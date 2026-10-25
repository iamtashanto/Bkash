/**
 * Synchronized Tab Management (Package Managers & Frameworks)
 */

export function initTabs() {
  // Package Manager Tabs
  const pmButtons = document.querySelectorAll("[data-pm-tab]");
  const preferredPm = localStorage.getItem("preferred_pm") || "pnpm";

  function activatePm(pm) {
    localStorage.setItem("preferred_pm", pm);

    document.querySelectorAll("[data-pm-tab]").forEach((btn) => {
      const match = btn.getAttribute("data-pm-tab") === pm;
      btn.setAttribute("aria-selected", match ? "true" : "false");
      btn.classList.toggle("text-accent-primary", match);
      btn.classList.toggle("border-b-2", match);
      btn.classList.toggle("border-accent-primary", match);
      btn.classList.toggle("text-txt-muted", !match);
    });

    document.querySelectorAll("[data-pm-panel]").forEach((panel) => {
      const match = panel.getAttribute("data-pm-panel") === pm;
      panel.classList.toggle("hidden", !match);
    });
  }

  pmButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activatePm(btn.getAttribute("data-pm-tab"));
    });
  });

  activatePm(preferredPm);

  // Framework Quickstart Tabs
  const frameworkButtons = document.querySelectorAll("[data-framework-tab]");

  function activateFramework(fw) {
    frameworkButtons.forEach((btn) => {
      const match = btn.getAttribute("data-framework-tab") === fw;
      btn.setAttribute("aria-selected", match ? "true" : "false");
      btn.classList.toggle("bg-accent-subtle", match);
      btn.classList.toggle("text-accent-primary", match);
      btn.classList.toggle("font-semibold", match);
      btn.classList.toggle("text-txt-secondary", !match);
    });

    document.querySelectorAll("[data-framework-panel]").forEach((panel) => {
      const match = panel.getAttribute("data-framework-panel") === fw;
      panel.classList.toggle("hidden", !match);
    });
  }

  frameworkButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activateFramework(btn.getAttribute("data-framework-tab"));
    });
  });

  if (frameworkButtons.length > 0) {
    activateFramework("express");
  }
}
