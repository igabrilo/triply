import logging
import uuid
from copy import deepcopy
from datetime import date, datetime, timezone

from app import db
from app.models.trip import Trip
from app.models.trip_day import TripDay
from app.models.plan_item import PlanItem
from app.models.flight_option import FlightOption
from app.models.stay_option import StayOption
from app.models.trip_generation_run import TripGenerationRun
from sqlalchemy.orm.attributes import flag_modified

logger = logging.getLogger(__name__)


def _constraints_snapshot(trip: Trip) -> dict:
    base = trip.constraints if isinstance(trip.constraints, dict) else {}
    return deepcopy(base)


def _commit_constraints(trip: Trip, constraints: dict) -> None:
    trip.constraints = constraints
    flag_modified(trip, 'constraints')
    db.session.commit()


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
        """Create plan days from AI output, but keep days empty by default."""

        days_raw = [
            {
                'dayIndex': d.day_index,
                'title': d.title,
                'items': [],
            }
            for d in plan_data.days
        ]

        # Calculate actual dates from trip start_date
        for day_dict in days_raw:
            if trip.start_date:
                from datetime import timedelta
                day_dict['date'] = (trip.start_date + timedelta(days=day_dict['dayIndex'])).isoformat()

        _persist_days(trip, days_raw)
        db.session.commit()

    @staticmethod
    def persist_stays(trip: Trip, stays_data) -> None:
        """Save AI-generated stays to DB.  Accepts a GeneratedStays schema object."""
        from app.services.geocoding_service import enrich_stays

        stays_raw = [s.model_dump() for s in stays_data.stays]
        stays_raw = enrich_stays(stays_raw)

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
                'deepLinkUrl': s.get('booking_search_url'),
                'details': {
                    'stayType': s.get('stay_type'),
                    'priceRange': s.get('price_range'),
                    'amenities': s.get('amenities', []),
                    'mapsUrl': s.get('maps_url'),
                    'imageQuery': s.get('image_query'),
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
    def get_user_trips(user_id: str):
        """Get all trips for a user, most recent first."""
        return Trip.query.filter_by(user_id=user_id).order_by(Trip.created_at.desc()).all()

    @staticmethod
    def get_trip(trip_id: str, user_id: str):
        """Get a single trip (ownership check)."""
        return Trip.query.filter_by(id=trip_id, user_id=user_id).first()

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

        query = (
            activity.get('place_query')
            or activity.get('location_name')
            or activity.get('title')
            or ''
        )
        maps_url = activity.get('maps_url')
        location_name = activity.get('location_name') or activity.get('place_query')
        address = activity.get('address')
        lat = activity.get('lat')
        lng = activity.get('lng')

        if query and (not maps_url or lat is None or lng is None):
            try:
                from app.services.geocoding_service import geocode_place
                geo = geocode_place(query)
                maps_url = maps_url or geo.get('maps_url')
                location_name = location_name or geo.get('location_name')
                address = address or geo.get('address')
                if lat is None and geo.get('lat') is not None:
                    lat = geo.get('lat')
                if lng is None and geo.get('lng') is not None:
                    lng = geo.get('lng')
            except Exception:
                # Keep add-to-day resilient even if geocoding fails.
                pass

        sort_order = len(day.plan_items)
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
            sort_order=sort_order,
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

        day = _resolve_trip_day(trip, day_number)
        if not day:
            raise ValueError('Day not found')

        take = max(1, min(int(limit), 6))
        picked = activities[:take]
        remaining = activities[take:]

        base_sort = len(day.plan_items)
        time_blocks = ['morning', 'afternoon', 'evening']
        for idx, activity in enumerate(picked):
            query = (
                activity.get('place_query')
                or activity.get('location_name')
                or activity.get('title')
                or ''
            )
            maps_url = activity.get('maps_url')
            location_name = activity.get('location_name') or activity.get('place_query')
            address = activity.get('address')
            lat = activity.get('lat')
            lng = activity.get('lng')

            if query and (not maps_url or lat is None or lng is None):
                try:
                    from app.services.geocoding_service import geocode_place
                    geo = geocode_place(query)
                    maps_url = maps_url or geo.get('maps_url')
                    location_name = location_name or geo.get('location_name')
                    address = address or geo.get('address')
                    if lat is None and geo.get('lat') is not None:
                        lat = geo.get('lat')
                    if lng is None and geo.get('lng') is not None:
                        lng = geo.get('lng')
                except Exception:
                    pass

            db.session.add(PlanItem(
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
                sort_order=base_sort + idx,
                status='suggested',
            ))

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

        days_data = enrich_plan_items(days_data)
        _replace_days(trip, days_data)
        db.session.commit()

    @staticmethod
    def replace_stays(trip: Trip, stays_data: list[dict]) -> None:
        """Replace all stay options from AI edit output."""
        from app.services.geocoding_service import enrich_stays

        stays_data = enrich_stays(stays_data)
        formatted = []
        for s in stays_data:
            formatted.append({
                'name': s.get('name'),
                'neighborhood': s.get('neighborhood'),
                'rating': s.get('rating_hint'),
                'lat': s.get('lat'),
                'lng': s.get('lng'),
                'whyItFits': s.get('why_it_fits'),
                'deepLinkUrl': s.get('booking_search_url'),
                'details': {
                    'stayType': s.get('stay_type'),
                    'priceRange': s.get('price_range'),
                    'amenities': s.get('amenities', []),
                    'mapsUrl': s.get('maps_url'),
                    'imageQuery': s.get('image_query'),
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
        """Delete a trip and all children (cascade)."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return False
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
            details=s.get('details'),
        ))


def _resolve_trip_day(trip: Trip, day_number: int) -> TripDay | None:
    """Resolve day by tolerant mapping.

    Supports direct `day_index`, plus index-based fallback for trips where
    AI day_index values are inconsistent (0/1-based or non-sequential).
    """
    try:
        day_number = int(day_number)
    except (TypeError, ValueError):
        return None

    direct = next((d for d in trip.days if d.day_index == day_number), None)
    if direct:
        return direct

    ordered_days = sorted(trip.days, key=lambda d: d.day_index)
    if not ordered_days:
        return None

    # 1-based fallback by ordinal position (most natural for users)
    if 1 <= day_number <= len(ordered_days):
        return ordered_days[day_number - 1]

    # 0-based fallback by ordinal position
    if 0 <= day_number < len(ordered_days):
        return ordered_days[day_number]

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
