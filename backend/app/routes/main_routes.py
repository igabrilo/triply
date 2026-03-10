from datetime import datetime, timezone

from flask import Response, current_app, jsonify, request
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


@api_bp.route('/geocode/search', methods=['GET'])
def geocode_search():
    """Resolve a place query into coordinates and maps URL.

    Query params: ?q=Zagreb+Airport
    Returns: { "success": true, "result": { lat, lng, location_name, address, maps_url } }
    """
    query = (request.args.get('q') or '').strip()
    if not query:
        return jsonify({'success': False, 'message': 'q query param is required'}), 400

    from app.services.geocoding_service import geocode_place
    result = geocode_place(query)
    return jsonify({'success': True, 'result': result}), 200


@api_bp.route('/media/place-photo', methods=['GET'])
def place_photo():
    """Proxy a real place photo image for place query or place identifiers.

    Query params:
      - q: place query (optional)
      - pid: Google place_id (optional)
      - pref: Google photo_reference (optional)
      - pname: Google Places API (New) photo name (optional)
      - w: max width (optional, default 640)
      - h: max height (optional)
      - norand: when 1/true, disables random fallback image sources
      - destination: destination hint for disambiguation (optional)
    """
    query = (request.args.get('q') or '').strip()
    place_id = (request.args.get('pid') or '').strip()
    photo_reference = (request.args.get('pref') or '').strip()
    photo_name = (request.args.get('pname') or '').strip()
    if not (query or place_id or photo_reference or photo_name):
        return jsonify({'success': False, 'message': 'Provide one of: q, pid, pref, pname'}), 400

    max_width = request.args.get('w', default=640, type=int)
    max_height = request.args.get('h', type=int)
    disable_random = str(request.args.get('norand', '')).strip().lower() in {'1', 'true', 'yes'}
    destination = (request.args.get('destination') or '').strip()

    from app.services.geocoding_service import fetch_place_photo
    photo = fetch_place_photo(
        query,
        max_width=max_width,
        max_height=max_height,
        place_id=place_id or None,
        photo_reference=photo_reference or None,
        photo_name=photo_name or None,
        allow_random_fallback=not disable_random,
        destination_hint=destination or None,
    )
    if not photo:
        return Response(status=404)

    body, content_type = photo
    return Response(
        body,
        mimetype=content_type,
        headers={
            'Cache-Control': 'public, max-age=86400',
        },
    )


@api_bp.route('/media/overview-hero', methods=['GET'])
def overview_hero_photo():
    """Resolve a destination into a recognizable overview hero image."""
    destination = (request.args.get('destination') or request.args.get('q') or '').strip()
    if not destination:
        return jsonify({'success': False, 'message': 'destination query param is required'}), 400

    max_width = request.args.get('w', default=1600, type=int)
    max_height = request.args.get('h', default=900, type=int)

    from app.services.geocoding_service import fetch_destination_hero_photo
    photo = fetch_destination_hero_photo(
        destination,
        max_width=max_width,
        max_height=max_height,
    )
    if not photo:
        return Response(status=404)

    body, content_type = photo
    return Response(
        body,
        mimetype=content_type,
        headers={
            'Cache-Control': 'public, max-age=86400',
        },
    )


@api_bp.route('/feature-flags', methods=['GET'])
def get_feature_flags():
    """Return runtime feature flags for frontend gating."""
    return jsonify({
        'success': True,
        'flags': {
            'firstPlanGuide': bool(current_app.config.get('FEATURE_FIRST_PLAN_GUIDE', True)),
            'nextBestActions': bool(current_app.config.get('FEATURE_NEXT_BEST_ACTIONS', True)),
            'activationAnalytics': bool(current_app.config.get('FEATURE_ACTIVATION_ANALYTICS', True)),
        },
        'fetchedAt': datetime.now(timezone.utc).isoformat(),
    }), 200


@api_bp.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Resource not found'}), 404


@api_bp.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500
