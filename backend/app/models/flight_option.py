import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class FlightOption(db.Model):
    """Suggested flight for a trip."""
    __tablename__ = 'flight_options'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = db.Column(Uuid, db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False, index=True)

    provider = db.Column(db.Text, nullable=True)
    deep_link_url = db.Column(db.Text, nullable=True)

    price_amount = db.Column(db.Numeric(10, 2), nullable=True)
    price_currency = db.Column(db.Text, nullable=True)

    depart_time = db.Column(db.DateTime(timezone=True), nullable=True)
    arrive_time = db.Column(db.DateTime(timezone=True), nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=True)
    stops_count = db.Column(db.Integer, nullable=True)
    airline = db.Column(db.Text, nullable=True)

    details = db.Column(db.JSON, nullable=True)
    saved = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    trip = db.relationship('Trip', back_populates='flight_options')

    def to_dict(self):
        return {
            'id': str(self.id),
            'tripId': str(self.trip_id),
            'provider': self.provider,
            'deepLinkUrl': self.deep_link_url,
            'price': float(self.price_amount) if self.price_amount else None,
            'priceCurrency': self.price_currency,
            'departTime': self.depart_time.isoformat() if self.depart_time else None,
            'arriveTime': self.arrive_time.isoformat() if self.arrive_time else None,
            'durationMinutes': self.duration_minutes,
            'stopsCount': self.stops_count,
            'airline': self.airline,
            'details': self.details,
            'saved': self.saved,
        }

    def __repr__(self):
        return f'<FlightOption {self.airline} ${self.price_amount}>'
