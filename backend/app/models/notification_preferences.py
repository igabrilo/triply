from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class NotificationPreferences(db.Model):
    """Per-user notification toggles."""
    __tablename__ = 'notification_preferences'

    user_id = db.Column(Uuid, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)

    trip_reminders = db.Column(db.Boolean, default=True)
    price_alerts = db.Column(db.Boolean, default=True)
    product_updates = db.Column(db.Boolean, default=True)
    marketing_opt_in = db.Column(db.Boolean, default=False)

    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    user = db.relationship('User', back_populates='notification_preferences')

    def to_dict(self):
        return {
            'tripReminders': self.trip_reminders,
            'priceAlerts': self.price_alerts,
            'productUpdates': self.product_updates,
            'marketingOptIn': self.marketing_opt_in,
        }

    def __repr__(self):
        return f'<NotificationPreferences user={self.user_id}>'
