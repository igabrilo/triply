import logging
from datetime import date

from app import db
from app.models.trip import Trip
from app.models.trip_day import TripDay
from app.models.plan_item import PlanItem
from app.models.flight_option import FlightOption
from app.models.stay_option import StayOption
from app.models.trip_generation_run import TripGenerationRun

logger = logging.getLogger(__name__)


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
        """Save AI-generated plan to DB.  Accepts a GeneratedPlan schema object."""
        from app.services.geocoding_service import enrich_plan_items

        days_raw = [
            {
                'dayIndex': d.day_index,
                'title': d.title,
                'items': [item.model_dump() for item in d.items],
            }
            for d in plan_data.days
        ]

        days_raw = enrich_plan_items(days_raw)

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
