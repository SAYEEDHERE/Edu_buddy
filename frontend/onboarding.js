/* ════════════════════════════════════════════════════════════
   EDUBUDDY — onboarding.js
   Step 2: Multi-step onboarding wizard + Firestore persistence
   ════════════════════════════════════════════════════════════
 
   HOW TO USE:
   1. Append onboarding_additions.css to the end of style.css
   2. Paste onboarding_modal_snippet.html before </body> in index.html
   3. Save this file as onboarding.js next to script.js
 
   This module:
   - Listens for a logged-in user via Firebase Auth
   - Checks Firestore for onboardingComplete
   - Opens the wizard if onboarding is not complete
   - Prefills all fields if a saved draft exists
   - Validates each step before advancing
   - Writes to Firestore on submit
   - Shows a success state and routes to the dashboard placeholder
*/
 
'use strict';
 
import { getApp }   from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import {
  getFirestore,
  doc, getDoc, setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
 
// ── Firebase refs (reuse the app already initialised in script.js) ───────────
const app  = getApp();
const auth = getAuth(app);
const db   = getFirestore(app);
 
// ── Element refs ─────────────────────────────────────────────────────────────
const overlay    = document.getElementById('onboarding-modal');
const card       = document.getElementById('onboarding-card');
const stepLabel  = document.getElementById('ob-step-label');
const progFill   = document.getElementById('ob-progress-fill');
const dots       = document.querySelectorAll('.ob-dot');
const bodyEl     = document.querySelector('#onboarding-modal .ob-body');
const successEl  = document.getElementById('ob-success');
const successCta = document.getElementById('ob-success-cta');
const spinner    = document.getElementById('ob-spinner');
const submitBtn  = document.getElementById('ob-submit-btn');
const reviewGrid = document.getElementById('ob-review-grid');
 
// Step panels
const steps = document.querySelectorAll('.ob-step');
 
// ── State ────────────────────────────────────────────────────────────────────
let currentStep = 1;
const TOTAL_STEPS = 4;
let currentUid = null;
 
// ══════════════════════════════════════════════════════════════════════════════
//  OPEN / CLOSE
// ══════════════════════════════════════════════════════════════════════════════
 
function openOnboarding() {
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  // Prevent background scroll
  document.body.style.overflow = 'hidden';
}
 
function closeOnboarding() {
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  STEP NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
 
function goToStep(n) {
  if (n < 1 || n > TOTAL_STEPS) return;
 
  // Update panels
  steps.forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.toggle('active', sn === n);
  });
 
  // Update progress
  currentStep = n;
  const pct   = Math.round((n / TOTAL_STEPS) * 100);
  progFill.style.width = `${pct}%`;
  stepLabel.textContent = `Step ${n} of ${TOTAL_STEPS}`;
 
  // Update dots
  dots.forEach(d => {
    const dn = parseInt(d.dataset.dot);
    d.classList.toggle('active', dn === n);
    d.classList.toggle('done',   dn < n);
  });
 
  // Scroll card to top on step change
  card.scrollTop = 0;
 
  // On review step: populate the review grid
  if (n === 4) buildReviewGrid();
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  VALIDATION HELPERS
// ══════════════════════════════════════════════════════════════════════════════
 
function showError(id, show = true) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('show', show);
}
 
function markField(id, error = true) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('ob-error', error);
}
 
function markRadioGroup(groupId, error = true) {
  const el = document.getElementById(groupId);
  if (el) el.classList.toggle('ob-error', error);
}
 
function showStepError(step, msg) {
  const el = document.getElementById(`ob-error-${step}`);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}
 
function clearStepError(step) { showStepError(step, ''); }
 
// ── Step 1 validation ────────────────────────────────────────────────────────
function validateStep1() {
  let valid = true;
  clearStepError(1);
 
  const name = document.getElementById('ob-name').value.trim();
  if (!name) {
    markField('ob-name'); showError('ob-err-name'); valid = false;
  } else {
    markField('ob-name', false); showError('ob-err-name', false);
  }
 
  const gender = document.querySelector('input[name="ob-gender"]:checked');
  if (!gender) {
    markRadioGroup('ob-gender-group'); showError('ob-err-gender'); valid = false;
  } else {
    markRadioGroup('ob-gender-group', false); showError('ob-err-gender', false);
  }
 
  const ageBand = document.getElementById('ob-age-band').value;
  if (!ageBand) {
    markField('ob-age-band'); showError('ob-err-age-band'); valid = false;
  } else {
    markField('ob-age-band', false); showError('ob-err-age-band', false);
  }
 
  const studentType = document.getElementById('ob-student-type').value;
  if (!studentType) {
    markField('ob-student-type'); showError('ob-err-student-type'); valid = false;
  } else {
    markField('ob-student-type', false); showError('ob-err-student-type', false);
  }
 
  if (!valid) showStepError(1, 'Please complete all required fields before continuing.');
  return valid;
}
 
