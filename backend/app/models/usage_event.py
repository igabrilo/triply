import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class UsageEvent(db.Model):
    """Analytics / telemetry event."""
    __tablename__ = 'usage_events'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(Uuid, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    trip_id = db.Column(Uuid, db.ForeignKey('trips.id', ondelete='SET NULL'), nullable=True, index=True)

    event_name = db.Column(db.Text, nullable=False, index=True)
    event_props = db.Column(db.JSON, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    # --- Relationships ---
    user = db.relationship('User', back_populates='usage_events')
    trip = db.relationship('Trip', back_populates='usage_events')

    def to_dict(self):
        return {
            'id': str(self.id),
            'userId': str(self.user_id),
            'tripId': str(self.trip_id) if self.trip_id else None,
            'eventName': self.event_name,
            'eventProps': self.event_props,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<UsageEvent {self.event_name}>'
