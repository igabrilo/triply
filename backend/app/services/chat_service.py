from typing import Optional

from app import db
from app.models.trip import Trip
from app.models.chat_thread import ChatThread
from app.models.chat_message import ChatMessage
from app.models.trip_edit import TripEdit


class ChatService:
    """Service for chat-based trip editing."""

    # Free tier limits
    MAX_EDITS_FREE = 5

    # ------------------------------------------------------------------
    # Threads
    # ------------------------------------------------------------------
    @staticmethod
    def get_or_create_thread(trip_id: str, user_id: str) -> Optional[ChatThread]:
        """Return the latest thread for a trip, or create one."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None

        thread = (ChatThread.query
                  .filter_by(trip_id=trip_id)
                  .order_by(ChatThread.created_at.desc())
                  .first())
        if not thread:
            thread = ChatThread(trip_id=trip_id)
            db.session.add(thread)
            db.session.commit()
        return thread

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------
    @staticmethod
    def get_messages(trip_id: str, user_id: str):
        """Get all messages across all threads for a trip (flat list)."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None
        return (ChatMessage.query
                .join(ChatThread)
                .filter(ChatThread.trip_id == trip_id)
                .order_by(ChatMessage.created_at.asc())
                .all())

    @staticmethod
    def send_message(trip_id: str, user_id: str, content: str, edit_scope: Optional[dict] = None):
        """Process a user message, generate mock response, record edit."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None

        # Check edit limit (count existing edits)
        edit_count = TripEdit.query.filter_by(trip_id=trip_id).count()
        # TODO: check subscription tier
        if edit_count >= ChatService.MAX_EDITS_FREE:
            return None

        # Ensure thread exists
        thread = (ChatThread.query
                  .filter_by(trip_id=trip_id)
                  .order_by(ChatThread.created_at.desc())
                  .first())
        if not thread:
            thread = ChatThread(trip_id=trip_id)
            db.session.add(thread)
            db.session.flush()

        # Save user message
        scope = edit_scope.get('section') if edit_scope else None
        target_ref_type = edit_scope.get('targetRefType') if edit_scope else None
        target_ref_id = edit_scope.get('targetRefId') if edit_scope else None

        user_msg = ChatMessage(
            thread_id=thread.id,
            role='user',
            content=content,
            scope=scope,
            target_ref_type=target_ref_type,
            target_ref_id=target_ref_id,
        )
        db.session.add(user_msg)
        db.session.flush()

        # Generate mock response (will be replaced with AI)
        response_content = ChatService._generate_response(content, edit_scope)
        assistant_msg = ChatMessage(
            thread_id=thread.id,
            role='assistant',
            content=response_content,
        )
        db.session.add(assistant_msg)

        # Record the edit
        edit = TripEdit(
            trip_id=trip_id,
            thread_id=thread.id,
            user_message_id=user_msg.id,
            scope=scope,
            target_ref_type=target_ref_type,
            target_ref_id=target_ref_id,
            instruction=content,
            result_summary=response_content,
            status='applied',
        )
        db.session.add(edit)
        db.session.commit()

        return {
            'user_message': user_msg,
            'assistant_message': assistant_msg,
            'edit': edit,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _generate_response(content: str, edit_scope: Optional[dict] = None) -> str:
        """Mock AI response – placeholder for real generation."""
        scope_text = ''
        if edit_scope:
            scope_text = f" for {edit_scope.get('section', 'the trip')}"
            if edit_scope.get('dayNumber'):
                scope_text += f" (Day {edit_scope['dayNumber']})"

        return (
            f"I've noted your request{scope_text}. "
            f"Let me adjust the plan based on: \"{content}\". "
            f"The changes will be reflected in your dashboard shortly."
        )
