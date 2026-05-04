import os
import json
import joblib
import pandas as pd

# ─────────────────────────────────────────────────────────────
# PATH SETUP
# ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(__file__)

MODEL_PATH = os.path.join(BASE_DIR, "models", "model_pipeline.pkl")
FEATURES_PATH = os.path.join(BASE_DIR, "feature_columns.json")

# ─────────────────────────────────────────────────────────────
# LOAD MODEL + FEATURES
# ─────────────────────────────────────────────────────────────
pipeline = joblib.load(MODEL_PATH)

with open(FEATURES_PATH, "r") as f:
    FEATURE_COLUMNS = json.load(f)


# ─────────────────────────────────────────────────────────────
# CORE FUNCTION (USED BY ROUTES)
# ─────────────────────────────────────────────────────────────
def analyze_student(input_data: dict) -> dict:
    """
    Main function used by FastAPI route.
    Takes feature dict → returns prediction + insights.
    """

    # Convert to DataFrame
    df = pd.DataFrame([input_data])

    # Ensure column order matches training
    df = df[FEATURE_COLUMNS]

    # ── Model Prediction ──────────────────────────────────────
    pred = pipeline.predict(df)[0]
    prob = pipeline.predict_proba(df)[0][1]

    prediction_label = "SUCCESS" if pred == 1 else "AT RISK"

    # ── Risk Level ────────────────────────────────────────────
    if prob >= 0.7:
        risk_level = "Low"
    elif prob >= 0.4:
        risk_level = "Moderate"
    else:
        risk_level = "High"

    # ── Current Behaviour ─────────────────────────────────────
    current = {
        "active_days": input_data.get("active_days", 0),
        "total_clicks": input_data.get("total_clicks", 0),
        "avg_assignment_score": input_data.get("avg_assignment_score", 0),
    }

    # ── Target Behaviour (simple heuristic) ───────────────────
    target = {
        "active_days": max(current["active_days"], 90),
        "total_clicks": max(current["total_clicks"], 1500),
        "avg_assignment_score": max(current["avg_assignment_score"], 80),
    }

    # ── Improvement Needed ────────────────────────────────────
    improvement = {
        "extra_days": max(0, target["active_days"] - current["active_days"]),
        "extra_clicks": max(0, target["total_clicks"] - current["total_clicks"]),
        "marks_improvement": round(
            max(0, target["avg_assignment_score"] - current["avg_assignment_score"]), 2
        ),
    }

    # ── Weekly Plan ───────────────────────────────────────────
    weekly_plan = {
        "days_per_week": 5,
        "clicks_per_week": 300,
    }

    # ── Simulation (simple projections) ───────────────────────
    def simulate(delta_days=0, delta_clicks=0, delta_score=0):
        temp = input_data.copy()
        temp["active_days"] += delta_days
        temp["total_clicks"] += delta_clicks
        temp["avg_assignment_score"] = min(
            100, temp["avg_assignment_score"] + delta_score
        )

        temp_df = pd.DataFrame([temp])[FEATURE_COLUMNS]
        return float(pipeline.predict_proba(temp_df)[0][1])

    simulation = {
        "study_days": simulate(delta_days=20),
        "assignment": simulate(delta_score=10),
        "lms": simulate(delta_clicks=500),
        "ideal": simulate(delta_days=50, delta_clicks=1000, delta_score=15),
    }

    # ── Remaining Weeks (dummy logic) ─────────────────────────
    remaining_weeks = max(0, 12 - (current["active_days"] // 7))

    # ── FINAL RESPONSE ────────────────────────────────────────
    return {
        "prediction": prediction_label,
        "success_probability": float(prob),
        "risk_level": risk_level,
        "current_behavior": current,
        "target_behavior": target,
        "improvement_needed": improvement,
        "weekly_plan": weekly_plan,
        "simulation": simulation,
        "remaining_weeks": remaining_weeks,
    }