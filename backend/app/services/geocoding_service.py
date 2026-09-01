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
import re
import time
import unicodedata
from typing import Optional
from urllib.parse import quote_plus

import requests
from flask import current_app
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Nominatim allows max 1 request per second; throttle to avoid rate-limit HTML responses
_nominatim_last_request: float = 0

# Per-generation geocode cache to avoid duplicate lookups for the same query
_geocode_cache: dict[str, dict] = {}


def reset_geocode_cache():
    """Clear the geocode cache (call at the start of each trip generation)."""
    _geocode_cache.clear()

# Domains we allow image downloads from (SSRF protection)
_ALLOWED_IMAGE_DOMAINS = frozenset({
    'maps.googleapis.com',
    'places.googleapis.com',
    'lh3.googleusercontent.com',
    'upload.wikimedia.org',
    'commons.wikimedia.org',
    'en.wikipedia.org',
    'loremflickr.com',
})


_DESTINATION_ALIAS_MAP: dict[str, str] = {
    'tokio': 'Tokyo',
    'bec': 'Vienna',
    'wien': 'Vienna',
    'rim': 'Rome',
    'napulj': 'Naples',
    'munchen': 'Munich',
    'muenchen': 'Munich',
    'nyc': 'New York',
    'new york city': 'New York',
}

_DESTINATION_LANDMARKS_BY_KEY: dict[str, list[str]] = {
    'tokyo': ['Senso-ji Temple', 'Shibuya Crossing', 'Tokyo Tower', 'Tokyo Skytree'],
    'paris': ['Eiffel Tower', 'Louvre Museum', 'Arc de Triomphe'],
    'rome': ['Colosseum', "St. Peter's Basilica", 'Trevi Fountain'],
    'london': ['Big Ben', 'Tower Bridge', 'Buckingham Palace'],
    'barcelona': ['Sagrada Familia', 'Park Guell', 'Casa Batllo'],
    'vienna': ["St. Stephen's Cathedral Vienna", 'Schonbrunn Palace'],
    'prague': ['Charles Bridge', 'Prague Castle'],
    'budapest': ['Parliament Building Budapest', "Fisherman's Bastion"],
    'amsterdam': ['Rijksmuseum', 'Amsterdam Canal Houses'],
    'new york': ['Statue of Liberty', 'Times Square', 'Brooklyn Bridge'],
    'dubai': ['Burj Khalifa', 'Palm Jumeirah'],
    'istanbul': ['Hagia Sophia', 'Blue Mosque Istanbul'],
    'athens': ['Acropolis of Athens'],
    'lisbon': ['Belem Tower Lisbon', 'Alfama Lisbon'],
    'berlin': ['Brandenburg Gate', 'Berlin Cathedral'],
    'munich': ['Marienplatz Munich', 'Nymphenburg Palace'],
    'naples': ['Piazza del Plebiscito Naples', 'Castel dell Ovo'],
}


def _ascii_fold(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value or '')
    return normalized.encode('ascii', 'ignore').decode('ascii')


def _destination_key(value: str) -> str:
    folded = _ascii_fold(value).lower()
    return re.sub(r'[^a-z0-9]+', ' ', folded).strip()


def _normalize_destination_name(value: str) -> str:
    raw = re.sub(r'\s+', ' ', (value or '').strip())
    if not raw:
        return ''

    key = _destination_key(raw)
    alias = _DESTINATION_ALIAS_MAP.get(key)
    if alias:
        return alias

    # Normalize pure lower-case destination labels (e.g., "tokyo" -> "Tokyo")
    if raw == raw.lower():
        parts = [p.capitalize() for p in raw.split(' ') if p]
        if parts:
            return ' '.join(parts)
    return raw


def _build_destination_hero_queries(destination: str) -> list[str]:
    normalized = _normalize_destination_name(destination)
    if not normalized:
        normalized = 'travel destination'

    key = _destination_key(normalized)
    queries: list[str] = []

    def _add(query: str):
        cleaned = re.sub(r'\s+', ' ', (query or '').strip())
        if not cleaned:
            return
        if all(existing.lower() != cleaned.lower() for existing in queries):
            queries.append(cleaned)

    for landmark in _DESTINATION_LANDMARKS_BY_KEY.get(key, []):
        landmark_key = _destination_key(landmark)
        if key and key in landmark_key:
            _add(landmark)
        else:
            _add(f"{landmark} {normalized}")

    _add(f"{normalized} famous landmark")
    _add(f"{normalized} old town")
    _add(f"{normalized} skyline")
    _add(normalized)
    return queries[:6]


