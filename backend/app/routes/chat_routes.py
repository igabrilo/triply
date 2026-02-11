from flask import jsonify, request
from app.routes import api_bp
from app.services.auth_service import AuthService
from app.services.chat_service import ChatService


def _get_user():
    """Helper to extract authenticated user from token."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    return AuthService.get_user_from_token(token)


@api_bp.route('/trips/<trip_id>/chat', methods=['GET'])
def get_chat_history(trip_id):
    """Get chat message history for a trip."""
    user = _get_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    messages = ChatService.get_messages(trip_id, str(user.id))
    if messages is None:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({
        'success': True,
        'messages': [m.to_dict() for m in messages],
    }), 200


@api_bp.route('/trips/<trip_id>/chat', methods=['POST'])
def send_chat_message(trip_id):
    """Send a chat message and get AI response."""
    user = _get_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'success': False, 'message': 'Message content is required'}), 400

    result = ChatService.send_message(
        trip_id=trip_id,
        user_id=str(user.id),
        content=data['content'],
        edit_scope=data.get('editScope'),
    )

    if not result:
        return jsonify({'success': False, 'message': 'Trip not found or edit limit reached'}), 404

    return jsonify({
        'success': True,
        'userMessage': result['user_message'].to_dict(),
        'assistantMessage': result['assistant_message'].to_dict(),
        'edit': result['edit'].to_dict(),
    }), 200
