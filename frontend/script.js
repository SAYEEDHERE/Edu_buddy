/* ════════════════════════════════════════════════════════
   EDUBUDDY v2 — script.js
   Firebase Authentication · Polished & Production-Ready
   ════════════════════════════════════════════════════════ */
 
'use strict';
 
// ╔════════════════════════════════════════════════════════╗
// ║              FIREBASE AUTHENTICATION                   ║
// ╚════════════════════════════════════════════════════════╝
 
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
 
const firebaseConfig = {
  apiKey: "AIzaSyB7-OoW7N2K43eX0iCUCwFl-qwnIMwUX_c",
  authDomain: "edubuddy-2c5a4.firebaseapp.com",
  projectId: "edubuddy-2c5a4",
  storageBucket: "edubuddy-2c5a4.firebasestorage.app",
  messagingSenderId: "304882114926",
  appId: "1:304882114926:web:53373e775cf8a09bc2e17f",
  measurementId: "G-39DMDVSQYZ"
};
 
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();
 
// ── Element refs ──────────────────────────────────────────
const authModal       = document.getElementById('auth-modal');
const authCloseBtn    = document.getElementById('auth-close');
const googleAuthBtn   = document.getElementById('google-auth-btn');
const emailInput      = document.getElementById('auth-email');
const passwordInput   = document.getElementById('auth-password');
const modalTitle      = document.getElementById('auth-modal-title');
const modalSub        = document.getElementById('auth-modal-sub');
const modalMainBtn    = document.getElementById('auth-main-btn');
const modalToggleText = document.getElementById('auth-toggle-text');
const modalToggleLink = document.getElementById('auth-toggle-link');
const modalForgotLink = document.getElementById('auth-forgot-link');
const authErrorEl     = document.getElementById('auth-error');
const authDividerSpan = document.querySelector('.auth-divider span');
const navGreeting     = document.getElementById('nav-user-greeting');
 
let isSignupMode = false;
let isLoading    = false;
 
// ── Button collections ────────────────────────────────────
const loginBtns = [
  document.getElementById('nav-login-btn'),
  document.getElementById('drawer-login-btn'),
  document.getElementById('cta-login-btn')
].filter(Boolean);
 
const signupBtns = [
  document.getElementById('hero-signup-btn'),
  document.getElementById('nav-signup-btn'),
  document.getElementById('drawer-signup-btn'),
  document.getElementById('cta-signup-btn')
].filter(Boolean);
 
// ── Feedback helpers ──────────────────────────────────────
function showAuthError(msg) {
  if (!authErrorEl) return;
  authErrorEl.classList.remove('auth-success');
  authErrorEl.textContent   = msg;
  authErrorEl.style.display = 'block';
}
 
function showAuthSuccess(msg) {
  if (!authErrorEl) return;
  authErrorEl.classList.add('auth-success');
  authErrorEl.textContent   = msg;
  authErrorEl.style.display = 'block';
}
 
function clearAuthError() {
  if (!authErrorEl) return;
  authErrorEl.textContent   = '';
  authErrorEl.style.display = 'none';
  authErrorEl.classList.remove('auth-success');
}
 
// ── Loading state — disables buttons and restores them ────
function setLoading(loading) {
  isLoading = loading;
  if (modalMainBtn)  modalMainBtn.disabled  = loading;
  if (googleAuthBtn) googleAuthBtn.disabled = loading;
  if (loading) {
    if (modalMainBtn) modalMainBtn.textContent = 'Please wait…';
  } else {
    updateModalText(); // Restores the correct button label
  }
}
 
// ── Firebase error code → user-friendly string ────────────
function firebaseErrorMsg(code) {
  const map = {
    'auth/email-already-in-use':    'An account already exists with this email.',
    'auth/invalid-credential':      'Incorrect email or password.',
    'auth/wrong-password':          'Incorrect email or password.',
    'auth/user-not-found':          'Incorrect email or password.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/too-many-requests':       'Too many attempts. Wait a moment and try again.',
    'auth/network-request-failed':  'Network error. Check your connection and try again.',
    'auth/popup-closed-by-user':     null, // Dismissed silently — no message needed
    'auth/cancelled-popup-request':  null,
  };
  return map[code] !== undefined ? map[code] : 'Something went wrong. Please try again.';
}
 
// ── Modal typography ──────────────────────────────────────
function updateModalText() {
  if (isSignupMode) {
    modalTitle.textContent      = 'Create an account';
    modalSub.textContent        = 'Sign up to start your personalized learning journey.';
    modalMainBtn.textContent    = 'SIGN UP';
    modalToggleText.textContent = 'Already have an account?';
    modalToggleLink.textContent = 'LOG IN';
    if (modalForgotLink)  modalForgotLink.style.display = 'none';
    if (authDividerSpan)  authDividerSpan.textContent   = 'OR SIGN UP WITH SOCIALS';
    if (passwordInput)    passwordInput.setAttribute('autocomplete', 'new-password');
  } else {
    modalTitle.textContent      = 'Welcome back';
    modalSub.textContent        = 'Log in to continue your learning journey.';
    modalMainBtn.textContent    = 'SIGN IN';
    modalToggleText.textContent = "Don't have an account?";
    modalToggleLink.textContent = 'SIGN UP';
    if (modalForgotLink)  modalForgotLink.style.display = 'block';
    if (authDividerSpan)  authDividerSpan.textContent   = 'OR SIGN IN WITH SOCIALS';
    if (passwordInput)    passwordInput.setAttribute('autocomplete', 'current-password');
  }
}
 
