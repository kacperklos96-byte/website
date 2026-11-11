// Firebase helpers shared by the community features.
// No administrator credentials or privileged backend access exist in the browser.
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  getFirestore, addDoc, collection, doc, getDoc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export function firebaseClient() {
  const ok = ["apiKey","authDomain","projectId","appId"].every(k =>
    typeof firebaseConfig[k] === "string" && firebaseConfig[k].length && !firebaseConfig[k].includes("REPLACE_"));
  if (!ok) throw new Error("Firebase isn't configured.");
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { app, auth:getAuth(app), db:getFirestore(app) };
}
export function authenticated(auth, callback) {
  return onAuthStateChanged(auth, user => {
    if (!user) { location.replace("login.html"); return; }
    callback(user);
  }, error => {
    const node = document.getElementById("page-status");
    if (node) node.textContent = "Couldn't verify your session. Reload and try again.";
    console.error(error);
  });
}
export function when(value) {
  const d = value?.toDate?.() || (value instanceof Date ? value : null);
  if (!d || Number.isNaN(d.getTime())) return "Just now";
  return d.toLocaleString(undefined, {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
export async function recordActivity(db, uid, kind, details = "") {
  try {
    await addDoc(collection(db,"activity",uid,"events"), {
      kind, details:String(details).slice(0,120), createdAt:serverTimestamp()
    });
  } catch (error) {
    // These are optional client-authored entries; they are NOT audit records.
    console.warn("Could not add activity entry:", error.code || error);
  }
}
export function routeProfile(uid) {
  return "public-profile.html?uid=" + encodeURIComponent(uid);
}
export function safeUid(uid) {
  return typeof uid === "string" && /^[A-Za-z0-9_-]{6,128}$/.test(uid);
}
export async function lookupPublicName(db, uid) {
  if (!safeUid(uid)) return null;
  try {
    const result = await getDoc(doc(db,"publicProfiles",uid));
    return result.exists() ? result.data() : null;
  } catch (_) { return null; }
}
export async function sendMessage(db, user, recipientUid, rawBody) {
  const body = String(rawBody).trim();
  if (!safeUid(recipientUid) || recipientUid === user.uid)
    throw new Error("Choose another member to message.");
  if (!body || body.length > 700)
    throw new Error("Messages must contain 1–700 characters.");

  // A stable thread ID avoids two simultaneous clients creating separate threads.
  const tid = [user.uid, recipientUid].sort().join("_");
  const tRef = doc(db,"threads",tid);
  const mRef = doc(collection(tRef,"messages"));
  const nRef = doc(db,"notifications",recipientUid,"items",mRef.id);

  // Transaction ensures the thread preview, message and recipient alert
  // are committed together or not at all.
  await runTransaction(db, async tx => {
    const threadSnap = await tx.get(tRef);
    if (threadSnap.exists()) {
      const members = threadSnap.data().members || [];
      if (!members.includes(user.uid) || !members.includes(recipientUid))
        throw new Error("You are not a participant in this conversation.");
    } else {
      const publicSnap = await tx.get(doc(db,"publicProfiles",recipientUid));
      if (!publicSnap.exists()) throw new Error("This member isn't accepting new conversations through a public profile.");
    }
    if (threadSnap.exists()) {
      tx.update(tRef, {
        lastMessage:body, lastMessageId:mRef.id, lastSenderUid:user.uid,
        lastSentAt:serverTimestamp(), updatedAt:serverTimestamp()
      });
    } else {
      tx.set(tRef, {
        members:[user.uid,recipientUid].sort(),
        createdBy:user.uid, createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
        lastMessage:body, lastMessageId:mRef.id,
        lastSenderUid:user.uid, lastSentAt:serverTimestamp()
      });
    }
    tx.set(mRef, {senderUid:user.uid,body,createdAt:serverTimestamp()});
    tx.set(nRef, {
      type:"message",fromUid:user.uid,threadId:tid,messageId:mRef.id,
      createdAt:serverTimestamp(),read:false
    });
  });
  return tid;
}
