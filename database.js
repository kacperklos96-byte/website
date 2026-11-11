// Firebase Auth manages login credentials. Firestore stores private
// website profile data and optional, compressed, custom avatar images.
import {
  doc, getDoc, runTransaction, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

export async function getUserProfile(db, uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function ensureUserProfile(db, user) {
  if (!user || !user.uid || !user.email) {
    throw new Error("profile/missing-identity");
  }
  const ref = doc(db, "users", user.uid);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) return;
    transaction.set(ref, {
      uid: user.uid,
      displayName: (user.displayName || "Member").slice(0, 60),
      email: user.email,
      photoURL: "", // Don't copy Google or other provider pictures.
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  return getUserProfile(db, user.uid);
}

export async function saveCustomAvatar(db, uid, avatarData) {
  if (typeof avatarData !== "string" ||
      avatarData.length > 48000 ||
      (avatarData !== "" && !/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(avatarData))) {
    throw new Error("Invalid profile image.");
  }
  await updateDoc(doc(db, "users", uid), {
    avatarData,
    updatedAt: serverTimestamp()
  });
}
