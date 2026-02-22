"""Thin auth service – delegates token verification to Supabase utilities."""

from app.utils.auth import get_current_user, verify_supabase_token


class AuthService:
    """Kept for any legacy call-sites; prefer using @require_auth decorator."""

    @staticmethod
    def get_user_from_token(token: str):
        """Verify a Supabase token and return the User, or None.

        NOTE: This is a convenience wrapper. New code should use
        ``@require_auth`` or ``get_current_user()`` from app.utils.auth.
        """
        from app import db
        from app.models.user import User

        payload = verify_supabase_token(token)
        if not payload:
            return None
        user_id = payload.get('sub')
        if not user_id:
            return None
        return db.session.get(User, user_id)
