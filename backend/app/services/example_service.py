from typing import Dict, List, Any

class ExampleService:
    """Example service with business logic"""
    
    @staticmethod
    def get_data() -> List[Dict[str, Any]]:
        """
        Get example data
        Replace with actual database queries
        """
        return [
            {'id': 1, 'name': 'Example 1', 'value': 100},
            {'id': 2, 'name': 'Example 2', 'value': 200},
        ]
    
    @staticmethod
    def create_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new data
        Replace with actual database operations
        """
        # Validate data
        if 'name' not in data:
            raise ValueError('Name is required')
        
        # Simulate creation
        new_item = {
            'id': 3,
            'name': data['name'],
            'value': data.get('value', 0)
        }
        
        return new_item
    
    @staticmethod
    def update_data(item_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing data"""
        # Implement update logic
        pass
    
    @staticmethod
    def delete_data(item_id: int) -> bool:
        """Delete data"""
        # Implement delete logic
        pass
