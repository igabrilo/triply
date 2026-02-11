import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class TripDay(db.Model):
    """One day inside a trip."""
    __tablename__ = 'trip_days'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = db.Column(Uuid, db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False, index=True)

    day_index = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, nullable=True)
    title = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # --- Relationships ---
    trip = db.relationship('Trip', back_populates='days')
    plan_items = db.relationship('PlanItem', back_populates='trip_day', cascade='all, delete-orphan',
                                 order_by='PlanItem.sort_order')

    def to_dict(self):
        return {
            'id': str(self.id),
            'tripId': str(self.trip_id),
            'dayIndex': self.day_index,
            'date': self.date.isoformat() if self.date else None,
            'title': self.title,
            'items': [i.to_dict() for i in self.plan_items],
        }

    def __repr__(self):
        return f'<TripDay {self.day_index} of Trip {self.trip_id}>'
