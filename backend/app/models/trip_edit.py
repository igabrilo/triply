import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class TripEdit(db.Model):
    """Record of an AI-driven edit applied to a trip."""
    __tablename__ = 'trip_edits'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = db.Column(Uuid, db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False, index=True)
    thread_id = db.Column(Uuid, db.ForeignKey('chat_threads.id', ondelete='SET NULL'), nullable=True)
    user_message_id = db.Column(Uuid, db.ForeignKey('chat_messages.id', ondelete='SET NULL'), nullable=True)

    scope = db.Column(db.Text, nullable=True)
    target_ref_type = db.Column(db.Text, nullable=True)
    target_ref_id = db.Column(Uuid, nullable=True)

    instruction = db.Column(db.Text, nullable=True)
    result_summary = db.Column(db.Text, nullable=True)
    diff = db.Column(db.JSON, nullable=True)

    status = db.Column(db.Text, default='pending')              # pending | applied | failed | reverted
    error_message = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # --- Relationships ---
    trip = db.relationship('Trip', back_populates='edits')
    thread = db.relationship('ChatThread', back_populates='edits')
    user_message = db.relationship('ChatMessage', foreign_keys=[user_message_id])

    def to_dict(self):
        return {
            'id': str(self.id),
            'tripId': str(self.trip_id),
            'threadId': str(self.thread_id) if self.thread_id else None,
            'userMessageId': str(self.user_message_id) if self.user_message_id else None,
            'scope': self.scope,
            'targetRefType': self.target_ref_type,
            'targetRefId': str(self.target_ref_id) if self.target_ref_id else None,
            'instruction': self.instruction,
            'resultSummary': self.result_summary,
            'diff': self.diff,
            'status': self.status,
            'errorMessage': self.error_message,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<TripEdit {self.id} [{self.status}]>'
