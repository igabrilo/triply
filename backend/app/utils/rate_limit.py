"""Tiered rate limiting based on user plan (basic / premium).

Uses Flask-Limiter with per-user keys.  When the user is authenticated
the limiter keys on their user ID; anonymous requests key on IP.

Plan limits (per endpoint group):
  - Trip generation:        basic  3/hour,   premium 20/hour
  - Chat edits:             basic 20/hour,   premium 100/hour
  - Activity generation:    basic 10/day,    premium 50/day
  - Weather refresh:        basic 10/day,    premium 50/day
  - General API:            basic 120/min,   premium 600/min

If Flask-Limiter is not installed the module degrades gracefully —
all decorators become no-ops so the app still starts.
"""

import logging
from functools import wraps

from flask import Flask, g

logger = logging.getLogger(__name__)

# ---- Optional Flask-Limiter import --------------------------------

try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address as _get_remote_address

    _LIMITER_AVAILABLE = True
except ImportError:
    logger.warning('Flask-Limiter not installed — rate limiting disabled. Run: pip install flask-limiter')
    _LIMITER_AVAILABLE = False
    _get_remote_address = lambda: '127.0.0.1'  # noqa: E731

# ---- Plan-aware rate limit strings --------------------------------

PLAN_LIMITS = {
    'trip_generate': {
        'basic': '2 per day',
        'premium': '100 per day',
    },
    'chat_edit': {
        'basic': '20 per hour',
        'premium': '200 per hour',
    },
    'activity_generate': {
        'basic': '10 per day',
        'premium': '50 per day',
    },
    'weather_refresh': {
        'basic': '10 per day',
        'premium': '50 per day',
    },
    'general': {
        'basic': '120 per minute',
        'premium': '600 per minute',
    },
}


def _get_user_plan() -> str:
    """Return the current user's plan, defaulting to 'basic'."""
    user = getattr(g, 'current_user', None)
    if user and hasattr(user, 'plan'):
        return user.plan or 'basic'
    return 'basic'


def _user_key() -> str:
    """Rate-limit key: user ID if authenticated, else remote IP."""
    user = getattr(g, 'current_user', None)
    if user:
        return str(user.id)
    return _get_remote_address()


def plan_limit(group: str):
    """Return a dynamic limit string based on the current user's plan."""
    def _resolver():
        plan = _get_user_plan()
        limits = PLAN_LIMITS.get(group, PLAN_LIMITS['general'])
        return limits.get(plan, limits['basic'])
    return _resolver


# ---- Limiter object (real or no-op) --------------------------------

if _LIMITER_AVAILABLE:
    limiter = Limiter(
        key_func=_get_remote_address,
        default_limits=["120 per minute"],
        storage_uri="memory://",
    )
else:
    class _NoOpLimiter:
        """Drop-in stub when Flask-Limiter is not installed."""

        def init_app(self, app):
            pass

        def limit(self, *args, **kwargs):
            def decorator(fn):
                @wraps(fn)
                def wrapper(*a, **kw):
                    return fn(*a, **kw)
                return wrapper
            return decorator

        def exempt(self, fn):
            return fn

    limiter = _NoOpLimiter()  # type: ignore[assignment]


def init_limiter(app: Flask):
    """Attach the limiter to the Flask app."""
    limiter.init_app(app)

    if _LIMITER_AVAILABLE:
        @app.errorhandler(429)
        def ratelimit_handler(_e):
            plan = _get_user_plan()
            msg = 'Rate limit exceeded. Please try again later.'
            if plan == 'basic':
                msg += ' Upgrade to Premium for higher limits.'
            return {'success': False, 'message': msg}, 429
