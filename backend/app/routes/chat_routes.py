from flask import g, jsonify, request
from app.routes import api_bp
from app.utils.auth import require_auth
from app.services.chat_service import ChatService


@api_bp.route('/trips/<trip_id>/chat', methods=['GET'])
@require_auth
def get_chat_history(trip_id):
    """Get chat message history for a trip."""
    user = g.current_user

    messages = ChatService.get_messages(trip_id, str(user.id))
    if messages is None:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({
        'success': True,
        'messages': [m.to_dict() for m in messages],
    }), 200


@api_bp.route('/trips/<trip_id>/chat', methods=['POST'])
@require_auth
def send_chat_message(trip_id):
    """Send a chat message, get AI response, and apply scoped edit.

    Returns the messages plus the updated section data so the
    frontend can refresh the affected part of the dashboard.
    """
    user = g.current_user

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
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    if isinstance(result, dict) and result.get('error') == 'edit_limit_reached':
        return jsonify({
            'success': False,
            'message': 'Edit limit reached. Upgrade to continue editing.',
            'error': 'edit_limit_reached',
        }), 429

    # Build response with updated section data
    response = {
        'success': True,
        'userMessage': result['user_message'].to_dict(),
        'assistantMessage': result['assistant_message'].to_dict(),
        'edit': result['edit'].to_dict(),
        'updatedSection': result.get('updated_section'),
    }

    # Include the refreshed section data so frontend doesn't need a second fetch
    trip = result.get('trip')
    if trip and result.get('updated_section'):
        section = result['updated_section']
        if section == 'plan':
            response['sectionData'] = [d.to_dict() for d in trip.days]
        elif section == 'stays':
            response['sectionData'] = [s.to_dict() for s in trip.stay_options]
        elif section == 'flights':
            response['sectionData'] = [f.to_dict() for f in trip.flight_options]

    return jsonify(response), 200
