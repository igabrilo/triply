"""Geocoding service – resolves place queries into lat/lng + Maps URLs.

Strategy:
  1. If GOOGLE_MAPS_API_KEY is set → use Google Places Text Search API
  2. Otherwise → build a Google Maps search URL from the query (no API key needed)

This lets the MVP work without a paid Maps API key while still producing
clickable map links. When a key is configured, plan items get real
lat/lng coordinates for rendering on the dashboard map.
"""

from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import quote_plus

import requests
from flask import current_app

logger = logging.getLogger(__name__)


def _google_maps_search_url(query: str) -> str:
    """Build a Google Maps search URL (works without API key)."""
    return f"https://www.google.com/maps/search/{quote_plus(query)}"


def _download_image_url(url: str):
    if not url:
        return None
    try:
        resp = requests.get(
            url,
            headers={
                'User-Agent': 'Triply/1.0 (travel-planner)',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
            timeout=12,
            allow_redirects=True,
        )
        content_type = resp.headers.get('Content-Type', 'image/jpeg').split(';')[0].strip()
        if resp.status_code == 200 and content_type.startswith('image/'):
            return resp.content, content_type
    except Exception as exc:
        logger.debug("Image download failed for %r: %s", url, exc)
    return None


def _fetch_wikimedia_place_photo(query: str, max_width: int = 640):
    cleaned = (query or '').strip()
    if not cleaned:
        return None
    # Reduce noisy address suffixes for better Wikipedia hit-rate.
    short_query = cleaned.split(',')[0].strip() or cleaned

    try:
        headers = {'User-Agent': 'Triply/1.0 (travel-planner)'}
        search_resp = requests.get(
            'https://en.wikipedia.org/w/api.php',
            params={
                'action': 'query',
                'list': 'search',
                'srsearch': short_query,
                'format': 'json',
                'srlimit': 1,
                'utf8': 1,
            },
            headers=headers,
            timeout=8,
        )
        search_json = search_resp.json()
        hits = (search_json.get('query') or {}).get('search') or []
        if not hits:
            return None
        title = hits[0].get('title')
        if not title:
            return None

        thumb_size = max(180, min(int(max_width or 640), 1200))
        thumb_resp = requests.get(
            'https://en.wikipedia.org/w/api.php',
            params={
                'action': 'query',
                'prop': 'pageimages',
                'titles': title,
                'pithumbsize': thumb_size,
                'format': 'json',
                'utf8': 1,
            },
            headers=headers,
            timeout=8,
        )
        thumb_json = thumb_resp.json()
        pages = ((thumb_json.get('query') or {}).get('pages') or {}).values()
        thumb_url = None
        for page in pages:
            thumb_url = (page.get('thumbnail') or {}).get('source')
            if thumb_url:
                break
        if not thumb_url:
            return None

        downloaded = _download_image_url(thumb_url)
        if downloaded:
            return downloaded
    except Exception as exc:
        logger.debug("Wikimedia photo fallback failed for %r: %s", query, exc)

    return None


def _fetch_wikimedia_commons_photo(query: str, max_width: int = 640):
    cleaned = (query or '').strip()
    if not cleaned:
        return None

    short_query = cleaned.split(',')[0].strip() or cleaned
    headers = {'User-Agent': 'Triply/1.0 (travel-planner)'}
    thumb_size = max(180, min(int(max_width or 640), 1200))

    try:
        search_resp = requests.get(
            'https://commons.wikimedia.org/w/api.php',
            params={
                'action': 'query',
                'list': 'search',
                'srsearch': short_query,
                'srnamespace': 6,
                'srlimit': 6,
                'format': 'json',
                'utf8': 1,
            },
            headers=headers,
            timeout=8,
        )
        search_json = search_resp.json()
        hits = (search_json.get('query') or {}).get('search') or []
        if not hits:
            return None

        for hit in hits:
            title = hit.get('title')
            if not title:
                continue
            info_resp = requests.get(
                'https://commons.wikimedia.org/w/api.php',
                params={
                    'action': 'query',
                    'prop': 'imageinfo',
                    'iiprop': 'url',
                    'iiurlwidth': thumb_size,
                    'titles': title,
                    'format': 'json',
                    'utf8': 1,
                },
                headers=headers,
                timeout=8,
            )
            info_json = info_resp.json()
            pages = ((info_json.get('query') or {}).get('pages') or {}).values()
            for page in pages:
                imageinfo = page.get('imageinfo') or []
                if not imageinfo:
                    continue
                candidate_url = imageinfo[0].get('thumburl') or imageinfo[0].get('url')
                downloaded = _download_image_url(candidate_url)
                if downloaded:
                    return downloaded
    except Exception as exc:
        logger.debug("Wikimedia Commons fallback failed for %r: %s", query, exc)

    return None


def _fetch_loremflickr_photo(query: str, max_width: int = 640, max_height: Optional[int] = None):
    cleaned = (query or '').strip()
    if not cleaned:
        return None
    width = max(120, min(int(max_width or 640), 1600))
    height = max(120, min(int(max_height), 1600)) if max_height else int(round(width * 0.65))
    short_query = cleaned.split(',')[0].strip() or cleaned
    url = f"https://loremflickr.com/{width}/{height}/{quote_plus(short_query)}"
    downloaded = _download_image_url(url)
    if downloaded:
        return downloaded
    return None


def _google_textsearch_first_result(query: str, api_key: str) -> Optional[dict]:
    if not query or not api_key:
        return None
    try:
        resp = requests.get(
            'https://maps.googleapis.com/maps/api/place/textsearch/json',
            params={'query': query, 'key': api_key},
            timeout=6,
        )
        data = resp.json()
        if data.get('status') == 'OK' and data.get('results'):
            return data['results'][0]
        logger.debug("Google Places returned status %r for %r", data.get('status'), query)
    except Exception as exc:
        logger.warning("Google Places text search failed for %r: %s", query, exc)
    return None


def _google_textsearch_first_result_new(query: str, api_key: str) -> Optional[dict]:
    if not query or not api_key:
        return None
    try:
        resp = requests.post(
            'https://places.googleapis.com/v1/places:searchText',
            headers={
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': api_key,
                'X-Goog-FieldMask': (
                    'places.id,places.displayName,places.formattedAddress,places.location,'
                    'places.googleMapsUri,places.photos.name'
                ),
            },
            json={'textQuery': query},
            timeout=6,
        )
        if resp.status_code != 200:
            logger.debug("Places API (New) status=%s for %r", resp.status_code, query)
            return None
        data = resp.json()
        places = data.get('places') or []
        if not places:
            return None
        return places[0]
    except Exception as exc:
        logger.warning("Places API (New) text search failed for %r: %s", query, exc)
    return None


def geocode_place(query: str) -> dict:
    """Resolve a place query into location data.

    Returns:
        {
            'lat': float | None,
            'lng': float | None,
            'address': str | None,
            'location_name': str | None,
            'place_id': str | None,
            'photo_query': str | None,
            'maps_url': str,
        }
    """
    api_key = current_app.config.get('GOOGLE_MAPS_API_KEY', '')

    result = {
        'lat': None,
        'lng': None,
        'address': None,
        'location_name': None,
        'place_id': None,
        'photo_query': query or None,
        'maps_url': _google_maps_search_url(query),
    }

    if api_key and query:
        place = _google_textsearch_first_result(query, api_key)
        if place:
            loc = place.get('geometry', {}).get('location', {})
            result['lat'] = loc.get('lat')
            result['lng'] = loc.get('lng')
            result['address'] = place.get('formatted_address')
            result['location_name'] = place.get('name')
            result['place_id'] = place.get('place_id')
            result['photo_query'] = place.get('name') or query
            result['maps_url'] = (
                f"https://www.google.com/maps/place/?q=place_id:{place.get('place_id', '')}"
                if place.get('place_id')
                else _google_maps_search_url(query)
            )
        else:
            place_new = _google_textsearch_first_result_new(query, api_key)
            if place_new:
                loc = place_new.get('location', {})
                display_name = (place_new.get('displayName') or {}).get('text')
                result['lat'] = loc.get('latitude')
                result['lng'] = loc.get('longitude')
                result['address'] = place_new.get('formattedAddress')
                result['location_name'] = display_name
                result['place_id'] = place_new.get('id')
                result['photo_query'] = display_name or query
                result['maps_url'] = place_new.get('googleMapsUri') or _google_maps_search_url(query)

    # Fallback: Nominatim (OpenStreetMap) – free, no API key required
    if result['lat'] is None and query:
        try:
            resp = requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={'q': query, 'format': 'json', 'limit': 1},
                headers={'User-Agent': 'Triply/1.0 (travel-planner)'},
                timeout=5,
            )
            places = resp.json()
            if places:
                place = places[0]
                result['lat'] = float(place['lat'])
                result['lng'] = float(place['lon'])
                display = place.get('display_name', '')
                result['location_name'] = display.split(',')[0].strip() if display else None
                # Shorten Nominatim's verbose display_name to city + country
                parts = [p.strip() for p in display.split(',')]
                non_postal = [p for p in parts if not any(c.isdigit() for c in p)]
                if len(non_postal) > 2:
                    result['address'] = ', '.join(non_postal[-2:])
                else:
                    result['address'] = ', '.join(non_postal)
        except Exception as exc:
            logger.warning("Nominatim geocoding failed for %r: %s", query, exc)

    return result


