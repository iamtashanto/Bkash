/**
 * Website Main Entry Point (Vanilla ES Module)
 */

import { initTheme } from "./theme.js";
import { initI18n } from "./i18n.js";
import { initTabs } from "./tabs.js";
import { initCopyButtons } from "./copy.js";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initI18n();
  initTabs();
  initCopyButtons();
});
