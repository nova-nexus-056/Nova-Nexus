/* =========================================================
   Nova Nexus — app.js
   Vanilla JS + Firebase v10 (Compat SDK)
   ========================================================= */

/* ---------- 1. Firebase configuration ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyC62KAm0R2qfPUVrI1VWnod119Tf2Y2HDc",
  authDomain: "nexus-nova-056.firebaseapp.com",
  projectId: "nexus-nova-056",
  storageBucket: "nexus-nova-056.firebasestorage.app",
  messagingSenderId: "506833053263",
  appId: "1:506833053263:web:5435ddf025c4e685546c3a"
};
const looksLikeRealApiKey = /^AIza[\w-]{30,}$/.test(firebaseConfig.apiKey);
if (!looksLikeRealApiKey) {
  console.warn("[Nova Nexus] firebaseConfig.apiKey doesn't look like a real Firebase API key yet.");
}

firebase.initializeApp(firebaseConfig);

/* ---------- 2. App Check ---------- */
const RECAPTCHA_ENTERPRISE_SITE_KEY = "6LcpHL0tAAAAAAwG1tnBe7rvfhfspN0GnrpQIFEd";
try {
  const appCheck = firebase.appCheck();
  appCheck.activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY), true);
} catch (error) {
  console.warn("[Nova Nexus] App Check did not activate — check your reCAPTCHA Enterprise site key.", error);
}

const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();
// Force account picker every time — otherwise Google silently reuses the last account.
googleProvider.setCustomParameters({ prompt: "select_account" });

/* ---------- 3. Frontend deterrents (best-effort only, not security) ---------- */
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  const key = e.key.toUpperCase();
  const blocked =
    key === "F12" ||
    (e.ctrlKey && e.shiftKey && (key === "I" || key === "J" || key === "C")) ||
    (e.ctrlKey && key === "U");
  if (blocked) e.preventDefault();
});

/* ---------- 4. DOM references ---------- */
const $ = (id) => document.getElementById(id);

const appLoader = $("appLoader");
const authView = $("authView");
const dashboardView = $("dashboardView");
const toastContainer = $("toastContainer");

const authSwitcherGroup = $("authSwitcherGroup");
const legalNote = $("legalNote");
const keepSignedIn = $("keepSignedIn");
const googleSignInBtn = $("googleSignInBtn");
const tabSwitcher = $("tabSwitcher");

const loginPanel = $("loginPanel");
const signupPanel = $("signupPanel");
const resetPanel = $("resetPanel");
const verifyPanel = $("verifyPanel");

const loginForm = $("loginPanel");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");
const loginSubmit = $("loginSubmit");

const resetForm = $("resetPanel");
const resetEmail = $("resetEmail");
const resetSubmit = $("resetSubmit");

const signupForm = $("signupPanel");
const signupUsername = $("signupUsername");
const signupEmail = $("signupEmail");
const signupPassword = $("signupPassword");
const signupConfirm = $("signupConfirm");
const signupSubmit = $("signupSubmit");
const strengthMeter = $("strengthMeter");

const verifyEmailDisplay = $("verifyEmailDisplay");
const continueVerifiedBtn = $("continueVerifiedBtn");
const resendVerificationBtn = $("resendVerificationBtn");
const verifySignOutBtn = $("verifySignOutBtn");

const chipUsername = $("chipUsername");
const chipEmail = $("chipEmail");
const userAvatar = $("userAvatar");
const heroUsername = $("heroUsername");
const logoutBtn = $("logoutBtn");

const profileUsername = $("profileUsername");
const profileEmail = $("profileEmail");
const updateProfileBtn = $("updateProfileBtn");

const securityPasswordForm = $("securityPasswordForm");
const securityGoogleNote = $("securityGoogleNote");
const currentPasswordInput = $("currentPassword");
const newPasswordInput = $("newPassword");
const confirmNewPasswordInput = $("confirmNewPassword");
const changePasswordBtn = $("changePasswordBtn");

const launchSideBtn = $("launchSideBtn");

