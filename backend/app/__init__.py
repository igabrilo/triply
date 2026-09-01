from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config.config import config

db = SQLAlchemy()
migrate = Migrate()

def create_app(config_name='development'):
    flask_app = Flask(__name__)
    flask_app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(flask_app)
    migrate.init_app(flask_app, db)
    CORS(flask_app, resources={r"/api/*": {
        "origins": flask_app.config['CORS_ORIGINS'],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "max_age": 3600,
    }})

    # --- Rate limiting (tiered by user plan) ---
    from app.utils.rate_limit import init_limiter
    init_limiter(flask_app)

    # --- Security headers ---
    @flask_app.after_request
    def set_security_headers(response):
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if not flask_app.debug:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Content-Security-Policy'] = (
            "default-src 'none'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "img-src 'self' https: data:; "
            "font-src 'self' https:; "
            "connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org "
            "https://en.wikipedia.org https://commons.wikimedia.org "
            "https://maps.googleapis.com https://places.googleapis.com; "
            "frame-ancestors 'none'"
        )
        return response

    @flask_app.errorhandler(413)
    def request_entity_too_large(_e):
        return jsonify({'success': False, 'message': 'Payload too large'}), 413

    # Import models so Flask-Migrate can discover them
    with flask_app.app_context():
        import app.models  # noqa: F401

    # Register blueprints
    from app.routes import api_bp
    flask_app.register_blueprint(api_bp, url_prefix='/api')

    return flask_app
