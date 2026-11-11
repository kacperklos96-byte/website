# My Website — all 8 roadmap features in the repository

**Status:** The source code for all eight planned features has now been added to `main`.
The newer features require publishing the latest Firestore rules and an admin-specific
one-time setup. Merely committing the files does not change Firebase permissions.

| # | Feature | Code | Activation / limits |
|---|---------|------|---------------------|
| 1 | Dashboard | ✅ | Firebase Authentication and private profiles |
| 2 | Profiles | ✅ | Publish updated Firestore rules for public profiles |
| 3 | Settings | ✅ | Existing Firebase Auth; local theme preference |
| 4 | Admin Panel | ✅ | Trusted Firebase Auth `admin: true` custom claim required |
| 5 | Notifications | ✅ | Alerts arrive when someone sends a new private message |
| 6 | Messaging | ✅ | Members can start chats from opted-in public profiles; per-user blocking |
| 7 | User Search | ✅ | Prefix search over explicitly public usernames only |
| 8 | Activity History | ✅ | Personal client-authored events, not a trusted security audit |

## The five new features

### 4. Admin Panel

- `admin.html`, `admin.js`: staff-only view of a bounded sample of account
  records and the public-profile collection, with private review notes.
- The page requires a **server-issued Firebase Auth custom claim**. Browser
  check **and** Firestore security rules must pass.
- No self-service role creation is allowed. A local, trusted Node.js helper
  `scripts/set-admin.mjs` can assign or revoke the claim.
- Review annotations do NOT suspend, ban, delete, or change user roles.
- The counts are sample/page counts, not fabricated global site statistics.

### 5. Notifications

- `notifications.html`, `notifications.js`: private, live Firestore inbox.
- New messages create an alert in the recipient's private collection as part
  of the same transaction that creates the message.
- Read/unread status, mark-all-read, delete, direct links to conversations.
- A small live unread bell is added to the existing navigation for logged-in
  users.

### 6. Messaging

- `messages.html`, `messages.js`, `community-data.js`
- Two-member conversations, recent messages, and real-time updates.
- Users can start a chat from another person's **opted-in public profile**.
- Block/unblock users; Firestore rules prevent messages if either side blocks.
- Messages are limited to 700 characters and stored privately. This is an
  experimental messaging feature, not an end-to-end encrypted chat product.
- The interface loads up to 30 threads and 40 recent messages per thread.

### 7. User Search

- `search.html`, `search.js`
- Search public usernames, view profile cards, and start conversations.
- Only users with a published `publicProfiles/{uid}` record are listed.
- Queries are limited to 15 results. Search can be used without signing in;
  messaging requires an account.

### 8. Activity History

- `activity.html`, `activity.js`
- Recent browser-recorded markers for session access, profile edits, theme,
  password changes, and sent messages.
- The record is private and append-only for the browser, but owners may delete
  entries. This is **not** a tamper-proof server audit trail.

## How to activate the new features

1. Copy **all** of the newest `firestore.rules` from the repository into
   Firebase Console > Firestore Database > Rules, then press **Publish**.
2. Sign into the website. Find People, Messages, Notifications and Activity
   should now access their collections. A new notification appears only after
   someone actually sends a message; the inbox isn't seeded with fake alerts.
3. To enable Admin Panel, the site owner must use a trusted Admin SDK
   environment to assign the claim. See [README.md](README.md) for the local
   script and safe credential handling.
4. Open [Dashboard](https://kacperklos96-byte.github.io/website/dashboard.html)
   for shortcuts to all features.

**Important:** All private user data remains protected by UID ownership rules,
except the limited account roster accessible to verified administrators.
The admin page never derives its role from editable Firestore profile fields.
Messages and notification creation are tied together in a single Firestore
transaction, so unauthenticated users cannot send or forge them.
The rules contain no unrestricted public write clause.

## Optional follow-up hardening

For a real public launch, add reporting and moderator escalation, rate limiting
through trusted backend enforcement, a dedicated account deletion/export service,
email-change flows, abuse monitoring, pagination, Firebase emulator rule tests,
and privileged server audit events. Never commit Firebase service-account keys.
