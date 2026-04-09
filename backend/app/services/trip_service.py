import logging
import uuid
from copy import deepcopy
from datetime import date, datetime, timezone
from urllib.parse import quote_plus
import hashlib
import math
import re
import unicodedata

from app import db
from app.models.trip import Trip
from app.models.trip_day import TripDay
from app.models.plan_item import PlanItem
from app.models.flight_option import FlightOption
from app.models.stay_option import StayOption
from app.models.trip_generation_run import TripGenerationRun
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

logger = logging.getLogger(__name__)


def _build_booking_search_url(
    name: str | None,
    neighborhood: str | None,
    destination: str | None,
    checkin: date | None,
    checkout: date | None,
    adults: int | None,
) -> str:
    """Build a Booking.com search-results URL with dates pre-filled.

    Using a search URL (instead of a direct property page) means users always
    land on a page showing *available* properties for their exact dates, even
    if the AI-suggested property has no vacancy.
    """
    parts = [p for p in [name, neighborhood, destination] if p and p.strip()]
    search_query = ', '.join(parts) if parts else (destination or 'hotel')
    params = [f"ss={quote_plus(search_query)}", "no_rooms=1"]
    if checkin:
        params.append(f"checkin={checkin.isoformat()}")
    if checkout:
        params.append(f"checkout={checkout.isoformat()}")
    params.append(f"group_adults={max(1, int(adults or 1))}")
    return "https://www.booking.com/searchresults.html?" + "&".join(params)


_DESTINATION_COORD_FALLBACKS: dict[str, tuple[float, float]] = {
    'tokyo': (35.6764, 139.6500),
    'paris': (48.8566, 2.3522),
    'rome': (41.9028, 12.4964),
    'vienna': (48.2082, 16.3738),
    'london': (51.5072, -0.1276),
    'barcelona': (41.3874, 2.1686),
    'amsterdam': (52.3676, 4.9041),
    'budapest': (47.4979, 19.0402),
    'prague': (50.0755, 14.4378),
    'new york': (40.7128, -74.0060),
    'berlin': (52.5200, 13.4050),
    'munich': (48.1351, 11.5820),
    'naples': (40.8518, 14.2681),
}

_DESTINATION_ALIAS_KEYS: dict[str, str] = {
    'tokio': 'tokyo',
    'bec': 'vienna',
    'wien': 'vienna',
    'rim': 'rome',
    'pariz': 'paris',
    'napulj': 'naples',
    'munchen': 'munich',
    'muenchen': 'munich',
    'nyc': 'new york',
}


def _constraints_snapshot(trip: Trip) -> dict:
    base = trip.constraints if isinstance(trip.constraints, dict) else {}
    return deepcopy(base)


def _commit_constraints(trip: Trip, constraints: dict) -> None:
    trip.constraints = constraints
    flag_modified(trip, 'constraints')
    db.session.commit()


