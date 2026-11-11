# My Website — Authentication, Firestore and custom avatars

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
