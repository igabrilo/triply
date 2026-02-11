from flask import jsonify
from app.routes import api_bp


@api_bp.route('/', methods=['GET'])
def index():
    """Health check endpoint."""
    return jsonify({
        'message': 'Triply API',
        'status': 'running',
        'version': '1.0.0',
    }), 200


@api_bp.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Resource not found'}), 404


@api_bp.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500
