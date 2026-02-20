from flask import g, jsonify
from app.routes import api_bp
from app.utils.auth import require_auth


@api_bp.route('/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    """Return the authenticated user's profile.

    The Supabase access-token is verified by the @require_auth decorator
    which populates ``g.current_user``.
    """
    return jsonify({'success': True, 'user': g.current_user.to_dict()}), 200


