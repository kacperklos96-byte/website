// User profile storage in Cloud Firestore.
// Firebase Authentication manages passwords and login identity.
// Firestore stores only the app's own profile data; one document per UID.
import {
  doc, getDoc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

export async function getUserProfile(db, uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function ensureUserProfile(db, user) {
  if (!user || !user.uid || !user.email) {
    throw new Error("profile/missing-identity");
  }

  const profileRef = doc(db, "users", user.uid);

  // Transactions prevent two simultaneous logins from replacing createdAt.
  // Existing profiles aren't overwritten when someone signs in again.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (snapshot.exists()) return;

    transaction.set(profileRef, {
      uid: user.uid,
      displayName: (user.displayName || "Member").slice(0, 60),
      email: user.email,
      photoURL: (user.photoURL || "").slice(0, 2000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  return getUserProfile(db, user.uid);
}
