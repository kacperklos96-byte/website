// Load this script in <head> before styles.css to prevent the wrong theme flashing.
(() => {
  const cookieName = "website_theme";
  const cookiePath = new URL("./", window.location.href).pathname;
  const saved = document.cookie.split("; ").find((c) => c.startsWith(cookieName + "="));
  const selected = saved?.slice(cookieName.length + 1) === "dark" ? "dark" : "light";

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#222428" : "#f3f3f1";
    const toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.checked = theme === "dark";
  }

  applyTheme(selected);

  function saveTheme(theme) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = cookieName + "=" + theme
      + "; Path=" + cookiePath
      + "; Max-Age=31536000; SameSite=Lax" + secure;
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(document.documentElement.dataset.theme);
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    toggle.addEventListener("change", () => {
      const theme = toggle.checked ? "dark" : "light";
      applyTheme(theme);
      saveTheme(theme);
    });
  });
})();