def _query_variants(query: str, destination: Optional[str] = None) -> list[str]:
    raw = (query or '').strip()
    if not raw:
        return []
    variants: list[str] = []

    def _add(value: str):
        v = re.sub(r'\s+', ' ', (value or '').strip())
        if not v:
            return
        if v.lower() == 'tokio':
            v = 'Tokyo'
        if v.lower().endswith(' tokio'):
            v = f"{v[:-6]} Tokyo".strip()
        if all(existing.lower() != v.lower() for existing in variants):
            variants.append(v)

    dest = (destination or '').strip()
    dest_lower = dest.lower()

    if dest and dest_lower not in raw.lower() and len(raw) < 60:
        _add(f"{raw}, {dest}")
        _add(f"{raw} {dest}")

    _add(raw)
    _add(raw.replace('Tokio', 'Tokyo').replace('tokio', 'tokyo'))
    no_paren = re.sub(r'\([^)]*\)', ' ', raw)
    _add(no_paren)
    no_slash = re.sub(r'[\\/|]', ' ', no_paren)
    _add(no_slash)
    before_comma = (raw.split(',', 1)[0] or '').strip()
    _add(before_comma)
    words = re.sub(r'[^A-Za-z0-9\\-\\s]', ' ', before_comma).split()
    if len(words) >= 2:
        _add(' '.join(words[:4]))
    return variants


def _google_maps_search_url(query: str) -> str:
    """Build a Google Maps search URL (works without API key)."""
    return f"https://www.google.com/maps/search/{quote_plus(query)}"


