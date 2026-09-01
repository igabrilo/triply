import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class User(db.Model):
    """User model – synced from Supabase auth.users via DB trigger.

    The primary key matches the Supabase auth.users.id UUID so that
    all child tables can FK directly to it.
    """
    __tablename__ = 'users'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    email = db.Column(db.Text, unique=True, nullable=False, index=True)
    name = db.Column(db.Text, nullable=False)
    avatar_url = db.Column(db.Text, nullable=True)
    plan = db.Column(db.String(20), nullable=False, default='basic', server_default='basic')

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    preferences = db.relationship(
        'UserPreferences', back_populates='user', uselist=False, cascade='all, delete-orphan',
    )
    notification_preferences = db.relationship(
        'NotificationPreferences', back_populates='user', uselist=False, cascade='all, delete-orphan',
    )
    trips = db.relationship('Trip', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    subscriptions = db.relationship('Subscription', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    price_alerts = db.relationship('PriceAlert', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    usage_events = db.relationship('UsageEvent', back_populates='user', lazy='dynamic')
    notification_events = db.relationship('NotificationEvent', back_populates='user', lazy='dynamic')

    # --- Serialization ---
    def to_dict(self):
        return {
            'id': str(self.id),
            'email': self.email,
            'name': self.name,
            'avatar': self.avatar_url,
            'plan': self.plan or 'basic',
            'preferences': self.preferences.to_dict() if self.preferences else None,
            'notificationPreferences': (
                self.notification_preferences.to_dict() if self.notification_preferences else None
            ),
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<User {self.email}>'
