# Import all models so that Flask-Migrate discovers them
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.notification_preferences import NotificationPreferences
from app.models.trip import Trip
from app.models.trip_day import TripDay
from app.models.plan_item import PlanItem
from app.models.flight_option import FlightOption
from app.models.stay_option import StayOption
from app.models.trip_generation_run import TripGenerationRun
from app.models.chat_thread import ChatThread
from app.models.chat_message import ChatMessage
from app.models.trip_edit import TripEdit
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.price_alert import PriceAlert
from app.models.notification_event import NotificationEvent
from app.models.usage_event import UsageEvent

__all__ = [
    'User', 'UserPreferences', 'NotificationPreferences',
    'Trip', 'TripDay', 'PlanItem',
    'FlightOption', 'StayOption', 'TripGenerationRun',
    'ChatThread', 'ChatMessage', 'TripEdit',
    'Subscription', 'Invoice',
    'PriceAlert', 'NotificationEvent', 'UsageEvent',
]
