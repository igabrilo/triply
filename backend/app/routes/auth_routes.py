from flask import jsonify, request
from app.routes import api_bp
from app.services.auth_service import AuthService


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
