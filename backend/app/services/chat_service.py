"""Chat service – handles scoped AI-driven trip edits via chat.

Uses GPT-5 Mini for fast, context-aware edits.
The LLM receives the current section snapshot + user instruction
and returns a structured JSON patch that gets validated and persisted.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from app import db
from app.models.trip import Trip
from app.models.chat_thread import ChatThread
from app.models.chat_message import ChatMessage
from app.models.trip_edit import TripEdit

logger = logging.getLogger(__name__)


class ChatService:
    """Service for chat-based trip editing."""

    MAX_EDITS_FREE = 5

    # ------------------------------------------------------------------
    # Threads
    # ------------------------------------------------------------------
    @staticmethod
    def get_or_create_thread(trip_id: str, user_id: str) -> Optional[ChatThread]:
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None

        thread = (ChatThread.query
                  .filter_by(trip_id=trip_id)
                  .order_by(ChatThread.created_at.desc())
                  .first())
        if not thread:
            thread = ChatThread(trip_id=trip_id)
            db.session.add(thread)
            db.session.commit()
        return thread

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------
    @staticmethod
    def get_messages(trip_id: str, user_id: str):
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None
        return (ChatMessage.query
                .join(ChatThread)
                .filter(ChatThread.trip_id == trip_id)
                .order_by(ChatMessage.created_at.asc())
                .all())

    # ------------------------------------------------------------------
    # Send message + AI edit
    # ------------------------------------------------------------------
    @staticmethod
    def send_message(trip_id: str, user_id: str, content: str,
                     edit_scope: Optional[dict] = None):
        """Process a user message: call AI, validate, apply edit, persist."""
        trip = Trip.query.filter_by(id=trip_id, user_id=user_id).first()
        if not trip:
            return None

        # Check edit limit
        edit_count = TripEdit.query.filter_by(trip_id=trip_id).count()
        if edit_count >= ChatService.MAX_EDITS_FREE:
            return {'error': 'edit_limit_reached'}

        # Ensure thread
        thread = (ChatThread.query
                  .filter_by(trip_id=trip_id)
                  .order_by(ChatThread.created_at.desc())
                  .first())
        if not thread:
            thread = ChatThread(trip_id=trip_id)
            db.session.add(thread)
            db.session.flush()

        # Determine scope
        scope = (edit_scope.get('section') if edit_scope else None) or 'plan'
        day_number = edit_scope.get('dayNumber') if edit_scope else None
        target_ref_type = edit_scope.get('targetRefType') if edit_scope else None
        target_ref_id = edit_scope.get('targetRefId') if edit_scope else None

        # Build context snapshot for the scoped section
        context_snapshot = ChatService._build_context_snapshot(
            trip, scope, day_number=day_number,
        )

        # Save user message
        user_msg = ChatMessage(
            thread_id=thread.id,
            role='user',
            content=content,
            scope=scope,
            target_ref_type=target_ref_type,
            target_ref_id=target_ref_id,
            context_snapshot=context_snapshot,
        )
        db.session.add(user_msg)
        db.session.flush()

        # Build trip preferences for context
        preferences = {
            'destination': trip.destination,
            'startDate': trip.start_date.isoformat() if trip.start_date else None,
            'endDate': trip.end_date.isoformat() if trip.end_date else None,
            'travelers': trip.travelers_count,
            'budget': trip.budget_tier,
            'pace': trip.pace,
            'interests': trip.interests_array,
        }

        # Call AI
        try:
            from app.services.ai_service import generate_chat_edit

            ai_response = generate_chat_edit(
                user_instruction=content,
                scope=scope,
                context_snapshot=context_snapshot,
                preferences=preferences,
            )

            response_content = ai_response.explanation

            # Apply the edit to the DB
            diff = ChatService._apply_edit(trip, scope, ai_response, day_number=day_number)

        except Exception as exc:
            logger.exception("AI chat edit failed for trip %s", trip_id)
            response_content = (
                f"I'm sorry, I encountered an error processing your request: {str(exc)}. "
                "Please try again."
            )
            diff = None

        # Save assistant message
        assistant_msg = ChatMessage(
            thread_id=thread.id,
            role='assistant',
            content=response_content,
            scope=scope,
        )
        db.session.add(assistant_msg)

        # Record the edit
        edit_status = 'applied' if diff else 'failed'
        edit = TripEdit(
            trip_id=trip_id,
            thread_id=thread.id,
            user_message_id=user_msg.id,
            scope=scope,
            target_ref_type=target_ref_type,
            target_ref_id=target_ref_id,
            instruction=content,
            result_summary=response_content,
            diff=diff,
            status=edit_status,
            error_message=None if diff else response_content,
        )
        db.session.add(edit)
        db.session.commit()

        return {
            'user_message': user_msg,
            'assistant_message': assistant_msg,
            'edit': edit,
            'updated_section': scope,
            'trip': trip,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_context_snapshot(trip: Trip, scope: str, *, day_number: int = None) -> dict:
        """Build a JSON-serialisable snapshot of the section being edited.

        When *day_number* is provided for scope='plan', only that day is
        included — significantly reducing prompt size for item-level edits.
        """
        if scope == 'plan':
            days = trip.days
            if day_number is not None:
                days = [d for d in days if d.day_index == day_number]
            return {
                'days': [
                    {
                        'day_index': d.day_index,
                        'title': d.title,
                        'date': d.date.isoformat() if d.date else None,
                        'items': [
                            {
                                'title': item.title,
                                'description': item.description,
                                'category': item.category,
                                'time_block': item.time_block,
                                'duration_minutes': item.duration_minutes,
                                'cost_hint': item.cost_hint,
                                'place_query': item.location_name or item.title,
                                'external_url': item.external_url,
                            }
                            for item in d.plan_items
                        ],
                    }
                    for d in days
                ]
            }
        elif scope == 'stays':
            return {
                'stays': [
                    {
                        'name': s.name,
                        'neighborhood': s.neighborhood,
                        'stay_type': (s.details or {}).get('stayType'),
                        'price_range': (s.details or {}).get('priceRange'),
                        'rating_hint': float(s.rating) if s.rating else None,
                        'why_it_fits': s.why_it_fits,
                        'place_query': s.name,
                        'amenities': (s.details or {}).get('amenities', []),
                        'booking_search_url': s.deep_link_url,
                    }
                    for s in trip.stay_options
                ]
            }
        elif scope == 'flights':
            return {
                'flights': [
                    {
                        'airline': f.airline,
                        'origin': (f.details or {}).get('origin'),
                        'destination': (f.details or {}).get('destination'),
                        'depart_time_hint': (f.details or {}).get('departTimeHint'),
                        'arrive_time_hint': (f.details or {}).get('arriveTimeHint'),
                        'duration_hint': (f.details or {}).get('durationHint'),
                        'stops_count': f.stops_count,
                        'price_hint': (f.details or {}).get('priceHint'),
                        'booking_search_url': f.deep_link_url,
                    }
                    for f in trip.flight_options
                ]
            }
        return {}

    @staticmethod
    def _apply_edit(trip: Trip, scope: str, ai_response, *, day_number: int = None) -> Optional[dict]:
        """Apply the AI-generated edit to the database.

        When *day_number* is set for plan edits, only the targeted day is
        replaced while all other days are preserved.

        Returns a diff dict for auditing, or None on failure.
        """
        from app.services.trip_service import TripService

        try:
            if scope == 'plan' and ai_response.plan:
                edited_days = [
                    {
                        'dayIndex': d.day_index,
                        'title': d.title,
                        'items': [item.model_dump() for item in d.items],
                    }
                    for d in ai_response.plan.days
                ]

                if day_number is not None:
                    # Merge: rebuild full plan, replacing only the targeted day
                    edited_indices = {d['dayIndex'] for d in edited_days}
                    existing_snapshot = ChatService._build_context_snapshot(trip, 'plan')
                    kept_days = [
                        {
                            'dayIndex': d['day_index'],
                            'title': d['title'],
                            'items': d['items'],
                        }
                        for d in existing_snapshot.get('days', [])
                        if d['day_index'] not in edited_indices
                    ]
                    merged = sorted(kept_days + edited_days, key=lambda d: d['dayIndex'])
                    TripService.replace_plan(trip, merged)
                    return {'scope': 'plan', 'days_count': len(merged), 'day_edited': day_number}
                else:
                    TripService.replace_plan(trip, edited_days)
                    return {'scope': 'plan', 'days_count': len(edited_days)}

            elif scope == 'stays' and ai_response.stays:
                stays_data = [s.model_dump() for s in ai_response.stays.stays]
                TripService.replace_stays(trip, stays_data)
                return {'scope': 'stays', 'count': len(stays_data)}

            elif scope == 'flights' and ai_response.flights:
                flights_data = [f.model_dump() for f in ai_response.flights.flights]
                TripService.replace_flights(trip, flights_data)
                return {'scope': 'flights', 'count': len(flights_data)}

        except Exception as exc:
            logger.exception("Failed to apply edit for scope=%s", scope)
            return None

        return None
