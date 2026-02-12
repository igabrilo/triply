import uuid
from datetime import datetime, timezone

import bcrypt
from sqlalchemy import Uuid

from app import db


class User(db.Model):
    """User model for authentication and profile."""
    __tablename__ = 'users'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    email = db.Column(db.Text, unique=True, nullable=False, index=True)
    name = db.Column(db.Text, nullable=False)
    password_hash = db.Column(db.Text, nullable=True)  # Nullable for OAuth users
    avatar_url = db.Column(db.Text, nullable=True)
    
    # OAuth fields
    oauth_provider = db.Column(db.Text, nullable=True)  # google | apple | None
    oauth_id = db.Column(db.Text, nullable=True, index=True)  # Provider's user ID

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

    # --- Password helpers ---
    def set_password(self, password: str):
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'), bcrypt.gensalt(),
        ).decode('utf-8')

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False  # OAuth users don't have password
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8'),
        )

    # --- Serialization ---
    def to_dict(self):
        return {
            'id': str(self.id),
            'email': self.email,
            'name': self.name,
            'avatar': self.avatar_url,
            'oauthProvider': self.oauth_provider,
            'preferences': self.preferences.to_dict() if self.preferences else None,
            'notificationPreferences': (
                self.notification_preferences.to_dict() if self.notification_preferences else None
            ),
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<User {self.email}>'
