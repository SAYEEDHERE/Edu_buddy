"""
EduBuddy — FastAPI Backend
==========================
Entry point. Registers all routers and middleware.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()   # ← reads .env before anything else runs

from routes.predict   import router as predict_router
from routes.activity  import router as activity_router
from routes.profile   import router as profile_router
from middleware.auth  import AuthMiddleware
from utils.firebase   import init_firebase


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once on startup — initialise Firebase Admin SDK."""
    init_firebase()
    yield


app = FastAPI(
    title="EduBuddy API",
    version="1.0.0",
    description="ML prediction backend for the EduBuddy platform",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5500",          # VS Code Live Server (localhost)
        "http://127.0.0.1:5500",         # VS Code Live Server (127.0.0.1)
        "http://localhost:5501",          # alternate Live Server port
        "http://127.0.0.1:5501",
        "https://your-domain.com",       # ← replace with your real domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(predict_router,  prefix="/predict",  tags=["Prediction"])
app.include_router(activity_router, prefix="/activity", tags=["Activity"])
app.include_router(profile_router,  prefix="/profile",  tags=["Profile"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "EduBuddy API v1"}