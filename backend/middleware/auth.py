"""
middleware/auth.py
==================
FastAPI dependency (not a Starlette middleware) that:
  1. Reads the Authorization header
  2. Verifies the Firebase ID token
  3. Returns the decoded payload (uid, email, …)

Usage in routes:
  from middleware.auth import get_current_user
  ...
  async def my_endpoint(user = Depends(get_current_user)):
      uid = user["uid"]
"""

from fastapi          import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.firebase   import verify_token

# Starlette's HTTPBearer reads the "Authorization: Bearer <token>" header
_bearer = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    FastAPI dependency that verifies the Firebase ID token.
    Returns the decoded JWT dict (contains uid, email, name, picture, …).
    Raises HTTP 401 on any verification failure.
    """
    token = credentials.credentials  # The raw JWT string
    decoded = verify_token(token)

    if not decoded.get("uid"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain a valid UID.",
        )

    return decoded


# ── Re-export as the common name used across routes ───────────────────────────
AuthMiddleware = None   # kept for import compatibility — not a real middleware
