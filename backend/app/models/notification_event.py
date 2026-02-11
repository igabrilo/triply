import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class NotificationEvent(db.Model):
    """Outbound notification record."""
    __tablename__ = 'notification_events'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(Uuid, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    trip_id = db.Column(Uuid, db.ForeignKey('trips.id', ondelete='SET NULL'), nullable=True, index=True)

    event_type = db.Column(db.Text, nullable=False)
    payload = db.Column(db.JSON, nullable=True)
    delivery_status = db.Column(db.Text, default='pending')     # pending | sent | failed

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # --- Relationships ---
    user = db.relationship('User', back_populates='notification_events')
    trip = db.relationship('Trip', back_populates='notification_events')

    def to_dict(self):
        return {
            'id': str(self.id),
            'userId': str(self.user_id),
            'tripId': str(self.trip_id) if self.trip_id else None,
            'eventType': self.event_type,
            'payload': self.payload,
            'deliveryStatus': self.delivery_status,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<NotificationEvent {self.id} [{self.event_type}]>'
