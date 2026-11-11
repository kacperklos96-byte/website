import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { renderAvatar } from "./avatar.js?v=mascot-1";

const $ = (id) => document.getElementById(id);
const loading = $("public-loading");
const content = $("public-profile-content");
const uid = new URLSearchParams(location.search).get("uid");

renderAvatar($("public-profile-avatar"));

function showUnavailable(message = "This profile is private or doesn't exist.") {
  loading.textContent = message;
  content.hidden = true;
}
if (!uid || !/^[A-Za-z0-9_-]{6,128}$/.test(uid)) {
  showUnavailable();
} else {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    getDoc(doc(db, "publicProfiles", uid)).then((snapshot) => {
      if (!snapshot.exists()) { showUnavailable(); return; }
      const profile = snapshot.data();
      renderAvatar($("public-profile-avatar"), profile);
      $("public-name").textContent = profile.displayName || "Member";
      $("public-handle").textContent = "@" + (profile.username || "member");
      $("public-bio").textContent = profile.bio || "No bio yet.";
      const joined = profile.joinedAt?.toDate?.();
      $("public-joined").textContent = joined
        ? joined.toLocaleDateString(undefined, { month: "long", year: "numeric" })
        : "Member";
      document.title = "@" + (profile.username || "member") + " | My Website";
      loading.hidden = true;
      content.hidden = false;
    }).catch((error) => {
      // Never expose internal permission reasons to unauthenticated visitors.
      showUnavailable();
      console.warn("Could not load public profile:", error);
    });
  } catch (error) {
    showUnavailable("Unable to load profiles right now.");
    console.error(error);
  }
}
