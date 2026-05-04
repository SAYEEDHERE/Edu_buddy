"""
routes/activity.py
==================
PUT /activity
  → Updates users/{uid}/activity/current with fresh behavioural metrics.
  → Called periodically by the frontend (e.g. after a study session).

GET /activity
  → Returns current activity snapshot for the logged-in user.
"""

from __future__  import annotations
from datetime    import datetime, timezone

from fastapi     import APIRouter, Depends, HTTPException, status

from middleware.auth  import get_current_user
from utils.firebase   import get_firestore
from schemas          import ActivityUpdateRequest, ActivityUpdateResponse

router = APIRouter()


@router.put("", response_model=ActivityUpdateResponse)
async def update_activity(
    body: ActivityUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """
    Frontend calls this whenever activity data is available.
    Safe to call repeatedly — uses merge so no data is lost.
    """
    uid = user["uid"]
    db  = get_firestore()
    now = datetime.now(timezone.utc)

    # Compute derived feature here to keep Firestore clean
    avg_clicks_per_day = (
        body.total_clicks / body.active_days
        if body.active_days > 0
        else 0.0
    )

    db.collection("users").document(uid)\
      .collection("activity").document("current")\
      .set({
          "total_clicks":         body.total_clicks,
          "active_days":          body.active_days,
          "activity_span":        body.activity_span,
          "avg_assignment_score": body.avg_assignment_score,
          "avg_clicks_per_day":   round(avg_clicks_per_day, 4),
          "updatedAt":            now.isoformat(),
      }, merge=True)

    return ActivityUpdateResponse(status="ok", updated_at=now.isoformat())


@router.get("")
async def get_activity(user: dict = Depends(get_current_user)):
    uid  = user["uid"]
    db   = get_firestore()
    snap = db.collection("users").document(uid)\
             .collection("activity").document("current").get()

    if not snap.exists:
        return {
            "total_clicks": 0, "active_days": 0,
            "activity_span": 0, "avg_assignment_score": 0.0,
            "avg_clicks_per_day": 0.0,
        }

    return snap.to_dict()
