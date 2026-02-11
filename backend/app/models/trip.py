from app import db
from datetime import datetime
import json


class Trip(db.Model):
    """Trip model storing generated trip data."""
    __tablename__ = 'trips'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    # Form input (stored as JSON)
    form_data_json = db.Column(db.Text, nullable=False)

    # Generated results (stored as JSON)
    flights_json = db.Column(db.Text, nullable=True)
    stays_json = db.Column(db.Text, nullable=True)
    plan_json = db.Column(db.Text, nullable=True)

    # Saved/favorited items
    saved_items_json = db.Column(db.Text, nullable=True)

    # Meta
    status = db.Column(db.String(20), default='generating')  # generating | ready | error
    edit_count = db.Column(db.Integer, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    chat_messages = db.relationship('ChatMessage', backref='trip', lazy='dynamic')

    @property
    def form_data(self):
        return json.loads(self.form_data_json) if self.form_data_json else {}

    @form_data.setter
    def form_data(self, value):
        self.form_data_json = json.dumps(value)

    @property
    def flights(self):
        return json.loads(self.flights_json) if self.flights_json else []

    @flights.setter
    def flights(self, value):
        self.flights_json = json.dumps(value)

    @property
    def stays(self):
        return json.loads(self.stays_json) if self.stays_json else []

    @stays.setter
    def stays(self, value):
        self.stays_json = json.dumps(value)

    @property
    def plan(self):
        return json.loads(self.plan_json) if self.plan_json else []

    @plan.setter
    def plan(self, value):
        self.plan_json = json.dumps(value)

    @property
    def saved_items(self):
        return json.loads(self.saved_items_json) if self.saved_items_json else []

    @saved_items.setter
    def saved_items(self, value):
        self.saved_items_json = json.dumps(value)

    def to_dict(self):
        return {
            'id': str(self.id),
            'userId': str(self.user_id),
            'formData': self.form_data,
            'flights': self.flights,
            'stays': self.stays,
            'plan': self.plan,
            'savedItems': self.saved_items,
            'status': self.status,
            'editCount': self.edit_count,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<Trip {self.id} by User {self.user_id}>'
