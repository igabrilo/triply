import os
from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    """Return env var or raise immediately so misconfig is obvious."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Required environment variable {name!r} is not set. "
            f"Add it to backend/.env or export it in your shell."
        )
    return value


def _as_bool(name: str, default: bool = True) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = str(raw).strip().lower()
    if normalized in {'1', 'true', 'yes', 'on'}:
        return True
    if normalized in {'0', 'false', 'no', 'off'}:
        return False
    return default


class Config:
    """Base configuration"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')

    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'max_overflow': 5,
        'pool_recycle': 300,
        'pool_pre_ping': True,
    }

    # Supabase Auth (only URL needed — JWT verified via public JWKS endpoint)
    SUPABASE_URL = os.getenv('SUPABASE_URL', '')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

    # xroute.ai proxy for OpenAI-compatible models
    XROUTE_AI_API_KEY = os.getenv('XROUTE_AI_API_KEY', '')
    OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://api.xroute.ai/openai/v1')
    OPENAI_MODEL_GENERATION = os.getenv('OPENAI_MODEL_GENERATION', 'gpt-5.2')
    OPENAI_MODEL_CHAT = os.getenv('OPENAI_MODEL_CHAT', 'gpt-5-mini')

    # Google Maps (optional – enables real geocoding for plan items)
    GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY', '')

    # Supabase PostgreSQL (direct connection for migrations)
    MIGRATION_DATABASE_URL = os.getenv('MIGRATION_DATABASE_URL')

    # Feature flags (runtime, backend-controlled)
    FEATURE_FIRST_PLAN_GUIDE = _as_bool('FEATURE_FIRST_PLAN_GUIDE', True)
    FEATURE_NEXT_BEST_ACTIONS = _as_bool('FEATURE_NEXT_BEST_ACTIONS', True)
    FEATURE_ACTIVATION_ANALYTICS = _as_bool('FEATURE_ACTIVATION_ANALYTICS', True)


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = _require_env('DATABASE_URL')


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    SECRET_KEY = _require_env('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = _require_env('DATABASE_URL')


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv('TEST_DATABASE_URL', 'sqlite:///triply_test.db')


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig,
}
