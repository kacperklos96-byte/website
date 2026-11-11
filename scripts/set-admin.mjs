// Run LOCALLY in a trusted Node.js environment, never on GitHub Pages.
// Requires npm install --no-save firebase-admin
// Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a private service-account JSON.
// Usage: node scripts/set-admin.mjs <Firebase-Auth-UID> grant|revoke
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [uid, action] = process.argv.slice(2);
if (!uid || !/^[A-Za-z0-9_-]{6,128}$/.test(uid) || !["grant", "revoke"].includes(action)) {
  console.error("Usage: node scripts/set-admin.mjs <Firebase-Auth-UID> grant|revoke");
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file stored privately on your own computer.");
  process.exit(1);
}
initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const user = await auth.getUser(uid);
const previous = user.customClaims || {};
await auth.setCustomUserClaims(uid, { ...previous, admin: action === "grant" });
console.log(action === "grant"
  ? "Admin claim granted. Have this user sign out and sign in again."
  : "Admin claim revoked. Revoke refresh tokens too if immediate revocation is required.");
if (action === "revoke") await auth.revokeRefreshTokens(uid);
