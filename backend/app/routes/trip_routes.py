import json
import logging
import re
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote_plus

from flask import Response, g, jsonify, request, stream_with_context
from app.routes import api_bp
from app.utils.auth import require_auth
from app.services.trip_service import TripService
from app.services.pdf_service import build_overview_pdf

logger = logging.getLogger(__name__)


def _maps_search_url(query: str) -> str:
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(query)}"


def _overview_place_photo_url(destination: str) -> str:
    safe_query = quote_plus((destination or '').strip() or 'travel destination')
    return f"/api/media/place-photo?q={safe_query}&w=1600&h=900"


def _activities_to_payload(activities_data):
    payload = []
    for idx, activity in enumerate(activities_data.activities):
        row = activity.model_dump()
        query = (row.get('place_query') or row.get('title') or '').strip()
        if query:
            row['maps_url'] = row.get('maps_url') or _maps_search_url(query)
            row['image_query'] = row.get('image_query') or query
        row['status'] = row.get('status') or 'suggested'
        row['id'] = f'act_{idx}'
        payload.append(row)
    return payload


def _activities_quality_score(activities_payload, expected_days: int) -> tuple[int, bool]:
    count = len(activities_payload or [])
    with_place_query = sum(1 for row in activities_payload if (row.get('place_query') or '').strip())
    categories = len({(row.get('category') or '').strip().lower() for row in activities_payload if row.get('category')})
    min_required = max(8, min(24, expected_days * 3))
    min_with_place_query = max(4, min(10, expected_days * 2))
    ok = count >= min_required and with_place_query >= min_with_place_query
    score = count * 10 + with_place_query * 2 + categories
    return score, ok


def _weather_quality_score(weather_payload, expected_days: int) -> tuple[int, bool]:
    count = len(weather_payload or [])
    with_condition = sum(1 for row in weather_payload if (row.get('condition') or '').strip())
    min_required = max(3, expected_days) if expected_days > 0 else 3
    ok = count >= min_required and with_condition >= max(2, min_required - 1)
    score = count * 8 + with_condition
    return score, ok


def _build_weather_fallback_payload(form_data: dict, expected_days: int) -> list[dict]:
    start_date_raw = form_data.get('startDate') if isinstance(form_data, dict) else None
    end_date_raw = form_data.get('endDate') if isinstance(form_data, dict) else None

    parsed_start = None
    parsed_end = None
    try:
        if start_date_raw:
            parsed_start = date.fromisoformat(str(start_date_raw))
    except (TypeError, ValueError):
        parsed_start = None
    try:
        if end_date_raw:
            parsed_end = date.fromisoformat(str(end_date_raw))
    except (TypeError, ValueError):
        parsed_end = None

    if parsed_start and parsed_end and parsed_end >= parsed_start:
        day_count = (parsed_end - parsed_start).days + 1
    else:
        day_count = expected_days if expected_days > 0 else 3

    day_count = max(3, min(14, day_count))
    start = parsed_start or datetime.now(timezone.utc).date()

    patterns = [
        ('Sunny', '☀️', 29, 20, 44),
        ('Partly cloudy', '⛅', 27, 18, 52),
        ('Mostly clear', '🌤️', 28, 19, 48),
        ('Light showers', '🌦️', 26, 18, 61),
        ('Cloudy intervals', '🌥️', 25, 17, 56),
    ]

    payload = []
    for idx in range(day_count):
        cond, icon, hi, low, humidity = patterns[idx % len(patterns)]
        payload.append({
            'date': (start + timedelta(days=idx)).isoformat(),
            'high_temp_c': hi + (idx % 2),
            'low_temp_c': low + (idx % 2),
            'condition': cond,
            'icon': icon,
            'humidity_pct': min(90, humidity + (idx % 3) * 3),
        })
    return payload


def _trip_has_core_sections(trip) -> bool:
    return len(trip.days) > 0 and len(trip.flight_options) > 0 and len(trip.stay_options) > 0


