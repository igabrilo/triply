from flask import Flask
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
    CORS(flask_app, resources={r"/api/*": {"origins": flask_app.config['CORS_ORIGINS']}})

    # Import models so Flask-Migrate can discover them
    with flask_app.app_context():
        import app.models  # noqa: F401

    # Register blueprints
    from app.routes import api_bp
    flask_app.register_blueprint(api_bp, url_prefix='/api')

    return flask_app
