import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, onAuthStateChanged,
  sendEmailVerification, signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const requiredFields = ["apiKey", "authDomain", "projectId", "appId"];
const configured = requiredFields.every((key) =>
  typeof firebaseConfig[key] === "string" &&
  firebaseConfig[key].length > 0 &&
  !firebaseConfig[key].includes("REPLACE_")
);
const auth = configured ? getAuth(initializeApp(firebaseConfig)) : null;
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
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow popups and try again.",
    "auth/account-exists-with-different-credential": "An account with this email uses a different sign-in method.",
    "auth/unauthorized-domain": "This website must be added to Firebase Authentication's authorized domains.",
    "auth/operation-not-allowed": "This login method must be enabled in Firebase Authentication.",
    "auth/network-request-failed": "Network error. Please check your internet connection."
  };
  return errors[err?.code] || "Something went wrong. Please try again.";
}
async function inProgress(task) {
  if (submitting) return;
  submitting = true;
  const controls = document.querySelectorAll("[data-requires-auth]");
  controls.forEach((control) => control.disabled = true);
  setStatus("");
  try { await task(); }
  catch (error) { setStatus(explainError(error), "error"); }
  finally {
    submitting = false;
    if (auth) controls.forEach((control) => control.disabled = false);
  }
}

if (!auth) {
  const note = document.getElementById("setup-notice");
  if (note) note.hidden = false;
  document.querySelectorAll("[data-requires-auth]").forEach((control) => control.disabled = true);
} else {
  onAuthStateChanged(auth, (user) => {
    if (page === "account") {
      if (!user) { window.location.replace("login.html"); return; }
      const displayName = user.displayName || "Member";
      document.getElementById("account-avatar").textContent = displayName.slice(0, 1).toUpperCase();
      document.getElementById("account-subtitle").textContent = user.emailVerified ? "Signed in successfully." : "Signed in successfully.";
      document.getElementById("account-name").textContent = displayName;
      document.getElementById("account-email").textContent = user.email || "No email supplied";
      document.getElementById("account-details").hidden = false;
      document.getElementById("verify-email").hidden = user.emailVerified || !user.email || user.providerData.some((provider) => provider.providerId === "google.com");
    } else if (user && !submitting) {
      window.location.replace("account.html");
    }
  }, () => setStatus("Couldn't check your account. Please refresh.", "error"));

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      inProgress(async () => {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        if (page === "signup") {
          const name = document.getElementById("name").value.trim();
          const confirm = document.getElementById("confirm-password").value;
          if (!name) { setStatus("Please enter your name.", "error"); return; }
          if (password.length < 8) { setStatus("Please use at least 8 characters for your password.", "error"); return; }
          if (password !== confirm) { setStatus("Passwords do not match.", "error"); return; }
          const result = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(result.user, { displayName: name });
          window.location.assign("account.html");
        } else {
          await signInWithEmailAndPassword(auth, email, password);
          window.location.assign("account.html");
        }
      });
    });
  }

  if (googleButton) {
    googleButton.addEventListener("click", () => inProgress(async () => {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      window.location.assign("account.html");
    }));
  }

  if (page === "account") {
    document.getElementById("signout").addEventListener("click", () => inProgress(async () => {
      await signOut(auth);
      window.location.replace("login.html");
    }));
    document.getElementById("verify-email").addEventListener("click", () => inProgress(async () => {
      if (!auth.currentUser) return;
      await sendEmailVerification(auth.currentUser);
      setStatus("Verification email sent. Check your inbox.", "success");
    }));
  }
}
