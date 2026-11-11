# My Website

A clean static site for GitHub Pages with login, create-account, and Google sign-in pages.

## Live pages
- Home: https://kacperklos96-byte.github.io/website/
- Login: https://kacperklos96-byte.github.io/website/login.html
- Create account: https://kacperklos96-byte.github.io/website/signup.html

## Make login work (Firebase required)
**IMPORTANT:** GitHub Pages only hosts static files. Login is not active until you complete the setup below. The forms are disabled until Firebase is configured, and no passwords are sent to this repository.

1. Visit https://console.firebase.google.com/ and create a Firebase project.
2. Under Project settings > Your apps, register a **Web** app (the `</>` icon). You don't need Firebase Hosting.
3. Copy the PUBLIC Firebase web app configuration values into `firebase-config.js`: `apiKey`, `authDomain`, `projectId`, and `appId`. Never upload an admin/service-account private key.
4. Go to **Authentication > Sign-in method**, enable **Email/Password** and **Google**, and save both.
5. Under **Authentication > Settings > Authorized domains**, add **kacperklos96-byte.github.io** (without https:// or /website).
6. Wait for the updated GitHub Pages build to publish and open the login page.

The Google button uses Firebase's popup sign-in flow. An account page displays the current user and lets them sign out. Email users can request a verification email. Passwords and identities are managed by Firebase, not saved in GitHub Pages files.

For a production website, also configure Firebase authentication security settings, rate limiting/abuse protection, your privacy policy, and any needed authorization rules for future protected data. A client-side account page alone is **not** authorization for protected resources.