def _heal_stuck_generating_trip(trip) -> bool:
    if trip.status != 'generating':
        return False
    if not _trip_has_core_sections(trip):
        return False
    created_at = trip.created_at or datetime.now(timezone.utc)
    age_seconds = (datetime.now(timezone.utc) - created_at).total_seconds()
    if age_seconds < 60:
        return False
    from app import db as _db
    trip.status = 'ready'
    _db.session.commit()
    logger.warning("Auto-healed trip %s from generating -> ready", trip.id)
    return True


def _budget_quality_score(budget_payload) -> tuple[int, bool]:
    categories = budget_payload.get('categories', []) if isinstance(budget_payload, dict) else []
    category_count = len(categories)
    with_estimate = sum(1 for row in categories if row.get('estimated_amount'))
    total_estimated = budget_payload.get('total_estimated') if isinstance(budget_payload, dict) else None
    ok = category_count >= 4 and (with_estimate >= 2 or total_estimated is not None)
    score = category_count * 10 + with_estimate * 2 + (3 if total_estimated is not None else 0)
    return score, ok


def _overview_quality_score(overview_payload) -> tuple[int, bool]:
    if not isinstance(overview_payload, dict):
        return 0, False
    summary = str(overview_payload.get('summary') or '').strip()
    notes_seed = overview_payload.get('notes_seed') or []
    image_prompt = str(overview_payload.get('destination_image_prompt') or '').strip()
    summary_word_count = len(summary.split())
    note_count = len([n for n in notes_seed if str(n).strip()])
    ok = summary_word_count >= 18 and note_count >= 3 and len(image_prompt) >= 16
    score = summary_word_count + note_count * 6 + min(len(image_prompt), 60) // 8
    return score, ok


