from app import db
from app.models.trip import Trip
from app.models.chat_message import ChatMessage


class ChatService:
    """Service for chat operations."""

    # Free tier limits
    MAX_EDITS_FREE = 5

    @staticmethod
    def get_messages(trip_id: int, user_id: int):
        """Get chat messages for a trip (with ownership check)."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None
        return ChatMessage.query.filter_by(trip_id=trip_id).order_by(ChatMessage.created_at.asc()).all()

    @staticmethod
    def send_message(trip_id: int, user_id: int, content: str, edit_scope: dict = None):
        """Process a chat message and generate a response."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None

        # Check edit limits for free tier
        if trip.user.subscription_tier == 'free' and trip.edit_count >= ChatService.MAX_EDITS_FREE:
            return None

        # Save user message
        user_msg = ChatMessage(
            trip_id=trip_id,
            role='user',
            content=content,
        )
        if edit_scope:
            user_msg.edit_scope = edit_scope
        db.session.add(user_msg)

        # Generate response (placeholder - will be replaced with AI)
        response_content = ChatService._generate_response(content, edit_scope)
        assistant_msg = ChatMessage(
            trip_id=trip_id,
            role='assistant',
            content=response_content,
        )
        db.session.add(assistant_msg)

        # Increment edit count
        trip.edit_count += 1
        db.session.commit()

        return {
            'user_message': user_msg,
            'assistant_message': assistant_msg,
        }

    @staticmethod
    def _generate_response(content: str, edit_scope: dict = None) -> str:
        """Generate a mock AI response. Will be replaced with actual AI integration."""
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
