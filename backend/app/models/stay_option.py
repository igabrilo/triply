import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class StayOption(db.Model):
    """Suggested accommodation for a trip."""
    __tablename__ = 'stay_options'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = db.Column(Uuid, db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False, index=True)

    provider = db.Column(db.Text, nullable=True)
    deep_link_url = db.Column(db.Text, nullable=True)

    name = db.Column(db.Text, nullable=True)
    neighborhood = db.Column(db.Text, nullable=True)
    rating = db.Column(db.Numeric(3, 1), nullable=True)

    price_amount = db.Column(db.Numeric(10, 2), nullable=True)
    price_currency = db.Column(db.Text, nullable=True)

    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    why_it_fits = db.Column(db.Text, nullable=True)
    details = db.Column(db.JSON, nullable=True)
    saved = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    trip = db.relationship('Trip', back_populates='stay_options')

    def to_dict(self):
        return {
            'id': str(self.id),
            'tripId': str(self.trip_id),
            'provider': self.provider,
            'deepLinkUrl': self.deep_link_url,
            'name': self.name,
            'neighborhood': self.neighborhood,
            'rating': float(self.rating) if self.rating else None,
            'price': float(self.price_amount) if self.price_amount else None,
            'priceCurrency': self.price_currency,
            'lat': self.lat,
            'lng': self.lng,
            'whyItFits': self.why_it_fits,
            'details': self.details,
            'saved': self.saved,
        }

    def __repr__(self):
        return f'<StayOption {self.name}>'
