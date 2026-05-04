"""
routes/profile.py
=================
GET /profile
  → Returns the user's basic info + latest prediction (for dashboard load).
"""

from fastapi     import APIRouter, Depends, HTTPException, status

from middleware.auth  import get_current_user
from utils.firebase   import get_firestore
from schemas          import ProfileResponse

router = APIRouter()


@router.get("", response_model=ProfileResponse)
async def get_profile(user: dict = Depends(get_current_user)):
    uid = user["uid"]
    db  = get_firestore()

    # Fetch base user doc
    user_snap = db.collection("users").document(uid).get()
    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found.",
        )

    user_data = user_snap.to_dict()

    # Optionally fetch latest prediction
    latest_pred = None
    pred_id     = user_data.get("latest_prediction_id")
    if pred_id:
        pred_snap = (
            db.collection("users").document(uid)
              .collection("predictions").document(pred_id).get()
        )
        if pred_snap.exists:
            latest_pred = pred_snap.to_dict()

    return ProfileResponse(
        uid=uid,
        preferred_name=user_data.get("preferred_name", ""),
        student_type=user_data.get("student_type", ""),
        onboarding_complete=user_data.get("onboardingComplete", False),
        latest_prediction=latest_pred,
    )
