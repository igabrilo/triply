import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class ChatThread(db.Model):
    """Conversation thread scoped to a trip."""
    __tablename__ = 'chat_threads'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = db.Column(Uuid, db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False, index=True)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # --- Relationships ---
    trip = db.relationship('Trip', back_populates='chat_threads')
    messages = db.relationship('ChatMessage', back_populates='thread', cascade='all, delete-orphan',
                               order_by='ChatMessage.created_at')
    edits = db.relationship('TripEdit', back_populates='thread', cascade='all, delete-orphan')

    def to_dict(self, include_messages=False):
        data = {
            'id': str(self.id),
            'tripId': str(self.trip_id),
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }
        if include_messages:
            data['messages'] = [m.to_dict() for m in self.messages]
        return data

    def __repr__(self):
        return f'<ChatThread {self.id}>'
