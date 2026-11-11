import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ensureUserProfile, saveProfile, normalizeUsername, validateUsername } from "./database.js";
import { renderAvatar } from "./avatar.js?v=mascot-1";

const $ = (id) => document.getElementById(id);
const form = $("edit-profile-form");
const feedback = $("profile-feedback");
const previewAvatar = $("profile-preview-avatar");
let user = null;
let current = null;
let busy = false;

function showFeedback(message, type = "") {
  feedback.textContent = message;
  feedback.className = "profile-feedback" + (type ? " " + type : "");
}
function getPublicUrl() {
  const url = new URL("public-profile.html", location.href);
  url.searchParams.set("uid", user.uid);
  return url.toString();
}
function updatePreview() {
  const name = $("edit-display-name").value.trim();
  const username = normalizeUsername($("edit-username").value);
  const bio = $("edit-bio").value.trim();
  $("preview-name").textContent = name || "Your display name";
  $("preview-handle").textContent = username ? "@" + username : "@username";
  $("preview-bio").textContent = bio || "Your bio will show up here.";
  $("bio-counter").textContent = bio.length + " / 180";
  const isPublic = $("edit-public").checked;
  $("preview-visibility").textContent = isPublic
    ? "Public when you save" : "Private profile";

  // A public profile link only works after a successful Firestore save.
  const published = current?.isPublic === true;
  $("view-profile-link").hidden = !published;
  $("copy-profile-link").hidden = !published;
  if (published && user) $("view-profile-link").href = getPublicUrl();
}
function fillForm(profile) {
  current = profile;
  $("edit-display-name").value = profile.displayName || user.displayName || "Member";
  $("edit-username").value = profile.username || "";
  $("edit-bio").value = profile.bio || "";
  $("edit-public").checked = profile.isPublic === true;
  renderAvatar(previewAvatar, profile);
  updatePreview();
}
function errorMessage(error) {
  if (error?.code === "profile/username-taken" || error?.code === "already-exists") {
    return "That username is already taken. Choose another one.";
  }
  if (error?.code === "permission-denied") {
    return "The updated profile security rules haven't been published in Firebase yet. Open the setup guide.";
  }
  if (error?.code === "unavailable") return "Firestore is unavailable. Check your connection.";
  return error?.message || "Couldn't save your profile. Please try again.";
}
form.addEventListener("input", updatePreview);
form.addEventListener("change", updatePreview);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !user) return;

  const displayName = $("edit-display-name").value.trim();
  const username = normalizeUsername($("edit-username").value);
  const bio = $("edit-bio").value.trim();
  const isPublic = $("edit-public").checked;
  $("edit-username").value = username;
  if (!validateUsername(username)) {
    showFeedback("Username must be 3–20 lowercase letters, numbers or underscores. Some reserved names are unavailable.", "error");
    return;
  }
  busy = true;
  $("save-profile").disabled = true;
  showFeedback("Saving your profile…");
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const saved = await saveProfile(getFirestore(app), user, { displayName, username, bio, isPublic });
    current = saved;
    // Firestore is the source of truth for the display name.
    // Firebase Auth also gets the updated name for sign-in pages.
    try { await updateProfile(user, { displayName }); } catch (err) {
      console.warn("Firebase Auth name sync will retry at a later login.", err);
    }
    fillForm(saved);
    showFeedback(isPublic
      ? "Saved! Your public profile is ready to share."
      : "Profile saved. Your information is private.", "success");
  } catch (error) {
    showFeedback(errorMessage(error), "error");
    console.error("Profile save failed", error);
  } finally {
    busy = false;
    $("save-profile").disabled = false;
  }
});
$("copy-profile-link").addEventListener("click", async () => {
  if (!current?.isPublic || !user) return;
  try {
    await navigator.clipboard.writeText(getPublicUrl());
    showFeedback("Public profile link copied.", "success");
  } catch (_) {
    showFeedback("Use the View public profile button to copy the link from your browser.", "error");
  }
});
const configured = ["apiKey", "authDomain", "projectId", "appId"].every((key) =>
  typeof firebaseConfig[key] === "string" && !firebaseConfig[key].includes("REPLACE_")
);
if (!configured) {
  $("profile-loading").textContent = "Firebase isn't configured.";
} else {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    onAuthStateChanged(auth, async (signedIn) => {
      if (!signedIn) { window.location.replace("login.html"); return; }
      user = signedIn;
      try {
        const profile = await ensureUserProfile(db, user);
        if (!profile) throw new Error("Profile not found.");
        fillForm(profile);
        $("profile-loading").hidden = true;
        $("profile-content").hidden = false;
      } catch (error) {
        $("profile-loading").textContent = errorMessage(error);
      }
    }, () => { $("profile-loading").textContent = "Couldn't check your session. Reload the page."; });
  } catch (error) {
    $("profile-loading").textContent = "Couldn't initialize Firebase.";
    console.error(error);
  }
}