def _dedupe_text_values(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for raw in values:
        normalized = re.sub(r'\s+', ' ', str(raw or '').strip())
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(normalized)
    return deduped


def _match_text(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', ' ', str(value or '').lower()).strip()


def _ascii_fold(value: str) -> str:
    return unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode('ascii')


def _destination_match_tokens(destination_hint: str) -> set[str]:
    primary = re.sub(r'\s+', ' ', str(destination_hint or '').strip()).split(',', 1)[0].strip()
    if not primary:
        return set()
    folded = _ascii_fold(primary).lower()
    primary_match = _match_text(folded)
    if not primary_match:
        return set()
    canonical = _DESTINATION_ALIAS_KEYS.get(primary_match, primary_match)
    return {primary_match, canonical}


def _geo_matches_destination(destination_hint: str, geo: dict, query: str) -> bool:
    tokens = _destination_match_tokens(destination_hint)
    if not tokens:
        return True
    geo_match_text = _match_text(f"{geo.get('location_name') or ''} {geo.get('address') or ''}")
    query_match_text = _match_text(query)
    for token in tokens:
        if token and token in geo_match_text:
            return True
    # Allow plain destination query as final fallback.
    for token in tokens:
        if token and query_match_text == token:
            return True
    return False


def _spread_fallback_coords(base_lat: float, base_lng: float, seed_text: str) -> tuple[float, float]:
    seed = str(seed_text or 'activity').encode('utf-8', errors='ignore')
    digest = hashlib.sha1(seed).hexdigest()
    angle_ratio = int(digest[:8], 16) / float(0xFFFFFFFF)
    radius_ratio = int(digest[8:16], 16) / float(0xFFFFFFFF)
    angle = angle_ratio * 2 * math.pi
    radius_deg = 0.002 + (radius_ratio * 0.010)  # ~0.2km to ~1.2km radial spread
    lat_offset = radius_deg * math.cos(angle)
    cos_lat = max(0.25, math.cos(math.radians(base_lat)))
    lng_offset = (radius_deg * math.sin(angle)) / cos_lat
    return round(base_lat + lat_offset, 6), round(base_lng + lng_offset, 6)


def _destination_fallback_coords(destination_hint: str) -> tuple[float, float] | None:
    tokens = _destination_match_tokens(destination_hint)
    if not tokens:
        return None
    for token in tokens:
        coords = _DESTINATION_COORD_FALLBACKS.get(token)
        if coords:
            return coords
    return None


def _build_activity_geocode_queries(activity: dict, destination_hint: str) -> list[str]:
    base = _dedupe_text_values([
        str(activity.get('place_query') or ''),
        str(activity.get('location_name') or ''),
        str(activity.get('address') or ''),
        str(activity.get('title') or ''),
    ])
    destination = re.sub(r'\s+', ' ', str(destination_hint or '').strip())
    if not destination:
        return base

    destination_lower = destination.lower()
    combined: list[str] = []
    for query in base:
        if destination_lower in query.lower():
            combined.append(query)
        else:
            combined.append(f"{query}, {destination}")
    return _dedupe_text_values(combined + base + [destination])


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _best_insert_index(existing_items: list[PlanItem], new_lat: float | None, new_lng: float | None) -> int:
    """Find the position where inserting the new activity minimises total route distance.

    Falls back to appending at the end if coords are missing.
    """
    if new_lat is None or new_lng is None:
        return len(existing_items)

    geo_items = [(i, it) for i, it in enumerate(existing_items) if it.lat is not None and it.lng is not None]
    if not geo_items:
        return len(existing_items)

    n = len(existing_items)
    best_idx = n
    best_cost = float('inf')

    for pos in range(n + 1):
        cost = 0.0
        prev_lat, prev_lng = None, None
        for i in range(n + 1):
            if i == pos:
                cur_lat, cur_lng = new_lat, new_lng
            elif i < pos:
                cur_lat, cur_lng = existing_items[i].lat, existing_items[i].lng
            else:
                cur_lat, cur_lng = existing_items[i - 1].lat, existing_items[i - 1].lng

            if prev_lat is not None and cur_lat is not None and prev_lng is not None and cur_lng is not None:
                cost += _haversine_km(prev_lat, prev_lng, cur_lat, cur_lng)
            prev_lat, prev_lng = cur_lat, cur_lng

        if cost < best_cost:
            best_cost = cost
            best_idx = pos

    return best_idx


def _resolve_activity_geo_fields(activity: dict, destination_hint: str):
    maps_url = activity.get('maps_url')
    location_name = activity.get('location_name') or activity.get('place_query')
    address = activity.get('address')
    lat = activity.get('lat')
    lng = activity.get('lng')

    needs_geocoding = (
        not maps_url
        or lat is None
        or lng is None
        or not location_name
        or not address
    )
    if not needs_geocoding:
        return maps_url, location_name, address, lat, lng

    try:
        from app.services.geocoding_service import geocode_place
    except Exception:
        return maps_url, location_name, address, lat, lng

    for query in _build_activity_geocode_queries(activity, destination_hint):
        try:
            geo = geocode_place(query)
        except Exception:
            continue
        if not geo:
            continue
        if not _geo_matches_destination(destination_hint, geo, query):
            continue
        maps_url = maps_url or geo.get('maps_url')
        location_name = location_name or geo.get('location_name')
        address = address or geo.get('address')
        if lat is None and geo.get('lat') is not None:
            lat = geo.get('lat')
        if lng is None and geo.get('lng') is not None:
            lng = geo.get('lng')
        if maps_url and location_name and address and lat is not None and lng is not None:
            break

    if (lat is None or lng is None) and destination_hint:
        fallback = _destination_fallback_coords(destination_hint)
        if fallback:
            spread_seed = (
                str(activity.get('id') or '')
                or str(activity.get('place_query') or '')
                or str(activity.get('title') or '')
                or str(activity.get('location_name') or '')
                or 'activity'
            )
            spread_lat, spread_lng = _spread_fallback_coords(fallback[0], fallback[1], spread_seed)
            lat = spread_lat if lat is None else lat
            lng = spread_lng if lng is None else lng
            location_name = location_name or destination_hint
            maps_url = maps_url or f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"

    return maps_url, location_name, address, lat, lng


def _resolve_activity_cached_image(trip: Trip, activity: dict, destination_hint: str) -> str | None:
    cached_url = (activity.get('cached_image_url') or activity.get('cachedImageUrl') or '').strip()
    if cached_url:
        return cached_url

    query = (
        activity.get('image_query')
        or activity.get('imageQuery')
        or activity.get('place_query')
        or activity.get('location_name')
        or activity.get('address')
        or activity.get('title')
        or ''
    )
    query = str(query).strip()
    if not query:
        return None

    try:
        from app.services.geocoding_service import _resolve_and_cache_image
        activity_id = str(activity.get('id') or uuid.uuid4())
        return _resolve_and_cache_image(
            str(trip.id),
            'activity',
            activity_id,
            query,
            destination_hint,
            place_id=activity.get('place_id') or activity.get('placeId'),
            photo_reference=activity.get('photo_reference') or activity.get('photoReference'),
            photo_name=activity.get('photo_name') or activity.get('photoName'),
        )
    except Exception:
        logger.debug("Skipping activity image cache for trip %s", trip.id, exc_info=True)
        return None


def _resolve_plan_item_cached_image(trip: Trip, day_data: dict, item_data: dict, item_index: int) -> str | None:
    cached_url = (item_data.get('cachedImageUrl') or item_data.get('cached_image_url') or '').strip()
    if cached_url:
        return cached_url

    query = (
        item_data.get('imageQuery')
        or item_data.get('image_query')
        or item_data.get('placeQuery')
        or item_data.get('place_query')
        or item_data.get('locationName')
        or item_data.get('location_name')
        or item_data.get('address')
        or item_data.get('title')
        or ''
    )
    query = str(query).strip()
    if not query:
        return None

    item_id_hint = item_data.get('id')
    if not item_id_hint:
        day_idx = day_data.get('dayIndex', day_data.get('day_index', 0))
        item_id_hint = f"day_{day_idx}_item_{item_index}"

    destination_hint = str(trip.destination or '').strip()
    try:
        from app.services.geocoding_service import _resolve_and_cache_image
        return _resolve_and_cache_image(
            str(trip.id),
            'activity',
            str(item_id_hint),
            query,
            destination_hint,
            place_id=item_data.get('placeId') or item_data.get('place_id'),
            photo_reference=item_data.get('photoReference') or item_data.get('photo_reference'),
            photo_name=item_data.get('photoName') or item_data.get('photo_name'),
        )
    except Exception:
        logger.debug("Skipping plan-item image cache for trip %s", trip.id, exc_info=True)
        return None


class TripService:
    """Service for trip CRUD operations against the normalized schema."""

    # ------------------------------------------------------------------
    # Create (from form only – AI generation happens via SSE route)
    # ------------------------------------------------------------------
    @staticmethod
    def create_trip_record(user_id: str, form_data: dict) -> Trip:
        """Create a bare trip record in 'generating' status.

        The AI generation pipeline fills in days/flights/stays
        afterwards via the SSE streaming endpoint.
        """
        destinations = form_data.get('destinations', [])
        destination_str = ', '.join(destinations) if isinstance(destinations, list) else str(destinations)

        prefs = form_data.get('preferences', {})
        interests = prefs.get('interests', [])
        interests_str = ','.join(interests) if isinstance(interests, list) else str(interests)

        trip = Trip(
            user_id=user_id,
            title=form_data.get('title') or f"Trip to {destination_str}",
            destination=destination_str,
            start_date=_parse_date(form_data.get('startDate')),
            end_date=_parse_date(form_data.get('endDate')),
            travelers_count=form_data.get('travelers', form_data.get('travelersCount')),
            origin=form_data.get('origin', ''),
            budget_tier=form_data.get('budget', form_data.get('budgetTier', 'mid')),
            pace=prefs.get('pace', form_data.get('pace', 'balanced')),
            interests_array=interests_str,
            constraints=form_data.get('constraints'),
            must_do=form_data.get('mustDo', ''),
            status='generating',
        )
        db.session.add(trip)
        db.session.commit()
        return trip

    # ------------------------------------------------------------------
    # Create (legacy – pre-generated data)
    # ------------------------------------------------------------------
    @staticmethod
    def create_trip(user_id: str, data: dict) -> Trip:
        """Create a trip from form data and (optionally) pre-generated sections."""
        form = data.get('formData', {})
        trip = Trip(
            user_id=user_id,
            title=form.get('title'),
            destination=form.get('destination'),
            start_date=_parse_date(form.get('startDate')),
            end_date=_parse_date(form.get('endDate')),
            travelers_count=form.get('travelersCount'),
            origin=form.get('origin'),
            budget_tier=form.get('budgetTier'),
            pace=form.get('pace'),
            interests_array=form.get('interests'),
            constraints=form.get('constraints'),
            must_do=form.get('mustDo'),
            status=data.get('status', 'generating'),
        )
        db.session.add(trip)

        _persist_days(trip, data.get('days', []))
        _persist_flights(trip, data.get('flights', []))
        _persist_stay_options(trip, data.get('stays', []))

        db.session.commit()
        return trip

    # ------------------------------------------------------------------
    # AI generation helpers (used by SSE route)
    # ------------------------------------------------------------------
    @staticmethod
    def persist_plan(trip: Trip, plan_data) -> None:
        """Create plan days from AI output with all generated items."""
        from app.services.geocoding_service import enrich_plan_items

        days_raw = [
            {
                'dayIndex': d.day_index,
                'title': d.title,
                'items': [
                    {
                        'title': item.title,
                        'description': item.description,
                        'category': item.category,
                        'time_block': item.time_block,
                        'duration_minutes': item.duration_minutes,
                        'cost_hint': item.cost_hint,
                        'place_query': item.place_query,
                        'external_url': item.external_url,
                        'location_name': item.place_query,
                        'maps_url': (
                            f"https://www.google.com/maps/search/?api=1&query={quote_plus(item.place_query)}"
                            if item.place_query else None
                        ),
                    }
                    for item in d.items
                ],
            }
            for d in plan_data.days
        ]

        # Calculate actual dates from trip start_date
        for day_dict in days_raw:
            if trip.start_date:
                from datetime import timedelta
                day_dict['date'] = (trip.start_date + timedelta(days=day_dict['dayIndex'])).isoformat()

        enrich_plan_items(days_raw, destination_hint=str(trip.destination or ''), trip_id=str(trip.id))
        _persist_days(trip, days_raw)
        db.session.commit()

    @staticmethod
    def persist_stays(trip: Trip, stays_data) -> None:
        """Save AI-generated stays to DB.  Accepts a GeneratedStays schema object."""
        from app.services.geocoding_service import enrich_stays

        stays_raw = [s.model_dump() for s in stays_data.stays]
        destination_hint = trip.destination or ''
        stays_raw = enrich_stays(stays_raw, trip_id=str(trip.id), destination_hint=destination_hint)

        stays_formatted = []
        for s in stays_raw:
            stays_formatted.append({
                'name': s.get('name'),
                'neighborhood': s.get('neighborhood'),
                'rating': s.get('rating_hint'),
                'price': None,
                'priceCurrency': None,
                'lat': s.get('lat'),
                'lng': s.get('lng'),
                'whyItFits': s.get('why_it_fits'),
                'deepLinkUrl': _build_booking_search_url(
                    s.get('name'), s.get('neighborhood'), trip.destination,
                    trip.start_date, trip.end_date, trip.travelers_count,
                ),
                'cachedImageUrl': s.get('cached_image_url'),
                'details': {
                    'stayType': s.get('stay_type'),
                    'priceRange': s.get('price_range'),
                    'amenities': s.get('amenities', []),
                    'mapsUrl': s.get('maps_url'),
                    'imageQuery': s.get('image_query'),
                    'placeId': s.get('place_id'),
                    'photoReference': s.get('photo_reference'),
                    'photoName': s.get('photo_name'),
                    'locationName': s.get('location_name'),
                    'address': s.get('address'),
                },
            })

        _persist_stay_options(trip, stays_formatted)
        db.session.commit()

    @staticmethod
    def persist_flights(trip: Trip, flights_data) -> None:
        """Save AI-generated flights to DB.  Accepts a GeneratedFlights schema object."""
        flights_formatted = []
        for f in flights_data.flights:
            flights_formatted.append({
                'airline': f.airline,
                'deepLinkUrl': f.booking_search_url,
                'stopsCount': f.stops_count,
                'details': {
                    'origin': f.origin,
                    'destination': f.destination,
                    'departTimeHint': f.depart_time_hint,
                    'arriveTimeHint': f.arrive_time_hint,
                    'durationHint': f.duration_hint,
                    'priceHint': f.price_hint,
                },
            })

        _persist_flights(trip, flights_formatted)
        db.session.commit()

    @staticmethod
    def create_generation_run(trip: Trip, form_data: dict) -> TripGenerationRun:
        """Create an audit log entry for a generation run."""
        run = TripGenerationRun(
            trip_id=trip.id,
            input_snapshot=form_data,
            status='running',
        )
        db.session.add(run)
        db.session.commit()
        return run

    @staticmethod
    def complete_generation_run(run: TripGenerationRun, status: str = 'completed',
                                 error_message: str = None) -> None:
        run.status = status
        run.error_message = error_message
        db.session.commit()

    @staticmethod
    def persist_generated_section(trip: Trip, section: str, payload) -> None:
        """Persist non-normalized generated sections in trip.constraints.aiGenerated."""
        constraints = _constraints_snapshot(trip)
        ai_generated = constraints.get('aiGenerated', {})
        ai_generated[section] = payload
        constraints['aiGenerated'] = ai_generated
        _commit_constraints(trip, constraints)

    @staticmethod
    def append_generated_activities(trip: Trip, new_activities: list[dict]) -> list[dict]:
        """Append new activities to aiGenerated bucket with de-duplication and stable ids."""
        constraints = _constraints_snapshot(trip)
        ai_generated = constraints.get('aiGenerated', {})
        existing = ai_generated.get('activities', [])
        if not isinstance(existing, list):
            existing = []

        existing_keys = {
            (
                (a.get('title') or '').strip().lower(),
                (a.get('place_query') or '').strip().lower(),
            )
            for a in existing
        }

        max_id_num = -1
        for a in existing:
            aid = str(a.get('id', ''))
            if aid.startswith('act_'):
                try:
                    max_id_num = max(max_id_num, int(aid.split('_', 1)[1]))
                except ValueError:
                    pass

        appended: list[dict] = []
        for raw in new_activities:
            key = (
                (raw.get('title') or '').strip().lower(),
                (raw.get('place_query') or '').strip().lower(),
            )
            if key in existing_keys:
                continue
            max_id_num += 1
            item = {**raw, 'id': f'act_{max_id_num}'}
            existing.append(item)
            existing_keys.add(key)
            appended.append(item)

        ai_generated['activities'] = existing
        constraints['aiGenerated'] = ai_generated
        _commit_constraints(trip, constraints)
        return appended

    @staticmethod
    def update_suggested_activity_status(trip: Trip, activity_id: str, status: str) -> dict:
        allowed = {'suggested', 'saved', 'dismissed'}
        if status not in allowed:
            raise ValueError('Invalid status')
        constraints = _constraints_snapshot(trip)
        if not isinstance(constraints, dict):
            raise ValueError('No generated activities available')

        ai_generated = constraints.get('aiGenerated', {})
        activities = ai_generated.get('activities', [])
        if not isinstance(activities, list):
            raise ValueError('No generated activities available')

        updated = None
        for activity in activities:
            if str(activity.get('id')) == str(activity_id):
                activity['status'] = status
                updated = activity
                break

        if not updated:
            raise ValueError('Activity not found')

        ai_generated['activities'] = activities
        constraints['aiGenerated'] = ai_generated
        _commit_constraints(trip, constraints)
        return updated

    @staticmethod
    def update_trip_notes(trip: Trip, notes: str) -> None:
        constraints = _constraints_snapshot(trip)
        ai_generated = constraints.get('aiGenerated', {})
        overview = ai_generated.get('overview', {})
        if not isinstance(overview, dict):
            overview = {}
        overview['notes'] = notes or ''
        ai_generated['overview'] = overview
        constraints['aiGenerated'] = ai_generated
        _commit_constraints(trip, constraints)

    @staticmethod
    def update_overview_image(trip: Trip, image_url: str) -> None:
        constraints = _constraints_snapshot(trip)
        ai_generated = constraints.get('aiGenerated', {})
        overview = ai_generated.get('overview', {})
        if not isinstance(overview, dict):
            overview = {}

        overview['destination_image_url'] = image_url or ''
        ai_generated['overview'] = overview
        constraints['aiGenerated'] = ai_generated
        _commit_constraints(trip, constraints)

    @staticmethod
    def update_overview_description(trip: Trip, description: str) -> None:
        constraints = _constraints_snapshot(trip)
        ai_generated = constraints.get('aiGenerated', {})
        overview = ai_generated.get('overview', {})
        if not isinstance(overview, dict):
            overview = {}

        overview['travel_description'] = description or ''
        ai_generated['overview'] = overview
        constraints['aiGenerated'] = ai_generated
        _commit_constraints(trip, constraints)

    @staticmethod
    def get_budget_data(trip: Trip) -> dict:
        constraints = trip.constraints if isinstance(trip.constraints, dict) else {}
        ai_generated = constraints.get('aiGenerated', {})
        budget = ai_generated.get('budget', {})
        entries = ai_generated.get('budgetEntries', [])

        if not isinstance(budget, dict):
            budget = {}
        if not isinstance(entries, list):
            entries = []

        currency = budget.get('currency') or 'EUR'
        total_estimated = budget.get('total_estimated', budget.get('totalEstimated'))

        total_actual = 0.0
        for entry in entries:
            try:
                total_actual += float(entry.get('amount', 0) or 0)
            except (TypeError, ValueError):
                continue

        delta = None
        if total_estimated is not None:
            try:
                delta = float(total_estimated) - total_actual
            except (TypeError, ValueError):
                delta = None

        return {
            'currency': currency,
            'totalEstimated': total_estimated,
            'categories': budget.get('categories', []),
            'entries': entries,
            'summary': {
                'estimatedTotal': total_estimated,
                'actualTotal': round(total_actual, 2),
                'delta': round(delta, 2) if delta is not None else None,
                'currency': currency,
            },
        }

    @staticmethod
    def add_budget_entry(trip: Trip, payload: dict) -> dict:
        constraints = _constraints_snapshot(trip)
        ai_generated = constraints.get('aiGenerated', {})
        entries = ai_generated.get('budgetEntries', [])
        budget = ai_generated.get('budget', {})

        if not isinstance(entries, list):
            entries = []
        if not isinstance(budget, dict):
            budget = {}

        currency = payload.get('currency') or budget.get('currency') or 'EUR'
        amount = float(payload.get('amount', 0))
        entry = {
            'id': str(uuid.uuid4()),
            'category': str(payload.get('category') or 'other').strip().lower(),
            'amount': round(amount, 2),
            'currency': currency,
            'date': payload.get('date'),
            'note': str(payload.get('note') or '').strip(),
            'createdAt': datetime.now(timezone.utc).isoformat(),
        }
        entries.append(entry)

        ai_generated['budgetEntries'] = entries
        constraints['aiGenerated'] = ai_generated
        _commit_constraints(trip, constraints)
        return entry

    @staticmethod
    def delete_budget_entry(trip: Trip, entry_id: str) -> bool:
        constraints = _constraints_snapshot(trip)
        ai_generated = constraints.get('aiGenerated', {})
        entries = ai_generated.get('budgetEntries', [])
        if not isinstance(entries, list):
            return False

        filtered = [entry for entry in entries if str(entry.get('id')) != str(entry_id)]
        if len(filtered) == len(entries):
            return False

        ai_generated['budgetEntries'] = filtered
        constraints['aiGenerated'] = ai_generated
        _commit_constraints(trip, constraints)
        return True

    @staticmethod
    def update_budget_entry(trip: Trip, entry_id: str, payload: dict) -> dict | None:
        constraints = _constraints_snapshot(trip)
        ai_generated = constraints.get('aiGenerated', {})
        entries = ai_generated.get('budgetEntries', [])
        if not isinstance(entries, list):
            return None

        target = None
        for entry in entries:
            if str(entry.get('id')) == str(entry_id):
                target = entry
                break
        if not target:
            return None

        if 'category' in payload and payload.get('category'):
            target['category'] = str(payload.get('category')).strip().lower()
        if 'amount' in payload:
            target['amount'] = round(float(payload.get('amount')), 2)
        if 'currency' in payload and payload.get('currency'):
            target['currency'] = str(payload.get('currency')).strip().upper()
        if 'date' in payload and payload.get('date'):
            target['date'] = payload.get('date')
        if 'note' in payload:
            target['note'] = str(payload.get('note') or '').strip()
        target['updatedAt'] = datetime.now(timezone.utc).isoformat()

        ai_generated['budgetEntries'] = entries
        constraints['aiGenerated'] = ai_generated
        _commit_constraints(trip, constraints)
        return target

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    @staticmethod
    def get_user_trips(user_id: str, limit: int = 50, offset: int = 0):
        """Get trips for a user, most recent first, with pagination."""
        limit = max(1, min(limit, 100))
        offset = max(0, offset)
        return (
            Trip.query
            .filter_by(user_id=user_id)
            .order_by(Trip.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_trip(trip_id: str, user_id: str):
        """Get a single trip (ownership check) with eager-loaded relations."""
        return (
            Trip.query
            .options(
                selectinload(Trip.days).selectinload(TripDay.plan_items),
                selectinload(Trip.flight_options),
                selectinload(Trip.stay_options),
            )
            .filter_by(id=trip_id, user_id=user_id)
            .first()
        )

    @staticmethod
    def select_primary_flight(trip: Trip, flight_id: str) -> None:
        selected = None
        for f in trip.flight_options:
            is_match = str(f.id) == str(flight_id)
            f.saved = is_match
            if is_match:
                selected = str(f.id)
        if not selected:
            raise ValueError('Flight not found')
        TripService.persist_generated_section(trip, 'selection', {
            **(trip.constraints.get('aiGenerated', {}).get('selection', {}) if isinstance(trip.constraints, dict) else {}),
            'selectedFlightId': selected,
            'selectedStayId': (
                trip.constraints.get('aiGenerated', {}).get('selection', {}).get('selectedStayId')
                if isinstance(trip.constraints, dict) else None
            ),
        })
        db.session.commit()

    @staticmethod
    def select_primary_stay(trip: Trip, stay_id: str) -> None:
        selected = None
        for s in trip.stay_options:
            is_match = str(s.id) == str(stay_id)
            s.saved = is_match
            if is_match:
                selected = str(s.id)
        if not selected:
            raise ValueError('Stay not found')
        TripService.persist_generated_section(trip, 'selection', {
            **(trip.constraints.get('aiGenerated', {}).get('selection', {}) if isinstance(trip.constraints, dict) else {}),
            'selectedStayId': selected,
            'selectedFlightId': (
                trip.constraints.get('aiGenerated', {}).get('selection', {}).get('selectedFlightId')
                if isinstance(trip.constraints, dict) else None
            ),
        })
        db.session.commit()

    @staticmethod
    def add_suggested_activity_to_day(trip: Trip, activity_id: str, day_number: int) -> None:
        constraints = _constraints_snapshot(trip)
        if not isinstance(constraints, dict):
            raise ValueError('No generated activities available')
        ai_generated = constraints.get('aiGenerated', {})
        activities = ai_generated.get('activities', [])
        if not isinstance(activities, list):
            raise ValueError('No generated activities available')

        activity = None
        remaining = []
        for item in activities:
            item_id = item.get('id')
            if not item_id:
                item_id = f"act_{len(remaining)}"
                item['id'] = item_id
            if str(item_id) == str(activity_id):
                activity = item
            else:
                remaining.append(item)
        if not activity:
            raise ValueError('Activity not found')

        day = _resolve_trip_day(trip, day_number)
        if not day:
            raise ValueError('Day not found')

        destination_hint = str(trip.destination or '').strip()
        maps_url, location_name, address, lat, lng = _resolve_activity_geo_fields(
            activity,
            destination_hint,
        )
        cached_image_url = _resolve_activity_cached_image(trip, activity, destination_hint)

        ordered_items = sorted(day.plan_items, key=lambda pi: pi.sort_order)
        insert_idx = _best_insert_index(ordered_items, lat, lng)

        for pi in ordered_items[insert_idx:]:
            pi.sort_order += 1

        db.session.add(PlanItem(
            trip_day=day,
            title=activity.get('title', 'Activity'),
            description=activity.get('description'),
            category=activity.get('category'),
            duration_minutes=activity.get('duration_minutes'),
            cost_hint=activity.get('cost_hint'),
            location_name=location_name,
            address=address,
            lat=lat,
            lng=lng,
            maps_url=maps_url,
            cached_image_url=cached_image_url,
            sort_order=insert_idx,
            status='suggested',
        ))

        ai_generated['activities'] = remaining
        constraints['aiGenerated'] = ai_generated
        trip.constraints = constraints
        flag_modified(trip, 'constraints')
        db.session.commit()

    @staticmethod
    def autofill_day_from_bucket(trip: Trip, day_number: int, limit: int = 3) -> int:
        """Add up to `limit` activities from bucket to a given day."""
        constraints = _constraints_snapshot(trip)
        if not isinstance(constraints, dict):
            raise ValueError('No generated activities available')
        ai_generated = constraints.get('aiGenerated', {})
        activities = ai_generated.get('activities', [])
        if not isinstance(activities, list) or not activities:
            raise ValueError('No generated activities available')

        normalized: list[dict] = []
        for idx, activity in enumerate(activities):
            if not isinstance(activity, dict):
                continue
            activity_id = activity.get('id')
            if not activity_id:
                activity_id = f'act_{idx}'
                activity['id'] = activity_id
            normalized.append(activity)

        candidates = [
            activity
            for activity in normalized
            if str(activity.get('status') or 'suggested').strip().lower() != 'dismissed'
        ]
        if not candidates:
            raise ValueError('No available activities in bucket for autofill')

        day = _resolve_trip_day(trip, day_number)
        if not day:
            raise ValueError('Day not found')

        take = max(1, min(int(limit), 6))
        picked = candidates[:take]
        picked_ids = {str(activity.get('id')) for activity in picked}
        remaining = [activity for activity in normalized if str(activity.get('id')) not in picked_ids]

        time_blocks = ['morning', 'afternoon', 'evening']
        destination_hint = str(trip.destination or '').strip()
        for idx, activity in enumerate(picked):
            maps_url, location_name, address, lat, lng = _resolve_activity_geo_fields(
                activity,
                destination_hint,
            )
            cached_image_url = _resolve_activity_cached_image(trip, activity, destination_hint)

            ordered_items = sorted(day.plan_items, key=lambda pi: pi.sort_order)
            insert_idx = _best_insert_index(ordered_items, lat, lng)

            for pi in ordered_items[insert_idx:]:
                pi.sort_order += 1

            new_item = PlanItem(
                trip_day=day,
                title=activity.get('title', 'Activity'),
                description=activity.get('description'),
                category=activity.get('category'),
                time_block=time_blocks[idx] if idx < len(time_blocks) else None,
                duration_minutes=activity.get('duration_minutes'),
                cost_hint=activity.get('cost_hint'),
                location_name=location_name,
                address=address,
                lat=lat,
                lng=lng,
                maps_url=maps_url,
                cached_image_url=cached_image_url,
                sort_order=insert_idx,
                status='suggested',
            )
            db.session.add(new_item)
            day.plan_items.append(new_item)

        ai_generated['activities'] = remaining
        constraints['aiGenerated'] = ai_generated
        trip.constraints = constraints
        flag_modified(trip, 'constraints')
        db.session.commit()
        return len(picked)

    @staticmethod
    def return_plan_item_to_bucket(trip: Trip, item_id: str) -> None:
        target_day = None
        target_item = None
        for day in trip.days:
            for item in day.plan_items:
                if str(item.id) == str(item_id):
                    target_day = day
                    target_item = item
                    break
            if target_item:
                break
        if not target_item or not target_day:
            raise ValueError('Plan item not found')

        constraints = _constraints_snapshot(trip)
        ai_generated = constraints.get('aiGenerated', {})
        activities = ai_generated.get('activities', [])
        if not isinstance(activities, list):
            activities = []

        activities.append({
            'id': str(target_item.id),
            'title': target_item.title,
            'description': target_item.description,
            'category': target_item.category,
            'duration_minutes': target_item.duration_minutes,
            'cost_hint': target_item.cost_hint,
            'place_query': target_item.location_name or target_item.address or target_item.title,
            'location_name': target_item.location_name,
            'address': target_item.address,
            'lat': target_item.lat,
            'lng': target_item.lng,
            'maps_url': target_item.maps_url,
            'image_query': target_item.location_name or target_item.title,
            'cached_image_url': target_item.cached_image_url,
        })
        ai_generated['activities'] = activities
        constraints['aiGenerated'] = ai_generated
        trip.constraints = constraints
        flag_modified(trip, 'constraints')

        db.session.delete(target_item)
        db.session.flush()
        # Compact sort order after removal.
        remaining_items = sorted(
            [i for i in target_day.plan_items if str(i.id) != str(item_id)],
            key=lambda i: i.sort_order,
        )
        for idx, item in enumerate(remaining_items):
            item.sort_order = idx
        db.session.commit()

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------
    @staticmethod
    def update_trip(trip_id: str, user_id: str, data: dict):
        """Update trip-level fields or replace child sections."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None

        for key in ('title', 'destination', 'origin', 'budgetTier', 'pace',
                     'interests', 'mustDo', 'status'):
            if key in data:
                attr = _camel_to_snake(key)
                if attr == 'interests':
                    attr = 'interests_array'
                setattr(trip, attr, data[key])
        if 'startDate' in data:
            trip.start_date = _parse_date(data['startDate'])
        if 'endDate' in data:
            trip.end_date = _parse_date(data['endDate'])
        if 'travelersCount' in data:
            trip.travelers_count = data['travelersCount']

        if 'days' in data:
            _replace_days(trip, data['days'])
        if 'flights' in data:
            _replace_flights(trip, data['flights'])
        if 'stays' in data:
            _replace_stays(trip, data['stays'])

        db.session.commit()
        return trip

    # ------------------------------------------------------------------
    # Replace sections (used by chat edit pipeline)
    # ------------------------------------------------------------------
    @staticmethod
    def replace_plan(trip: Trip, days_data: list[dict]) -> None:
        """Replace the entire plan (days + items) from AI edit output."""
        from app.services.geocoding_service import enrich_plan_items

        days_data = enrich_plan_items(days_data, destination_hint=str(trip.destination or ''), trip_id=str(trip.id))
        _replace_days(trip, days_data)
        db.session.commit()

    @staticmethod
    def replace_stays(trip: Trip, stays_data: list[dict]) -> None:
        """Replace all stay options from AI edit output."""
        from app.services.geocoding_service import enrich_stays

        stays_data = enrich_stays(
            stays_data,
            trip_id=str(trip.id),
            destination_hint=str(trip.destination or ''),
        )
        formatted = []
        for s in stays_data:
            formatted.append({
                'name': s.get('name'),
                'neighborhood': s.get('neighborhood'),
                'rating': s.get('rating_hint'),
                'lat': s.get('lat'),
                'lng': s.get('lng'),
                'whyItFits': s.get('why_it_fits'),
                'deepLinkUrl': _build_booking_search_url(
                    s.get('name'), s.get('neighborhood'), trip.destination,
                    trip.start_date, trip.end_date, trip.travelers_count,
                ),
                'details': {
                    'stayType': s.get('stay_type'),
                    'priceRange': s.get('price_range'),
                    'amenities': s.get('amenities', []),
                    'mapsUrl': s.get('maps_url'),
                    'imageQuery': s.get('image_query'),
                    'placeId': s.get('place_id'),
                    'photoReference': s.get('photo_reference'),
                    'photoName': s.get('photo_name'),
                    'locationName': s.get('location_name'),
                    'address': s.get('address'),
                },
            })
        _replace_stays(trip, formatted)
        db.session.commit()

    @staticmethod
    def replace_flights(trip: Trip, flights_data: list[dict]) -> None:
        """Replace all flight options from AI edit output."""
        formatted = []
        for f in flights_data:
            formatted.append({
                'airline': f.get('airline'),
                'deepLinkUrl': f.get('booking_search_url'),
                'stopsCount': f.get('stops_count'),
                'details': {
                    'origin': f.get('origin'),
                    'destination': f.get('destination'),
                    'departTimeHint': f.get('depart_time_hint'),
                    'arriveTimeHint': f.get('arrive_time_hint'),
                    'durationHint': f.get('duration_hint'),
                    'priceHint': f.get('price_hint'),
                },
            })
        _replace_flights(trip, formatted)
        db.session.commit()

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------
    @staticmethod
    def delete_trip(trip_id: str, user_id: str) -> bool:
        """Delete a trip and all children (cascade), including cached images."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return False
        try:
            from app.services.image_storage_service import delete_trip_images
            delete_trip_images(str(trip.id))
        except Exception:
            logger.debug("Image cleanup skipped for trip %s", trip_id, exc_info=True)
        db.session.delete(trip)
        db.session.commit()
        return True


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------

def _persist_days(trip, days_list):
    """Add day + item rows (no delete of existing)."""
    for day_data in days_list:
        day = TripDay(
            trip=trip,
            day_index=day_data.get('dayIndex', day_data.get('day_index', 0)),
            date=_parse_date(day_data.get('date')),
            title=day_data.get('title'),
        )
        db.session.add(day)
        for idx, item_data in enumerate(day_data.get('items', [])):
            cached_url = (item_data.get('cached_image_url') or '').strip() or None
            db.session.add(PlanItem(
                trip_day=day,
                title=item_data.get('title', ''),
                description=item_data.get('description'),
                category=item_data.get('category'),
                time_block=item_data.get('timeBlock', item_data.get('time_block')),
                duration_minutes=item_data.get('durationMinutes', item_data.get('duration_minutes')),
                cost_hint=item_data.get('costHint', item_data.get('cost_hint')),
                location_name=item_data.get('locationName', item_data.get('location_name')),
                address=item_data.get('address'),
                lat=item_data.get('lat'),
                lng=item_data.get('lng'),
                external_url=item_data.get('externalUrl', item_data.get('external_url')),
                maps_url=item_data.get('mapsUrl', item_data.get('maps_url')),
                cached_image_url=cached_url,
                sort_order=idx,
            ))


def _persist_flights(trip, flights_list):
    for f in flights_list:
        db.session.add(FlightOption(
            trip=trip,
            provider=f.get('provider'),
            deep_link_url=f.get('deepLinkUrl'),
            price_amount=f.get('price'),
            price_currency=f.get('priceCurrency'),
            depart_time=f.get('departTime'),
            arrive_time=f.get('arriveTime'),
            duration_minutes=f.get('durationMinutes'),
            stops_count=f.get('stopsCount'),
            airline=f.get('airline'),
            details=f.get('details'),
        ))


def _persist_stay_options(trip, stays_list):
    for s in stays_list:
        details = s.get('details') or {}
        cached_url = s.get('cachedImageUrl') or ''
        if cached_url:
            details['cachedImageUrl'] = cached_url
        db.session.add(StayOption(
            trip=trip,
            provider=s.get('provider'),
            deep_link_url=s.get('deepLinkUrl'),
            name=s.get('name'),
            neighborhood=s.get('neighborhood'),
            rating=s.get('rating'),
            price_amount=s.get('price'),
            price_currency=s.get('priceCurrency'),
            lat=s.get('lat'),
            lng=s.get('lng'),
            why_it_fits=s.get('whyItFits'),
            details=details,
            cached_image_url=cached_url or None,
        ))


def _resolve_trip_day(trip: Trip, day_number: int) -> TripDay | None:
    """Resolve day by tolerant mapping.

    Prioritizes user-facing ordinal day selection (Day 1..N), while still
    supporting direct `day_index` and legacy 0-based inputs.
    """
    try:
        day_number = int(day_number)
    except (TypeError, ValueError):
        return None

    ordered_days = sorted(trip.days, key=lambda d: d.day_index)
    if not ordered_days:
        return None

    # 1-based fallback by ordinal position (most natural for users)
    if 1 <= day_number <= len(ordered_days):
        return ordered_days[day_number - 1]

    # 0-based fallback by ordinal position
    if 0 <= day_number < len(ordered_days):
        return ordered_days[day_number]

    direct = next((d for d in trip.days if d.day_index == day_number), None)
    if direct:
        return direct

    plus_one = next((d for d in trip.days if d.day_index == day_number + 1), None)
    if plus_one:
        return plus_one
    minus_one = next((d for d in trip.days if d.day_index == day_number - 1), None)
    if minus_one:
        return minus_one

    return None


def _replace_days(trip, days_list):
    """Delete existing days + items, then persist new ones."""
    for old_day in trip.days:
        db.session.delete(old_day)
    db.session.flush()
    _persist_days(trip, days_list)


def _replace_flights(trip, flights_list):
    for old in trip.flight_options:
        db.session.delete(old)
    db.session.flush()
    _persist_flights(trip, flights_list)


def _replace_stays(trip, stays_list):
    for old in trip.stay_options:
        db.session.delete(old)
    db.session.flush()
    _persist_stay_options(trip, stays_list)


def _parse_date(value):
    """Accept ISO date string or None."""
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _camel_to_snake(name: str) -> str:
    import re
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()
