/* ════════════════════════════════════════════════════════════
   onboarding.patch.js
   ════════════════════════════════════════════════════════════
   DO NOT replace onboarding.js with this file.

   This file documents the EXACT, MINIMAL edits to make
   to your existing onboarding.js so that prediction.js
   is triggered automatically when onboarding completes.

   There are only TWO changes needed:
   ─────────────────────────────────────────────────────────
   CHANGE 1 — Inside handleSubmit(), after the success state
              is shown, dispatch the custom event.

   Find this block in your onboarding.js (around line 450):
   ─────────────────────────────────────────────────────────

   EXISTING CODE:
   ───────────────
   // Show success state
   if (bodyEl)    bodyEl.style.display  = 'none';
   if (successEl) successEl.classList.add('show');
   setProgress(100, 'Complete');

   // TODO (Step 5): route to dashboard if on landing page
   // window.location.href = '/dashboard.html';

   ───────────────
   REPLACE WITH:
   ───────────────
   // Show success state
   if (bodyEl)    bodyEl.style.display  = 'none';
   if (successEl) successEl.classList.add('show');
   setProgress(100, 'Complete');

   // ── NEW: Notify prediction.js that onboarding is done ──
   window.dispatchEvent(new CustomEvent('edubuddy:onboarding-complete', {
     detail: { uid: currentUid }
   }));

   ─────────────────────────────────────────────────────────
   CHANGE 2 — Success CTA button handler (around line 558):
   ─────────────────────────────────────────────────────────

   EXISTING CODE:
   ───────────────
   successCta?.addEventListener('click', () => {
     // TODO (Step 5): replace with real dashboard route
     alert('Dashboard coming soon — Step 5!');
     closeOnboarding();
   });

   ───────────────
   REPLACE WITH:
   ───────────────
   successCta?.addEventListener('click', () => {
     closeOnboarding();
     // Route to your dashboard page when it exists:
     // window.location.href = '/dashboard.html';
     //
     // For now, scroll to the result section on the landing page:
     const resultSection = document.getElementById('eb-result-section');
     if (resultSection) {
       resultSection.scrollIntoView({ behavior: 'smooth' });
     }
   });

   ═════════════════════════════════════════════════════════
   That's it. Two changes. No design changes. No rewrites.
   ═════════════════════════════════════════════════════════
*/
