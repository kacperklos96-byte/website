// Firebase Authentication owns passwords. User details live in private
// users/{uid}. Only opted-in data is copied to publicProfiles/{uid}.
import {
  doc, getDoc, runTransaction, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

export async function getUserProfile(db, uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function ensureUserProfile(db, user) {
  if (!user || !user.uid || !user.email) throw new Error("profile/missing-identity");
  const ref = doc(db, "users", user.uid);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) return;
    tx.set(ref, {
      uid: user.uid,
      displayName: (user.displayName || "Member").slice(0, 60),
      email: user.email,
      photoURL: "", // Never import Google profile pictures.
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
  return getUserProfile(db, user.uid);
}

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

const restricted = new Set([
  "admin", "administrator", "moderator", "mod", "staff", "support",
  "system", "owner", "root", "security", "firebase", "official", "null"
]);
export function validateUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username) && !restricted.has(username);
}

export async function saveProfile(db, user, changes) {
  if (!user?.uid) throw new Error("Sign in to edit your profile.");
  const displayName = String(changes.displayName || "").trim();
  const username = normalizeUsername(changes.username);
  const bio = String(changes.bio || "").trim();
  const isPublic = changes.isPublic === true;
  if (displayName.length < 2 || displayName.length > 60)
    throw new Error("Display name must contain 2–60 characters.");
  if (!validateUsername(username))
    throw new Error("Use 3–20 lowercase letters, numbers or underscores for your username.");
  if (bio.length > 180) throw new Error("Bio cannot be longer than 180 characters.");

  const privateRef = doc(db, "users", user.uid);
  const publicRef = doc(db, "publicProfiles", user.uid);
  const newHandleRef = doc(db, "handles", username);

  await runTransaction(db, async (tx) => {
    // Firestore requires every transaction read before any write.
    const privateSnap = await tx.get(privateRef);
    if (!privateSnap.exists()) throw new Error("Your account record was not found. Refresh and try again.");
    const oldData = privateSnap.data();
    const previousUsername = oldData.username || "";
    const previousRef = previousUsername && previousUsername !== username
      ? doc(db, "handles", previousUsername) : null;

    const newHandle = await tx.get(newHandleRef);
    const oldHandle = previousRef ? await tx.get(previousRef) : null;
    const publicSnap = await tx.get(publicRef);

    if (newHandle.exists() && newHandle.data().uid !== user.uid) {
      const error = new Error("That username is already taken.");
      error.code = "profile/username-taken";
      throw error;
    }

    // This handle record is a unique reservation. Rules require the
    // reservation and the private profile update to happen together.
    if (!newHandle.exists()) tx.set(newHandleRef, { uid: user.uid });
    if (oldHandle?.exists() && oldHandle.data().uid === user.uid) {
      tx.delete(previousRef);
    }

    tx.update(privateRef, {
      displayName, username, bio, isPublic,
      updatedAt: serverTimestamp()
    });

    if (isPublic) {
      tx.set(publicRef, {
        uid: user.uid,
        username,
        displayName,
        bio,
        avatarData: oldData.avatarData || "",
        joinedAt: oldData.createdAt
      });
    } else if (publicSnap.exists()) {
      tx.delete(publicRef);
    }
  });
  return getUserProfile(db, user.uid);
}

export async function saveCustomAvatar(db, uid, avatarData) {
  if (typeof avatarData !== "string" ||
      avatarData.length > 48000 ||
      (avatarData !== "" &&
        !/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(avatarData))) {
    throw new Error("Invalid profile image.");
  }
  const privateRef = doc(db, "users", uid);
  const publicRef = doc(db, "publicProfiles", uid);
  await runTransaction(db, async (tx) => {
    const privateSnap = await tx.get(privateRef);
    if (!privateSnap.exists()) throw new Error("Profile not found.");
    const p = privateSnap.data();
    const publicSnap = p.isPublic === true ? await tx.get(publicRef) : null;
    tx.update(privateRef, { avatarData, updatedAt: serverTimestamp() });
    if (p.isPublic && p.username && publicSnap?.exists()) {
      tx.update(publicRef, { avatarData });
    }
  });
}
