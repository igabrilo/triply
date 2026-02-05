from flask import jsonify, request
from app.routes import api_bp
from app.services.example_service import ExampleService

@api_bp.route('/', methods=['GET'])
def index():
    """Health check endpoint"""
    return jsonify({
        'message': 'Hello from Triply Backend!',
        'status': 'running',
        'version': '1.0.0'
    }), 200

@api_bp.route('/example', methods=['GET'])
def get_example():
    """Example GET endpoint"""
    data = ExampleService.get_data()
    return jsonify({
        'success': True,
        'data': data
    }), 200

@api_bp.route('/example', methods=['POST'])
def create_example():
    """Example POST endpoint"""
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'message': 'No data provided'
        }), 400
    
    result = ExampleService.create_data(data)
    return jsonify({
        'success': True,
        'data': result
    }), 201

@api_bp.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'message': 'Resource not found'
    }), 404

@api_bp.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'message': 'Internal server error'
    }), 500
