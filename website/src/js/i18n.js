/**
 * Internationalization (i18n) — English & Bangla Toggle
 */

export function initI18n() {
  const toggleBtn = document.getElementById("lang-toggle-btn");
  const savedLang = localStorage.getItem("site_lang") || "en";

  applyLanguage(savedLang);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("lang") || "en";
      const next = current === "en" ? "bn" : "en";
      localStorage.setItem("site_lang", next);
      applyLanguage(next);
    });
  }
}

export function applyLanguage(lang) {
  document.documentElement.setAttribute("lang", lang);

  const langLabel = document.getElementById("lang-label");
  if (langLabel) {
    langLabel.textContent = lang === "en" ? "BN" : "EN";
  }

  // Update elements with data-en and data-bn attributes
  const translatable = document.querySelectorAll("[data-en][data-bn]");
  translatable.forEach((el) => {
    const text = el.getAttribute(`data-${lang}`);
    if (text) {
      el.textContent = text;
    }
  });
}
