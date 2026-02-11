import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class PlanItem(db.Model):
    """Single activity / point-of-interest inside a trip day."""
    __tablename__ = 'plan_items'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_day_id = db.Column(Uuid, db.ForeignKey('trip_days.id', ondelete='CASCADE'), nullable=False, index=True)

    title = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.Text, nullable=True)               # dining | activity | transport | …
    time_block = db.Column(db.Text, nullable=True)              # morning | afternoon | evening
    duration_minutes = db.Column(db.Integer, nullable=True)
    cost_hint = db.Column(db.Text, nullable=True)

    location_name = db.Column(db.Text, nullable=True)
    address = db.Column(db.Text, nullable=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    external_url = db.Column(db.Text, nullable=True)
    maps_url = db.Column(db.Text, nullable=True)

    status = db.Column(db.Text, default='suggested')            # suggested | confirmed | skipped
    saved = db.Column(db.Boolean, default=False)
    sort_order = db.Column(db.Integer, default=0)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    trip_day = db.relationship('TripDay', back_populates='plan_items')

    def to_dict(self):
        return {
            'id': str(self.id),
            'tripDayId': str(self.trip_day_id),
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'timeBlock': self.time_block,
            'durationMinutes': self.duration_minutes,
            'costHint': self.cost_hint,
            'locationName': self.location_name,
            'address': self.address,
            'lat': self.lat,
            'lng': self.lng,
            'externalUrl': self.external_url,
            'mapsUrl': self.maps_url,
            'status': self.status,
            'saved': self.saved,
            'sortOrder': self.sort_order,
        }

    def __repr__(self):
        return f'<PlanItem {self.title}>'
