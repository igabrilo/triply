import secrets
from flask import jsonify, request, redirect, session
from app.routes import api_bp
from app.services.auth_service import AuthService
from app.services.oauth_service import OAuthService


@api_bp.route('/auth/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400

    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({'success': False, 'message': 'Name, email, and password are required'}), 400

    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400

    result = AuthService.register(name, email, password)
    if not result['success']:
        return jsonify(result), 409

    return jsonify(result), 201


@api_bp.route('/auth/login', methods=['POST'])
def login():
    """Login user."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400

    result = AuthService.login(email, password)
    if not result['success']:
        return jsonify(result), 401

    return jsonify(result), 200


@api_bp.route('/auth/me', methods=['GET'])
def get_current_user():
    """Get current authenticated user."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'success': False, 'message': 'No token provided'}), 401

    user = AuthService.get_user_from_token(token)
    if not user:
        return jsonify({'success': False, 'message': 'Invalid token'}), 401

    return jsonify({'success': True, 'user': user.to_dict()}), 200


# ------------------------------------------------------------------
# OAuth routes (Google)
# ------------------------------------------------------------------
@api_bp.route('/auth/google', methods=['GET'])
def google_login():
    """Initiate Google OAuth flow."""
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    
    # Store intent in server session (survives OAuth redirect)
    intent = request.args.get('intent', 'account')
    session['oauth_intent'] = intent
    
    auth_url = OAuthService.get_google_auth_url(state)
    if not auth_url:
        return jsonify({'success': False, 'message': 'Google OAuth not configured'}), 500
    
    return jsonify({'success': True, 'authUrl': auth_url}), 200


@api_bp.route('/auth/google/callback', methods=['GET'])
def google_callback():
    """Handle Google OAuth callback."""
    code = request.args.get('code')
    state = request.args.get('state')
    
    # Verify state to prevent CSRF
    if state != session.get('oauth_state'):
        return redirect('http://localhost:3000?error=invalid_state')
    
    if not code:
        return redirect('http://localhost:3000?error=no_code')
    
    result = OAuthService.handle_google_callback(code)
    if not result:
        return redirect('http://localhost:3000?error=auth_failed')
    
    # Check if user was generating a trip (stored in session during OAuth init)
    intent = session.get('oauth_intent', 'account')
    session.pop('oauth_intent', None)
    
    # Redirect to frontend with token and intent
    token = result['token']
    return redirect(f'http://localhost:3000?token={token}&intent={intent}')


# ------------------------------------------------------------------
# OAuth routes (Apple)
# ------------------------------------------------------------------
@api_bp.route('/auth/apple', methods=['GET'])
def apple_login():
    """Initiate Apple OAuth flow."""
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    
    # Store intent in server session (survives OAuth redirect)
    intent = request.args.get('intent', 'account')
    session['oauth_intent'] = intent
    
    auth_url = OAuthService.get_apple_auth_url(state)
    if not auth_url:
        return jsonify({'success': False, 'message': 'Apple OAuth not configured'}), 500
    
    return jsonify({'success': True, 'authUrl': auth_url}), 200


@api_bp.route('/auth/apple/callback', methods=['POST'])
def apple_callback():
    """Handle Apple OAuth callback (POST form_post)."""
    code = request.form.get('code')
    state = request.form.get('state')
    user_data = request.form.get('user')  # Apple sends user data on first sign-in
    
    # Verify state
    if state != session.get('oauth_state'):
        return redirect('http://localhost:3000?error=invalid_state')
    
    if not code:
        return redirect('http://localhost:3000?error=no_code')
    
    # Parse user data if present
    import json
    user_json = None
    if user_data:
        try:
            user_json = json.loads(user_data)
        except:
            pass
    
    result = OAuthService.handle_apple_callback(code, user_json)
    if not result:
        return redirect('http://localhost:3000?error=auth_failed')
    
    # Check if user was generating a trip (stored in session during OAuth init)
    intent = session.get('oauth_intent', 'account')
    session.pop('oauth_intent', None)
    
    # Redirect to frontend with token and intent
    token = result['token']
    return redirect(f'http://localhost:3000?token={token}&intent={intent}')

