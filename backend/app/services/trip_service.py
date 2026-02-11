from app import db
from app.models.trip import Trip


class TripService:
    """Service for trip CRUD operations."""

    @staticmethod
    def create_trip(user_id: int, data: dict) -> Trip:
        """Create and save a new trip."""
        trip = Trip(user_id=user_id, status='ready')
        trip.form_data = data.get('formData', {})
        trip.flights = data.get('flights', [])
        trip.stays = data.get('stays', [])
        trip.plan = data.get('plan', [])
        trip.saved_items = data.get('savedItems', [])

        db.session.add(trip)
        db.session.commit()
        return trip

    @staticmethod
    def get_user_trips(user_id: int):
        """Get all trips for a user, ordered by most recent."""
        return Trip.query.filter_by(user_id=user_id).order_by(Trip.created_at.desc()).all()

    @staticmethod
    def get_trip(trip_id: int, user_id: int):
        """Get a specific trip (with ownership check)."""
        return Trip.query.filter_by(id=trip_id, user_id=user_id).first()

    @staticmethod
    def update_trip(trip_id: int, user_id: int, data: dict):
        """Update specific sections of a trip (scoped edit)."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None

        if 'flights' in data:
            trip.flights = data['flights']
        if 'stays' in data:
            trip.stays = data['stays']
        if 'plan' in data:
            trip.plan = data['plan']
        if 'savedItems' in data:
            trip.saved_items = data['savedItems']
        if 'status' in data:
            trip.status = data['status']

        trip.edit_count += 1
        db.session.commit()
        return trip

    @staticmethod
    def delete_trip(trip_id: int, user_id: int) -> bool:
        """Delete a trip."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return False
        db.session.delete(trip)
        db.session.commit()
        return True
