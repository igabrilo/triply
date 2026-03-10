"""Pydantic schemas that define the strict JSON contract with the LLM.

Every AI call must return JSON conforming to one of these schemas.
The OpenAI Structured Outputs feature enforces this at generation time;
we also validate on the backend as a second line of defense.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ------------------------------------------------------------------
# Plan generation
# ------------------------------------------------------------------
class PlanItemSchema(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = Field(None, description="dining | activity | transport | landmark | shopping | nightlife")
    time_block: Optional[str] = Field(None, description="morning | afternoon | evening | full_day")
    duration_minutes: Optional[int] = None
    cost_hint: Optional[str] = None
    place_query: Optional[str] = Field(None, description="Search query for geocoding, e.g. 'Sacré-Cœur Basilica, Paris'")
    external_url: Optional[str] = None
    tips: Optional[str] = None


class PlanDaySchema(BaseModel):
    day_index: int
    title: str
    items: list[PlanItemSchema]


class GeneratedPlan(BaseModel):
    """Full itinerary returned by the LLM."""
    days: list[PlanDaySchema]


# ------------------------------------------------------------------
# Stay suggestions
# ------------------------------------------------------------------
class StaySchema(BaseModel):
    name: str
    neighborhood: Optional[str] = None
    stay_type: Optional[str] = Field(None, description="hotel | hostel | apartment | boutique | resort")
    price_range: Optional[str] = None
    rating_hint: Optional[float] = None
    why_it_fits: Optional[str] = None
    place_query: Optional[str] = Field(None, description="Search query for geocoding")
    amenities: Optional[list[str]] = None
    booking_search_url: Optional[str] = None


class GeneratedStays(BaseModel):
    """Accommodation suggestions returned by the LLM."""
    stays: list[StaySchema]


# ------------------------------------------------------------------
# Flight suggestions
# ------------------------------------------------------------------
class FlightSchema(BaseModel):
    airline: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    depart_time_hint: Optional[str] = None
    arrive_time_hint: Optional[str] = None
    duration_hint: Optional[str] = None
    stops_count: Optional[int] = None
    price_hint: Optional[str] = None
    booking_search_url: Optional[str] = None


class GeneratedFlights(BaseModel):
    """Flight suggestions returned by the LLM."""
    flights: list[FlightSchema]


# ------------------------------------------------------------------
# Activities bucket suggestions
# ------------------------------------------------------------------
class ActivitySuggestionSchema(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = Field(None, description="attractions | food | nightlife | outdoors | shopping | custom")
    duration_minutes: Optional[int] = None
    cost_hint: Optional[str] = None
    place_query: Optional[str] = Field(None, description="Search query for geocoding")


class GeneratedActivities(BaseModel):
    activities: list[ActivitySuggestionSchema]


# ------------------------------------------------------------------
# Weather
# ------------------------------------------------------------------
class WeatherDaySchema(BaseModel):
    date: str = Field(description="YYYY-MM-DD")
    high_temp_c: Optional[int] = None
    low_temp_c: Optional[int] = None
    condition: Optional[str] = None
    icon: Optional[str] = None
    humidity_pct: Optional[int] = None


class GeneratedWeather(BaseModel):
    days: list[WeatherDaySchema]


# ------------------------------------------------------------------
# Budget hints
# ------------------------------------------------------------------
class BudgetCategoryHintSchema(BaseModel):
    category: str = Field(description="transport | accommodation | food | activities | shopping | other")
    estimated_amount: Optional[int] = None
    note: Optional[str] = None


class GeneratedBudget(BaseModel):
    currency: Optional[str] = None
    total_estimated: Optional[int] = None
    categories: list[BudgetCategoryHintSchema]


# ------------------------------------------------------------------
# Overview summary + hero image prompt
# ------------------------------------------------------------------
class GeneratedOverview(BaseModel):
    summary: str
    destination_image_prompt: str = Field(description="A cinematic, realistic destination photo prompt")
    notes_seed: list[str]


# ------------------------------------------------------------------
# Full trip generation (combines all three)
# ------------------------------------------------------------------
class GeneratedTrip(BaseModel):
    """Complete trip generation output."""
    plan: GeneratedPlan
    stays: GeneratedStays
    flights: GeneratedFlights


# ------------------------------------------------------------------
# Chat edit (scope-limited patch)
# ------------------------------------------------------------------
class ChatEditPlan(BaseModel):
    """Patch for the plan section."""
    days: list[PlanDaySchema]
    explanation: str = Field(description="Human-readable summary of what changed")


class ChatEditStays(BaseModel):
    """Patch for the stays section."""
    stays: list[StaySchema]
    explanation: str


class ChatEditFlights(BaseModel):
    """Patch for the flights section."""
    flights: list[FlightSchema]
    explanation: str


class ChatEditResponse(BaseModel):
    """LLM response for a scoped chat edit.

    Exactly one of plan / stays / flights should be populated,
    matching the scope of the edit request.
    """
    scope: str = Field(description="plan | stays | flights")
    plan: Optional[ChatEditPlan] = None
    stays: Optional[ChatEditStays] = None
    flights: Optional[ChatEditFlights] = None
    explanation: str = Field(description="Human-readable explanation for the user")
