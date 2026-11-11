import { recordActivity, firebaseClient } from "./community-data.js";
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  EmailAuthProvider, getAuth, onAuthStateChanged,
  reauthenticateWithCredential, reload, sendEmailVerification,
  sendPasswordResetEmail, signOut, updatePassword
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ensureUserProfile } from "./database.js";

const $ = (id) => document.getElementById(id);
let auth = null;
let signedInUser = null;
let privateProfile = null;
let busy = false;

function feedback(id, message, kind = "") {
  const element = $(id);
  element.textContent = message;
  element.className = "settings-feedback" + (kind ? " " + kind : "");
}

function errorText(error) {
  const messages = {
    "auth/invalid-credential": "The current password is incorrect. Try again.",
    "auth/wrong-password": "The current password is incorrect. Try again.",
    "auth/weak-password": "Choose a stronger new password.",
    "auth/requires-recent-login": "For security, sign out and sign in again before retrying.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/operation-not-allowed": "This operation hasn't been enabled in Firebase.",
    "auth/user-token-expired": "Your session has expired. Sign in again.",
    "permission-denied": "Firestore access was denied. Check the published security rules.",
    "unavailable": "Firebase is temporarily unavailable."
  };
  return messages[error?.code] || error?.message || "Something went wrong. Please try again.";
}

