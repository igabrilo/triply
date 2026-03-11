from flask import g, jsonify, request
from app.routes import api_bp
from app.utils.auth import require_auth
from app import db


@api_bp.route('/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    """Return the authenticated user's profile.

    The Supabase access-token is verified by the @require_auth decorator
    which populates ``g.current_user``.
    """
    return jsonify({'success': True, 'user': g.current_user.to_dict()}), 200


@api_bp.route('/auth/me', methods=['PUT'])
@require_auth
def update_current_user():
    """Update the authenticated user's profile (name)."""
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'success': False, 'message': 'Name is required'}), 400
    if len(name) > 120:
        return jsonify({'success': False, 'message': 'Name is too long'}), 400

    user = g.current_user
    user.name = name
    db.session.commit()
    return jsonify({'success': True, 'user': user.to_dict()}), 200


@api_bp.route('/auth/me/preferences', methods=['PUT'])
@require_auth
def update_user_preferences():
    """Update the authenticated user's travel preferences."""
    data = request.get_json() or {}
    user = g.current_user

    if user.preferences is None:
        from app.models.user_preferences import UserPreferences
        user.preferences = UserPreferences()
        db.session.add(user.preferences)

    prefs = user.preferences
    if 'interests' in data:
        val = data['interests']
        prefs.interests_array = ','.join(val) if isinstance(val, list) else str(val) if val else None
    if 'defaultPace' in data:
        prefs.default_pace = str(data['defaultPace']).strip() or None
    if 'defaultHomeAirport' in data:
        prefs.default_home_airport = str(data['defaultHomeAirport']).strip() or None
    if 'rememberPreferences' in data:
        prefs.remember_preferences = bool(data['rememberPreferences'])

    db.session.commit()
    return jsonify({'success': True, 'user': user.to_dict()}), 200


@api_bp.route('/auth/me/notifications', methods=['PUT'])
@require_auth
def update_user_notifications():
    """Update the authenticated user's notification preferences."""
    data = request.get_json() or {}
    user = g.current_user

    if user.notification_preferences is None:
        from app.models.notification_preferences import NotificationPreferences
        user.notification_preferences = NotificationPreferences()
        db.session.add(user.notification_preferences)

    np = user.notification_preferences
    if 'priceAlerts' in data:
        np.price_alerts = bool(data['priceAlerts'])
    if 'tripReminders' in data:
        np.trip_reminders = bool(data['tripReminders'])
    if 'productUpdates' in data:
        np.product_updates = bool(data['productUpdates'])
    if 'marketingOptIn' in data:
        np.marketing_opt_in = bool(data['marketingOptIn'])

    db.session.commit()
    return jsonify({'success': True, 'user': user.to_dict()}), 200