def _safe_track_usage_event(user_id, trip_id, event_name: str, event_props: dict | None = None):
    from app import db as _db
    from app.models.usage_event import UsageEvent

    try:
        _db.session.add(
            UsageEvent(
                user_id=user_id,
                trip_id=trip_id,
                event_name=event_name,
                event_props=event_props or {},
            )
        )
        _db.session.commit()
    except Exception:
        _db.session.rollback()
        logger.warning("Failed to store usage event %s for trip %s", event_name, trip_id, exc_info=True)


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
      - status: generation phase updates
      - section_ready: generated section payload
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
        from app.models.usage_event import UsageEvent

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

        def track_guardrail_retry(section: str, initial_score: int, retry_score: int):
            logger.warning(
                "Guardrail retry for trip %s section=%s initial_score=%s retry_score=%s",
                trip_id,
                section,
                initial_score,
                retry_score,
            )
            _db.session.add(
                UsageEvent(
                    user_id=trip.user_id,
                    trip_id=trip.id,
                    event_name='generation_guardrail_retry',
                    event_props={
                        'section': section,
                        'initialScore': initial_score,
                        'retryScore': retry_score,
                    },
                )
            )

        run = TripService.create_generation_run(trip, form_data)

        try:
            # Phase 1: Plan
            yield _sse('status', {'phase': 'generating_plan'})
            plan_data = ai_service.generate_plan(form_data)
            TripService.persist_plan(trip, plan_data)
            _db.session.refresh(trip)
            expected_days = max(1, len(plan_data.days))
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

            # Core trip is usable after plan + flights + stays.
            if trip.status != 'ready':
                trip.status = 'ready'
                _db.session.commit()

            # Phase 4: Activities bucket
            yield _sse('status', {'phase': 'generating_activities'})
            activities_data = ai_service.generate_activities(form_data)
            activities_payload = _activities_to_payload(activities_data)
            activities_score, activities_ok = _activities_quality_score(activities_payload, expected_days)
            if not activities_ok:
                retry_data = ai_service.generate_activities(
                    form_data,
                    extra_instruction=(
                        "Return at least 15 concrete, diverse activities. "
                        "Avoid generic placeholders and include place_query for each item."
                    ),
                )
                retry_payload = _activities_to_payload(retry_data)
                retry_score, _ = _activities_quality_score(retry_payload, expected_days)
                track_guardrail_retry('activities', activities_score, retry_score)
                if retry_score >= activities_score:
                    activities_payload = retry_payload
            TripService.persist_generated_section(trip, 'activities', activities_payload)
            yield _sse('section_ready', {
                'section': 'activities',
                'data': activities_payload,
            })

            # Phase 5: Weather (informational)
            yield _sse('status', {'phase': 'generating_weather'})
            weather_data = ai_service.generate_weather(form_data)
            weather_payload = [w.model_dump() for w in weather_data.days]
            weather_score, weather_ok = _weather_quality_score(weather_payload, expected_days)
            if not weather_ok:
                retry_data = ai_service.generate_weather(
                    form_data,
                    extra_instruction=(
                        "Cover each trip day with practical conditions and reasonable temperatures. "
                        "Keep dates sequential and avoid empty condition fields."
                    ),
                )
                retry_payload = [w.model_dump() for w in retry_data.days]
                retry_score, _ = _weather_quality_score(retry_payload, expected_days)
                track_guardrail_retry('weather', weather_score, retry_score)
                if retry_score >= weather_score:
                    weather_payload = retry_payload
            weather_score, weather_ok = _weather_quality_score(weather_payload, expected_days)
            if not weather_ok:
                weather_payload = _build_weather_fallback_payload(form_data, expected_days)
                logger.warning("Weather fallback used for trip %s", trip_id)
            TripService.persist_generated_section(trip, 'weather', weather_payload)
            yield _sse('section_ready', {
                'section': 'weather',
                'data': weather_payload,
            })

            # Phase 6: Budget hints
            yield _sse('status', {'phase': 'generating_budget'})
            budget_data = ai_service.generate_budget(form_data)
            budget_payload = budget_data.model_dump()
            budget_score, budget_ok = _budget_quality_score(budget_payload)
            if not budget_ok:
                retry_data = ai_service.generate_budget(
                    form_data,
                    extra_instruction=(
                        "Provide at least 4 budget categories with realistic estimated_amount values "
                        "and include total_estimated."
                    ),
                )
                retry_payload = retry_data.model_dump()
                retry_score, _ = _budget_quality_score(retry_payload)
                track_guardrail_retry('budget', budget_score, retry_score)
                if retry_score >= budget_score:
                    budget_payload = retry_payload
            TripService.persist_generated_section(trip, 'budget', budget_payload)
            yield _sse('section_ready', {
                'section': 'budget',
                'data': budget_payload,
            })

            # Phase 7: Overview content + destination image
            yield _sse('status', {'phase': 'generating_overview'})
            overview_data = ai_service.generate_overview(form_data)
            overview_payload = overview_data.model_dump()
            overview_score, overview_ok = _overview_quality_score(overview_payload)
            if not overview_ok:
                retry_data = ai_service.generate_overview(
                    form_data,
                    extra_instruction=(
                        "Write a concrete summary of at least 18 words and provide at least 3 actionable notes_seed bullets. "
                        "Use a vivid, realistic destination_image_prompt."
                    ),
                )
                retry_payload = retry_data.model_dump()
                retry_score, _ = _overview_quality_score(retry_payload)
                track_guardrail_retry('overview', overview_score, retry_score)
                if retry_score >= overview_score:
                    overview_payload = retry_payload
            primary_destination = (
                (form_data.get('destinations') or [''])[0]
                if isinstance(form_data.get('destinations'), list)
                else form_data.get('destinations')
            ) or trip.destination or ''
            overview_payload['destination_image_url'] = _overview_place_photo_url(str(primary_destination))
            TripService.persist_generated_section(trip, 'overview', overview_payload)
            yield _sse('section_ready', {
                'section': 'overview',
                'data': overview_payload,
            })

            # Mark trip as ready
            trip.status = 'ready'
            _db.session.commit()

            TripService.complete_generation_run(run, 'completed')
            yield _sse('done', {'tripId': str(trip.id)})

        except Exception as exc:
            logger.exception("Trip generation failed for trip %s", trip_id)
            partial_ready = _trip_has_core_sections(trip)
            trip.status = 'ready' if partial_ready else 'error'
            _db.session.commit()
            TripService.complete_generation_run(run, 'failed', str(exc))
            yield _sse('error', {'message': str(exc), 'partial': partial_ready})

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
    for trip in trips:
        _heal_stuck_generating_trip(trip)
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
    _heal_stuck_generating_trip(trip)

    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/analytics/activation', methods=['GET'])
