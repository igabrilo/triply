from app import db
from datetime import datetime
import bcrypt
import json


class User(db.Model):
    """User model for authentication and profile."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar_url = db.Column(db.String(500), nullable=True)

    # Stored preferences (opt-in, JSON)
    preferences_json = db.Column(db.Text, nullable=True)
    preferences_opted_in = db.Column(db.Boolean, default=False)

    # Notification settings
    notify_price_alerts = db.Column(db.Boolean, default=True)
    notify_trip_reminders = db.Column(db.Boolean, default=True)
    notify_feature_updates = db.Column(db.Boolean, default=True)
    notify_marketing = db.Column(db.Boolean, default=False)

    # Subscription
    subscription_tier = db.Column(db.String(20), default='free')  # free | premium
    generations_used = db.Column(db.Integer, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    trips = db.relationship('Trip', backref='user', lazy='dynamic')

    def set_password(self, password: str):
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'), bcrypt.gensalt()
        ).decode('utf-8')

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    @property
    def preferences(self):
        if self.preferences_json:
            return json.loads(self.preferences_json)
        return None

    @preferences.setter
    def preferences(self, value):
        self.preferences_json = json.dumps(value) if value else None

    def to_dict(self):
        return {
            'id': str(self.id),
            'email': self.email,
            'name': self.name,
            'avatar': self.avatar_url,
            'preferences': self.preferences,
            'subscription_tier': self.subscription_tier,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<User {self.email}>'