// ── Open / Close ──────────────────────────────────────────
function openAuthModal(signup = false) {
  isSignupMode = signup;
  updateModalText();
  clearAuthError();
  if (emailInput)    emailInput.value    = '';
  if (passwordInput) passwordInput.value = '';
  authModal.setAttribute('aria-hidden', 'false');
  authModal.classList.add('open');
  // Move focus into modal after CSS transition completes
  setTimeout(() => emailInput && emailInput.focus(), 300);
}
 
function closeAuthModal() {
  if (isLoading) return; // Never close while a request is in-flight
  authModal.classList.remove('open');
  authModal.setAttribute('aria-hidden', 'true');
  clearAuthError();
}
 
// ── Close triggers ─────────────────────────────────────────
if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
 
if (authModal) authModal.addEventListener('click', (e) => {
  if (e.target === authModal) closeAuthModal();
});
 
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && authModal && authModal.classList.contains('open')) {
    closeAuthModal();
  }
});
 
// ── Toggle login ↔ signup ──────────────────────────────────
if (modalToggleLink) {
  modalToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (isLoading) return;
    isSignupMode = !isSignupMode;
    updateModalText();
    clearAuthError();
  });
}
 
// ── Forgot password ────────────────────────────────────────
if (modalForgotLink) {
  modalForgotLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isLoading) return;
 
    const email = emailInput.value.trim();
    if (!email) {
      showAuthError('Enter your email address above first, then click Forgot Password.');
      emailInput.focus();
      return;
    }
 
    clearAuthError();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showAuthSuccess(`Reset link sent to ${email}. Check your inbox.`);
    } catch (err) {
      const msg = firebaseErrorMsg(err.code);
      if (msg) showAuthError(msg);
    } finally {
      setLoading(false);
    }
  });
}
 
// ── Email / password submit ────────────────────────────────
if (modalMainBtn) {
  modalMainBtn.addEventListener('click', async () => {
    if (isLoading) return;
 
    const email    = emailInput.value.trim();
    const password = passwordInput.value; // Never trim — passwords can have spaces
 
    if (!email || !password) {
      showAuthError('Please enter your email and password.');
      return;
    }
 
    clearAuthError();
    setLoading(true);
    try {
      if (isSignupMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // onAuthStateChanged fires on success and calls closeAuthModal()
    } catch (err) {
      const msg = firebaseErrorMsg(err.code);
      if (msg) showAuthError(msg);
    } finally {
      setLoading(false);
    }
  });
}
 
// ── Google sign-in ─────────────────────────────────────────
if (googleAuthBtn) {
  googleAuthBtn.addEventListener('click', async () => {
    if (isLoading) return;
    clearAuthError();
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged handles the rest
    } catch (err) {
      const msg = firebaseErrorMsg(err.code);
      if (msg) showAuthError(msg);
    } finally {
      setLoading(false);
    }
  });
}
 
// ── Nav / hero / CTA / drawer button clicks ───────────────
async function handlePageButtonClick(isSignupAction = false) {
  if (auth.currentUser) {
    if (isSignupAction) {
      window.location.href = 'dashboard.html';
    } else {
      try { await signOut(auth); } catch (e) { console.error('Sign out error:', e); }
    }
  } else {
    openAuthModal(isSignupAction);
  }
}
 
loginBtns.forEach(btn => btn.addEventListener('click', (e) => {
  e.preventDefault();
  handlePageButtonClick(false);
}));
 
signupBtns.forEach(btn => btn.addEventListener('click', (e) => {
  e.preventDefault();
  handlePageButtonClick(true);
}));
 
