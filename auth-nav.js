import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, onSnapshot, orderBy, limit, query } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { renderAvatar } from "./avatar.js?v=mascot-1";

const link = document.getElementById("nav-auth-link");
let activeUid = null;
let unsubscribeAlerts = null;
let notificationButton = null;

function clearNotificationWatcher() {
  if (unsubscribeAlerts) { unsubscribeAlerts(); unsubscribeAlerts = null; }
  if (notificationButton) { notificationButton.remove(); notificationButton = null; }
}

function startNotificationWatcher(db, uid) {
  clearNotificationWatcher();
  if (!link) return;
  notificationButton = document.createElement("a");
  notificationButton.href = "notifications.html";
  notificationButton.className = "nav-notification";
  notificationButton.title = "Notifications";
  notificationButton.setAttribute("aria-label", "Notifications");
  notificationButton.innerHTML = '<i class="fas fa-bell" aria-hidden="true"></i><span class="nav-unread-count" hidden></span>';
  link.insertAdjacentElement("beforebegin", notificationButton);
  const count = notificationButton.querySelector(".nav-unread-count");
  const q = query(collection(db, "notifications", uid, "items"), orderBy("createdAt", "desc"), limit(20));
  unsubscribeAlerts = onSnapshot(q, snapshot => {
    if (activeUid !== uid) return;
    const unread = snapshot.docs.filter(d => d.data().read !== true).length;
    count.hidden = unread === 0;
    count.textContent = unread >= 20 ? "20+" : String(unread);
    notificationButton.setAttribute("aria-label", unread ? unread + " unread notifications" : "Notifications");
  }, error => {
    // Bell stays available when rules aren't published, but unread counts
    // aren't guessed or shown as zero on a permission failure.
    count.hidden = true;
    console.warn("Notifications unavailable:", error.code || error);
  });
}

function showGuest() {
  clearNotificationWatcher();
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
  link.href = "dashboard.html";
  link.setAttribute("aria-label", "Open dashboard");
  link.title = "Dashboard";
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
      startNotificationWatcher(db, user.uid);
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
