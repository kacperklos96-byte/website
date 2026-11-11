import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ensureUserProfile } from "./database.js";
import { renderAvatar } from "./avatar.js?v=mascot-1";

const $ = (id) => document.getElementById(id);
const ready = $("dashboard-content");
const loading = $("dashboard-loading");
const error = $("dash-error");
const activity = $("dash-activity");

function formatDate(date, includeTime = false) {
  if (!date || Number.isNaN(date.getTime())) return "Not available";
  const options = { day: "numeric", month: "short", year: "numeric" };
  if (includeTime) Object.assign(options, { hour: "2-digit", minute: "2-digit" });
  return new Intl.DateTimeFormat(undefined, options).format(date);
}
function timeFromTimestamp(value) {
  return value?.toDate?.() ?? null;
}
function setStatus(value, text, level = "") {
  const el = $(value);
  el.textContent = text;
  el.className = "status-value" + (level ? " " + level : "");
}
function addActivity(icon, label, when) {
  if (!when || Number.isNaN(when.getTime())) return;
  const row = document.createElement("div");
  row.className = "activity-entry";
  const symbol = document.createElement("span");
  symbol.className = "activity-marker";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = icon;
  const detail = document.createElement("div");
  const title = document.createElement("span");
  title.className = "activity-label";
  title.textContent = label;
  const date = document.createElement("span");
  date.className = "activity-date";
  date.textContent = formatDate(when, true);
  detail.append(title, date);
  row.append(symbol, detail);
  activity.appendChild(row);
}
function showUser(user) {
  $("dash-first-name").textContent = (user.displayName || user.email?.split("@")[0] || "there").split(/\s+/)[0].slice(0, 35);
  $("dash-name").textContent = user.displayName || "Member";
  $("dash-email").textContent = user.email || "No email available";
  $("dash-provider").textContent = user.providerData.some((entry) => entry.providerId === "google.com") ? "Google" : "Email & password";

  setStatus("dash-email-status", user.emailVerified ? "Verified" : "Not verified", user.emailVerified ? "good" : "warning");
  $("email-status-description").textContent = user.emailVerified
    ? "Your email address is confirmed."
    : "Verify your email in Account.";

  const createdAuth = user.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;
  const lastLogin = user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime) : null;
  $("dash-member-since").textContent = formatDate(createdAuth);
  activity.replaceChildren();
  const events = [
    ["↗", "Last sign-in", lastLogin],
    ["★", "Account created", createdAuth]
  ].filter((item) => item[2] && !Number.isNaN(item[2].getTime()));
  events.sort((a,b) => b[2] - a[2]);
  for (const event of events) addActivity(...event);
  if (!events.length) activity.textContent = "No account events available yet.";
  renderAvatar($("dashboard-avatar"));
  setStatus("dash-cloud-status", "Checking…");
  $("cloud-description").textContent = "Retrieving your private profile";

  loading.hidden = true;
  ready.hidden = false;
}
async function showProfile(db, user) {
  try {
    const profile = await ensureUserProfile(db, user);
    if (!profile) throw new Error("No private profile found.");
    $("dash-name").textContent = profile.displayName || user.displayName || "Member";
    const usernameEl = $("dash-username");
    usernameEl.hidden = !profile.username;
    usernameEl.textContent = profile.username ? "@" + profile.username : "";
    renderAvatar($("dashboard-avatar"), profile);
    const since = timeFromTimestamp(profile.createdAt);
    if (since) $("dash-member-since").textContent = formatDate(since);
    setStatus("dash-cloud-status", "Synced", "good");
    $("cloud-description").textContent = "Saved securely in Cloud Firestore";

    const updatedAt = timeFromTimestamp(profile.updatedAt);
    const createdAt = timeFromTimestamp(profile.createdAt);
    if (updatedAt && createdAt && updatedAt - createdAt > 60 * 1000) {
      addActivity("✎", "Profile updated", updatedAt);
    }
  } catch (err) {
    setStatus("dash-cloud-status", "Unavailable", "warning");
    $("cloud-description").textContent = "Could not load your private profile";
    error.textContent = "Your login is working, but the dashboard couldn't read your Firestore profile. Please check your connection and published Firestore rules.";
    error.hidden = false;
    console.error("Unable to load dashboard profile:", err);
  }
}

const configured = ["apiKey", "authDomain", "projectId", "appId"].every((key) =>
  typeof firebaseConfig[key] === "string" && firebaseConfig[key] && !firebaseConfig[key].includes("REPLACE_")
);
if (!configured) {
  loading.textContent = "Firebase is not configured yet.";
} else {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace("login.html");
        return;
      }
      showUser(user);
      await showProfile(db, user);
    }, (err) => {
      loading.textContent = "Unable to check your login. Please reload the page.";
      console.error("Dashboard authentication failed:", err);
    });
  } catch (err) {
    loading.textContent = "Unable to load your account. Please try refreshing.";
    console.error("Dashboard initialization failed:", err);
  }
}
