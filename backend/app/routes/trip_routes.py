import json
import logging

from flask import Response, g, jsonify, request, stream_with_context
from app.routes import api_bp
from app.utils.auth import require_auth
from app.services.trip_service import TripService

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Create trip + start AI generation (returns trip id immediately)
# ------------------------------------------------------------------
@api_bp.route('/trips', methods=['POST'])
@require_auth
def create_trip():
    """Create a new trip record and return it.

    The frontend should then open an SSE connection to
    GET /trips/<id>/stream to receive generated sections progressively.
    """
    user = g.current_user

    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'Form data is required'}), 400

    form_data = data.get('formData', data)
    trip = TripService.create_trip_record(str(user.id), form_data)
    return jsonify({'success': True, 'trip': trip.to_dict()}), 201


# ------------------------------------------------------------------
# SSE streaming endpoint – generates trip sections progressively
# ------------------------------------------------------------------
@api_bp.route('/trips/<trip_id>/stream', methods=['GET'])
@require_auth
def stream_trip_generation(trip_id):
    """Server-Sent Events endpoint that drives the AI generation pipeline.

    Events emitted:
      - status: { "phase": "generating_plan" | "generating_stays" | "generating_flights" }
      - section_ready: { "section": "plan"|"stays"|"flights", "data": { ... } }
      - done: { "tripId": "..." }
      - error: { "message": "..." }
    """
    user = g.current_user

    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"

    def generate():
        from app.services import ai_service
        from app import db as _db

        form_data = {
            'destinations': [trip.destination] if trip.destination else [],
            'startDate': trip.start_date.isoformat() if trip.start_date else None,
            'endDate': trip.end_date.isoformat() if trip.end_date else None,
            'travelers': trip.travelers_count,
            'budget': trip.budget_tier,
            'origin': trip.origin,
            'mustDo': trip.must_do,
            'preferences': {
                'interests': trip.interests_array.split(',') if trip.interests_array else [],
                'pace': trip.pace or 'balanced',
            },
        }

        run = TripService.create_generation_run(trip, form_data)

        try:
            # Phase 1: Plan
            yield _sse('status', {'phase': 'generating_plan'})
            plan_data = ai_service.generate_plan(form_data)
            TripService.persist_plan(trip, plan_data)
            _db.session.refresh(trip)
            yield _sse('section_ready', {
                'section': 'plan',
                'data': [d.to_dict() for d in trip.days],
            })

            # Phase 2: Stays
            yield _sse('status', {'phase': 'generating_stays'})
            stays_data = ai_service.generate_stays(form_data)
            TripService.persist_stays(trip, stays_data)
            _db.session.refresh(trip)
            yield _sse('section_ready', {
                'section': 'stays',
                'data': [s.to_dict() for s in trip.stay_options],
            })

            # Phase 3: Flights
            yield _sse('status', {'phase': 'generating_flights'})
            flights_data = ai_service.generate_flights(form_data)
            TripService.persist_flights(trip, flights_data)
            _db.session.refresh(trip)
            yield _sse('section_ready', {
                'section': 'flights',
                'data': [f.to_dict() for f in trip.flight_options],
            })

            # Mark trip as ready
            trip.status = 'ready'
            _db.session.commit()

            TripService.complete_generation_run(run, 'completed')
            yield _sse('done', {'tripId': str(trip.id)})

        except Exception as exc:
            logger.exception("Trip generation failed for trip %s", trip_id)
            trip.status = 'error'
            _db.session.commit()
            TripService.complete_generation_run(run, 'failed', str(exc))
            yield _sse('error', {'message': str(exc)})

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        },
    )


# ------------------------------------------------------------------
# Standard CRUD
# ------------------------------------------------------------------
@api_bp.route('/trips', methods=['GET'])
@require_auth
def get_trips():
    """Get all trips for the authenticated user (summary list)."""
    user = g.current_user

    trips = TripService.get_user_trips(str(user.id))
    return jsonify({
        'success': True,
        'trips': [t.to_dict() for t in trips],
    }), 200


@api_bp.route('/trips/<trip_id>', methods=['GET'])
@require_auth
def get_trip(trip_id):
    """Get a specific trip with full details."""
    user = g.current_user

    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>', methods=['PUT'])
@require_auth
def update_trip(trip_id):
    """Update a trip (scoped edit)."""
    user = g.current_user

    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400

    trip = TripService.update_trip(trip_id, str(user.id), data)
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/geocode', methods=['POST'])
@require_auth
def geocode_trip(trip_id):
    """Re-geocode all plan items for an existing trip.

    Useful when a trip was generated before a Google Maps API key was configured,
    or when geocoding previously failed.
    """
    from app.services.geocoding_service import geocode_place
    from app import db as _db
    from app.models.plan_item import PlanItem
    from app.models.trip_day import TripDay

    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    updated = 0
    for day in trip.days:
        for item in day.plan_items:
            if item.lat is not None and item.lng is not None:
                continue  # already geocoded
            query = item.location_name or item.title or ''
            if not query:
                continue
            geo = geocode_place(query)
            if geo['lat'] is not None:
                item.lat = geo['lat']
                item.lng = geo['lng']
                item.address = item.address or geo['address']
                item.location_name = item.location_name or geo['location_name']
                item.maps_url = item.maps_url or geo['maps_url']
                updated += 1

    _db.session.commit()
    _db.session.refresh(trip)

    return jsonify({
        'success': True,
        'updatedItems': updated,
        'trip': trip.to_dict(include_details=True),
    }), 200


@api_bp.route('/trips/<trip_id>', methods=['DELETE'])
@require_auth
def delete_trip(trip_id):
    """Delete a trip."""
    user = g.current_user

    deleted = TripService.delete_trip(trip_id, str(user.id))
    if not deleted:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    return jsonify({'success': True, 'message': 'Trip deleted'}), 200
