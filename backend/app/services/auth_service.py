import jwt
import os
from datetime import datetime, timedelta
from app import db
from app.models.user import User


class AuthService:
    """Authentication service handling registration, login, and token management."""

    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    TOKEN_EXPIRY_HOURS = 72

    @staticmethod
    def register(name: str, email: str, password: str) -> dict:
        """Register a new user."""
        if User.query.filter_by(email=email).first():
            return {'success': False, 'message': 'Email already registered'}

        user = User(name=name, email=email)
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        token = AuthService._generate_token(user.id)
        return {
            'success': True,
            'user': user.to_dict(),
            'token': token,
        }

    @staticmethod
    def login(email: str, password: str) -> dict:
        """Authenticate a user."""
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return {'success': False, 'message': 'Invalid email or password'}

        token = AuthService._generate_token(user.id)
        return {
            'success': True,
            'user': user.to_dict(),
            'token': token,
        }

    @staticmethod
    def get_user_from_token(token: str):
        """Decode token and return user, or None."""
        try:
            payload = jwt.decode(token, AuthService.SECRET_KEY, algorithms=['HS256'])
            user_id = payload.get('user_id')
            if not user_id:
                return None
            return User.query.get(user_id)
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None

    @staticmethod
    def _generate_token(user_id: int) -> str:
        """Generate a JWT token."""
        payload = {
            'user_id': user_id,
            'exp': datetime.utcnow() + timedelta(hours=AuthService.TOKEN_EXPIRY_HOURS),
            'iat': datetime.utcnow(),
        }
        return jwt.encode(payload, AuthService.SECRET_KEY, algorithm='HS256')
