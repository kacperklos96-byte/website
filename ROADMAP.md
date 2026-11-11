# Experimental website — development roadmap

A professional, minimal experimental site built on GitHub Pages, Firebase Authentication and Cloud Firestore.

## Stage 1 — User Dashboard ✅ implemented

- `dashboard.html` — authenticated account dashboard
- `dashboard.js` — reads real Firebase sign-in information and the user's own Firestore profile
- `dashboard.css` — responsive light/dark layout with solid blue accents
- After successful login or registration, users open the dashboard automatically
- Header displays a **Dashboard** link only when the session is authenticated
- Shows the user's own avatar, display name, email, member-since date, provider and verification status
- Shows recent available Firebase account events (last sign-in, account creation, profile update)
- Links to the existing account page for changing custom pictures and signing out

The dashboard displays **real account data only**. Recent events are drawn from available Firebase metadata; this is not yet a full tamper-resistant audit system. This stage uses your existing security rules and needs **no new Firestore permissions**.

## Next planned stages

2. **Profiles:** editable username, bio and opt-in public profile.
3. **Settings:** account settings, privacy controls, password reset and appearance.
4. **Admin:** role-protected administrative UI (needs trusted server-side authorization).
5. **Notifications:** private per-user notification inbox.
6. **Messaging:** authenticated private conversations with abuse protections.
7. **Search:** public-profile opt-in and searchable directory.
8. **Activity:** a richer activity timeline; sensitive audit events require a trusted backend.

These future stages are **not yet implemented**. Their data models and Firestore rules must be designed and published before enabling them. The dashboard deliberately labels them as upcoming.

## Links

- [Website](https://kacperklos96-byte.github.io/website/)
- [Dashboard](https://kacperklos96-byte.github.io/website/dashboard.html)
- [Account](https://kacperklos96-byte.github.io/website/account.html)
- [Firebase project](https://console.firebase.google.com/project/website-d402e/overview)

See [README.md](README.md) for setup and account photo details.
