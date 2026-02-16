from flask import jsonify, request
from app.routes import api_bp


@api_bp.route('/', methods=['GET'])
def index():
    """Health check endpoint."""
    return jsonify({
        'message': 'Triply API',
        'status': 'running',
        'version': '1.0.0',
    }), 200


@api_bp.route('/geocode/reverse', methods=['GET'])
def reverse_geocode():
    """Resolve lat/lng to a city name.

    Query params: ?lat=45.81&lng=15.98
    Returns: { "success": true, "city": "Zagreb, Croatia" }
    """
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)

    if lat is None or lng is None:
        return jsonify({'success': False, 'message': 'lat and lng query params are required'}), 400

    from app.services.geocoding_service import reverse_geocode_city
    city = reverse_geocode_city(lat, lng)

    if city:
        return jsonify({'success': True, 'city': city}), 200
    else:
        return jsonify({'success': False, 'message': 'Could not determine city from coordinates'}), 200


@api_bp.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Resource not found'}), 404


@api_bp.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500
