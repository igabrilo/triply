import re
from typing import Optional

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password: str) -> tuple[bool, Optional[str]]:
    """
    Validate password strength
    Returns (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    return True, None

def sanitize_string(text: str, max_length: int = 500) -> str:
    """Sanitize string input: strip whitespace, remove control chars, enforce length."""
    if not isinstance(text, str):
        raise ValueError("Input must be a string")
    text = text.strip()
    # Remove ASCII control characters (except newline/tab)
    text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]', '', text)
    if len(text) > max_length:
        raise ValueError(f"Input exceeds maximum length of {max_length} characters")
    return text


VALID_BUDGET_TIERS = {'budget', 'mid', 'premium', 'luxury'}
VALID_PACES = {'relaxed', 'balanced', 'packed'}


def validate_trip_form_data(data: dict) -> tuple[bool, Optional[str]]:
    """Validate and sanitize trip creation form data.

    Returns (is_valid, error_message).
    """
    # Destinations
    destinations = data.get('destinations', [])
    if isinstance(destinations, list):
        if len(destinations) > 10:
            return False, "Too many destinations (max 10)"
        for dest in destinations:
            if not isinstance(dest, str) or len(dest) > 200:
                return False, "Each destination must be a string under 200 characters"
    elif isinstance(destinations, str):
        if len(destinations) > 200:
            return False, "Destination must be under 200 characters"

    # Travelers
    travelers = data.get('travelers', data.get('travelersCount'))
    if travelers is not None:
        try:
            t = int(travelers)
            if t < 1 or t > 50:
                return False, "Travelers must be between 1 and 50"
        except (TypeError, ValueError):
            return False, "Travelers must be a number"

    # Budget tier
    budget = data.get('budget', data.get('budgetTier', 'mid'))
    if isinstance(budget, str) and budget.lower() not in VALID_BUDGET_TIERS:
        return False, f"Invalid budget tier (must be one of: {', '.join(sorted(VALID_BUDGET_TIERS))})"

    # Pace
    prefs = data.get('preferences', {})
    pace = prefs.get('pace', data.get('pace', 'balanced'))
    if isinstance(pace, str) and pace.lower() not in VALID_PACES:
        return False, f"Invalid pace (must be one of: {', '.join(sorted(VALID_PACES))})"

    # Interests
    interests = prefs.get('interests', [])
    if isinstance(interests, list):
        if len(interests) > 20:
            return False, "Too many interests (max 20)"
        for item in interests:
            if not isinstance(item, str) or len(item) > 100:
                return False, "Each interest must be a string under 100 characters"

    # mustDo
    must_do = data.get('mustDo', '')
    if isinstance(must_do, str) and len(must_do) > 2000:
        return False, "Must-do text must be under 2000 characters"

    # Origin
    origin = data.get('origin', '')
    if isinstance(origin, str) and len(origin) > 200:
        return False, "Origin must be under 200 characters"

    # Title
    title = data.get('title', '')
    if isinstance(title, str) and len(title) > 200:
        return False, "Title must be under 200 characters"

    return True, None