// ── Step 2 validation ────────────────────────────────────────────────────────
function validateStep2() {
  let valid = true;
  clearStepError(2);
 
  const fields = [
    { id: 'ob-highest-edu',      err: 'ob-err-highest-edu' },
    { id: 'ob-code-module',      err: 'ob-err-code-module' },
    { id: 'ob-code-pres',        err: 'ob-err-code-pres' },
    { id: 'ob-studied-credits',  err: 'ob-err-studied-credits' },
  ];
 
  fields.forEach(({ id, err }) => {
    const val = document.getElementById(id).value;
    if (!val) {
      markField(id); showError(err); valid = false;
    } else {
      markField(id, false); showError(err, false);
    }
  });
 
  if (!valid) showStepError(2, 'Please fill in all required fields.');
  return valid;
}
 
// ── Step 3 validation ────────────────────────────────────────────────────────
function validateStep3() {
  let valid = true;
  clearStepError(3);
 
  const required = [
    { id: 'ob-region',         err: 'ob-err-region' },
    { id: 'ob-imd-band',       err: 'ob-err-imd-band' },
    { id: 'ob-prev-attempts',  err: 'ob-err-prev-attempts' },
    { id: 'ob-mod-length',     err: 'ob-err-mod-length' },
  ];
 
  required.forEach(({ id, err }) => {
    const val = document.getElementById(id).value;
    if (!val) {
      markField(id); showError(err); valid = false;
    } else {
      markField(id, false); showError(err, false);
    }
  });
 
  if (!valid) showStepError(3, 'Please complete all required fields.');
  return valid;
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  COLLECT FORM DATA  →  structured object ready for Firestore
// ══════════════════════════════════════════════════════════════════════════════
 
function collectFormData() {
  const genderEl = document.querySelector('input[name="ob-gender"]:checked');
 
  return {
    // Step 1
    preferred_name:    document.getElementById('ob-name').value.trim(),
    gender:            genderEl ? genderEl.value : '',
    age_band:          document.getElementById('ob-age-band').value,
    student_type:      document.getElementById('ob-student-type').value,
 
    // Step 2
    highest_education: document.getElementById('ob-highest-edu').value,
    code_module:       document.getElementById('ob-code-module').value,
    code_presentation: document.getElementById('ob-code-pres').value,
    studied_credits:   parseInt(document.getElementById('ob-studied-credits').value, 10),
 
    // Step 3
    region:                     document.getElementById('ob-region').value,
    imd_band:                   document.getElementById('ob-imd-band').value,
    num_of_prev_attempts:       parseInt(document.getElementById('ob-prev-attempts').value, 10),
    module_presentation_length: parseInt(document.getElementById('ob-mod-length').value, 10),
    disability:                 document.getElementById('ob-disability').value || '',
    weekly_availability:        document.getElementById('ob-weekly-hours').value || '',
  };
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  REVIEW GRID  — build the step-4 summary table
// ══════════════════════════════════════════════════════════════════════════════
 
const REVIEW_SECTIONS = [
  {
    title: 'About You',
    fields: [
      { label: 'Preferred name',   key: 'preferred_name' },
      { label: 'Gender',           key: 'gender',       map: { M:'Male', F:'Female', N:'Non-binary', X:'Prefer not to say' } },
      { label: 'Age band',         key: 'age_band' },
      { label: 'Academic level',   key: 'student_type', map: {
        undergraduate:'Undergraduate', postgraduate:'Postgraduate', doctoral:'Doctoral / PhD',
        professional:'Professional / CPD', other:'Other' } },
    ],
    editStep: 1,
  },
  {
    title: 'Module Details',
    fields: [
      { label: 'Highest education', key: 'highest_education' },
      { label: 'Module code',       key: 'code_module' },
      { label: 'Presentation',      key: 'code_presentation' },
      { label: 'Studied credits',   key: 'studied_credits', suffix: ' credits' },
    ],
    editStep: 2,
  },
  {
    title: 'Study Context',
    fields: [
      { label: 'Region',            key: 'region' },
      { label: 'IMD band',          key: 'imd_band' },
      { label: 'Previous attempts', key: 'num_of_prev_attempts' },
      { label: 'Module length',     key: 'module_presentation_length', suffix: ' days' },
      { label: 'Accessibility',     key: 'disability',   optional: true, map: { Y:'Yes', N:'No', '':'Not specified' } },
      { label: 'Weekly hours',      key: 'weekly_availability', optional: true },
    ],
    editStep: 3,
  },
];
 
function buildReviewGrid() {
  const data = collectFormData();
  reviewGrid.innerHTML = '';
 
  REVIEW_SECTIONS.forEach(({ title, fields, editStep }) => {
    // Section label
    const sectionLabel = document.createElement('div');
    sectionLabel.className = 'ob-review-section-label';
    sectionLabel.style.cssText = `
      font-size:10.5px;font-weight:600;color:#3f3f46;
      text-transform:uppercase;letter-spacing:.08em;
      padding:14px 16px 5px;
    `;
    sectionLabel.innerHTML = `
      ${title}
      <button class="ob-review-edit" type="button"
              onclick="window.__obGoToStep(${editStep})"
              style="float:right;font-size:11px;color:#2563eb;
                     background:none;border:none;cursor:pointer;
                     font-weight:600;padding:0;font-family:inherit;">
        Edit
      </button>
    `;
    reviewGrid.appendChild(sectionLabel);
 
    fields.forEach(({ label, key, map, suffix, optional }) => {
      let raw = data[key];
      let display = (raw !== undefined && raw !== '') ? String(raw) : null;
 
      if (map && display !== null) display = map[display] ?? display;
      if (suffix && display !== null) display = display + suffix;
 
      const row = document.createElement('div');
      row.className = 'ob-review-row';
      row.innerHTML = `
        <span class="ob-review-key">${label}</span>
        <span class="ob-review-val${!display ? ' ob-review-empty' : ''}">
          ${display || (optional ? '—' : 'Not set')}
        </span>
      `;
      reviewGrid.appendChild(row);
    });
  });
 
  // Expose helper for the Edit buttons
  window.__obGoToStep = (n) => goToStep(n);
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  FIRESTORE — WRITE
// ══════════════════════════════════════════════════════════════════════════════
 
async function saveOnboarding(uid) {
  const raw = collectFormData();
  const now = serverTimestamp();
 
  // Flat object shaped for the prediction service
  const predictionFields = {
    code_module:               raw.code_module,
    code_presentation:         raw.code_presentation,
    gender:                    raw.gender,
    region:                    raw.region,
    highest_education:         raw.highest_education,
    imd_band:                  raw.imd_band,
    age_band:                  raw.age_band,
    num_of_prev_attempts:      raw.num_of_prev_attempts,
    studied_credits:           raw.studied_credits,
    disability:                raw.disability || 'N',
    module_presentation_length: raw.module_presentation_length,
  };
 
  const userRef      = doc(db, 'users', uid);
  const onboardRef   = doc(db, 'users', uid, 'onboarding', 'current');
 
  // Write to users/{uid}
  await setDoc(userRef, {
    preferred_name:   raw.preferred_name,
    student_type:     raw.student_type,
    onboardingComplete: true,
    updatedAt:        now,
  }, { merge: true });
 
  // Write to users/{uid}/onboarding/current
  await setDoc(onboardRef, {
    ...raw,
    ...predictionFields,           // flat top-level copy for easy ML read
    onboardingComplete: true,
    submittedAt:  now,
    updatedAt:    now,
  });
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  FIRESTORE — READ & PREFILL
// ══════════════════════════════════════════════════════════════════════════════
 
function prefillText(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}
 
function prefillSelect(id, val) {
  const el = document.getElementById(id);
  if (!el || val === undefined || val === null) return;
  // Set the value; if the option doesn't exist the select falls back to blank
  el.value = String(val);
}
 
function prefillRadio(name, val) {
  if (!val) return;
  const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
  if (el) el.checked = true;
}
 
async function loadAndPrefill(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'onboarding', 'current'));
    if (!snap.exists()) return false; // No saved data
 
    const d = snap.data();
 
    // Step 1
    prefillText('ob-name', d.preferred_name);
    prefillRadio('ob-gender', d.gender);
    prefillSelect('ob-age-band', d.age_band);
    prefillSelect('ob-student-type', d.student_type);
 
    // Step 2
    prefillSelect('ob-highest-edu', d.highest_education);
    prefillSelect('ob-code-module', d.code_module);
    prefillSelect('ob-code-pres', d.code_presentation);
    prefillSelect('ob-studied-credits', String(d.studied_credits));
 
    // Step 3
    prefillSelect('ob-region', d.region);
    prefillSelect('ob-imd-band', d.imd_band);
    prefillSelect('ob-prev-attempts', String(d.num_of_prev_attempts));
    prefillSelect('ob-mod-length', String(d.module_presentation_length));
    prefillSelect('ob-disability', d.disability ?? '');
    prefillSelect('ob-weekly-hours', d.weekly_availability ?? '');
 
    return d.onboardingComplete === true;
  } catch (err) {
    console.error('[EduBuddy] Could not load onboarding data:', err);
    return false;
  }
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  AUTH STATE — trigger onboarding when user logs in
// ══════════════════════════════════════════════════════════════════════════════
 
async function checkAndShowOnboarding(user) {
  if (!user) return;
  currentUid = user.uid;
 
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const data     = userSnap.exists() ? userSnap.data() : {};
 
    if (data.onboardingComplete === true) {
      // Already completed — go straight to dashboard
      window.location.href = 'dashboard.html';
      return;
    }
 
    // New user or incomplete onboarding — open wizard & try to prefill draft
    await loadAndPrefill(user.uid);
    goToStep(1);
    openOnboarding();
 
  } catch (err) {
    console.error('[EduBuddy] Onboarding check failed:', err);
    // Open anyway so the user can proceed
    goToStep(1);
    openOnboarding();
  }
}
 
onAuthStateChanged(auth, (user) => {
  if (user) {
    checkAndShowOnboarding(user);
  } else {
    closeOnboarding();
    currentUid = null;
  }
});
 
// ══════════════════════════════════════════════════════════════════════════════
//  SUBMIT
// ══════════════════════════════════════════════════════════════════════════════
 
function setSubmitLoading(on) {
  submitBtn.disabled = on;
  spinner.classList.toggle('show', on);
  submitBtn.querySelector('span + *') // text node guard
  submitBtn.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = on ? ' Saving…' : ' Submit Profile';
    }
  });
}
 
