from flask import Blueprint

api_bp = Blueprint('api', __name__)

from app.routes.main_routes import *
from app.routes.auth_routes import *
from app.routes.trip_routes import *
from app.routes.chat_routes import *
from app.routes.subscription_routes import *