def _is_allowed_image_url(url: str) -> bool:
    """Check URL against domain allowlist to prevent SSRF."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        host = (parsed.hostname or '').lower()
        return host in _ALLOWED_IMAGE_DOMAINS
    except Exception:
        return False


def _download_image_url(url: str):
    if not url:
        return None
    if not _is_allowed_image_url(url):
        logger.warning("Blocked image download from disallowed domain: %s", urlparse(url).hostname)
        return None
    try:
        resp = requests.get(
            url,
            headers={
                'User-Agent': 'Triply/1.0 (travel-planner)',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
            timeout=12,
            allow_redirects=False,
        )
        # Follow redirects only to allowed domains
        if resp.status_code in (301, 302, 303, 307, 308):
            redirect_url = resp.headers.get('Location', '')
            if _is_allowed_image_url(redirect_url):
                resp = requests.get(
                    redirect_url,
                    headers={
                        'User-Agent': 'Triply/1.0 (travel-planner)',
                        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                    },
                    timeout=12,
                    allow_redirects=False,
                )
            else:
                logger.warning("Blocked redirect to disallowed domain: %s", urlparse(redirect_url).hostname)
                return None
        content_type = resp.headers.get('Content-Type', 'image/jpeg').split(';')[0].strip()
        if resp.status_code == 200 and content_type.startswith('image/'):
            return resp.content, content_type
    except Exception as exc:
        logger.debug("Image download failed for %r: %s", url, exc)
    return None


def _fetch_wikimedia_place_photo(query: str, max_width: int = 640, destination: Optional[str] = None):
    cleaned = (query or '').strip()
    if not cleaned:
        return None
    short_query = cleaned.split(',')[0].strip() or cleaned
    dest = (destination or '').strip()
    candidates: list[str] = []
    if dest and dest.lower() not in short_query.lower():
        candidates.append(f"{short_query} {dest}")
    candidates.append(short_query)
    if ' city' not in short_query.lower():
        candidates.append(f"{short_query} city")

    try:
        headers = {'User-Agent': 'Triply/1.0 (travel-planner)'}
        thumb_size = max(180, min(int(max_width or 640), 2560))
        for candidate in candidates:
            search_resp = requests.get(
                'https://en.wikipedia.org/w/api.php',
                params={
                    'action': 'query',
                    'list': 'search',
                    'srsearch': candidate,
                    'format': 'json',
                    'srlimit': 1,
                    'utf8': 1,
                },
                headers=headers,
                timeout=8,
            )
            if search_resp.status_code == 429:
                time.sleep(1.5)
                search_resp = requests.get(
                    'https://en.wikipedia.org/w/api.php',
                    params={'action': 'query', 'list': 'search', 'srsearch': candidate, 'format': 'json', 'srlimit': 1, 'utf8': 1},
                    headers=headers, timeout=8,
                )
            if search_resp.status_code != 200:
                continue
            search_json = search_resp.json()
            hits = (search_json.get('query') or {}).get('search') or []
            if not hits:
                continue
            title = hits[0].get('title')
            if not title:
                continue

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
            if thumb_resp.status_code == 429:
                time.sleep(1.5)
                thumb_resp = requests.get(
                    'https://en.wikipedia.org/w/api.php',
                    params={'action': 'query', 'prop': 'pageimages', 'titles': title, 'pithumbsize': thumb_size, 'format': 'json', 'utf8': 1},
                    headers=headers, timeout=8,
                )
            if thumb_resp.status_code != 200:
                continue
            thumb_json = thumb_resp.json()
            pages = ((thumb_json.get('query') or {}).get('pages') or {}).values()
            thumb_url = None
            for page in pages:
                thumb_url = (page.get('thumbnail') or {}).get('source')
                if thumb_url:
                    break
            if not thumb_url:
                continue

            downloaded = _download_image_url(thumb_url)
            if downloaded:
                return downloaded
    except Exception as exc:
        logger.debug("Wikimedia photo fallback failed for %r: %s", query, exc)

    return None


def _fetch_wikimedia_commons_photo(query: str, max_width: int = 640, destination: Optional[str] = None):
    cleaned = (query or '').strip()
    if not cleaned:
        return None

    dest = (destination or '').strip()
    base_short = cleaned.split(',')[0].strip() or cleaned
    short_query = f"{base_short} {dest}" if dest and dest.lower() not in base_short.lower() else base_short
    headers = {'User-Agent': 'Triply/1.0 (travel-planner)'}
    thumb_size = max(180, min(int(max_width or 640), 2560))

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
        if search_resp.status_code == 429:
            time.sleep(1.5)
            search_resp = requests.get(
                'https://commons.wikimedia.org/w/api.php',
                params={'action': 'query', 'list': 'search', 'srsearch': short_query, 'srnamespace': 6, 'srlimit': 6, 'format': 'json', 'utf8': 1},
                headers=headers, timeout=8,
            )
        if search_resp.status_code != 200:
            return None
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
            if info_resp.status_code == 429:
                time.sleep(1.5)
                info_resp = requests.get(
                    'https://commons.wikimedia.org/w/api.php',
                    params={'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': thumb_size, 'titles': title, 'format': 'json', 'utf8': 1},
                    headers=headers, timeout=8,
                )
            if info_resp.status_code != 200:
                continue
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


def _extract_place_from_query(query: str) -> str:
    """Extract place name from 'Label: PlaceName' format for better geocoding."""
    raw = (query or '').strip()
    if ':' in raw:
        after_colon = raw.split(':', 1)[-1].strip()
        if len(after_colon) > 3:
            return after_colon
    return raw


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
    query = _extract_place_from_query(query)

    # Return cached result if available (avoids duplicate API calls within a generation)
    cache_key = query.strip().lower()
    if cache_key in _geocode_cache:
        logger.debug("Geocode cache hit for %r", query)
        return _geocode_cache[cache_key]

    result = {
        'lat': None,
        'lng': None,
        'address': None,
        'location_name': None,
        'place_id': None,
        'photo_reference': None,
        'photo_name': None,
        'photo_query': query or None,
        'maps_url': _google_maps_search_url(query),
    }

    if api_key and query:
        # New Places API v1 first (Google-preferred, returns photo_name for higher-quality photos)
        place_new = _google_textsearch_first_result_new(query, api_key)
        if place_new:
            loc = place_new.get('location', {})
            display_name = (place_new.get('displayName') or {}).get('text')
            result['lat'] = loc.get('latitude')
            result['lng'] = loc.get('longitude')
            result['address'] = place_new.get('formattedAddress')
            result['location_name'] = display_name
            result['place_id'] = place_new.get('id')
            photos_new = place_new.get('photos') or []
            if photos_new:
                result['photo_name'] = photos_new[0].get('name')
            result['photo_query'] = display_name or query
            result['maps_url'] = place_new.get('googleMapsUri') or _google_maps_search_url(query)
        else:
            # Legacy Places API as fallback
            place = _google_textsearch_first_result(query, api_key)
            if place:
                loc = place.get('geometry', {}).get('location', {})
                result['lat'] = loc.get('lat')
                result['lng'] = loc.get('lng')
                result['address'] = place.get('formatted_address')
                result['location_name'] = place.get('name')
                result['place_id'] = place.get('place_id')
                photos = place.get('photos') or []
                if photos:
                    result['photo_reference'] = photos[0].get('photo_reference')
                result['photo_query'] = place.get('name') or query
                result['maps_url'] = (
                    f"https://www.google.com/maps/place/?q=place_id:{place.get('place_id', '')}"
                    if place.get('place_id')
                    else _google_maps_search_url(query)
                )

    # Fallback: Nominatim (OpenStreetMap) – free, max 1 req/sec
    if result['lat'] is None and query:
        try:
            global _nominatim_last_request
            elapsed = time.monotonic() - _nominatim_last_request
            if elapsed < 1.0:
                time.sleep(1.0 - elapsed)
            _nominatim_last_request = time.monotonic()

            resp = requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={'q': query, 'format': 'json', 'limit': 1},
                headers={'User-Agent': 'Triply/1.0 (travel-planner)'},
                timeout=5,
            )
            if resp.status_code != 200:
                logger.debug("Nominatim returned %s for %r", resp.status_code, query)
            elif 'application/json' not in (resp.headers.get('Content-Type') or ''):
                logger.debug("Nominatim returned non-JSON for %r (likely rate-limited)", query)
            else:
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

    _geocode_cache[cache_key] = result
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

    # Fallback: use free Nominatim (OpenStreetMap) reverse geocoding, max 1 req/sec
    try:
        global _nominatim_last_request
        elapsed = time.monotonic() - _nominatim_last_request
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        _nominatim_last_request = time.monotonic()

        resp = requests.get(
            'https://nominatim.openstreetmap.org/reverse',
            params={'lat': lat, 'lon': lng, 'format': 'json', 'zoom': 10},
            headers={'User-Agent': 'Triply/1.0'},
            timeout=5,
        )
        if resp.status_code != 200 or 'application/json' not in (resp.headers.get('Content-Type') or ''):
            return None
        data = resp.json()
        address = data.get('address', {})
        city = address.get('city') or address.get('town') or address.get('village') or address.get('municipality')
        country = address.get('country')
        if city:
            return f"{city}, {country}" if country else city
    except Exception as exc:
        logger.warning("Nominatim reverse geocode failed for (%s, %s): %s", lat, lng, exc)

    return None


_TICKET_CATEGORIES = {'activity', 'landmark', 'shopping', 'nightlife'}
_DINING_CATEGORIES = {'dining'}
_SKIP_LINK_CATEGORIES = {'transport'}


def _build_attraction_link(query: str, category: str | None) -> tuple[str, str] | None:
    """Return (url, label) for a tickets / reservation search, or None for transport."""
    cat = (category or '').lower().strip()
    if cat in _SKIP_LINK_CATEGORIES:
        return None
    safe = quote_plus(query.strip())
    if cat in _DINING_CATEGORIES:
        return (f"https://www.google.com/search?q={safe}+reservation", 'Reserve')
    return (f"https://www.google.com/search?q={safe}+tickets", 'Tickets')


def _transport_image_query(place_query: str, title: str, destination: str) -> str:
    """Build an image search query for transport items that yields a real photo.

    For flights/airports → query the airport name so we get a terminal photo.
    For transfers/hotels → query the destination area so we get a scenic arrival shot.
    """
    combined = f"{place_query} {title}".lower()
    dest = (destination or '').strip()

    # Flight / airport items
    flight_keywords = ('fly ', 'flight', 'airport', 'airline', 'depart', 'arrive', ' nan', ' cdg', ' lhr', ' jfk', '→', '->')
    if any(kw in combined for kw in flight_keywords):
        # Prefer the airport name from place_query if it looks like one
        if 'airport' in place_query.lower():
            return place_query
        if dest:
            return f"{dest} international airport"
        return place_query or title

    # Transfer / hotel / check-in items
    transfer_keywords = ('transfer', 'check-in', 'check in', 'hotel', 'resort', 'accommodation')
    if any(kw in combined for kw in transfer_keywords):
        if dest:
            return f"{dest} hotel resort"
        return place_query or title

    # Generic transport (bus, train, ferry, etc.)
    if dest:
        return f"{dest} travel"
    return place_query or title


def enrich_plan_items(days_data: list[dict], destination_hint: str = '', trip_id: Optional[str] = None) -> list[dict]:
    """Enrich plan items with geocoded lat/lng, maps_url, photo metadata, and cached images.

    Accepts the raw list of day dicts (with items) from the AI output
    and returns the same structure with location and image fields populated.
    """
    dest = (destination_hint or '').strip()
    for day in days_data:
        day_idx = day.get('dayIndex', day.get('day_index', 0))
        for item_idx, item in enumerate(day.get('items', [])):
            query = item.get('place_query') or item.get('title', '')
            if not query:
                continue
            search_query = query
            if dest and dest.lower() not in query.lower():
                search_query = f"{query}, {dest}"
            geo = geocode_place(search_query)
            if geo['lat'] is not None:
                item['lat'] = geo['lat']
                item['lng'] = geo['lng']
            if geo['address']:
                item['address'] = geo['address']
            if geo['location_name']:
                item['location_name'] = geo['location_name']
            item['maps_url'] = geo['maps_url']

            # Store photo metadata for image fetching
            if geo.get('place_id'):
                item['place_id'] = geo['place_id']
            if geo.get('photo_reference'):
                item['photo_reference'] = geo['photo_reference']
            if geo.get('photo_name'):
                item['photo_name'] = geo['photo_name']
            if geo.get('photo_query'):
                item['image_query'] = geo['photo_query']

            # Cache image during enrichment
            item_id = item.get('id') or f"day_{day_idx}_item_{item_idx}"
            item['id'] = item_id
            category = (item.get('category') or '').lower().strip()
            if trip_id:
                image_query = _transport_image_query(query, item.get('title', ''), dest) if category == 'transport' else query
                cached_url = _resolve_and_cache_image(
                    trip_id, 'activity', str(item_id), image_query, dest,
                    place_id=geo.get('place_id'),
                    photo_reference=geo.get('photo_reference'),
                    photo_name=geo.get('photo_name'),
                    allow_random_fallback=True,
                )
                if cached_url:
                    item['cached_image_url'] = cached_url

            # Generate a tickets / reservation search link when the AI didn't supply one
            if not item.get('external_url'):
                link = _build_attraction_link(query, item.get('category'))
                if link:
                    item['external_url'] = link[0]
                    item['external_url_label'] = link[1]
    return days_data


def _resolve_and_cache_image(
    trip_id: Optional[str],
    item_type: str,
    item_id: str,
    query: str,
    destination_hint: str = '',
    place_id: Optional[str] = None,
    photo_reference: Optional[str] = None,
    photo_name: Optional[str] = None,
    allow_random_fallback: bool = False,
) -> Optional[str]:
    """Fetch a place photo and permanently cache it to Supabase Storage.

    Returns the cached public URL, or None if caching is unavailable.
    """
    if not trip_id:
        return None
    photo = fetch_place_photo(
        query,
        max_width=640,
        place_id=place_id,
        photo_reference=photo_reference,
        photo_name=photo_name,
        allow_random_fallback=allow_random_fallback,
        destination_hint=destination_hint or None,
    )
    if not photo:
        return None
    image_bytes, content_type = photo
    try:
        from app.services.image_storage_service import upload_trip_image
        return upload_trip_image(trip_id, item_type, item_id, image_bytes, content_type)
    except Exception as exc:
        logger.debug("Image cache upload failed for %s/%s/%s: %s", trip_id, item_type, item_id, exc)
        return None


def enrich_activities(activities_data: list[dict], destination_hint: str = '', trip_id: Optional[str] = None) -> list[dict]:
    """Enrich activities with geocoded data and photo references (parallel to enrich_stays)."""
    dest = (destination_hint or '').strip()
    for activity in activities_data:
        query = activity.get('place_query') or activity.get('title', '')
        if not query:
            continue
        search_query = query
        if dest and dest.lower() not in query.lower():
            search_query = f"{query}, {dest}"
        geo = geocode_place(search_query)
        if geo.get('lat') is not None:
            activity.setdefault('lat', geo['lat'])
            activity.setdefault('lng', geo['lng'])
        if geo.get('maps_url'):
            activity.setdefault('maps_url', geo['maps_url'])
        if geo.get('location_name'):
            activity.setdefault('location_name', geo['location_name'])
        if geo.get('address'):
            activity.setdefault('address', geo['address'])
        if geo.get('place_id'):
            activity['place_id'] = geo['place_id']
        if geo.get('photo_reference'):
            activity['photo_reference'] = geo['photo_reference']
        if geo.get('photo_name'):
            activity['photo_name'] = geo['photo_name']
        if geo.get('photo_query'):
            activity['image_query'] = geo['photo_query']

        act_id = activity.get('id', '')
        if trip_id and act_id:
            cached_url = _resolve_and_cache_image(
                trip_id, 'activity', str(act_id), query, dest,
                place_id=geo.get('place_id'),
                photo_reference=geo.get('photo_reference'),
                photo_name=geo.get('photo_name'),
                allow_random_fallback=True,
            )
            if cached_url:
                activity['cached_image_url'] = cached_url
    return activities_data


def enrich_stays(stays_data: list[dict], trip_id: Optional[str] = None, destination_hint: str = '') -> list[dict]:
    """Enrich stay options with geocoded lat/lng."""
    dest = (destination_hint or '').strip()
    for idx, stay in enumerate(stays_data):
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
        if geo.get('place_id'):
            stay['place_id'] = geo['place_id']
        if geo.get('photo_reference'):
            stay['photo_reference'] = geo['photo_reference']
        if geo.get('photo_name'):
            stay['photo_name'] = geo['photo_name']
        if geo.get('photo_query'):
            stay['image_query'] = geo['photo_query']

        if trip_id:
            stay_id = stay.get('id') or f'stay_{idx}'
            cached_url = _resolve_and_cache_image(
                trip_id, 'stay', str(stay_id), query, dest,
                place_id=geo.get('place_id'),
                photo_reference=geo.get('photo_reference'),
                photo_name=geo.get('photo_name'),
                allow_random_fallback=True,
            )
            if cached_url:
                stay['cached_image_url'] = cached_url
    return stays_data


def _fetch_google_place_photo_legacy(photo_reference: str, api_key: str, width: int, height: Optional[int] = None):
    if not photo_reference or not api_key:
        return None
    params = {
        'photo_reference': photo_reference,
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
        logger.warning("Google Place Photo (legacy) fetch by reference failed: %s", exc)
    return None


def _fetch_google_place_photo_new(photo_name: str, api_key: str, width: int, height: Optional[int] = None):
    if not photo_name or not api_key:
        return None
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
        logger.warning("Places API (New) photo fetch by name failed: %s", exc)
    return None


def _google_place_details_photo_reference(place_id: str, api_key: str) -> Optional[str]:
    if not place_id or not api_key:
        return None
    try:
        resp = requests.get(
            'https://maps.googleapis.com/maps/api/place/details/json',
            params={
                'place_id': place_id,
                'fields': 'photo',
                'key': api_key,
            },
            timeout=8,
        )
        payload = resp.json()
        result = payload.get('result') or {}
        photos = result.get('photos') or []
        if photos:
            return photos[0].get('photo_reference')
    except Exception as exc:
        logger.warning("Google Place Details photo reference fetch failed for %r: %s", place_id, exc)
    return None


def fetch_destination_hero_photo(
    destination: str,
    max_width: int = 1600,
    max_height: Optional[int] = 900,
):
    """Fetch a recognizable hero photo for a destination.

    The strategy is deterministic: try landmark-first queries with random
    fallback disabled, then allow random fallback only as the last resort.
    """
    queries = _build_destination_hero_queries(destination)
    if not queries:
        return None

    for query in queries:
        photo = fetch_place_photo(
            query,
            max_width=max_width,
            max_height=max_height,
            allow_random_fallback=False,
        )
        if photo:
            return photo

    # Last resort – use LoremFlickr for a relevant travel photo.
    return fetch_place_photo(
        queries[0],
        max_width=max_width,
        max_height=max_height,
        allow_random_fallback=True,
    )


def fetch_place_photo(
    query: str,
    max_width: int = 640,
    max_height: Optional[int] = None,
    place_id: Optional[str] = None,
    photo_reference: Optional[str] = None,
    photo_name: Optional[str] = None,
    allow_random_fallback: bool = True,
    destination_hint: Optional[str] = None,
):
    """Fetch a real place photo from Google Places Photo API.

    Returns:
        tuple[bytes, content_type] or None when unavailable.
    """
    if not (query or place_id or photo_reference or photo_name):
        return None
    api_key = current_app.config.get('GOOGLE_MAPS_API_KEY', '')
    query_candidates = _query_variants(query or '', destination=destination_hint)

    width = max(120, min(int(max_width or 640), 4800))
    height = max(120, min(int(max_height), 4800)) if max_height else None

    if api_key:
        if photo_name:
            photo_from_name = _fetch_google_place_photo_new(photo_name, api_key, width, height)
            if photo_from_name:
                return photo_from_name

        if photo_reference:
            photo_from_ref = _fetch_google_place_photo_legacy(photo_reference, api_key, width, height)
            if photo_from_ref:
                return photo_from_ref

        if place_id:
            # Try new API first using place_id as a direct resource name
            place_new_by_id = _google_textsearch_first_result_new(place_id, api_key)
            if place_new_by_id:
                photos_by_id = place_new_by_id.get('photos') or []
                photo_name_by_id = photos_by_id[0].get('name') if photos_by_id else None
                if photo_name_by_id:
                    photo_from_new_id = _fetch_google_place_photo_new(photo_name_by_id, api_key, width, height)
                    if photo_from_new_id:
                        return photo_from_new_id
            # Legacy fallback via Place Details
            resolved_ref = _google_place_details_photo_reference(place_id, api_key)
            if resolved_ref:
                photo_from_place_id = _fetch_google_place_photo_legacy(resolved_ref, api_key, width, height)
                if photo_from_place_id:
                    return photo_from_place_id

        # New Places API v1 first, legacy as fallback, per query candidate
        for candidate in query_candidates:
            place_new = _google_textsearch_first_result_new(candidate, api_key)
            if place_new:
                photos_new = place_new.get('photos') or []
                photo_name_candidate = photos_new[0].get('name') if photos_new else None
                if photo_name_candidate:
                    from_query_name = _fetch_google_place_photo_new(photo_name_candidate, api_key, width, height)
                    if from_query_name:
                        return from_query_name

            place = _google_textsearch_first_result(candidate, api_key)
            if place:
                photos = place.get('photos') or []
                photo_ref = photos[0].get('photo_reference') if photos else None
                if photo_ref:
                    from_query_ref = _fetch_google_place_photo_legacy(photo_ref, api_key, width, height)
                    if from_query_ref:
                        return from_query_ref

    if query_candidates:
        for candidate in query_candidates:
            wiki_photo = _fetch_wikimedia_place_photo(candidate, max_width=width, destination=destination_hint)
            if wiki_photo:
                return wiki_photo

        for candidate in query_candidates:
            commons_photo = _fetch_wikimedia_commons_photo(candidate, max_width=width, destination=destination_hint)
            if commons_photo:
                return commons_photo

        if allow_random_fallback:
            for candidate in query_candidates:
                loremflickr_photo = _fetch_loremflickr_photo(candidate, max_width=width, max_height=height)
                if loremflickr_photo:
                    return loremflickr_photo

    return None
