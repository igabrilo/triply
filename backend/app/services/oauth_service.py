import os
from typing import Optional
from authlib.integrations.requests_client import OAuth2Session
from authlib.jose import jwt

from app import db
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.notification_preferences import NotificationPreferences
from app.services.auth_service import AuthService


class OAuthService:
    """OAuth service for Google and Apple Sign In."""

    # Google OAuth config
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5001/api/auth/google/callback')
    GOOGLE_DISCOVERY_URL = 'https://accounts.google.com/.well-known/openid-configuration'
    
    # Apple OAuth config
    APPLE_CLIENT_ID = os.getenv('APPLE_CLIENT_ID')
    APPLE_TEAM_ID = os.getenv('APPLE_TEAM_ID')
    APPLE_KEY_ID = os.getenv('APPLE_KEY_ID')
    APPLE_PRIVATE_KEY = os.getenv('APPLE_PRIVATE_KEY')
    APPLE_REDIRECT_URI = os.getenv('APPLE_REDIRECT_URI', 'http://localhost:5001/api/auth/apple/callback')

    # ------------------------------------------------------------------
    # Google OAuth
    # ------------------------------------------------------------------
    @staticmethod
    def get_google_auth_url(state: str) -> Optional[str]:
        """Generate Google OAuth authorization URL."""
        if not OAuthService.GOOGLE_CLIENT_ID:
            return None
        
        session = OAuth2Session(
            OAuthService.GOOGLE_CLIENT_ID,
            OAuthService.GOOGLE_CLIENT_SECRET,
            scope='openid email profile',
            redirect_uri=OAuthService.GOOGLE_REDIRECT_URI,
        )
        
        authorization_url, _ = session.create_authorization_url(
            'https://accounts.google.com/o/oauth2/v2/auth',
            state=state,
        )
        return authorization_url

    @staticmethod
    def handle_google_callback(code: str) -> Optional[dict]:
        """Exchange Google authorization code for tokens and get user info."""
        if not OAuthService.GOOGLE_CLIENT_ID:
            return None
        
        session = OAuth2Session(
            OAuthService.GOOGLE_CLIENT_ID,
            OAuthService.GOOGLE_CLIENT_SECRET,
            redirect_uri=OAuthService.GOOGLE_REDIRECT_URI,
        )
        
        # Exchange code for token
        token = session.fetch_token(
            'https://oauth2.googleapis.com/token',
            code=code,
        )
        
        # Get user info
        resp = session.get('https://www.googleapis.com/oauth2/v3/userinfo')
        user_info = resp.json()
        
        return OAuthService._create_or_login_oauth_user(
            provider='google',
            oauth_id=user_info['sub'],
            email=user_info['email'],
            name=user_info.get('name', user_info['email']),
            avatar_url=user_info.get('picture'),
        )

    # ------------------------------------------------------------------
    # Apple OAuth
    # ------------------------------------------------------------------
    @staticmethod
    def get_apple_auth_url(state: str) -> Optional[str]:
        """Generate Apple OAuth authorization URL."""
        if not OAuthService.APPLE_CLIENT_ID:
            return None
        
        params = {
            'response_type': 'code',
            'response_mode': 'form_post',
            'client_id': OAuthService.APPLE_CLIENT_ID,
            'redirect_uri': OAuthService.APPLE_REDIRECT_URI,
            'state': state,
            'scope': 'name email',
        }
        
        query_string = '&'.join([f'{k}={v}' for k, v in params.items()])
        return f'https://appleid.apple.com/auth/authorize?{query_string}'

    @staticmethod
    def handle_apple_callback(code: str, user_data: Optional[dict] = None) -> Optional[dict]:
        """Exchange Apple authorization code for tokens and get user info."""
        if not OAuthService.APPLE_CLIENT_ID:
            return None
        
        # Generate client secret (Apple requires JWT signed with private key)
        client_secret = OAuthService._generate_apple_client_secret()
        
        session = OAuth2Session(
            OAuthService.APPLE_CLIENT_ID,
            client_secret,
            redirect_uri=OAuthService.APPLE_REDIRECT_URI,
        )
        
        # Exchange code for token
        token = session.fetch_token(
            'https://appleid.apple.com/auth/token',
            code=code,
        )
        
        # Decode ID token to get user info
        id_token = token['id_token']
        claims = jwt.decode(id_token, OAuthService.APPLE_CLIENT_ID)
        claims.validate()
        
        oauth_id = claims['sub']
        email = claims.get('email', '')
        
        # Apple only sends name on first sign-in
        name = email
        if user_data and 'name' in user_data:
            first_name = user_data['name'].get('firstName', '')
            last_name = user_data['name'].get('lastName', '')
            name = f"{first_name} {last_name}".strip() or email
        
        return OAuthService._create_or_login_oauth_user(
            provider='apple',
            oauth_id=oauth_id,
            email=email,
            name=name,
            avatar_url=None,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _create_or_login_oauth_user(
        provider: str,
        oauth_id: str,
        email: str,
        name: str,
        avatar_url: Optional[str] = None,
    ) -> dict:
        """Find or create user from OAuth data and return auth response."""
        # Try to find existing user by OAuth ID
        user = User.query.filter_by(oauth_provider=provider, oauth_id=oauth_id).first()
        
        if not user:
            # Try to find by email (user might have registered with email/password)
            user = User.query.filter_by(email=email).first()
            
            if user:
                # Link OAuth to existing account
                user.oauth_provider = provider
                user.oauth_id = oauth_id
                if avatar_url:
                    user.avatar_url = avatar_url
            else:
                # Create new user
                user = User(
                    email=email,
                    name=name,
                    avatar_url=avatar_url,
                    oauth_provider=provider,
                    oauth_id=oauth_id,
                )
                user.preferences = UserPreferences()
                user.notification_preferences = NotificationPreferences()
                db.session.add(user)
        
        db.session.commit()
        
        token = AuthService._generate_token(str(user.id))
        return {
            'success': True,
            'user': user.to_dict(),
            'token': token,
        }

    @staticmethod
    def _generate_apple_client_secret() -> str:
        """Generate Apple client secret JWT (required by Apple)."""
        import time
        
        headers = {
            'kid': OAuthService.APPLE_KEY_ID,
            'alg': 'ES256',
        }
        
        payload = {
            'iss': OAuthService.APPLE_TEAM_ID,
            'iat': int(time.time()),
            'exp': int(time.time()) + 86400 * 180,  # 6 months
            'aud': 'https://appleid.apple.com',
            'sub': OAuthService.APPLE_CLIENT_ID,
        }
        
        return jwt.encode(headers, payload, OAuthService.APPLE_PRIVATE_KEY)