def reverse_geocode_city(lat: float, lng: float) -> Optional[str]:
    """Resolve lat/lng into a city name using Google Geocoding API.

    Returns the city name (e.g. "Zagreb, Croatia") or None if unavailable.
    Falls back to a free IP-based lookup when no Google API key is present.
    """
    api_key = current_app.config.get('GOOGLE_MAPS_API_KEY', '')

    if api_key:
        try:
            resp = requests.get(
                'https://maps.googleapis.com/maps/api/geocode/json',
                params={'latlng': f'{lat},{lng}', 'key': api_key, 'result_type': 'locality'},
                timeout=5,
            )
            data = resp.json()
            if data.get('status') == 'OK' and data.get('results'):
                components = data['results'][0].get('address_components', [])
                city = None
                country = None
                for comp in components:
                    types = comp.get('types', [])
                    if 'locality' in types:
                        city = comp.get('long_name')
                    elif 'country' in types:
                        country = comp.get('long_name')
                if city:
                    return f"{city}, {country}" if country else city
                return data['results'][0].get('formatted_address')
        except Exception as exc:
            logger.warning("Reverse geocode failed for (%s, %s): %s", lat, lng, exc)

    # Fallback: use free Nominatim (OpenStreetMap) reverse geocoding
    try:
        resp = requests.get(
            'https://nominatim.openstreetmap.org/reverse',
            params={'lat': lat, 'lon': lng, 'format': 'json', 'zoom': 10},
            headers={'User-Agent': 'Triply/1.0'},
            timeout=5,
        )
        data = resp.json()
        address = data.get('address', {})
        city = address.get('city') or address.get('town') or address.get('village') or address.get('municipality')
        country = address.get('country')
        if city:
            return f"{city}, {country}" if country else city
    except Exception as exc:
        logger.warning("Nominatim reverse geocode failed for (%s, %s): %s", lat, lng, exc)

    return None


