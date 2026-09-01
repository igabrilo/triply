from datetime import datetime, timezone

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


@api_bp.route('/auth/usage-limits', methods=['GET'])
@require_auth
def get_usage_limits():
    """Return the user's current usage vs plan limits."""
    from app.models.trip import Trip
    from app.models.trip_edit import TripEdit

    user = g.current_user
    plan = user.plan or 'basic'
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    trips_today = Trip.query.filter(
        Trip.user_id == user.id,
        Trip.created_at >= today_start,
    ).count()

    # Per-trip edit counts for current trip (optional query param)
    trip_id = request.args.get('tripId')
    edits_today = 0
    if trip_id:
        edits_today = TripEdit.query.filter(
            TripEdit.trip_id == trip_id,
            TripEdit.created_at >= today_start,
        ).count()

    if plan == 'premium':
        return jsonify({
            'success': True,
            'plan': 'premium',
            'limits': {
                'tripsPerDay': None,
                'tripsUsedToday': trips_today,
                'chatEditsPerTripPerDay': None,
                'chatEditsUsedToday': edits_today,
            },
        }), 200

    return jsonify({
        'success': True,
        'plan': 'basic',
        'limits': {
            'tripsPerDay': 2,
            'tripsUsedToday': trips_today,
            'chatEditsPerTripPerDay': 5,
            'chatEditsUsedToday': edits_today,
        },
    }), 200


