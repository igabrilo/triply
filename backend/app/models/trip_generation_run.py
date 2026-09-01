import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class TripGenerationRun(db.Model):
    """Audit log for each AI generation attempt."""
    __tablename__ = 'trip_generation_runs'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = db.Column(Uuid, db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False, index=True)

    input_snapshot = db.Column(db.JSON, nullable=True)
    model_info = db.Column(db.JSON, nullable=True)
    token_usage = db.Column(db.JSON, nullable=True)

    status = db.Column(db.Text, default='pending')              # pending | running | completed | failed
    error_message = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # --- Relationships ---
    trip = db.relationship('Trip', back_populates='generation_runs')

    def to_dict(self):
        return {
            'id': str(self.id),
            'tripId': str(self.trip_id),
            'inputSnapshot': self.input_snapshot,
            'modelInfo': self.model_info,
            'tokenUsage': self.token_usage,
            'status': self.status,
            'errorMessage': self.error_message,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<TripGenerationRun {self.id} [{self.status}]>'