def enrich_plan_items(days_data: list[dict]) -> list[dict]:
    """Enrich plan items with geocoded lat/lng and maps_url.

    Accepts the raw list of day dicts (with items) from the AI output
    and returns the same structure with location fields populated.
    """
    for day in days_data:
        for item in day.get('items', []):
            query = item.get('place_query') or item.get('title', '')
            if not query:
                continue
            geo = geocode_place(query)
            if geo['lat'] is not None:
                item['lat'] = geo['lat']
                item['lng'] = geo['lng']
            if geo['address']:
                item['address'] = geo['address']
            if geo['location_name']:
                item['location_name'] = geo['location_name']
            item['maps_url'] = geo['maps_url']
    return days_data


def enrich_stays(stays_data: list[dict]) -> list[dict]:
    """Enrich stay options with geocoded lat/lng."""
    for stay in stays_data:
        query = stay.get('place_query') or stay.get('name', '')
        if not query:
            continue
        geo = geocode_place(query)
        if geo['lat'] is not None:
            stay['lat'] = geo['lat']
            stay['lng'] = geo['lng']
        if geo.get('maps_url'):
            stay['maps_url'] = geo['maps_url']
        if geo.get('location_name'):
            stay['location_name'] = geo['location_name']
        if geo.get('address'):
            stay['address'] = geo['address']
        if geo.get('photo_query'):
            stay['image_query'] = geo['photo_query']
    return stays_data


