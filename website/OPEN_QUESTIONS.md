# Website & Documentation Architecture — Open Questions

**Project:** `bkash-server` & `bkash-client` Documentation & Marketing Site  
**Status:** Open for User Review (Phase A)  
**Date:** October 25, 2026  

---

### Question 1: Package Scaffolding vs. Documentation Site Sequencing
In the previous turn, Phase 0 (Audit) was completed with `docs/AUDIT.md`, and the npm packages (`bkash-server` and `bkash-client`) are scheduled for Phase 1 scaffolding.  
* **Current status in repo:** The repository currently houses `docs/DESIGN.md` and reference integration documentation.
* **Approach:** The documentation site will present the audited, verified API contracts (`createBkash()`, `useBkash()`, `<BkashCheckout/>`, Tokenized v2 endpoints) as specified in `docs/DESIGN.md`, with code snippets matching the upcoming zero-dependency core. Features planned for subsequent phases (Vue composables, Angular services, Dynamic Charging v1, Payouts) will be explicitly tagged as **"Coming Soon / Roadmap"**.  
* **Decision needed:** Does this approach meet your expectations for Phase A/B?

---

### Question 2: Brand Palette & Accent Selection
* **Hard Rule:** *"Do not use official bKash logos or trademarked brand assets. Use the project's own wordmark... Own palette with a single distinctive accent (do not clone bKash branding)."*
* **Selected Palette:** We have selected an **Electric Iris / Deep Indigo** fintech palette (`#4F46E5` in light mode, `#6366F1` in dark mode) paired with zinc/slate neutrals. This evokes Stripe and Vercel aesthetic quality while staying completely clear of bKash's signature pink/magenta (`#E2136E`).
* **Decision needed:** Do you approve the Electric Iris (`#6366F1`) accent, or do you prefer an alternative like Emerald Fintech (`#10B981`) or Cyan/Sky (`#0EA5E9`)?

---

### Question 3: TypeDoc Reference Integration Location
* **Requirement:** *"API reference: link to generated TypeDoc output, integrated into the site navigation."*
* **Architecture:** When TypeDoc builds, it produces static HTML files. Should the build script output them into `website/dist/api/` so that the site serves `/api/index.html` seamlessly under the same domain, or would you prefer an external standalone link to a GitHub pages sub-site?  
* **Recommendation:** Place TypeDoc output inside `website/dist/api/` with a shared header navigation bar injected into the TypeDoc HTML shell for consistent site UX.

---

### Question 4: Hosting Destination & Base Path
* **Options:**
  1. **GitHub Pages** (usually deployed at `https://<org>.github.io/<repo>/`, requiring a configurable base path like `/Bkash/` or `/bkash/`).
  2. **Cloudflare Pages / Vercel** (served from custom domain root `/`).
* **Approach:** We will make the site builder base-path aware via an environment variable (`BASE_URL` or `SITE_PREFIX`, defaulting to `.` or `/`).
* **Decision needed:** What is your intended production deployment target?

---

### Question 5: Roadmap Feature Tagging
* As established in `docs/AUDIT.md`, **Dynamic Charging v1** (aggregators/sub-merchants) and **Payouts/Disbursements** (B2C, B2B) are unverified in the live project and are scheduled for Phase 4.
* On the website, we will give these features dedicated concept pages and roadmap cards, but watermark them clearly with a **`Roadmap / Coming Soon`** pill badge and outline their expected contract.
* **Decision needed:** Confirm if this labelling strategy is approved.