// ── Auth state listener ────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (user) {
    // ---- LOGGED IN ----
    closeAuthModal();
 
    let firstName = 'Student';
    if (user.displayName)  firstName = user.displayName.split(' ')[0];
    else if (user.email)   firstName = user.email.split('@')[0];
 
    if (navGreeting) {
      navGreeting.textContent   = `Hi, ${firstName}`;
      navGreeting.style.display = 'inline-block';
    }
 
    loginBtns[0]  && (loginBtns[0].textContent  = 'Sign Out');
    loginBtns[1]  && (loginBtns[1].textContent  = 'Sign Out');
    loginBtns[2]  && (loginBtns[2].textContent  = 'Already signed in? Sign Out →');
 
    signupBtns[0] && (signupBtns[0].textContent = 'Go to Dashboard');
    signupBtns[1] && (signupBtns[1].textContent = 'Go to Dashboard');
    signupBtns[2] && (signupBtns[2].textContent = 'Go to Dashboard →');
    signupBtns[3] && (signupBtns[3].textContent = 'Go to Dashboard');
 
  } else {
    // ---- LOGGED OUT ----
    if (navGreeting) {
      navGreeting.textContent   = '';
      navGreeting.style.display = 'none';
    }
 
    loginBtns[0]  && (loginBtns[0].textContent  = 'Log in');
    loginBtns[1]  && (loginBtns[1].textContent  = 'Log in');
    loginBtns[2]  && (loginBtns[2].textContent  = 'Already have an account? Log in →');
 
    signupBtns[0] && (signupBtns[0].textContent = 'Get started free');
    signupBtns[1] && (signupBtns[1].textContent = 'Get EduBuddy free');
    signupBtns[2] && (signupBtns[2].textContent = 'Get EduBuddy free →');
    signupBtns[3] && (signupBtns[3].textContent = 'Create your free account');
  }
});
 
 
// ╔════════════════════════════════════════════════════════╗
// ║              EXISTING UI / ANIMATION LOGIC             ║
// ╚════════════════════════════════════════════════════════╝
 
/* ── Mobile nav ──────────────────────────────────────── */
(function mobileNav() {
  const burger = document.getElementById('burger');
  const drawer = document.getElementById('nav-drawer');
  if (!burger || !drawer) return;
 
  burger.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
  });
 
  // Close on any link click
  drawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      drawer.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
    });
  });
 
  // Close on outside click
  document.addEventListener('click', e => {
    if (!burger.contains(e.target) && !drawer.contains(e.target)) {
      drawer.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });
})();
 
/* ── Scroll-triggered reveal ─────────────────────────── */
(function scrollReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;
 
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
 
      const el    = entry.target;
      const delay = parseInt(el.dataset.delay || '0', 10);
 
      setTimeout(() => {
        el.classList.add('revealed');
      }, delay);
 
      observer.unobserve(el);
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });
 
  items.forEach(el => observer.observe(el));
})();
 
/* ── Active nav link on scroll ───────────────────────── */
(function activeNav() {
  const sections = document.querySelectorAll('section[id], div[id]');
  const links    = document.querySelectorAll('.nav-links a[href^="#"]');
  if (!links.length) return;
 
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(l => l.classList.remove('active'));
      const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
      if (active) active.classList.add('active');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
 
  sections.forEach(s => observer.observe(s));
 
  // Inject active style once
  const style = document.createElement('style');
  style.textContent = `.nav-links a.active { color: var(--text-1) !important; font-weight: 500; }`;
  document.head.appendChild(style);
})();
 
/* ── Progress bar animation (product preview) ────────── */
(function animateProgressBars() {
  const bars = document.querySelectorAll('.prog-bar-fill');
  if (!bars.length) return;
 
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
 
      const bar     = entry.target;
      const finalW  = bar.style.width;
      bar.style.width = '0%';
 
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bar.style.width = finalW;
        });
      });
 
      observer.unobserve(bar);
    });
  }, { threshold: 0.5 });
 
  bars.forEach(b => observer.observe(b));
})();
 
/* ── Smooth scroll for internal links ────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    // 1. Force the browser to STOP jumping to the top immediately
    e.preventDefault(); 
    
    const hrefVal = a.getAttribute('href');
    
    // 2. Ignore empty placeholder links
    if (hrefVal === '#') return;
 
    // 3. Try to find the section and scroll smoothly
    const id = hrefVal.slice(1);
    const el = document.getElementById(id);
    
    if (el) {
      const navH = document.getElementById('header')?.offsetHeight || 64;
      const top  = el.getBoundingClientRect().top + window.scrollY - navH - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    } else {
      // If the section hasn't been built yet, show a polite alert instead of breaking
      alert("This page is currently under construction. Check back soon!");
    }
  });
});
 
/* ── Subtle shadow reveal on preview wrap ────────────── */
(function previewReveal() {
  const wrap = document.getElementById('preview-wrap');
  if (!wrap) return;
 
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
 
    wrap.style.opacity    = '0';
    wrap.style.transform  = 'translateY(20px)';
    wrap.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
 
    setTimeout(() => {
      wrap.style.opacity   = '1';
      wrap.style.transform = 'translateY(0)';
    }, 200);
 
    observer.unobserve(wrap);
  }, { threshold: 0.1 });
 
  observer.observe(wrap);
})();
 
/* ── Hero text stagger on load ───────────────────────── */
(function heroEntrance() {
  const elements = [
    '.hero-label',
    '.hero-heading',
    '.hero-body',
    '.hero-actions',
    '.hero-footnote',
  ];
 
  elements.forEach((selector, i) => {
    const el = document.querySelector(selector);
    if (!el) return;
 
    el.style.opacity   = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = `opacity 0.6s ease ${i * 0.08 + 0.05}s, transform 0.6s ease ${i * 0.08 + 0.05}s`;
 
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity   = '1';
        el.style.transform = 'translateY(0)';
      });
    });
  });
})();

































