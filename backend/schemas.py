"""
schemas.py
==========
Pydantic models for all API requests and responses.
"""

from __future__ import annotations
from typing   import Optional
from pydantic import BaseModel, Field


# ── Shared token header ────────────────────────────────────────────────────────

class TokenHeader(BaseModel):
    """Every protected endpoint extracts the bearer token from this."""
    authorization: str = Field(..., description="Bearer <Firebase ID token>")


# ── Prediction ─────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """
    Sent by the frontend after onboarding (or on dashboard refresh).
    The ID token is passed in the Authorization header.
    """
    # Optional: frontend can override behavioural values for simulation.
    # If omitted, the backend reads them from Firestore activity doc.
    total_clicks:          Optional[int]   = None
    active_days:           Optional[int]   = None
    activity_span:         Optional[int]   = None
    avg_assignment_score:  Optional[float] = None


class BehaviourSnapshot(BaseModel):
    active_days:           float
    total_clicks:          float
    avg_assignment_score:  float


class ImprovementNeeded(BaseModel):
    extra_days:          int
    extra_clicks:        int
    marks_improvement:   float


class Simulation(BaseModel):
    study_days:  float
    assignment:  float
    lms:         float
    ideal:       float


class PredictResponse(BaseModel):
    prediction:           str              # "SUCCESS" | "AT RISK"
    success_probability:  float            # 0.0 – 1.0
    risk_level:           str              # "Low" | "Moderate" | "High"
    current_behavior:     BehaviourSnapshot
    target_behavior:      BehaviourSnapshot
    improvement_needed:   ImprovementNeeded
    weekly_plan:          dict
    simulation:           Simulation
    remaining_weeks:      int
    prediction_id:        str              # Firestore document ID
    model_version:        str


# ── Activity update ────────────────────────────────────────────────────────────

class ActivityUpdateRequest(BaseModel):
    total_clicks:          int   = Field(ge=0)
    active_days:           int   = Field(ge=0)
    activity_span:         int   = Field(ge=0)
    avg_assignment_score:  float = Field(ge=0, le=100)


class ActivityUpdateResponse(BaseModel):
    status:      str
    updated_at:  str


# ── Profile ────────────────────────────────────────────────────────────────────

class ProfileResponse(BaseModel):
    uid:                str
    preferred_name:     str
    student_type:       str
    onboarding_complete: bool
    latest_prediction:  Optional[dict] = None
