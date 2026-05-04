"""
routes/predict.py
=================
POST /predict
  → Verifies Firebase token
  → Fetches onboarding + activity from Firestore
  → Maps to ML features
  → Runs analyze_student()
  → Saves result to users/{uid}/predictions/{id}
  → Returns PredictResponse

POST /predict/simulate
  → Same as above but accepts overridden behavioural values from the body
    (used by the frontend "what-if" simulation panel)
"""

from __future__     import annotations
import sys, os, uuid
from datetime       import datetime, timezone

from fastapi        import APIRouter, Depends, HTTPException, status

from middleware.auth  import get_current_user
from utils.firebase   import get_firestore
from utils.mapper     import map_to_ml_input, validate_ml_input
from schemas          import PredictRequest, PredictResponse

# ── Add project root to path so we can import predict.py ──────────────────────
_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, _BACKEND_DIR)

try:
    from predict import analyze_student
except ImportError as e:
    raise RuntimeError(
        "Could not import analyze_student from predict.py. "
        f"Make sure predict.py is in the backend root. Error: {e}"
    )

MODEL_VERSION = "xgboost-v1.0"

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fetch_onboarding(uid: str) -> dict:
    db   = get_firestore()
    snap = db.collection("users").document(uid)\
             .collection("onboarding").document("current").get()
    if not snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding profile not found. Complete onboarding first.",
        )
    return snap.to_dict()


def _fetch_activity(uid: str) -> dict | None:
    db   = get_firestore()
    snap = db.collection("users").document(uid)\
             .collection("activity").document("current").get()
    return snap.to_dict() if snap.exists else None


def _save_prediction(uid: str, result: dict, feature_input: dict) -> str:
    db      = get_firestore()
    pred_id = str(uuid.uuid4())
    now     = datetime.now(timezone.utc)

    db.collection("users").document(uid)\
      .collection("predictions").document(pred_id)\
      .set({
          "prediction":           result["prediction"],
          "success_probability":  result["success_probability"],
          "risk_level":           result["risk_level"],
          "current_behavior":     result["current_behavior"],
          "target_behavior":      result["target_behavior"],
          "improvement_needed":   result["improvement_needed"],
          "weekly_plan":          result["weekly_plan"],
          "simulation":           result["simulation"],
          "remaining_weeks":      result["remaining_weeks"],
          "feature_input":        feature_input,
          "model_version":        MODEL_VERSION,
          "created_at":           now.isoformat(),
      })

    db.collection("users").document(uid).set(
        {"latest_prediction_id": pred_id, "updatedAt": now.isoformat()},
        merge=True,
    )

    return pred_id


def _build_response(result: dict, pred_id: str) -> PredictResponse:
    sim = result.get("simulation", {})
    return PredictResponse(
        prediction=result["prediction"],
        success_probability=result["success_probability"],
        risk_level=result["risk_level"],
        current_behavior=result["current_behavior"],
        target_behavior=result["target_behavior"],
        improvement_needed=result["improvement_needed"],
        weekly_plan=result.get("weekly_plan", {}),
        simulation={
            "study_days": sim.get("study_days", 0.0),
            "assignment":  sim.get("assignment", 0.0),
            "lms":         sim.get("lms", 0.0),
            "ideal":       sim.get("ideal", 0.0),
        },
        remaining_weeks=result.get("remaining_weeks", 0),
        prediction_id=pred_id,
        model_version=MODEL_VERSION,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=PredictResponse)
def run_prediction(
    body: PredictRequest,
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]

    onboarding = _fetch_onboarding(uid)
    activity   = _fetch_activity(uid)

    if body.total_clicks is not None and activity is not None:
        activity["total_clicks"] = body.total_clicks
    if body.active_days is not None and activity is not None:
        activity["active_days"] = body.active_days
    if body.activity_span is not None and activity is not None:
        activity["activity_span"] = body.activity_span
    if body.avg_assignment_score is not None and activity is not None:
        activity["avg_assignment_score"] = body.avg_assignment_score

    feature_input = map_to_ml_input(onboarding, activity)

    warnings = validate_ml_input(feature_input)
    if warnings:
        print(f"[WARN] uid={uid} feature warnings: {warnings}")

    try:
        result = analyze_student(feature_input)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ML model error: {str(exc)}",
        )

    pred_id = _save_prediction(uid, result, feature_input)
    return _build_response(result, pred_id)


@router.post("/simulate", response_model=PredictResponse)
def simulate_prediction(
    body: PredictRequest,
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]

    onboarding = _fetch_onboarding(uid)

    sim_activity = {
        "total_clicks":         body.total_clicks         or 0,
        "active_days":          body.active_days          or 0,
        "activity_span":        body.activity_span        or 0,
        "avg_assignment_score": body.avg_assignment_score or 0.0,
    }

    feature_input = map_to_ml_input(onboarding, sim_activity)

    try:
        result = analyze_student(feature_input)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ML model error: {str(exc)}",
        )

    return _build_response(result, pred_id="simulation-only")