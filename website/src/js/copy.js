/**
 * Copy to Clipboard Helper
 */

export function initCopyButtons() {
  document.querySelectorAll("[data-copy-target]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-copy-target");
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const text = targetEl.innerText || targetEl.textContent;

      try {
        await navigator.clipboard.writeText(text.trim());
        const originalText = btn.innerHTML;
        btn.innerHTML = `
          <svg class="w-4 h-4 text-emerald-500 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-emerald-500 text-xs font-semibold">Copied!</span>
        `;
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 2000);
      } catch (err) {
        console.error("Failed to copy code snippet", err);
      }
    });
  });
}
