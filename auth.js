import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, onAuthStateChanged,
  sendEmailVerification, signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ensureUserProfile, saveCustomAvatar } from "./database.js";
import { renderAvatar, prepareAvatar } from "./avatar.js";

const requiredFields = ["apiKey", "authDomain", "projectId", "appId"];
const configured = requiredFields.every((key) =>
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
    "failed-precondition": "Firestore is not ready. Create the Cloud Firestore database in Firebase Console.",
    "unavailable": "The profile database is temporarily unavailable.",
    "profile/missing-identity": "An email address is required to create a user profile."
  };
  return errors[err?.code] || "Something went wrong. Please try again.";
}

async function inProgress(task) {
  if (submitting) return;
  submitting = true;
  const controls = document.querySelectorAll("[data-requires-auth]");
  controls.forEach((control) => { control.disabled = true; });
  setStatus("");
  try { await task(); }
  catch (error) { setStatus(explainError(error), "error"); }
  finally {
    submitting = false;
    if (auth) controls.forEach((control) => { control.disabled = false; });
  }
}

// If the authentication step succeeds but Firestore isn't set up yet,
// still show the account page so it can explain the database problem.
async function finishSignIn(user) {
  try {
    await ensureUserProfile(db, user);
  } catch (error) {
    console.warn("Signed in, but the profile database isn't ready:", error);
  }
  window.location.assign("account.html");
}

function renderAccount(user) {
  const displayName = user.displayName || "Member";
  renderAvatar(document.getElementById("account-avatar"));
  document.getElementById("account-subtitle").textContent = "Signed in successfully.";
  document.getElementById("account-name").textContent = displayName;
  document.getElementById("account-email").textContent = user.email || "No email supplied";
  document.getElementById("account-details").hidden = false;
  document.getElementById("verify-email").hidden =
    user.emailVerified || !user.email ||
    user.providerData.some((provider) => provider.providerId === "google.com");
}

async function renderSavedProfile(user) {
  const databaseStatus = document.getElementById("database-status");
  databaseStatus.textContent = "Checking your Cloud Firestore profile...";
  try {
    const profile = await ensureUserProfile(db, user);
    if (auth.currentUser?.uid !== user.uid) return;
    if (!profile) throw new Error("profile/not-found");
    document.getElementById("account-name").textContent = profile.displayName;
    document.getElementById("account-email").textContent = profile.email;
    renderAvatar(document.getElementById("account-avatar"), profile);
    const uploadButton = document.getElementById("avatar-upload-btn");
    const removeButton = document.getElementById("avatar-remove-btn");
    if (uploadButton) uploadButton.disabled = false;
    if (removeButton) {
      removeButton.hidden = !profile.avatarData;
      removeButton.disabled = false;
    }
    const createdAt = profile.createdAt?.toDate?.();
    document.getElementById("account-created").textContent = createdAt
      ? createdAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
      : "Just created";
    databaseStatus.textContent = "Your profile is saved in Cloud Firestore.";
    databaseStatus.className = "database-status connected";
  } catch (error) {
    if (auth.currentUser?.uid !== user.uid) return;
    databaseStatus.textContent = "Profile database is not connected yet.";
    databaseStatus.className = "database-status disconnected";
    setStatus(explainError(error) + " Check README.md for database setup.", "error");
  }
}

if (!auth) {
  const notice = document.getElementById("setup-notice");
  if (notice) notice.hidden = false;
  document.querySelectorAll("[data-requires-auth]").forEach((control) => {
    control.disabled = true;
  });
  if (page === "account") {
    document.getElementById("account-subtitle").textContent =
      "Set up Firebase to enable user accounts.";
    document.getElementById("database-status").textContent =
      "Database setup is required.";
  }
} else {
  onAuthStateChanged(auth, (user) => {
    if (page === "account") {
      if (!user) {
        window.location.replace("login.html");
        return;
      }
      renderAccount(user);
      renderSavedProfile(user);
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
          if (password.length < 8) {
            setStatus("Please use at least 8 characters for your password.", "error");
            return;
          }
          if (password !== confirm) {
            setStatus("Passwords do not match.", "error");
            return;
          }
          const result = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(result.user, { displayName: name });
          await finishSignIn(result.user);
        } else {
          const result = await signInWithEmailAndPassword(auth, email, password);
          await finishSignIn(result.user);
        }
      });
    });
  }

  if (googleButton) {
    googleButton.addEventListener("click", () => inProgress(async () => {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await finishSignIn(result.user);
    }));
  }

  if (page === "account") {
    const avatarInput = document.getElementById("avatar-file");
    const uploadButton = document.getElementById("avatar-upload-btn");
    const removeButton = document.getElementById("avatar-remove-btn");
    const avatarStatus = document.getElementById("avatar-status");

    function setAvatarStatus(message, type = "") {
      avatarStatus.textContent = message;
      avatarStatus.className = "avatar-status" + (type ? " " + type : "");
    }

    async function changeAvatar(avatarData) {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Your session expired. Please sign in again.");
      await saveCustomAvatar(db, uid, avatarData);
      if (auth.currentUser?.uid !== uid) return;
      renderAvatar(document.getElementById("account-avatar"), { avatarData });
      window.dispatchEvent(new CustomEvent("profile-avatar-updated", {
        detail: { uid, avatarData }
      }));
      removeButton.hidden = !avatarData;
    }

    uploadButton.addEventListener("click", () => avatarInput.click());

    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      uploadButton.disabled = true;
      removeButton.disabled = true;
      setAvatarStatus("Preparing picture...");
      try {
        const compressed = await prepareAvatar(file);
        setAvatarStatus("Saving picture...");
        await changeAvatar(compressed);
        setAvatarStatus("Picture saved to your profile.", "success");
      } catch (error) {
        setAvatarStatus(error.code === "permission-denied"
          ? "Upload needs updated Firestore rules. See the setup instructions."
          : (error.message || "Couldn't save that picture."), "error");
      } finally {
        avatarInput.value = "";
        uploadButton.disabled = false;
        removeButton.disabled = false;
      }
    });

    removeButton.addEventListener("click", async () => {
      uploadButton.disabled = true;
      removeButton.disabled = true;
      setAvatarStatus("Removing picture...");
      try {
        await changeAvatar("");
        setAvatarStatus("Picture removed.", "success");
      } catch (error) {
        setAvatarStatus(error.code === "permission-denied"
          ? "Removal needs updated Firestore rules. See the setup instructions."
          : (error.message || "Couldn't remove that picture."), "error");
      } finally {
        uploadButton.disabled = false;
        removeButton.disabled = false;
      }
    });

    document.getElementById("signout").addEventListener("click", () =>
      inProgress(async () => {
        await signOut(auth);
        window.location.replace("login.html");
      })
    );
    document.getElementById("verify-email").addEventListener("click", () =>
      inProgress(async () => {
        if (!auth.currentUser) return;
        await sendEmailVerification(auth.currentUser);
        setStatus("Verification email sent. Check your inbox.", "success");
      })
    );
  }
}
