from flask import jsonify, request
from app.routes import api_bp
from app.services.auth_service import AuthService
from app.services.trip_service import TripService


def get_authenticated_user():
    """Helper to extract user from token."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    return AuthService.get_user_from_token(token)


@api_bp.route('/trips', methods=['POST'])
def create_trip():
    """Create a new trip (save generated results)."""
    user = get_authenticated_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    data = request.get_json()
    if not data or 'formData' not in data:
        return jsonify({'success': False, 'message': 'Form data is required'}), 400

    result = TripService.create_trip(user.id, data)
    return jsonify({'success': True, 'trip': result.to_dict()}), 201


@api_bp.route('/trips', methods=['GET'])
def get_trips():
    """Get all trips for the authenticated user."""
    user = get_authenticated_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    trips = TripService.get_user_trips(user.id)
    return jsonify({
        'success': True,
        'trips': [t.to_dict() for t in trips]
    }), 200


@api_bp.route('/trips/<int:trip_id>', methods=['GET'])
def get_trip(trip_id):
    """Get a specific trip."""
    user = get_authenticated_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    trip = TripService.get_trip(trip_id, user.id)
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({'success': True, 'trip': trip.to_dict()}), 200


@api_bp.route('/trips/<int:trip_id>', methods=['PUT'])
def update_trip(trip_id):
    """Update a trip section (scoped edit)."""
    user = get_authenticated_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400

    trip = TripService.update_trip(trip_id, user.id, data)
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({'success': True, 'trip': trip.to_dict()}), 200


@api_bp.route('/trips/<int:trip_id>', methods=['DELETE'])
def delete_trip(trip_id):
    """Delete a trip."""
    user = get_authenticated_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    deleted = TripService.delete_trip(trip_id, user.id)
    if not deleted:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({'success': True, 'message': 'Trip deleted'}), 200
