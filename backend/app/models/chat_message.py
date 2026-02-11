import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class ChatMessage(db.Model):
    """Single message inside a chat thread."""
    __tablename__ = 'chat_messages'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    thread_id = db.Column(Uuid, db.ForeignKey('chat_threads.id', ondelete='CASCADE'), nullable=False, index=True)

    role = db.Column(db.Text, nullable=False)                   # user | assistant | system
    scope = db.Column(db.Text, nullable=True)                   # flights | stays | plan | day | item
    target_ref_type = db.Column(db.Text, nullable=True)         # trip_day | plan_item | flight_option | …
    target_ref_id = db.Column(Uuid, nullable=True)

    content = db.Column(db.Text, nullable=False)
    context_snapshot = db.Column(db.JSON, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # --- Relationships ---
    thread = db.relationship('ChatThread', back_populates='messages')

    def to_dict(self):
        return {
            'id': str(self.id),
            'threadId': str(self.thread_id),
            'role': self.role,
            'scope': self.scope,
            'targetRefType': self.target_ref_type,
            'targetRefId': str(self.target_ref_id) if self.target_ref_id else None,
            'content': self.content,
            'contextSnapshot': self.context_snapshot,
            'timestamp': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<ChatMessage {self.id} ({self.role})>'
