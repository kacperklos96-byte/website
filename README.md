# My Website — Firebase Auth + Cloud Firestore

A clean experimental website (GitHub Pages) with solid-blue buttons, a cookie-saved light/dark theme, login, account creation, Google sign-in, and private user profiles.

## Current status

The **website code is ready**, but **no real database is activated yet**. GitHub Pages hosts only static files, and the repository's `firebase-config.js` currently contains placeholders. You must create a Firebase project and publish its Firestore rules before user accounts can be stored. Do not use real credentials in the demo forms before the project is configured.

## Set up the live database and authentication

1. Go to [Firebase Console](https://console.firebase.google.com/), sign in, and create a project (or select one you've already created).
2. Open **Project settings > Your apps**, click the Web `</>` icon, and register a web app. You do not need Firebase Hosting because you're using GitHub Pages.
3. Copy the Firebase **public web app config** into `firebase-config.js`: `apiKey`, `authDomain`, `projectId`, `appId`. These values are meant to be used in the browser; **never** paste service-account keys, private keys, Firebase Admin credentials, or passwords into this public GitHub repo.
4. Go to **Build > Authentication > Sign-in method**. Enable **Email/Password** and **Google** (Google may ask for a support email), then save.
5. Under **Authentication > Settings > Authorized domains**, add `kacperklos96-byte.github.io` (without `https://` or `/website`).
6. Go to **Build > Firestore Database > Create database**. Create the **(default)** database in a suitable region. Choose **production mode** if asked; we will publish specific restrictive rules next.
7. In **Firestore Database > Rules**, replace the starter rules with the complete contents of [`firestore.rules`](firestore.rules) from this repository. Click **Publish**. The rules **must** be published in the Firebase project; simply committing the rules file to GitHub does not activate them.
8. Open the published website and register a test account. Go to **Firestore Database > Data > users**: a document with that Firebase Auth user's **UID** should now appear. Check a Google login too. Sign-in with an existing Firebase Auth account also creates a missing profile document.

**Site URLs**

- Home: https://kacperklos96-byte.github.io/website/
- Login: https://kacperklos96-byte.github.io/website/login.html
- Create account: https://kacperklos96-byte.github.io/website/signup.html
- Account: https://kacperklos96-byte.github.io/website/account.html

GitHub Pages may need a few minutes to publish updates to `main`.

## What is stored

**Firebase Authentication** handles passwords, accounts, provider identities, and login sessions.

**Cloud Firestore** stores one private app-profile document at `users/{uid}`:

```text
users/
  <Firebase Authentication UID>/
    uid          = same as document ID
    displayName  = user's name
    email        = account email (private)
    photoURL     = Google profile photo URL, if any
    createdAt    = Firestore server timestamp
    updatedAt    = Firestore server timestamp
```

- The user document is created the first time an authenticated user signs in if it doesn't exist. Existing documents keep their original `createdAt` time.
- The account page shows the stored name, email, creation date, and database connection status.
- **No plaintext passwords** or Google access tokens are stored in Firestore or your GitHub repository.
- The `firestore.rules` policy permits each signed-in account to **read only its own user document**. Public user listings, edits to UID/email/createdAt, all other collections, and client-controlled admin roles are denied. The client cannot delete a user document.
- Future public profiles, messaging, dashboard data, notifications, or admin functionality require separate collections and carefully designed security rules and/or a privileged backend. Don't simply make the `users` collection public.

## Optional: publish Firestore rules from the CLI

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

The CLI will need to be associated with your Firebase project; `firebase.json` points to the rule file. The Firebase Console rule editor is easier for the first deployment.

## Troubleshooting

- **Buttons disabled / setup message:** Edit `firebase-config.js` with your own public Firebase web config.
- **Missing or insufficient permissions:** Publish `firestore.rules` in **Firestore Database > Rules**, and make sure you're logged in as the document owner.
- **Firestore database not found:** Create the default Firestore database in your Firebase project.
- **Google login unauthorized domain:** Add `kacperklos96-byte.github.io` under Authentication authorized domains.
- **Account exists but no Firestore document:** Authentication and Cloud Firestore are separate. Open the account page after setting up Firestore; the page attempts to create the missing private profile safely.
- **Profile failed to save:** The account page shows a database warning instead of claiming the profile was stored.

For a real public launch, review privacy notices, consent for any non-essential trackers, account deletion/export flows, abuse protection, and Firebase billing usage and security settings.
