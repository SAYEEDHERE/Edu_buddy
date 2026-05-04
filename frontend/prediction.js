/* ════════════════════════════════════════════════════════════
   EDUBUDDY — prediction.js
   ML API Integration Layer
 
   HOW TO USE:
   Add this script tag to index.html (after onboarding.js):
     <script type="module" src="prediction.js"></script>
 
   This module:
   - Calls the FastAPI backend after onboarding completes
   - Updates the dashboard UI with ML results
   - Handles activity sync for repeat predictions
   - Zero UI design changes — only injects data into existing elements
════════════════════════════════════════════════════════════ */
 
'use strict';
 
import { getApp }    from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth }   from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
 
// ── Config ────────────────────────────────────────────────────────────────────
// Replace with your actual deployed backend URL.
const API_BASE = 'http://127.0.0.1:8000';
 
// ── Firebase refs ─────────────────────────────────────────────────────────────
const app  = getApp();
const auth = getAuth(app);
 
// ── State ─────────────────────────────────────────────────────────────────────
let _latestPrediction = null;
 
// ══════════════════════════════════════════════════════════════════════════════
//  TOKEN HELPER
// ══════════════════════════════════════════════════════════════════════════════
 
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  // Firebase auto-refreshes tokens; force refresh every call to be safe
  return user.getIdToken(/* forceRefresh */ false);
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  CORE: callPredictionAPI()
//  Called: (a) right after onboarding submit, (b) on dashboard load,
//           (c) after an activity update
// ══════════════════════════════════════════════════════════════════════════════
 
export async function callPredictionAPI(overrides = {}) {
  try {
    const token = await getIdToken();
 
    const res = await fetch(`${API_BASE}/predict`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(overrides),   // optional behavioural overrides
    });
 
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
 
    const data = await res.json();
    _latestPrediction = data;
 
    // Update UI with result
    renderPredictionResult(data);
    return data;
 
  } catch (err) {
    console.error('[EduBuddy Prediction] Error:', err.message);
    showPredictionError(err.message);
    return null;
  }
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  SIMULATE: callSimulationAPI()
//  Used by "what-if" sliders on dashboard — does NOT save to Firestore
// ══════════════════════════════════════════════════════════════════════════════
 
export async function callSimulationAPI(hypotheticalBehaviour) {
  try {
    const token = await getIdToken();
 
    const res = await fetch(`${API_BASE}/predict/simulate`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(hypotheticalBehaviour),
    });
 
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
 
    return await res.json();
 
  } catch (err) {
    console.error('[EduBuddy Simulation] Error:', err.message);
    return null;
  }
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  ACTIVITY SYNC: updateActivityAndPredict()
//  Call this when you have fresh activity data (e.g. after a study session)
// ══════════════════════════════════════════════════════════════════════════════
 
export async function updateActivityAndPredict(activityData) {
  try {
    const token = await getIdToken();
 
    // 1. Push activity to backend (saves to Firestore)
    const updateRes = await fetch(`${API_BASE}/activity`, {
      method:  'PUT',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(activityData),
    });
 
    if (!updateRes.ok) throw new Error('Activity update failed');
 
    // 2. Run fresh prediction with the updated data
    return callPredictionAPI();
 
  } catch (err) {
    console.error('[EduBuddy Activity] Error:', err.message);
    return null;
  }
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  UI RENDERING
//  Injects ML results into existing dashboard elements.
//  Add these IDs to your dashboard.html (or inject the section from JS).
// ══════════════════════════════════════════════════════════════════════════════
 
function renderPredictionResult(data) {
  // Guard: if dashboard elements don't exist yet, silently skip
  const _ = (id) => document.getElementById(id);
 
  // ── Core prediction ──────────────────────────────────────────────────────
  const probPct = Math.round(data.success_probability * 100);
 
  setText('eb-prediction-label',      data.prediction);           // "SUCCESS" or "AT RISK"
  setText('eb-risk-level',            data.risk_level);           // "Low" | "Moderate" | "High"
  setText('eb-probability',           `${probPct}%`);
  setText('eb-remaining-weeks',       `${data.remaining_weeks} weeks`);
 
  // Update risk badge colour
  const badge = _('eb-risk-badge');
  if (badge) {
    badge.dataset.risk = data.risk_level.toLowerCase();           // CSS hooks on data-risk
  }
 
  // ── Progress ring / bar ──────────────────────────────────────────────────
  const ring = _('eb-prob-ring');
  if (ring) ring.style.setProperty('--prob', probPct);            // CSS custom property
 
  // ── Current vs Target behaviour ──────────────────────────────────────────
  const cb = data.current_behavior;
  const tb = data.target_behavior;
 
  setText('eb-curr-days',   cb.active_days);
  setText('eb-curr-clicks', cb.total_clicks);
  setText('eb-curr-score',  `${cb.avg_assignment_score.toFixed(1)}%`);
 
  setText('eb-target-days',   tb.active_days);
  setText('eb-target-clicks', tb.total_clicks);
  setText('eb-target-score',  `${tb.avg_assignment_score.toFixed(1)}%`);
 
  // ── Improvement needed ───────────────────────────────────────────────────
  const imp = data.improvement_needed;
  setText('eb-extra-days',   imp.extra_days);
  setText('eb-extra-clicks', imp.extra_clicks);
  setText('eb-extra-marks',  imp.marks_improvement);
 
  // ── Weekly plan ──────────────────────────────────────────────────────────
  const plan = data.weekly_plan;
  if (plan.days_per_week)   setText('eb-plan-days',   `${plan.days_per_week} days/week`);
  if (plan.clicks_per_week) setText('eb-plan-clicks', `${plan.clicks_per_week} clicks/week`);
 
  // ── Simulation cards ─────────────────────────────────────────────────────
  const sim = data.simulation;
  setText('eb-sim-study',    pct(sim.study_days));
  setText('eb-sim-assign',   pct(sim.assignment));
  setText('eb-sim-lms',      pct(sim.lms));
  setText('eb-sim-ideal',    pct(sim.ideal));
 
  // ── Show the result section ───────────────────────────────────────────────
  const resultSection = _('eb-result-section');
  if (resultSection) resultSection.style.display = 'block';
 
  const loadingSection = _('eb-loading-section');
  if (loadingSection) loadingSection.style.display = 'none';
}
 
function showPredictionError(message) {
  const el = document.getElementById('eb-prediction-error');
  if (!el) return;
  el.textContent = `Could not load your AI prediction: ${message}. Please try again.`;
  el.style.display = 'block';
}
 
// ── Tiny helpers ──────────────────────────────────────────────────────────────
 
function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined) el.textContent = value;
}
 
function pct(prob) {
  return `${Math.round((prob ?? 0) * 100)}%`;
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  HOOK: Listen for the onboarding "complete" event
//  onboarding.js dispatches this when the user submits the wizard.
// ══════════════════════════════════════════════════════════════════════════════
 
window.addEventListener('edubuddy:onboarding-complete', async () => {
  console.log('[EduBuddy] Onboarding complete → running first prediction…');
 
  // Brief delay so Firestore write has time to commit
  await delay(1500);
  await callPredictionAPI();
});
 
// ══════════════════════════════════════════════════════════════════════════════
//  EXPOSE globally for console/debug access
// ══════════════════════════════════════════════════════════════════════════════
 
window.EduBuddyML = {
  predict:  callPredictionAPI,
  simulate: callSimulationAPI,
  updateActivity: updateActivityAndPredict,
  getLatest: () => _latestPrediction,
};
 
// ── Utility ───────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
 