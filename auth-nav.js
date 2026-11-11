import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { renderAvatar } from "./avatar.js";

const link = document.getElementById("nav-auth-link");

function showGuest() {
  if (!link) return;
  link.className = "nav-auth nav-login auth-ready";
  link.href = "login.html";
  link.textContent = "Log in";
  link.setAttribute("aria-label", "Log in");
  link.removeAttribute("title");
}

function showAccount(user) {
  if (!link) return;
  link.className = "nav-auth nav-profile auth-ready";
  link.href = "account.html";
  link.setAttribute("aria-label", "Open your account");
  link.title = "Your account";
  renderAvatar(link, user);
}

const isConfigured = ["apiKey", "authDomain", "projectId", "appId"].every((key) =>
  typeof firebaseConfig[key] === "string" &&
  firebaseConfig[key].trim().length > 0 &&
  !firebaseConfig[key].includes("REPLACE_")
);

if (!isConfigured) {
  showGuest();
} else {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    onAuthStateChanged(getAuth(app), (user) => {
      if (user) showAccount(user);
      else showGuest();
    }, () => showGuest());
  } catch (error) {
    console.error("Unable to initialize account navigation", error);
    showGuest();
  }
}
