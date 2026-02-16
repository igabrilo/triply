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


def geocode_place(query: str) -> dict:
    """Resolve a place query into location data.

    Returns:
        {
            'lat': float | None,
            'lng': float | None,
            'address': str | None,
            'location_name': str | None,
            'maps_url': str,
        }
    """
    api_key = current_app.config.get('GOOGLE_MAPS_API_KEY', '')

    result = {
        'lat': None,
        'lng': None,
        'address': None,
        'location_name': None,
        'maps_url': _google_maps_search_url(query),
    }

    if not api_key or not query:
        return result

    try:
        resp = requests.get(
            'https://maps.googleapis.com/maps/api/place/textsearch/json',
            params={'query': query, 'key': api_key},
            timeout=5,
        )
        data = resp.json()
        if data.get('status') == 'OK' and data.get('results'):
            place = data['results'][0]
            loc = place.get('geometry', {}).get('location', {})
            result['lat'] = loc.get('lat')
            result['lng'] = loc.get('lng')
            result['address'] = place.get('formatted_address')
            result['location_name'] = place.get('name')
            result['maps_url'] = (
                f"https://www.google.com/maps/place/?q=place_id:{place.get('place_id', '')}"
                if place.get('place_id')
                else _google_maps_search_url(query)
            )
    except Exception as exc:
        logger.warning("Geocoding failed for %r: %s", query, exc)

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
    return stays_data
