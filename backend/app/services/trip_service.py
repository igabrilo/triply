from datetime import date

from app import db
from app.models.trip import Trip
from app.models.trip_day import TripDay
from app.models.plan_item import PlanItem
from app.models.flight_option import FlightOption
from app.models.stay_option import StayOption


class TripService:
    """Service for trip CRUD operations against the normalized schema."""

    # ------------------------------------------------------------------
    # Create
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

        # Persist days + plan items
        for day_data in data.get('days', []):
            day = TripDay(
                trip=trip,
                day_index=day_data.get('dayIndex', 0),
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
                    time_block=item_data.get('timeBlock'),
                    duration_minutes=item_data.get('durationMinutes'),
                    cost_hint=item_data.get('costHint'),
                    location_name=item_data.get('locationName'),
                    address=item_data.get('address'),
                    lat=item_data.get('lat'),
                    lng=item_data.get('lng'),
                    external_url=item_data.get('externalUrl'),
                    maps_url=item_data.get('mapsUrl'),
                    sort_order=idx,
                ))

        # Persist flight options
        for f in data.get('flights', []):
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

        # Persist stay options
        for s in data.get('stays', []):
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

        db.session.commit()
        return trip

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

        # Scalar fields
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

        # Replace days (full swap)
        if 'days' in data:
            # Delete old
            for old_day in trip.days:
                db.session.delete(old_day)
            db.session.flush()
            for day_data in data['days']:
                day = TripDay(
                    trip=trip,
                    day_index=day_data.get('dayIndex', 0),
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
                        time_block=item_data.get('timeBlock'),
                        duration_minutes=item_data.get('durationMinutes'),
                        cost_hint=item_data.get('costHint'),
                        location_name=item_data.get('locationName'),
                        address=item_data.get('address'),
                        lat=item_data.get('lat'),
                        lng=item_data.get('lng'),
                        external_url=item_data.get('externalUrl'),
                        maps_url=item_data.get('mapsUrl'),
                        sort_order=idx,
                    ))

        # Replace flights
        if 'flights' in data:
            for old in trip.flight_options:
                db.session.delete(old)
            db.session.flush()
            for f in data['flights']:
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

        # Replace stays
        if 'stays' in data:
            for old in trip.stay_options:
                db.session.delete(old)
            db.session.flush()
            for s in data['stays']:
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

        db.session.commit()
        return trip

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
# Helpers
# ------------------------------------------------------------------
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