@require_auth
def get_activation_analytics():
    from app.models.trip import Trip
    from app.models.usage_event import UsageEvent

    user = g.current_user
    try:
        window_days = int(request.args.get('days', 30))
    except (TypeError, ValueError):
        window_days = 30
    window_days = max(1, min(window_days, 90))

    since = datetime.now(timezone.utc) - timedelta(days=window_days)
    trips = (
        Trip.query
        .filter(Trip.user_id == user.id, Trip.created_at >= since)
        .order_by(Trip.created_at.asc())
        .all()
    )
    trip_count = len(trips)
    if trip_count == 0:
        return jsonify({
            'success': True,
            'windowDays': window_days,
            'tripCreated': 0,
            'firstUsefulPlan': 0,
            'conversionRatePct': 0.0,
            'medianTimeToFirstUsefulPlanMinutes': None,
            'daily': [],
        }), 200

    trip_ids = [trip.id for trip in trips]
    tracked_names = [
        'primary_flight_selected',
        'primary_stay_selected',
        'activity_added_to_day',
        'overview_exported',
        'overview_exported_fallback',
    ]
    events = (
        UsageEvent.query
        .filter(
            UsageEvent.user_id == user.id,
            UsageEvent.trip_id.in_(trip_ids),
            UsageEvent.event_name.in_(tracked_names),
        )
        .order_by(UsageEvent.created_at.asc())
        .all()
    )

    created_by_day: dict[str, int] = {}
    for trip in trips:
        day = trip.created_at.date().isoformat()
        created_by_day[day] = created_by_day.get(day, 0) + 1

    by_trip: dict[str, dict] = {
        str(trip.id): {
            'flight': None,
            'stay': None,
            'activityEvents': [],
            'export': None,
            'createdAt': trip.created_at,
        }
        for trip in trips
    }

    for event in events:
        if not event.trip_id:
            continue
        bucket = by_trip.get(str(event.trip_id))
        if not bucket:
            continue
        if event.event_name == 'primary_flight_selected' and bucket['flight'] is None:
            bucket['flight'] = event.created_at
        elif event.event_name == 'primary_stay_selected' and bucket['stay'] is None:
            bucket['stay'] = event.created_at
        elif event.event_name == 'activity_added_to_day':
            bucket['activityEvents'].append(event.created_at)
        elif event.event_name in ('overview_exported', 'overview_exported_fallback') and bucket['export'] is None:
            bucket['export'] = event.created_at

    useful_by_day: dict[str, int] = {}
    useful_count = 0
    time_to_useful_minutes: list[float] = []
    for bucket in by_trip.values():
        flight_ts = bucket['flight']
        stay_ts = bucket['stay']
        activity_events = bucket['activityEvents']
        export_ts = bucket['export']
        if not (flight_ts and stay_ts and export_ts and len(activity_events) >= 3):
            continue

        primary_ts = max(flight_ts, stay_ts)
        activities_ts = activity_events[2]  # timestamp when 3rd activity was added
        first_useful_ts = max(primary_ts, activities_ts, export_ts)

        useful_count += 1
        useful_day = first_useful_ts.date().isoformat()
        useful_by_day[useful_day] = useful_by_day.get(useful_day, 0) + 1

        created_at = bucket['createdAt']
        if created_at:
            delta_minutes = (first_useful_ts - created_at).total_seconds() / 60.0
            if delta_minutes >= 0:
                time_to_useful_minutes.append(delta_minutes)

    median_minutes = None
    if time_to_useful_minutes:
        sorted_values = sorted(time_to_useful_minutes)
        n = len(sorted_values)
        mid = n // 2
        if n % 2 == 1:
            median_minutes = round(sorted_values[mid], 2)
        else:
            median_minutes = round((sorted_values[mid - 1] + sorted_values[mid]) / 2.0, 2)

    all_days = sorted(set(created_by_day.keys()) | set(useful_by_day.keys()))
    daily = [
        {
            'date': day,
            'tripCreated': created_by_day.get(day, 0),
            'firstUsefulPlan': useful_by_day.get(day, 0),
        }
        for day in all_days
    ]

    conversion_rate = round((useful_count / trip_count) * 100.0, 2) if trip_count else 0.0
    return jsonify({
        'success': True,
        'windowDays': window_days,
        'tripCreated': trip_count,
        'firstUsefulPlan': useful_count,
        'conversionRatePct': conversion_rate,
        'medianTimeToFirstUsefulPlanMinutes': median_minutes,
        'daily': daily,
        'definitions': {
            'firstUsefulPlan': (
                'Trip has primary flight selected, primary stay selected, at least 3 activities added to plan days, and overview exported.'
            ),
            'timeToFirstUsefulPlan': 'Minutes from trip creation timestamp to firstUsefulPlan timestamp.',
        },
    }), 200


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


