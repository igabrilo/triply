import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class PriceAlert(db.Model):
    """User-configured price watch for flights / stays."""
    __tablename__ = 'price_alerts'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(Uuid, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    trip_id = db.Column(Uuid, db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=True, index=True)

    alert_type = db.Column(db.Text, nullable=True)              # flight | stay
    threshold_amount = db.Column(db.Numeric(10, 2), nullable=True)
    threshold_currency = db.Column(db.Text, nullable=True)
    route = db.Column(db.JSON, nullable=True)                   # origin/destination pair, etc.

    enabled = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    user = db.relationship('User', back_populates='price_alerts')
    trip = db.relationship('Trip', back_populates='price_alerts')

    def to_dict(self):
        return {
            'id': str(self.id),
            'userId': str(self.user_id),
            'tripId': str(self.trip_id) if self.trip_id else None,
            'alertType': self.alert_type,
            'thresholdAmount': float(self.threshold_amount) if self.threshold_amount else None,
            'thresholdCurrency': self.threshold_currency,
            'route': self.route,
            'enabled': self.enabled,
        }

    def __repr__(self):
        return f'<PriceAlert {self.id} [{self.alert_type}]>'