async function handleSubmit() {
  if (!currentUid) {
    showStepError(4, 'You must be logged in to submit. Please refresh and try again.');
    return;
  }
 
  clearStepError(4);
  setSubmitLoading(true);
 
  try {
    await saveOnboarding(currentUid);
 
    // Notify prediction.js to run the first ML prediction
    window.dispatchEvent(new CustomEvent('edubuddy:onboarding-complete', {
      detail: { uid: currentUid }
    }));
 
    // Show success state
    bodyEl.style.display    = 'none';
    successEl.classList.add('show');
 
    // Scroll to top of card
    card.scrollTop = 0;
 
    // Update progress to 100% for polish
    progFill.style.width    = '100%';
    stepLabel.textContent   = 'Complete';
    dots.forEach(d => d.classList.add('done'));
 
  } catch (err) {
    console.error('[EduBuddy] Submit failed:', err);
    showStepError(4, 'Could not save your profile. Check your connection and try again.');
  } finally {
    setSubmitLoading(false);
  }
}
 
// ══════════════════════════════════════════════════════════════════════════════
//  BUTTON WIRING
// ══════════════════════════════════════════════════════════════════════════════
 
// Step 1 — Next
document.getElementById('ob-next-1')?.addEventListener('click', () => {
  if (validateStep1()) goToStep(2);
});
 
