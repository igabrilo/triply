import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class Trip(db.Model):
    """Core trip record with form input fields."""
    __tablename__ = 'trips'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(Uuid, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)

    title = db.Column(db.Text, nullable=True)
    destination = db.Column(db.Text, nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    travelers_count = db.Column(db.Integer, nullable=True)
    origin = db.Column(db.Text, nullable=True)
    budget_tier = db.Column(db.Text, nullable=True)
    pace = db.Column(db.Text, nullable=True)
    interests_array = db.Column(db.Text, nullable=True)       # JSON-encoded list
    constraints = db.Column(db.JSON, nullable=True)
    must_do = db.Column(db.Text, nullable=True)

    status = db.Column(db.Text, default='generating', index=True)  # generating | ready | error

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    user = db.relationship('User', back_populates='trips')
    days = db.relationship('TripDay', back_populates='trip', cascade='all, delete-orphan',
                           order_by='TripDay.day_index')
    flight_options = db.relationship('FlightOption', back_populates='trip', cascade='all, delete-orphan')
    stay_options = db.relationship('StayOption', back_populates='trip', cascade='all, delete-orphan')
    generation_runs = db.relationship('TripGenerationRun', back_populates='trip', cascade='all, delete-orphan')
    chat_threads = db.relationship('ChatThread', back_populates='trip', cascade='all, delete-orphan')
    edits = db.relationship('TripEdit', back_populates='trip', cascade='all, delete-orphan')
    price_alerts = db.relationship('PriceAlert', back_populates='trip', cascade='all, delete-orphan')
    usage_events = db.relationship('UsageEvent', back_populates='trip', lazy='dynamic')
    notification_events = db.relationship('NotificationEvent', back_populates='trip', lazy='dynamic')

    # --- Serialization ---
    def to_dict(self, include_details=False):
        ai_generated = self.constraints.get('aiGenerated', {}) if isinstance(self.constraints, dict) else {}
        selection = ai_generated.get('selection', {}) if isinstance(ai_generated, dict) else {}
        data = {
            'id': str(self.id),
            'userId': str(self.user_id),
            'title': self.title,
            'destination': self.destination,
            'startDate': self.start_date.isoformat() if self.start_date else None,
            'endDate': self.end_date.isoformat() if self.end_date else None,
            'travelersCount': self.travelers_count,
            'origin': self.origin,
            'budgetTier': self.budget_tier,
            'pace': self.pace,
            'interests': self.interests_array,
            'constraints': self.constraints,
            'selectedFlightId': selection.get('selectedFlightId'),
            'selectedStayId': selection.get('selectedStayId'),
            'mustDo': self.must_do,
            'status': self.status,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_details:
            data['days'] = [d.to_dict() for d in self.days]
            data['flights'] = [f.to_dict() for f in self.flight_options]
            data['stays'] = [s.to_dict() for s in self.stay_options]
        return data

    def __repr__(self):
        return f'<Trip {self.id} – {self.destination}>'
