from app import db
from datetime import datetime
import json


class ChatMessage(db.Model):
    """Chat message model for edit history per trip."""
    __tablename__ = 'chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey('trips.id'), nullable=False, index=True)

    role = db.Column(db.String(20), nullable=False)  # user | assistant | system
    content = db.Column(db.Text, nullable=False)

    # Edit scope (optional, JSON)
    edit_scope_json = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def edit_scope(self):
        return json.loads(self.edit_scope_json) if self.edit_scope_json else None

    @edit_scope.setter
    def edit_scope(self, value):
        self.edit_scope_json = json.dumps(value) if value else None

    def to_dict(self):
        return {
            'id': str(self.id),
            'tripId': str(self.trip_id),
            'role': self.role,
            'content': self.content,
            'editScope': self.edit_scope,
            'timestamp': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<ChatMessage {self.id} ({self.role})>'
