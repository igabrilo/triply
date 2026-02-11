from flask import jsonify, request
from app.routes import api_bp
from app.services.auth_service import AuthService
from app.services.trip_service import TripService


def _get_user():
    """Helper to extract authenticated user from token."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    return AuthService.get_user_from_token(token)


@api_bp.route('/trips', methods=['POST'])
def create_trip():
    """Create a new trip (save generated results)."""
    user = _get_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    data = request.get_json()
    if not data or 'formData' not in data:
        return jsonify({'success': False, 'message': 'Form data is required'}), 400

    trip = TripService.create_trip(str(user.id), data)
    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 201


@api_bp.route('/trips', methods=['GET'])
def get_trips():
    """Get all trips for the authenticated user (summary list)."""
    user = _get_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    trips = TripService.get_user_trips(str(user.id))
    return jsonify({
        'success': True,
        'trips': [t.to_dict() for t in trips],
    }), 200


@api_bp.route('/trips/<trip_id>', methods=['GET'])
def get_trip(trip_id):
    """Get a specific trip with full details."""
    user = _get_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>', methods=['PUT'])
def update_trip(trip_id):
    """Update a trip (scoped edit)."""
    user = _get_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400

    trip = TripService.update_trip(trip_id, str(user.id), data)
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>', methods=['DELETE'])
def delete_trip(trip_id):
    """Delete a trip."""
    user = _get_user()
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    deleted = TripService.delete_trip(trip_id, str(user.id))
    if not deleted:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({'success': True, 'message': 'Trip deleted'}), 200
