import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { renderAvatar } from "./avatar.js";

const link = document.getElementById("nav-auth-link");
let activeUid = null;

function showGuest() {
  activeUid = null;
  if (!link) return;
  link.className = "nav-auth nav-login auth-ready";
  link.href = "login.html";
  link.textContent = "Log in";
  link.setAttribute("aria-label", "Log in");
  link.removeAttribute("title");
}

function showAccount(profile) {
  if (!link) return;
  link.className = "nav-auth nav-profile auth-ready";
  link.href = "account.html";
  link.setAttribute("aria-label", "Open your account");
  link.title = "Your account";
  renderAvatar(link, profile);
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
    const db = getFirestore(app);
    onAuthStateChanged(getAuth(app), async (user) => {
      if (!user) {
        showGuest();
        return;
      }
      activeUid = user.uid;
      showAccount(null);
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (activeUid === user.uid && snapshot.exists()) {
          showAccount(snapshot.data());
        }
      } catch (error) {
        // Private profile access might fail briefly; the icon still works.
        console.warn("Could not load the custom avatar:", error);
      }
    }, () => showGuest());
    window.addEventListener("profile-avatar-updated", (event) => {
      if (activeUid && event.detail?.uid === activeUid) {
        showAccount({ avatarData: event.detail.avatarData });
      }
    });
  } catch (error) {
    console.error("Unable to initialize account navigation", error);
    showGuest();
  }
}
