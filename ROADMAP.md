# My Website — Feature Roadmap

This is an intentionally small, professional but experimental Firebase-powered website, hosted on GitHub Pages.

## 1. User dashboard — implemented

- `dashboard.html`, `dashboard.js`, `dashboard.css`
- Real Firebase Authentication session and private Firestore profile, with your own custom avatar
- Account status, account creation and last sign-in metadata, clear links to editing your profile
- Responsive light/dark layout

## 2. Profile system — implemented in GitHub (Firebase rules publishing required)

- `profile.html`: private profile editor and live preview
- Editable display name, **unique** username (3–20 lowercase letters/numbers/underscores), 180-character bio
- Public profile is **off by default**; sharing is explicit
- `public-profile.html?uid=...`: view a published profile through a stable link
- Private account email stays in `users/{uid}`, never appears in public profiles
- `handles/{username}` reserves names transactionally to prevent collisions
- `publicProfiles/{uid}` stores only name, handle, bio, chosen picture and member-since date
- Custom profile picture uploads from the existing account page also update a published avatar
- No server-side Cloud Functions or additional hosting needed for these features

**IMPORTANT:** The new collections and fields require publishing the updated [firestore.rules](firestore.rules) file in the [Firebase Console](https://console.firebase.google.com/project/website-d402e/firestore/databases/-default-/security/rules). Until then profile changes and public profile links may return permission errors. Committing the rules file does not deploy it.

## Upcoming stages (not yet built)

3. Settings: account security, appearance and privacy settings.
4. Admin panel: securely assigned administrator roles and moderation.
5. Notifications: per-user inbox and unread counts.
6. Messaging: private messaging, blocking, and abuse controls.
7. Search: opt-in searchable public profile directory.
8. Activity history: a fuller event timeline and backend-recorded audit events.

## Project links

- [Website](https://kacperklos96-byte.github.io/website/)
- [Dashboard](https://kacperklos96-byte.github.io/website/dashboard.html)
- [Edit profile](https://kacperklos96-byte.github.io/website/profile.html)
- [Account and avatar](https://kacperklos96-byte.github.io/website/account.html)

### Security notes

Only authenticated users can edit their own private and public documents. A public profile can be accessed with a direct link only while its owner opted in; the new rules disallow listing all user records and profile records. Usernames are unique via transactionally reserved handles and rules. We will introduce controlled public directory/search permissions during stage 7. Do not switch Firestore to open read/write rules.