const openDeleteModalBtn = $("openDeleteModalBtn");
const deleteAccountModal = $("deleteAccountModal");
const deletePhrase = $("deletePhrase");
const deletePasswordSection = $("deletePasswordSection");
const deletePassword = $("deletePassword");
const deleteGoogleReauthBtn = $("deleteGoogleReauthBtn");
const confirmDeleteBtn = $("confirmDeleteBtn");

const privacyModal = $("privacyModal");
const termsModal = $("termsModal");

const DELETE_PHRASE = "DELETE MY NOVA NEXUS ACCOUNT";

/* ---------- 5. State ---------- */
let currentUser = null;
let googleReauthConfirmed = false;

function isGoogleUser(user) {
  return !!user && user.providerData.some((p) => p.providerId === "google.com");
}

/* ---------- 6. Session persistence ---------- */
async function applyPersistence() {
  const mode = keepSignedIn.checked
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;
  try {
    await auth.setPersistence(mode);
  } catch (error) {
    console.warn("Could not set auth persistence, continuing with default:", error);
  }
}

/* ---------- 7. Toasts ---------- */
const TOAST_ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/><circle cx="12" cy="12" r="10"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = "info", duration = 4500) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button type="button" class="toast-close" aria-label="Dismiss">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <span class="toast-progress" style="animation-duration:${duration}ms"></span>
  `;
  toastContainer.appendChild(toast);

  const dismiss = () => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };
  const timer = setTimeout(dismiss, duration);
  toast.querySelector(".toast-close").addEventListener("click", () => {
    clearTimeout(timer);
    dismiss();
  });

  return toast;
}

/* ---------- 8. View switching ---------- */
function showView(el) {
  [authView, dashboardView].forEach((v) => {
    v.hidden = true;
    v.classList.remove("view-animate-in");
  });
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add("view-animate-in");
}

function hideLoader() {
  appLoader.classList.add("is-hidden");
}

/* ---------- 9. Auth panel switching ---------- */
function activatePanel(panel) {
  [loginPanel, signupPanel, resetPanel, verifyPanel].forEach((p) => p.classList.remove("active"));
  panel.classList.add("active");
  const isGate = panel === verifyPanel;
  authSwitcherGroup.hidden = isGate;
  legalNote.hidden = isGate;
}

function switchTab(tab) {
  tabSwitcher.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  tabSwitcher.classList.toggle("tab-signup", tab === "signup");
  activatePanel(tab === "signup" ? signupPanel : loginPanel);
}

tabSwitcher.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (btn) switchTab(btn.dataset.tab);
});

$("forgotPasswordBtn").addEventListener("click", () => activatePanel(resetPanel));
$("backToLoginBtn").addEventListener("click", () => activatePanel(loginPanel));

/* ---------- 10. Password visibility toggle ---------- */
const EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.62 21.62 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.61 3.85M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

document.querySelectorAll("[data-toggle-pass]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = $(btn.dataset.togglePass);
    const willShow = input.type === "password";
    input.type = willShow ? "text" : "password";
    btn.innerHTML = willShow ? EYE_OFF : EYE_OPEN;
    btn.setAttribute("aria-label", willShow ? "Hide password" : "Show password");
  });
});

/* ---------- 11. Password strength meter ---------- */
signupPassword.addEventListener("input", () => {
  const val = signupPassword.value;
  if (!val) { strengthMeter.removeAttribute("data-level"); return; }
  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[a-z]/.test(val) && /[A-Z]/.test(val)) score++;
  if (/\d/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  strengthMeter.setAttribute("data-level", score <= 2 ? "weak" : score <= 3 ? "medium" : "strong");
});

/* ---------- 12. Validation helpers ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

function passwordRuleError(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  return null;
}

function setFieldError(input, hasError) {
  const field = input.closest(".field");
  if (field) field.classList.toggle("field-error", hasError);
}

[loginEmail, signupEmail, resetEmail].forEach((input) => {
  input.addEventListener("blur", () => setFieldError(input, input.value.trim() !== "" && !EMAIL_RE.test(input.value.trim())));
  input.addEventListener("input", () => setFieldError(input, false));
});
signupUsername.addEventListener("blur", () => setFieldError(signupUsername, signupUsername.value.trim() !== "" && !USERNAME_RE.test(signupUsername.value.trim())));
signupUsername.addEventListener("input", () => setFieldError(signupUsername, false));

function friendlyAuthError(error) {
  const map = {
    "auth/email-already-in-use": "That email is already registered. Try signing in instead.",
    "auth/invalid-email": "That email address isn't valid.",
    "auth/weak-password": "That password doesn't meet the site's password policy.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid credentials.",
    "auth/invalid-login-credentials": "Invalid credentials.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/requires-recent-login": "Sign out and back in, then try again.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups for this site and try again.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/cancelled-popup-request": "Sign-in was cancelled.",
    "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
    "auth/operation-not-allowed": "Google sign-in isn't enabled for this project yet. Enable it in Firebase Console → Authentication → Sign-in method → Google.",
    "auth/unauthorized-domain": "This domain isn't authorized in Firebase Console → Authentication → Settings → Authorized domains.",
    "auth/internal-error": "Sign-in failed due to a temporary issue. Try again in a moment.",
    "auth/web-storage-unsupported": "Your browser is blocking cookies or storage. Allow them for this site and reload.",
    "auth/firebase-app-check-token-is-invalid": "Security verification failed. Reload the page and try again."
  };
  return map[error?.code] || error?.message || "Something went wrong. Try again.";
}

const ENUMERATION_SENSITIVE_CODES = [
  "auth/user-not-found",
  "auth/wrong-password",
  "auth/invalid-credential",
  "auth/invalid-login-credentials",
  "auth/user-disabled"
];
function loginErrorMessage(error) {
  if (ENUMERATION_SENSITIVE_CODES.includes(error?.code)) {
    return "Invalid credentials.";
  }
  return friendlyAuthError(error);
}

function setLoading(button, isLoading) {
  button.classList.toggle("is-loading", isLoading);
  button.disabled = isLoading;
}

/* ---------- 13. Global auth-state listener ---------- */
auth.onAuthStateChanged(async (user) => {
  try {
    if (!user) {
      currentUser = null;
      activatePanel(loginPanel);
      showView(authView);
      return;
    }

    await user.reload();
    const fresh = auth.currentUser;

    if (!fresh || !fresh.emailVerified) {
      verifyEmailDisplay.textContent = fresh?.email || "";
      activatePanel(verifyPanel);
      showView(authView);
      return;
    }

    await fresh.getIdToken(true);

    currentUser = fresh;
    await loadDashboard(fresh);
    showView(dashboardView);
  } catch (error) {
    console.error("Auth state handling error:", error);
    activatePanel(loginPanel);
    showView(authView);
  } finally {
    hideLoader();
  }
});

/* ---------- 14. Sign up ---------- */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = signupUsername.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const confirm = signupConfirm.value;

  if (!USERNAME_RE.test(username)) return showToast("Username must be 3–24 characters (letters, numbers, underscore).", "error");
  if (!EMAIL_RE.test(email)) return showToast("Enter a valid email address.", "error");
  const pwError = passwordRuleError(password);
  if (pwError) return showToast(pwError, "error");
  if (password !== confirm) return showToast("Passwords don't match.", "error");

  setLoading(signupSubmit, true);
  try {
    await applyPersistence();
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const user = cred.user;

    await user.sendEmailVerification();

    await db.collection("users").doc(user.uid).set({
      username,
      email,
      provider: "password",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    signupForm.reset();
    strengthMeter.removeAttribute("data-level");
    showToast("Account created — verify your email to continue.", "success");
  } catch (error) {
    console.error("Signup error:", error);
    if (auth.currentUser) { try { await auth.currentUser.delete(); } catch (_) { /* best effort */ } }
    showToast(friendlyAuthError(error), "error");
  } finally {
    setLoading(signupSubmit, false);
  }
});

/* ---------- 15. Sign in ---------- */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!EMAIL_RE.test(email) || !password) return showToast("Invalid credentials.", "error");

  setLoading(loginSubmit, true);
  try {
    await applyPersistence();
    await auth.signInWithEmailAndPassword(email, password);
    loginForm.reset();
  } catch (error) {
    console.error("Login error:", error);
    showToast(loginErrorMessage(error), "error");
  } finally {
    setLoading(loginSubmit, false);
  }
});

/* ---------- 16. Google sign-in ----------
   Two important fixes vs. the previous version:
   1. `prompt: "select_account"` (set on the provider above) forces Google
      to show the account chooser every time — without this, Google
      silently reuses the last signed-in account on the device, which
      looks like "nothing happened" if the user wanted a different one.
   2. If the popup is blocked by the browser, we surface a clear,
      actionable error instead of letting the button quietly fail.
   The actual reason the button "did nothing" in production was the CSP
   (see index.html), which blocked the scripts/frames Google's popup
   needs — that's now fixed there. */
googleSignInBtn.addEventListener("click", async () => {
  setLoading(googleSignInBtn, true);
  try {
    await applyPersistence();
    const result = await auth.signInWithPopup(googleProvider);
    const user = result.user;

    const docRef = db.collection("users").doc(user.uid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      await docRef.set({
        username: deriveGoogleUsername(user),
        email: user.email,
        provider: "google",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    const silent = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];
    if (!silent.includes(error.code)) {
      console.error("Google sign-in error:", error);
      showToast(friendlyAuthError(error), "error", 7000);
    }
  } finally {
    setLoading(googleSignInBtn, false);
  }
});

// Complete a pending redirect sign-in on page load, if any. This is a
// no-op when signInWithPopup was used; it only matters if the browser
// fell back to redirect (or if the user did).
auth.getRedirectResult().catch((error) => {
  const silent = ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/no-auth-event"];
  if (!silent.includes(error.code)) {
    console.error("Redirect sign-in error:", error);
    showToast(friendlyAuthError(error), "error", 7000);
  }
});

function deriveGoogleUsername(user) {
  const raw = (user.displayName || "").trim() || user.email.split("@")[0];
  let sanitized = raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24);
  if (sanitized.length < 3) {
    sanitized = ("user" + user.uid.replace(/[^a-zA-Z0-9_]/g, "")).slice(0, 24);
  }
  return sanitized;
}

/* ---------- 17. Forgot password ---------- */
const RESET_SENT_MESSAGE = "If an account exists for that email, we've sent instructions.";

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = resetEmail.value.trim();
  if (!EMAIL_RE.test(email)) return showToast("Enter a valid email address.", "error");

  setLoading(resetSubmit, true);
  try {
    await auth.sendPasswordResetEmail(email);
    showToast(RESET_SENT_MESSAGE, "success", 6000);
    resetForm.reset();
    activatePanel(loginPanel);
  } catch (error) {
    if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential") {
      showToast(RESET_SENT_MESSAGE, "success", 6000);
      resetForm.reset();
      activatePanel(loginPanel);
    } else {
      console.error("Reset error:", error);
      showToast(friendlyAuthError(error), "error");
    }
  } finally {
    setLoading(resetSubmit, false);
  }
});

/* ---------- 18. Verify-email gate actions ---------- */
continueVerifiedBtn.addEventListener("click", async () => {
  if (!auth.currentUser) return;
  setLoading(continueVerifiedBtn, true);
  try {
    await auth.currentUser.reload();
    if (!auth.currentUser.emailVerified) {
      showToast("Still not verified — check your inbox for the link, or resend it below.", "error");
      return;
    }
    await auth.currentUser.getIdToken(true);
    currentUser = auth.currentUser;
    await loadDashboard(currentUser);
    showView(dashboardView);
  } catch (error) {
    console.error("Verification recheck error:", error);
    showToast(friendlyAuthError(error), "error");
  } finally {
    setLoading(continueVerifiedBtn, false);
  }
});

resendVerificationBtn.addEventListener("click", async () => {
  if (!auth.currentUser) return;
  setLoading(resendVerificationBtn, true);
  try {
    await auth.currentUser.sendEmailVerification();
    showToast("Verification email sent. Check your inbox and spam folder.", "success", 6000);
  } catch (error) {
    console.error("Resend verification error:", error);
    showToast(friendlyAuthError(error), "error");
  } finally {
    setLoading(resendVerificationBtn, false);
  }
});

verifySignOutBtn.addEventListener("click", async () => {
  try { await auth.signOut(); } catch (error) { console.error("Sign-out error:", error); }
});

/* ---------- 19. Dashboard data ---------- */
async function loadDashboard(user) {
  renderSecurityCardForProvider(user);
  try {
    const doc = await db.collection("users").doc(user.uid).get();
    const data = doc.exists ? doc.data() : {};
    renderProfile(data.username || "User", user.email);
  } catch (error) {
    console.error("Failed to load profile:", error);
    renderProfile("User", user.email);
    showToast("Couldn't load your full profile — some details may be out of date.", "error");
  }
}

function renderProfile(username, email) {
  chipUsername.textContent = username;
  chipEmail.textContent = email;
  heroUsername.textContent = username;
  userAvatar.textContent = username.charAt(0).toUpperCase();
  profileUsername.value = username;
  profileEmail.value = email;
}

function renderSecurityCardForProvider(user) {
  const hasPasswordAccount = !isGoogleUser(user);
  securityPasswordForm.hidden = !hasPasswordAccount;
  securityGoogleNote.hidden = hasPasswordAccount;
}

/* ---------- 20. Logout ---------- */
logoutBtn.addEventListener("click", async () => {
  try {
    await auth.signOut();
    showToast("Signed out.", "success");
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Something went wrong while signing out.", "error");
  }
});

/* ---------- 21. Profile: update username ---------- */
updateProfileBtn.addEventListener("click", async () => {
  const newUsername = profileUsername.value.trim();
  if (!USERNAME_RE.test(newUsername)) return showToast("Username must be 3–24 characters (letters, numbers, underscore).", "error");
  if (!currentUser) return;

  setLoading(updateProfileBtn, true);
  try {
    await db.collection("users").doc(currentUser.uid).update({ username: newUsername });
    chipUsername.textContent = newUsername;
    heroUsername.textContent = newUsername;
    userAvatar.textContent = newUsername.charAt(0).toUpperCase();
    showToast("Changes saved.", "success");
  } catch (error) {
    console.error("Profile update error:", error);
    showToast("Couldn't update your username. Try again.", "error");
  } finally {
    setLoading(updateProfileBtn, false);
  }
});

/* ---------- 22. Change password ---------- */
changePasswordBtn.addEventListener("click", async () => {
  const currentPass = currentPasswordInput.value;
  const newPass = newPasswordInput.value;
  const confirmPass = confirmNewPasswordInput.value;

  if (!currentPass || !newPass) return showToast("Fill in both password fields.", "error");
  const pwError = passwordRuleError(newPass);
  if (pwError) return showToast(pwError, "error");
  if (newPass !== confirmPass) return showToast("New passwords don't match.", "error");
  if (!currentUser) return;

  setLoading(changePasswordBtn, true);
  try {
    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPass);
    await currentUser.reauthenticateWithCredential(credential);
    await currentUser.updatePassword(newPass);

    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmNewPasswordInput.value = "";
    showToast("Password updated.", "success");
  } catch (error) {
    console.error("Password change error:", error);
    showToast(friendlyAuthError(error), "error");
  } finally {
    setLoading(changePasswordBtn, false);
  }
});

/* ---------- 23. Hardened account deletion ---------- */
function updateDeleteButtonState() {
  const phraseOk = deletePhrase.value === DELETE_PHRASE;
  const credentialOk = isGoogleUser(currentUser) ? googleReauthConfirmed : deletePassword.value.length > 0;
  confirmDeleteBtn.disabled = !(phraseOk && credentialOk);
}
deletePhrase.addEventListener("input", updateDeleteButtonState);
deletePassword.addEventListener("input", updateDeleteButtonState);

function openDeleteAccountModal() {
  deletePhrase.value = "";
  deletePassword.value = "";
  googleReauthConfirmed = false;

  const googleOnly = isGoogleUser(currentUser);
  deletePasswordSection.hidden = googleOnly;
  deleteGoogleReauthBtn.hidden = !googleOnly;
  deleteGoogleReauthBtn.disabled = false;
  deleteGoogleReauthBtn.querySelector(".btn-label").textContent = "Re-authenticate with Google";

  updateDeleteButtonState();
  openModal(deleteAccountModal);
}
openDeleteModalBtn.addEventListener("click", openDeleteAccountModal);

deleteGoogleReauthBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  setLoading(deleteGoogleReauthBtn, true);
  try {
    await currentUser.reauthenticateWithPopup(googleProvider);
    googleReauthConfirmed = true;
    deleteGoogleReauthBtn.querySelector(".btn-label").textContent = "Re-authenticated ✓";
    deleteGoogleReauthBtn.disabled = true;
    updateDeleteButtonState();
  } catch (error) {
    console.error("Re-authentication error:", error);
    showToast(friendlyAuthError(error), "error");
  } finally {
    setLoading(deleteGoogleReauthBtn, false);
  }
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (deletePhrase.value !== DELETE_PHRASE || !currentUser) return;

  try {
    await currentUser.reload();
  } catch (error) {
    console.error("Session recheck failed:", error);
  }
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    showToast("Your session isn't verified. Sign in again before deleting your account.", "error");
    closeModal(deleteAccountModal);
    return;
  }

  setLoading(confirmDeleteBtn, true);
  try {
    if (!isGoogleUser(currentUser)) {
      const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, deletePassword.value);
      await currentUser.reauthenticateWithCredential(credential);
    }

    await db.collection("users").doc(currentUser.uid).delete();

    try {
      await currentUser.delete();
    } catch (authDeleteError) {
      console.error("Auth record deletion failed after Firestore cleanup:", authDeleteError);
      showToast("Your profile data was removed, but the account itself needs one more step — sign out and back in, then delete again.", "error", 7000);
      closeModal(deleteAccountModal);
      return;
    }

    closeModal(deleteAccountModal);
    showToast("Your account has been permanently deleted.", "success");
  } catch (error) {
    console.error("Account deletion error:", error);
    showToast(friendlyAuthError(error), "error");
  } finally {
    setLoading(confirmDeleteBtn, false);
  }
});

/* ---------- 24. SSO / ecosystem token handoff (postMessage) ---------- */
const ALLOWED_SIDE_ORIGINS = [
  "https://uvcrm.vercel.app"
  // Add one entry per registered Side Website — exact origin only.
];
const SIDE_WEBSITE_URL = ALLOWED_SIDE_ORIGINS[0];
const AUTH_REQUEST_TYPE = "NOVA_NEXUS_AUTH_REQUEST";
const AUTH_RESPONSE_TYPE = "NOVA_NEXUS_AUTH_RESPONSE";

launchSideBtn.addEventListener("click", () => {
  if (!currentUser) return;
  const opened = window.open(SIDE_WEBSITE_URL, "_blank");
  if (!opened) {
    showToast("Your browser blocked the new tab. Allow pop-ups for this site and try again.", "error");
  }
});

window.addEventListener("message", async (event) => {
  if (!ALLOWED_SIDE_ORIGINS.includes(event.origin)) return;
  if (event.data?.type !== AUTH_REQUEST_TYPE) return;
  if (!event.source) return;

  if (!currentUser) {
    event.source.postMessage({ type: AUTH_RESPONSE_TYPE, token: null, error: "not_authenticated" }, event.origin);
    return;
  }

  try {
    const token = await currentUser.getIdToken();
    event.source.postMessage({
      type: AUTH_RESPONSE_TYPE,
      token,
      uid: currentUser.uid,
      email: currentUser.email
    }, event.origin);
  } catch (error) {
    console.error("Token generation error:", error);
    event.source.postMessage({ type: AUTH_RESPONSE_TYPE, token: null, error: "token_error" }, event.origin);
  }
});

/* ---------- 25. Modals ---------- */
function openModal(modal) {
  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
}
function closeModal(modal) {
  modal.classList.remove("is-open");
  document.body.style.overflow = "";
}

document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal($(btn.dataset.closeModal)));
});
[privacyModal, termsModal, deleteAccountModal].forEach((modal) => {
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(modal); });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(privacyModal); closeModal(termsModal); closeModal(deleteAccountModal); }
});
["openPrivacy", "openPrivacyDash"].forEach((id) => $(id)?.addEventListener("click", () => openModal(privacyModal)));
["openTerms", "openTermsDash"].forEach((id) => $(id)?.addEventListener("click", () => openModal(termsModal)));