def fetch_place_photo(query: str, max_width: int = 640, max_height: Optional[int] = None):
    """Fetch a real place photo from Google Places Photo API.

    Returns:
        tuple[bytes, content_type] or None when unavailable.
    """
    if not query:
        return None
    api_key = current_app.config.get('GOOGLE_MAPS_API_KEY', '')

    width = max(120, min(int(max_width or 640), 1600))
    height = max(120, min(int(max_height), 1600)) if max_height else None

    if api_key:
        # Legacy Places Photo API
        place = _google_textsearch_first_result(query, api_key)
        if place:
            photos = place.get('photos') or []
            photo_ref = photos[0].get('photo_reference') if photos else None
            if photo_ref:
                params = {
                    'photo_reference': photo_ref,
                    'maxwidth': width,
                    'key': api_key,
                }
                if height:
                    params['maxheight'] = height
                try:
                    resp = requests.get(
                        'https://maps.googleapis.com/maps/api/place/photo',
                        params=params,
                        allow_redirects=True,
                        timeout=10,
                    )
                    content_type = resp.headers.get('Content-Type', 'image/jpeg')
                    if resp.status_code == 200 and content_type.startswith('image/'):
                        return resp.content, content_type
                except Exception as exc:
                    logger.warning("Google Place Photo (legacy) fetch failed for %r: %s", query, exc)

        # Places API (New) photo flow
        place_new = _google_textsearch_first_result_new(query, api_key)
        if place_new:
            photos_new = place_new.get('photos') or []
            photo_name = photos_new[0].get('name') if photos_new else None
            if photo_name:
                params_new = {'maxWidthPx': width}
                if height:
                    params_new['maxHeightPx'] = height
                try:
                    resp_new = requests.get(
                        f'https://places.googleapis.com/v1/{photo_name}/media',
                        params=params_new,
                        headers={'X-Goog-Api-Key': api_key},
                        allow_redirects=True,
                        timeout=12,
                    )
                    content_type_new = resp_new.headers.get('Content-Type', '')
                    if resp_new.status_code == 200 and content_type_new.startswith('image/'):
                        return resp_new.content, content_type_new

                    if resp_new.status_code == 200 and 'application/json' in content_type_new:
                        payload = resp_new.json()
                        photo_uri = payload.get('photoUri')
                        downloaded = _download_image_url(photo_uri)
                        if downloaded:
                            return downloaded
                except Exception as exc:
                    logger.warning("Places API (New) photo fetch failed for %r: %s", query, exc)

    wiki_photo = _fetch_wikimedia_place_photo(query, max_width=width)
    if wiki_photo:
        return wiki_photo

    commons_photo = _fetch_wikimedia_commons_photo(query, max_width=width)
    if commons_photo:
        return commons_photo

    loremflickr_photo = _fetch_loremflickr_photo(query, max_width=width, max_height=height)
    if loremflickr_photo:
        return loremflickr_photo

    return None
