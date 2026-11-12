// Authentication is only for login/signup. Dashboard is the account landing page.
// Avatar editing lives in profile.js, security and sign-out live in settings.js.
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ensureUserProfile } from "./database.js";

const configured = ["apiKey", "authDomain", "projectId", "appId"].every(key =>
  typeof firebaseConfig[key] === "string" &&
  firebaseConfig[key].trim().length > 0 &&
  !firebaseConfig[key].includes("REPLACE_")
);
const app = configured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const page = document.body.dataset.page;
const status = document.getElementById("auth-status");
const form = document.getElementById("auth-form");
const googleButton = document.getElementById("google-signin");
let submitting = false;

function setStatus(message, type = "") {
  if (!status) return;
  status.hidden = !message;
  status.textContent = message;
  status.className = "form-status" + (type ? " " + type : "");
}
function explainError(err) {
  const errors = {
    "auth/email-already-in-use": "This email is already registered. Try logging in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "Incorrect email or password.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/weak-password": "Choose a stronger password.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked Google sign-in. Allow popups and try again.",
    "auth/account-exists-with-different-credential": "This email uses another sign-in method.",
    "auth/unauthorized-domain": "Add this website to Firebase Authentication's authorized domains.",
    "auth/operation-not-allowed": "Enable the sign-in method in Firebase Authentication.",
    "auth/network-request-failed": "Network error. Please check your connection.",
    "permission-denied": "Database access denied. Publish the firestore.rules file in Firebase Console.",
    "unavailable": "The profile database is temporarily unavailable.",
    "profile/missing-identity": "An email address is required to create a user profile."
  };
  return errors[err?.code] || "Something went wrong. Please try again.";
}
async function inProgress(task) {
  if (submitting) return;
  submitting = true;
  const controls = document.querySelectorAll("[data-requires-auth]");
  controls.forEach(control => { control.disabled = true; });
  setStatus("");
  try { await task(); }
  catch (error) { console.warn("Sign-in failed:", error); setStatus(explainError(error), "error"); }
  finally {
    submitting = false;
    if (auth) controls.forEach(control => { control.disabled = false; });
  }
}
async function finishSignIn(user) {
  try { await ensureUserProfile(db, user); }
  catch (error) { console.warn("Signed in; profile Firestore isn't ready:", error); }
  window.location.assign("dashboard.html");
}
if (!auth) {
  const notice = document.getElementById("setup-notice");
  if (notice) notice.hidden = false;
  document.querySelectorAll("[data-requires-auth]").forEach(control => { control.disabled = true; });
} else {
  onAuthStateChanged(auth, user => {
    if (user && !submitting) window.location.replace("dashboard.html");
  }, () => setStatus("Couldn't check your account. Please refresh.", "error"));

  if (form) form.addEventListener("submit", event => {
    event.preventDefault();
    inProgress(async () => {
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      if (page === "signup") {
        const name = document.getElementById("name").value.trim();
        const confirmation = document.getElementById("confirm-password").value;
        if (!name) { setStatus("Please enter your name.", "error"); return; }
        if (password.length < 8) { setStatus("Please use at least 8 characters for your password.", "error"); return; }
        if (password !== confirmation) { setStatus("Passwords do not match.", "error"); return; }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        await finishSignIn(result.user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await finishSignIn(result.user);
      }
    });
  });
  if (googleButton) googleButton.addEventListener("click", () => inProgress(async () => {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await finishSignIn(result.user);
  }));
}