@api_bp.route('/trips/<trip_id>/events', methods=['POST'])
@require_auth
def track_trip_event(trip_id):
    from app import db as _db
    from app.models.usage_event import UsageEvent

    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    payload = request.get_json() or {}
    event_name = str(payload.get('eventName') or '').strip()
    if not event_name:
        return jsonify({'success': False, 'message': 'eventName is required'}), 400

    event_props = payload.get('eventProps')
    if event_props is None:
        event_props = {}
    if not isinstance(event_props, dict):
        return jsonify({'success': False, 'message': 'eventProps must be an object'}), 400

    event = UsageEvent(
        user_id=trip.user_id,
        trip_id=trip.id,
        event_name=event_name[:120],
        event_props=event_props,
    )
    _db.session.add(event)
    _db.session.commit()
    return jsonify({'success': True, 'event': event.to_dict()}), 201


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


@api_bp.route('/trips/<trip_id>/overview/pdf', methods=['GET'])
@require_auth
def export_trip_overview_pdf(trip_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    try:
        pdf_bytes = build_overview_pdf(trip)
    except Exception as exc:
        logger.exception("Overview PDF export failed for trip %s", trip_id)
        return jsonify({'success': False, 'message': str(exc)}), 500

    destination = trip.destination or trip.title or 'trip'
    safe_destination = re.sub(r'[^A-Za-z0-9_-]+', '-', str(destination)).strip('-').lower() or 'trip'
    filename = f'{safe_destination}-overview.pdf'
    return Response(
        pdf_bytes,
        mimetype='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Cache-Control': 'no-store',
        },
    )


