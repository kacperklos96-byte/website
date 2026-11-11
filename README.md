# My Website — Authentication, Firestore and custom avatars

## NEW: Features 4–8 — Admin, Notifications, Messages, Search, Activity

These features have been committed directly to the website:

- [Admin Panel](https://kacperklos96-byte.github.io/website/admin.html) — staff-only roster and review notes
- [Notifications](https://kacperklos96-byte.github.io/website/notifications.html) — unread message alerts
- [Messages](https://kacperklos96-byte.github.io/website/messages.html) — private 1-to-1 conversations and blocking
- [Find People](https://kacperklos96-byte.github.io/website/search.html) — search only users who opted into public profiles
- [Activity](https://kacperklos96-byte.github.io/website/activity.html) — your personal activity history
- [Dashboard](https://kacperklos96-byte.github.io/website/dashboard.html) — shortcuts to all five

### REQUIRED: Publish the newest Firestore security rules

The code is committed, **but the Firebase database will reject new collections
until you publish its latest rules**. The updated rules also cover profile
usernames and public profiles from Feature 2.

1. Open [firestore.rules](https://github.com/kacperklos96-byte/website/blob/main/firestore.rules) in GitHub and copy the entire file.
2. Open [Firebase Console > Firestore Rules](https://console.firebase.google.com/project/website-d402e/firestore/databases/-default-/security/rules).
3. Replace the old rules and click **Publish**. Keep the strict rules; do NOT use `allow read, write: if true`.
4. Reload the website, sign in, and test member search, messages, notifications, and activity. A notification is created only when someone sends a message.

### Admin setup — server-issued role, never a front-end password

The Admin Panel requires a real custom claim (`admin: true`) issued by the
**Firebase Admin SDK**. A normal visitor can't make themselves an admin
by editing HTML or Firestore. Only the project owner should perform this action.

From a trusted, local copy of this GitHub repository on your own computer:

1. In Firebase Console > Authentication > Users, locate the account to promote and copy its **Firebase Authentication UID**.
2. In Firebase Console > Project settings > Service accounts, create an Admin SDK credential file **only if you do not already have trusted credentials**. Keep it outside your public repository and never upload it to GitHub, chat, a browser webpage, or GitHub Pages.
3. Install the Node.js dependency locally with `npm install --no-save firebase-admin`.
4. In a local PowerShell window, set the environment variable to the *private file on your PC*: `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\\secure\\firebase-admin.json"` (replace with the actual file path).
5. Run `node scripts/set-admin.mjs YOUR_FIREBASE_UID grant` from the repo root, replacing `YOUR_FIREBASE_UID` with the user's UID.
6. Sign out and sign in again. The admin page now checks the claim with Firebase Authentication **and** Firestore rules.

To remove access, run `node scripts/set-admin.mjs YOUR_FIREBASE_UID revoke`
in the same trusted environment. Never place a service-account JSON file in this
GitHub repository.

**Admin Panel functionality:** bounded user roster, public profile sample,
and private moderation-review notes. Review notes **do not ban, suspend, delete
or grant roles**. Real account sanctions would require a trusted backend.

### Privacy and functionality

- Search lists only opted-in public profile cards. Private profile documents
  and email addresses are never exposed by search.
- Two-person threads have private, owner-only reads; blocked users cannot
  send new messages. The recipient receives a notification in the same
  Firestore transaction as the message. This is not end-to-end encryption.
- Each user's notifications are private, and owners can mark them read or clear
  them. The navbar bell shows a live unread count when permissions allow.
- Activity entries are **browser-authored markers** and can be incomplete;
  they are not verified server-side security audit logs.
- The existing Firebase Auth, Firestore, custom mascot and photo uploads,
  cookie theme, and account pages are retained.

See [ROADMAP.md](ROADMAP.md) for implementation scope and limitations.

---


## NEW: Feature 3 — Settings Page

[Open your settings](https://kacperklos96-byte.github.io/website/settings.html) after logging in.

Settings now offers theme choices (saved in the existing preference cookie), private/public profile status, email verification, password changes for email/password accounts, password-reset emails, account information, logout and a local download of your saved profile data. Google-only accounts don't have a website password, so the password form is hidden for them. Sensitive password changes require the current password and Firebase reauthentication.

**No extra Firebase rules are required for Settings.** The optional public profile feature still requires its updated Firestore rules from the previous stage.

Notes: This page doesn't change your account email or delete accounts yet. The JSON export contains your private profile and limited Firebase Auth metadata; it is not an export of all Firebase project data.

---


## NEW: Feature 2 — Profile system

Your `main` branch now has editable profiles.

- **Edit:** [profile.html](https://kacperklos96-byte.github.io/website/profile.html). You must be signed in.
- **Public view:** `public-profile.html?uid=<Firebase UID>` (the editor generates/copies the actual link after you publish).
- **Private by default:** Only the profile owner sees their private email. Public visitors only see the fields you choose to share.
- **Unique username:** 3–20 lowercase letters, numbers, underscores. Names are reserved in `handles/{username}` through a Firestore transaction.
- **Custom profile picture:** Upload via [account.html](https://kacperklos96-byte.github.io/website/account.html). The profile editor previews it.

### REQUIRED: Publish the revised rules

The new database collections **will not work** until the updated rules are published in Firebase:

1. Open [firestore.rules in GitHub](https://github.com/kacperklos96-byte/website/blob/main/firestore.rules) and copy the entire file.
2. Open the [website-d402e Firestore Rules editor](https://console.firebase.google.com/project/website-d402e/firestore/databases/-default-/security/rules).
3. Replace the rules with the copied content and click **Publish**.
4. Reopen the [profile editor](https://kacperklos96-byte.github.io/website/profile.html), set a username and bio, then save your profile.
5. To share your page, enable **Public profile**, save, then use the **Copy profile link** button.

**Do not** enable open Firestore read/write access to troubleshoot. The new rules protect users' private documents while allowing individual public profiles to be read by URL.

The public profile's avatar is deliberately a copy of the user's *chosen website avatar*, never their Google photo. Email addresses, Firebase Auth details, and private account documents are not published. Turning public visibility off makes the page inaccessible (and deletes its public copy).

See [ROADMAP.md](ROADMAP.md) for the remaining features.

---


This is a simple, professional-looking experimental website hosted on GitHub Pages.

## Live website

- [Homepage](https://kacperklos96-byte.github.io/website/)
- [Log in](https://kacperklos96-byte.github.io/website/login.html)
- [Create account](https://kacperklos96-byte.github.io/website/signup.html)
- [Your account](https://kacperklos96-byte.github.io/website/account.html)

## Firebase setup

This project uses the Firebase project **website-d402e**.

- Firebase Authentication provides email/password and Google login.
- The logged-in user's private profile is stored in Cloud Firestore at `users/{uid}`.
- Theme preference is stored in a cookie.
- Private custom avatars are saved as small, resized image data in the user's Firestore document — **Google profile photos are not used**. This avoids requiring Cloud Storage/billing for this small experimental site.

### Important: Publish updated Firestore rules to activate picture uploads

The file [firestore.rules](firestore.rules) was changed to allow the optional `avatarData` field. **GitHub commits do not automatically publish Firestore rules.** To make **Change picture** and **Remove** work:

1. Open [Firestore Rules for website-d402e](https://console.firebase.google.com/project/website-d402e/firestore/databases/-default-/security/rules).
2. Open [firestore.rules](firestore.rules) from this repository and copy its complete contents.
3. Replace the existing Firebase rules and click **Publish**.
4. Refresh [Your account](https://kacperklos96-byte.github.io/website/account.html), click **Change picture**, and select a JPG, PNG, or WebP image. Your own picture should now be saved and used across the site.

**Don't change the rules to `allow read, write: if true`.** The existing rules keep user documents private.

### How avatar uploads work

- You can upload a JPG, PNG, or WebP image up to 5 MB.
- The browser center-crops and resizes the image to a tiny square, compresses it to less than 48 KB, and uploads that result to `users/{uid}.avatarData`.
- Your picture replaces the default generic avatar on the account page and navigation.
- **Remove** clears the stored avatar and restores the generic icon.
- Your Google profile picture is **never** used as the website avatar.
- Firestore rules restrict each user to their own private profile, validate the avatar format and size, and block unauthenticated access.
- No Cloud Storage bucket is needed for these small experimental avatars. For a larger website, use dedicated object storage and a separate thumbnail pipeline.

### Other Firebase setup (only if starting from scratch)

1. Register a Firebase Web app and place its public configuration in `firebase-config.js` (never upload private keys).
2. Enable **Email/Password** and **Google** providers in [Firebase Authentication](https://console.firebase.google.com/project/website-d402e/authentication/providers).
3. Add `kacperklos96-byte.github.io` as an authorized authentication domain.
4. Create the **(default)** Firestore database, and publish the rules in `firestore.rules`.

### Data layout

```text
users/{uid}
  uid          = Firebase Authentication user ID
  displayName  = display name
  email        = private email address
  photoURL     = legacy field; no longer used for avatars
  avatarData   = optional, private compressed image data
  createdAt    = Firestore timestamp
  updatedAt    = Firestore timestamp
```

Firebase Authentication stores credentials. Firestore does not store plaintext passwords. User records are private. Features like public profiles, direct messages and admin tools will need carefully scoped additional collections and security rules.

### Development / troubleshooting

- **Picture upload says access denied:** Publish the latest `firestore.rules` from GitHub in Firebase Console.
- **Profile picture doesn't update everywhere:** Reload the page. The navigation reads the saved avatar after authentication.
- **Login isn't working:** Check Firebase Authentication providers, authorized domain, and configuration.
- **Rules update:** The repository also has `firebase.json` for future Firebase CLI deployment.

Before launching publicly, implement privacy notices, account deletion, audit/recovery, security testing, and appropriate abuse protection.
