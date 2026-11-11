// Consistent account avatar for navigation and profile pages.
// Prefer a real provider photo when available; otherwise use a neutral icon.
const silhouette = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.1" r="3.35"/><path d="M5.4 19.1c.5-3.3 3-5.3 6.6-5.3s6.1 2 6.6 5.3"/></svg>';

export function renderAvatar(element, user) {
  if (!element) return;
  element.replaceChildren();
  const photoURL = user?.photoURL;
  if (typeof photoURL === "string" && photoURL.startsWith("https://")) {
    const picture = document.createElement("img");
    picture.src = photoURL;
    picture.alt = "";
    picture.referrerPolicy = "no-referrer";
    picture.decoding = "async";
    picture.addEventListener("error", () => {
      picture.remove();
      element.innerHTML = silhouette;
    }, { once: true });
    element.appendChild(picture);
  } else {
    // Only our constant SVG is injected, never arbitrary account text.
    element.innerHTML = silhouette;
  }
}