async function guarded(action, feedbackId = "security-feedback") {
  if (busy || !signedInUser) return;
  busy = true;
  const buttons = ["change-password", "send-reset", "send-verification", "settings-signout", "download-profile"]
    .map($).filter(Boolean);
  buttons.forEach((button) => { button.disabled = true; });
  feedback(feedbackId, "");
  try { await action(); }
  catch (error) {
    console.error("Settings operation failed:", error);
    feedback(feedbackId, errorText(error), "error");
  } finally {
    busy = false;
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function setTheme(theme) {
  const switchInput = $("theme-toggle");
  switchInput.checked = theme === "dark";
  // theme.js handles the cookie and applies the same preference to every page.
  switchInput.dispatchEvent(new Event("change", { bubbles: true }));
  updateThemeChoices();
  if (signedInUser) {
    const client = firebaseClient();
    recordActivity(client.db, signedInUser.uid, "theme_changed", "Changed appearance to " + theme);
  }
}

function updateThemeChoices() {
  const dark = document.documentElement.dataset.theme === "dark";
  $("choose-light").setAttribute("aria-pressed", String(!dark));
  $("choose-dark").setAttribute("aria-pressed", String(dark));
}

$("choose-light").addEventListener("click", () => setTheme("light"));
$("choose-dark").addEventListener("click", () => setTheme("dark"));
$("theme-toggle").addEventListener("change", updateThemeChoices);
updateThemeChoices();

function updateVerification(user) {
  const verified = user.emailVerified === true;
  $("verification-status").textContent = verified ? "Verified" : "Unverified";
  $("verification-status").className = "settings-status " + (verified ? "good" : "warning");
  $("verification-description").textContent = verified
    ? "Your email address is verified."
    : "Verify your email to help protect your account.";
  $("send-verification").hidden = verified || !user.email;
}

function showAccount(user) {
  $("settings-email").textContent = user.email || "No email available";
  const providers = user.providerData.map((item) => item.providerId);
  const hasPassword = providers.includes("password");
  const hasGoogle = providers.includes("google.com");
  $("settings-provider").textContent = hasGoogle && hasPassword
    ? "Google and Email/Password"
    : hasGoogle ? "Google"
    : hasPassword ? "Email / Password"
    : providers.length ? providers.join(", ") : "Account provider unavailable";
  const createdAt = user.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;
  $("settings-created").textContent = createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "Unavailable";
  $("password-section").hidden = !hasPassword;
  $("provider-only-section").hidden = hasPassword;
  updateVerification(user);
}

async function showPrivateProfile(user, db) {
  const description = $("visibility-description");
  const status = $("visibility-status");
  try {
    privateProfile = await ensureUserProfile(db, user);
    if (auth.currentUser?.uid !== user.uid) return;
    const isPublic = privateProfile?.isPublic === true;
    status.textContent = isPublic ? "Public" : "Private";
    status.className = "settings-status " + (isPublic ? "good" : "private");
    description.textContent = isPublic
      ? "Your chosen profile information can be viewed through your public link."
      : "Only you can view your profile details right now.";
  } catch (error) {
    console.warn("Could not load profile settings:", error);
    status.textContent = "Unavailable";
    status.className = "settings-status warning";
    description.textContent = "Could not read your Firestore profile. Check the profile editor and database rules.";
  }
}

$("send-verification").addEventListener("click", () => guarded(async () => {
  if (!signedInUser?.email || signedInUser.emailVerified) return;
  await sendEmailVerification(signedInUser);
  feedback("security-feedback", "Verification email sent. Check your inbox and open the link.", "success");
}));

$("send-reset").addEventListener("click", () => guarded(async () => {
  if (!signedInUser?.email) throw new Error("Your account does not have an email address.");
  await sendPasswordResetEmail(auth, signedInUser.email);
  feedback("security-feedback", "Password reset email requested. Check your inbox.", "success");
}));

$("password-form").addEventListener("submit", (event) => {
  event.preventDefault();
  guarded(async () => {
    const oldPassword = $("current-password").value;
    const newPassword = $("new-password").value;
    const confirm = $("confirm-password").value;
    if (newPassword.length < 8) throw new Error("Your new password must be at least 8 characters.");
    if (newPassword !== confirm) throw new Error("The new passwords don't match.");
    if (oldPassword === newPassword) throw new Error("Choose a different password.");
    const credential = EmailAuthProvider.credential(signedInUser.email, oldPassword);
    await reauthenticateWithCredential(signedInUser, credential);
    await updatePassword(signedInUser, newPassword);
    $("password-form").reset();
    feedback("security-feedback", "Password updated successfully.", "success");
    recordActivity(firebaseClient().db, signedInUser.uid, "password_changed", "Updated website account password");
  });
});

$("download-profile").addEventListener("click", () => guarded(async () => {
  if (!privateProfile) throw new Error("Your Firestore profile isn't available to export yet.");
  const profile = { ...privateProfile };
  for (const key of ["createdAt", "updatedAt"]) {
    const date = profile[key]?.toDate?.();
    if (date) profile[key] = date.toISOString();
  }
  const data = {
    exportedAt: new Date().toISOString(),
    note: "This contains your private Firestore profile and basic Firebase Auth details, not all activity or application data.",
    account: {
      uid: signedInUser.uid,
      email: signedInUser.email,
      emailVerified: signedInUser.emailVerified,
      signInProviders: signedInUser.providerData.map((item) => item.providerId)
    },
    profile
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "my-website-profile.json";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    feedback("account-feedback", "Your profile export has been prepared for download.", "success");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}, "account-feedback"));

$("settings-signout").addEventListener("click", () => guarded(async () => {
  await signOut(auth);
  window.location.replace("login.html");
}, "account-feedback"));

const configured = ["apiKey", "authDomain", "projectId", "appId"].every((key) =>
  typeof firebaseConfig[key] === "string" &&
  firebaseConfig[key].trim().length > 0 &&
  !firebaseConfig[key].includes("REPLACE_")
);
if (!configured) {
  $("settings-loading").textContent = "Firebase is not configured.";
} else {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    const db = getFirestore(app);
    onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.replace("login.html"); return; }
      signedInUser = user;
      showAccount(user);
      $("settings-loading").hidden = true;
      $("settings-content").hidden = false;
      await showPrivateProfile(user, db);
      try {
        await reload(user);
        if (auth.currentUser?.uid === user.uid) showAccount(user);
      } catch (error) {
        console.warn("Could not refresh verification status:", error);
      }
    }, () => {
      $("settings-loading").textContent = "Unable to check your session. Refresh this page.";
    });
  } catch (error) {
    $("settings-loading").textContent = "Unable to start Firebase. Refresh this page.";
    console.error(error);
  }
}
