import pytest
from flask import json

def test_index(client):
    """Test the index route"""
    response = client.get('/api/')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'running'
    assert 'message' in data

def test_get_example(client):
    """Test GET example endpoint"""
    response = client.get('/api/example')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert 'data' in data

def test_create_example(client):
    """Test POST example endpoint"""
    test_data = {'name': 'Test Item', 'value': 42}
    response = client.post(
        '/api/example',
        data=json.dumps(test_data),
        content_type='application/json'
    )
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['success'] is True

def test_create_example_no_data(client):
    """Test POST example endpoint with no data"""
    response = client.post(
        '/api/example',
        data=json.dumps({}),
        content_type='application/json'
    )
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['success'] is False
    assert data['message'] == 'No data provided'
