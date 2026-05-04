"""
utils/mapper.py
===============
Maps raw Firestore data → the exact feature vector that the ML pipeline expects.

Feature schema (must match feature_columns.json exactly):
  code_module, code_presentation, gender, region, highest_education,
  imd_band, age_band, num_of_prev_attempts, studied_credits, disability,
  module_presentation_length, total_clicks, active_days,
  avg_clicks_per_day, activity_span, avg_assignment_score

Firestore sources:
  • Static fields  → users/{uid}/onboarding/current
  • Behavioural    → users/{uid}/activity/current  (updated as user studies)
"""

from __future__ import annotations
from typing import Any


# ── Safe coercion helpers ──────────────────────────────────────────────────────

def _int(val: Any, default: int = 0) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _str(val: Any, default: str = "") -> str:
    return str(val).strip() if val is not None else default


# ── Module presentation length lookup ─────────────────────────────────────────
# Stored in onboarding; fall back to the median (268 days) if not provided.
_DEFAULT_MODULE_LENGTH = 268


# ── Main mapping function ──────────────────────────────────────────────────────

def map_to_ml_input(
    onboarding: dict,
    activity: dict | None = None,
) -> dict:
    """
    Parameters
    ----------
    onboarding : dict
        Document from users/{uid}/onboarding/current
    activity : dict | None
        Document from users/{uid}/activity/current.
        Defaults to zeroes if None (first prediction, right after onboarding).

    Returns
    -------
    dict
        Fully typed feature dict ready to pass into analyze_student().
    """

    act = activity or {}

    # ── Behavioural features ───────────────────────────────────────────────
    total_clicks  = _int(act.get("total_clicks"), 0)
    active_days   = _int(act.get("active_days"),  0)
    activity_span = _int(act.get("activity_span"), 0)
    avg_score     = _float(act.get("avg_assignment_score"), 0.0)

    # Guard against divide-by-zero
    avg_clicks_per_day = (total_clicks / active_days) if active_days > 0 else 0.0

    # ── Static (onboarding) features ──────────────────────────────────────
    module_length = _int(
        onboarding.get("module_presentation_length"),
        _DEFAULT_MODULE_LENGTH,
    )

    return {
        # ── Categorical ───────────────────────────────────────────────────
        "code_module":          _str(onboarding.get("code_module"),          "BBB"),
        "code_presentation":    _str(onboarding.get("code_presentation"),    "2013J"),
        "gender":               _str(onboarding.get("gender"),               "M"),
        "region":               _str(onboarding.get("region"),               "South East Region"),
        "highest_education":    _str(onboarding.get("highest_education"),    "A Level or Equivalent"),
        "imd_band":             _str(onboarding.get("imd_band"),             "50-60%"),
        "age_band":             _str(onboarding.get("age_band"),             "0-35"),
        "disability":           _str(onboarding.get("disability"),           "N"),

        # ── Numeric (static) ──────────────────────────────────────────────
        "num_of_prev_attempts":      _int(onboarding.get("num_of_prev_attempts"), 0),
        "studied_credits":           _int(onboarding.get("studied_credits"),      60),
        "module_presentation_length": module_length,

        # ── Numeric (behavioural) ─────────────────────────────────────────
        "total_clicks":         total_clicks,
        "active_days":          active_days,
        "avg_clicks_per_day":   round(avg_clicks_per_day, 4),
        "activity_span":        activity_span,
        "avg_assignment_score": round(avg_score, 2),
    }


def validate_ml_input(feature_dict: dict) -> list[str]:
    """
    Returns a list of validation warnings (non-fatal).
    The caller decides whether to block or just log them.
    """
    warnings: list[str] = []

    REQUIRED_FEATURES = [
        "code_module", "code_presentation", "gender", "region",
        "highest_education", "imd_band", "age_band", "num_of_prev_attempts",
        "studied_credits", "disability", "module_presentation_length",
        "total_clicks", "active_days", "avg_clicks_per_day",
        "activity_span", "avg_assignment_score",
    ]

    for feat in REQUIRED_FEATURES:
        if feat not in feature_dict:
            warnings.append(f"Missing feature: {feat}")

    if feature_dict.get("active_days", 0) < 0:
        warnings.append("active_days is negative")
    if not (0 <= feature_dict.get("avg_assignment_score", 0) <= 100):
        warnings.append("avg_assignment_score out of range [0, 100]")

    return warnings