@api_bp.route('/trips/<trip_id>/flights/<flight_id>/select', methods=['PUT'])
@require_auth
def select_primary_flight(trip_id, flight_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404
    try:
        TripService.select_primary_flight(trip, flight_id)
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400
    _safe_track_usage_event(trip.user_id, trip.id, 'primary_flight_selected', {'flightId': str(flight_id)})
    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/stays/<stay_id>/select', methods=['PUT'])
@require_auth
def select_primary_stay(trip_id, stay_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404
    try:
        TripService.select_primary_stay(trip, stay_id)
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400
    _safe_track_usage_event(trip.user_id, trip.id, 'primary_stay_selected', {'stayId': str(stay_id)})
    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/activities/<activity_id>/add-to-day', methods=['POST'])
@require_auth
def add_activity_to_day(trip_id, activity_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    data = request.get_json() or {}
    day_number = data.get('dayNumber', data.get('dayIndex'))
    if day_number is None:
        return jsonify({'success': False, 'message': 'dayNumber is required'}), 400

    try:
        TripService.add_suggested_activity_to_day(trip, activity_id, int(day_number))
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400
    _safe_track_usage_event(
        trip.user_id,
        trip.id,
        'activity_added_to_day',
        {'activityId': str(activity_id), 'dayNumber': int(day_number)},
    )
    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/activities/generate-more', methods=['POST'])
@require_auth
def generate_more_activities(trip_id):
    from app.services import ai_service

    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

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

    payload = request.get_json() or {}
    focus_category = payload.get('category')
    extra = None
    if focus_category:
        extra = f"Focus suggestions on category: {focus_category}. Keep variety but bias toward this category."

    try:
        generated = ai_service.generate_activities(form_data, extra_instruction=extra)
        generated_rows = []
        for activity in generated.activities:
            row = activity.model_dump()
            query = (row.get('place_query') or row.get('title') or '').strip()
            if query:
                row['maps_url'] = row.get('maps_url') or _maps_search_url(query)
                row['image_query'] = row.get('image_query') or query
            row['status'] = row.get('status') or 'suggested'
            generated_rows.append(row)
        appended = TripService.append_generated_activities(
            trip,
            generated_rows,
        )
    except Exception as exc:
        logger.exception("Generate-more activities failed for trip %s", trip_id)
        return jsonify({'success': False, 'message': str(exc)}), 500

    return jsonify({'success': True, 'added': appended, 'count': len(appended)}), 200


@api_bp.route('/trips/<trip_id>/activities/<activity_id>/status', methods=['PUT'])
@require_auth
def update_activity_status(trip_id, activity_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    payload = request.get_json() or {}
    status = str(payload.get('status', '')).strip().lower()
    try:
        updated = TripService.update_suggested_activity_status(trip, activity_id, status)
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400
    return jsonify({'success': True, 'activity': updated, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/notes', methods=['GET'])
@require_auth
def get_trip_notes(trip_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404
    ai_generated = trip.constraints.get('aiGenerated', {}) if isinstance(trip.constraints, dict) else {}
    overview = ai_generated.get('overview', {}) if isinstance(ai_generated, dict) else {}
    notes = overview.get('notes', '') if isinstance(overview, dict) else ''
    return jsonify({'success': True, 'notes': notes}), 200


@api_bp.route('/trips/<trip_id>/notes', methods=['PUT'])
@require_auth
def update_trip_notes(trip_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404
    payload = request.get_json() or {}
    notes = str(payload.get('notes', ''))
    TripService.update_trip_notes(trip, notes)
    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/overview/image', methods=['PUT'])
@require_auth
def update_overview_image(trip_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    payload = request.get_json() or {}
    image_url = str(payload.get('imageUrl') or '').strip()
    if image_url:
        is_http = image_url.startswith('http://') or image_url.startswith('https://')
        is_data = image_url.startswith('data:image/')
        if not (is_http or is_data):
            return jsonify({'success': False, 'message': 'imageUrl must be http(s) or data:image URL'}), 400
        if len(image_url) > 2_000_000:
            return jsonify({'success': False, 'message': 'Image is too large'}), 400

    TripService.update_overview_image(trip, image_url)
    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/budget', methods=['GET'])
@require_auth
def get_trip_budget(trip_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404
    return jsonify({'success': True, 'budget': TripService.get_budget_data(trip)}), 200


@api_bp.route('/trips/<trip_id>/budget', methods=['POST'])
@require_auth
def add_trip_budget_entry(trip_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    payload = request.get_json() or {}
    try:
        amount = float(payload.get('amount', 0))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'Invalid amount'}), 400
    if amount <= 0:
        return jsonify({'success': False, 'message': 'Amount must be greater than 0'}), 400
    if not payload.get('date'):
        return jsonify({'success': False, 'message': 'Date is required'}), 400

    entry = TripService.add_budget_entry(trip, payload)
    return jsonify({
        'success': True,
        'entry': entry,
        'budget': TripService.get_budget_data(trip),
        'trip': trip.to_dict(include_details=True),
    }), 201


@api_bp.route('/trips/<trip_id>/budget/<entry_id>', methods=['DELETE'])
@require_auth
def delete_trip_budget_entry(trip_id, entry_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404
    deleted = TripService.delete_budget_entry(trip, entry_id)
    if not deleted:
        return jsonify({'success': False, 'message': 'Budget entry not found'}), 404
    return jsonify({'success': True, 'budget': TripService.get_budget_data(trip), 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/budget/<entry_id>', methods=['PUT'])
@require_auth
def update_trip_budget_entry(trip_id, entry_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    payload = request.get_json() or {}
    if 'amount' in payload:
        try:
            amount = float(payload.get('amount', 0))
        except (TypeError, ValueError):
            return jsonify({'success': False, 'message': 'Invalid amount'}), 400
        if amount <= 0:
            return jsonify({'success': False, 'message': 'Amount must be greater than 0'}), 400

    updated = TripService.update_budget_entry(trip, entry_id, payload)
    if not updated:
        return jsonify({'success': False, 'message': 'Budget entry not found'}), 404

    return jsonify({
        'success': True,
        'entry': updated,
        'budget': TripService.get_budget_data(trip),
        'trip': trip.to_dict(include_details=True),
    }), 200


@api_bp.route('/trips/<trip_id>/weather/refresh', methods=['POST'])
@require_auth
def refresh_weather(trip_id):
    from app.services import ai_service

    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

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

    try:
        weather_data = ai_service.generate_weather(form_data)
        weather_payload = [w.model_dump() for w in weather_data.days]
        expected_days = max(1, len(trip.days))
        weather_score, weather_ok = _weather_quality_score(weather_payload, expected_days)
        if not weather_ok:
            retry_data = ai_service.generate_weather(
                form_data,
                extra_instruction=(
                    "Cover each trip day with practical conditions and reasonable temperatures. "
                    "Keep dates sequential and avoid empty condition fields."
                ),
            )
            retry_payload = [w.model_dump() for w in retry_data.days]
            retry_score, _ = _weather_quality_score(retry_payload, expected_days)
            if retry_score >= weather_score:
                weather_payload = retry_payload
        weather_score, weather_ok = _weather_quality_score(weather_payload, expected_days)
        if not weather_ok:
            weather_payload = _build_weather_fallback_payload(form_data, expected_days)
            logger.warning("Weather refresh fallback used for trip %s", trip_id)
        TripService.persist_generated_section(trip, 'weather', weather_payload)
    except Exception as exc:
        logger.exception("Weather refresh failed for trip %s", trip_id)
        return jsonify({'success': False, 'message': str(exc)}), 500

    return jsonify({'success': True, 'weather': weather_payload, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/plan-items/<item_id>/return-to-bucket', methods=['POST'])
@require_auth
def return_plan_item_to_bucket(trip_id, item_id):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404
    try:
        TripService.return_plan_item_to_bucket(trip, item_id)
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400
    return jsonify({'success': True, 'trip': trip.to_dict(include_details=True)}), 200


@api_bp.route('/trips/<trip_id>/days/<int:day_number>/autofill', methods=['POST'])
@require_auth
def autofill_day(trip_id, day_number):
    user = g.current_user
    trip = TripService.get_trip(trip_id, str(user.id))
    if not trip:
        return jsonify({'success': False, 'message': 'Trip not found'}), 404

    payload = request.get_json() or {}
    limit = payload.get('limit', 3)

    try:
        added = TripService.autofill_day_from_bucket(trip, day_number=day_number, limit=int(limit))
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400

    return jsonify({'success': True, 'added': added, 'trip': trip.to_dict(include_details=True)}), 200
