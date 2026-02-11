from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class UserPreferences(db.Model):
    """Stored travel preferences (opt-in)."""
    __tablename__ = 'user_preferences'

    user_id = db.Column(Uuid, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)

    remember_preferences = db.Column(db.Boolean, default=False)
    default_budget_tier = db.Column(db.Text, nullable=True)
    default_pace = db.Column(db.Text, nullable=True)
    default_home_city = db.Column(db.Text, nullable=True)
    default_home_airport = db.Column(db.Text, nullable=True)
    interests_array = db.Column(db.Text, nullable=True)        # JSON-encoded list
    constraints = db.Column(db.JSON, nullable=True)

    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    user = db.relationship('User', back_populates='preferences')

    def to_dict(self):
        return {
            'rememberPreferences': self.remember_preferences,
            'defaultBudgetTier': self.default_budget_tier,
            'defaultPace': self.default_pace,
            'defaultHomeCity': self.default_home_city,
            'defaultHomeAirport': self.default_home_airport,
            'interests': self.interests_array,
            'constraints': self.constraints,
        }

    def __repr__(self):
        return f'<UserPreferences user={self.user_id}>'