// Step 2 — Back / Next
document.getElementById('ob-back-2')?.addEventListener('click', () => goToStep(1));
document.getElementById('ob-next-2')?.addEventListener('click', () => {
  if (validateStep2()) goToStep(3);
});
 
// Step 3 — Back / Next (review)
document.getElementById('ob-back-3')?.addEventListener('click', () => goToStep(2));
document.getElementById('ob-next-3')?.addEventListener('click', () => {
  if (validateStep3()) goToStep(4);
});
 
// Step 4 — Back / Submit
document.getElementById('ob-back-4')?.addEventListener('click', () => goToStep(3));
submitBtn?.addEventListener('click', handleSubmit);
 
// Success CTA — route to dashboard
successCta?.addEventListener('click', () => {
  closeOnboarding();
  window.location.href = 'dashboard.html';
});
 
// Live input cleanup: remove error highlight on edit
document.querySelectorAll('.ob-input, .ob-select').forEach(el => {
  el.addEventListener('input', () => {
    el.classList.remove('ob-error');
    const errId = el.id.replace('ob-', 'ob-err-');
    showError(errId, false);
  });
  el.addEventListener('change', () => {
    el.classList.remove('ob-error');
    const errId = el.id.replace('ob-', 'ob-err-');
    showError(errId, false);
  });
});
 
document.querySelectorAll('input[name="ob-gender"]').forEach(radio => {
  radio.addEventListener('change', () => {
    markRadioGroup('ob-gender-group', false);
    showError('ob-err-gender', false);
  });
});
 
// ══════════════════════════════════════════════════════════════════════════════
//  EXPOSE for re-opening (e.g. from a settings or profile page)
//  Usage:  window.EduBuddyOnboarding.open()  /  .openForEdit()
// ══════════════════════════════════════════════════════════════════════════════
window.EduBuddyOnboarding = {
  /** Open wizard for a new user */
  open() { goToStep(1); openOnboarding(); },
 
  /** Re-open wizard for editing — loads saved answers, starts at step 1 */
  async openForEdit() {
    if (currentUid) await loadAndPrefill(currentUid);
    goToStep(1);
    bodyEl.style.display = '';
    successEl.classList.remove('show');
    openOnboarding();
  },
};