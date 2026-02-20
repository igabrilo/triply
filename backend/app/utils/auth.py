"""Supabase JWT verification via JWKS and @require_auth decorator.

Verifies access tokens using the project's public JWKS endpoint:
  GET {SUPABASE_URL}/auth/v1/.well-known/jwks.json

No shared secret is needed — only the SUPABASE_URL.
See: https://supabase.com/docs/guides/auth/jwts#verifying-a-jwt-from-supabase
"""

import functools
import logging

import jwt
from jwt import PyJWKClient
from flask import current_app, g, jsonify, request

from app import db
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.notification_preferences import NotificationPreferences

logger = logging.getLogger(__name__)

# Lazily-initialised JWKS client (caches public keys in-process).
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Return (and lazily create) a PyJWKClient for the project's JWKS endpoint.

    The Supabase Edge caches the JWKS for ~10 min; we re-fetch every 5 min
    so key rotations propagate quickly while still avoiding per-request calls.
    """
    global _jwks_client
    if _jwks_client is None:
        supabase_url = current_app.config.get('SUPABASE_URL', '')
        if not supabase_url:
            raise RuntimeError('SUPABASE_URL is not configured')
        _jwks_client = PyJWKClient(
            f'{supabase_url}/auth/v1/.well-known/jwks.json',
            cache_jwk_set=True,
            lifespan=300,  # seconds
        )
    return _jwks_client


def _extract_token() -> str | None:
    """Pull the Bearer token from the Authorization header or ?token= query param (SSE fallback)."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return request.args.get('token') or None


def verify_supabase_token(token: str) -> dict | None:
    """Verify a Supabase-issued JWT using the project's JWKS public keys.

    Returns the decoded payload dict on success, or None on any failure.
    The ``sub`` claim contains the Supabase auth user ID.
    """
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=['RS256', 'ES256'],
            audience='authenticated',
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug('Supabase token expired')
    except jwt.InvalidTokenError as exc:
        logger.debug('Invalid Supabase token: %s', exc)
    except Exception as exc:
        logger.error('JWKS verification error: %s', exc)
    return None


def _ensure_user(payload: dict) -> User | None:
    """Return the User for the given JWT payload, creating it if missing.

    Acts as a safety-net: the Supabase DB trigger normally creates the
    public.users row on signup, but if it didn't fire (or the user was
    created before the trigger existed) we handle it here.
    """
    user_id = payload.get('sub')
    if not user_id:
        return None

    user = db.session.get(User, user_id)
    if user:
        return user

    # First request from a user that has no public.users row yet — create one.
    meta = payload.get('user_metadata') or {}
    email = payload.get('email', '')
    name = (
        meta.get('name')
        or meta.get('full_name')
        or email.split('@')[0]
    )
    avatar_url = meta.get('avatar_url') or meta.get('picture')

    try:
        user = User(id=user_id, email=email, name=name, avatar_url=avatar_url)
        user.preferences = UserPreferences()
        user.notification_preferences = NotificationPreferences()
        db.session.add(user)
        db.session.commit()
        logger.info('Created public.users row for Supabase user %s', user_id)
        return user
    except Exception:
        db.session.rollback()
        logger.exception('Failed to create public.users row for %s', user_id)
        # Race condition: another request may have inserted concurrently — retry read.
        return db.session.get(User, user_id)


def get_current_user() -> User | None:
    """Verify the request token and return the corresponding User, or None."""
    token = _extract_token()
    if not token:
        return None

    payload = verify_supabase_token(token)
    if not payload:
        return None

    return _ensure_user(payload)


def require_auth(fn):
    """Decorator that enforces Supabase authentication on a route.

    On success the User ORM object is available as ``g.current_user``.
    """

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper
