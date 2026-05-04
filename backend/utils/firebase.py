"""
utils/firebase.py
=================
Initialises Firebase Admin SDK (once, on startup).
Exposes helpers:
  - verify_token(id_token)  → decoded JWT dict  (raises HTTPException on fail)
  - get_firestore()         → google.cloud.firestore.AsyncClient
"""

import os
import firebase_admin
from firebase_admin        import credentials, auth, firestore
from fastapi               import HTTPException, status


def init_firebase() -> None:
    """Called once in the FastAPI lifespan hook."""
    if firebase_admin._apps:
        return  # Already initialised (e.g. hot-reload)

    # Option A — service account JSON file path (local dev)
    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if sa_path:
        cred = credentials.Certificate(sa_path)
    else:
        # Option B — JSON string injected as env variable (Render / Railway)
        import json
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not sa_json:
            raise RuntimeError(
                "No Firebase credentials found. "
                "Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON."
            )
        cred = credentials.Certificate(json.loads(sa_json))

    firebase_admin.initialize_app(cred)


def verify_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token sent from the frontend.
    Returns the decoded token payload (contains uid, email, etc.)
    Raises HTTP 401 if invalid / expired.
    """
    try:
        return auth.verify_id_token(id_token)
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token has expired. Please sign in again.",
        )
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(exc)}",
        )


def get_firestore():
    """Return the Firestore client (synchronous, thread-safe)."""
    return firestore.client()
