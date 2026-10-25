# Documentation & Marketing Website Plan (`website/PLAN.md`)

**Role:** Senior Front-End Engineer & Designer  
**Scope:** Open-source website for `bkash-server` and `bkash-client`  
**Location:** `/website`  
**Stack:** Plain HTML + Tailwind CSS (v3/v4 stable via Tailwind CLI, no CDN script) + Vanilla JavaScript (ES modules)  
**Status:** Phase A Plan — STOPPING FOR APPROVAL  

---

## 1. Executive Vision & Aesthetics

The goal is to deliver a **Stripe / Vercel-grade developer experience** for the bKash open-source ecosystem. bKash payment integrations in Bangladesh are notorious for brittle implementations, lack of official TypeScript types, unhandled rate limits (the 2 calls/hr v2 token grant trap), and missing amount verification.

This website serves two distinct audiences:
1. **The Fast-Paced Engineer:** Needs an Express, Next.js, or React Native checkout running in under 10 lines of code with zero-config defaults.
2. **The Senior Fintech Architect:** Demands full visibility into state machines, token rotation mutexes, idempotency guards, AWS SNS RSA signature verifications, and audit trails.

### Brand Identity & Compliance (Hard Rules)
* **Custom Wordmark:** A sleek modern monogram & wordmark for `bkash-server` and `bkash-client` (geometric shields and currency node).
* **Trademark Compliance:** **Zero official bKash logos or brand assets.** No pink/magenta cloning (`#E2136E`).
* **Disclaimer:** Prominent notice on both home hero and global footer:  
  > *"Unofficial, community-developed open-source SDK. Not affiliated with, endorsed by, or sponsored by bKash Limited."*
* **Security & Credential Plain Language:** The bKash-hosted page handles wallet numbers, OTPs, and PINs. Our SDK never sees or stores customer credentials. What *is* customizable is the surrounding orchestration, buttons, loaders, error recovery, saved wallet pickers, and callbacks.

---

## 2. Complete Sitemap & Route Architecture

```
/website/
├── / (Home — Marketing + Quickstart)
├── /docs/ (Full Developer Documentation)
│   ├── index.html (Getting Started)
│   ├── core-concepts.html (State Machine & "Session Created" vs "Paid")
│   ├── server-guide.html (createBkash(), Zero-Config & Subpath Adapters)
│   ├── client-guide.html (React useBkash, React Native <BkashCheckout/>)
│   ├── customization.html (Headless -> Slots -> Themed Tokens)
│   ├── agreements.html (Tokenized Saved Wallets & 1-Click Pay)
│   ├── auth-capture.html (Pre-auth, Capture, Void)
│   ├── refunds.html (Full & Partial Refunds, Status)
│   ├── webhooks.html (AWS SNS IPN, Handshake & RSA Signatures)
│   ├── dynamic-charging.html (Aggregator Fees — Roadmap)
│   ├── payouts.html (Disbursements B2C/B2B — Roadmap)
│   ├── testing.html (Mock Simulator, Fixtures, Contract Tests)
│   ├── security.html (Amount Verification & Security Checklist)
│   ├── error-reference.html (Numeric Taxonomy 2001–2119 & Mappings)
│   ├── production-checklist.html (Go-Live Migration & Audit)
│   ├── faq.html (Common Questions & Gotchas)
│   └── migration.html (Migrating from legacy / community packages)
├── /playground/ (Interactive Client-Side Checkout Simulator)
├── /examples/ (Runnable Repository Demos & Framework Cards)
├── /api/ (TypeDoc Static HTML Reference Integration)
└── /changelog/ (Release Notes & GitHub Releases Log)
```

---

## 3. Content Outline Mapped to Real Source Files

In strict compliance with the **Source of Truth** rule, all content maps directly to audited reality. Any planned feature not yet implemented in code is watermarked as **`[Coming Soon / Roadmap]`**.

| Page / Section | Source of Truth in Repository | Implementation Status | Content Outline |
| :--- | :--- | :--- | :--- |
| **Home (Hero & Quickstart)** | `docs/AUDIT.md` (Sections 1 & 2), `LifeLineit/backend/utils/bkash.js` | **Ready** | One-line value prop: *"Type-safe, production-hardened bKash SDK for server and client."* 10-line quickstart tabs for Express, Next.js App Router, React, and React Native. Inline SVG payment flow diagram. Feature cards. |
| **Getting Started** | `docs/AUDIT.md` (Section 3), `packages/bkash-server` architecture | **Ready** | Node >= 18 requirements, installation commands (`pnpm add bkash-server bkash-client`), environment variables (`BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_BASE_URL`). |
| **Core Concepts** | `docs/AUDIT.md` (Section 2.2), `LifeLineit` payment controller | **Ready** | Why "session created" $\neq$ "paid". Payment lifecycle states: `idle` $\rightarrow$ `creating` $\rightarrow$ `awaiting_user` $\rightarrow$ `verifying` $\rightarrow$ `success` / `failed` / `cancelled` / `pending`. Explain the 30s timeout race and the mandatory auto-query fallback. |
| **Server Guide** | `docs/AUDIT.md` (Section 4), `packages/bkash-server` specification | **Ready** | `createBkash(config)` API: zero-config env, typed options, hooks (`beforeRequest`, `afterResponse`, `onTokenRefresh`), pluggable token store (`MemoryTokenStore`, `RedisTokenStore`), single-flight mutex for the 2 calls/hr v2 limit, and subpath adapters (`/express`, `/next`, `/hono`, `/fastify`). |
| **Client Guide** | `docs/AUDIT.md` (Section 5), `LifeLineit/public/components/pages/checkout` | **Ready** | Headless core state machine; React hook `useBkash()`; React Native `<BkashCheckout/>` with WebView URL interception, In-App-Browser fallback, and hardware back-button handler. (Vue and Angular labeled as **`[Coming Soon]`**). |
| **Customization & Theming** | `LifeLineit/public/components/pages/checkout` UI tokens | **Ready** | Headless logic $\rightarrow$ unstyled slots $\rightarrow$ themed tokens. Full CSS variable design tokens. Light/dark themes. Bangla/English i18n font setup (`Hind Siliguri`). |
| **Agreements & Saved Wallets** | `docs/AUDIT.md` (Section 2.3), official v2 specs (`create-agreement-1.md`) | **Ready** | Modes `0000` (Agreement only) and `0001` (Agreement + Charge). `agreementId` lifecycle, 1-click checkout with PIN-only entry, cancellation. |
| **Auth & Capture** | `docs/AUDIT.md` (Section 2.2), official v2 specs (`capture-payment`, `void-payment`) | **Ready** | Authorizing funds prior to fulfillment (`intent: "authorization"`), one-time capture guarantee, auto-void window (3–5 days). |
| **Refunds & Status** | `docs/AUDIT.md` (Section 3), official v2 specs (`refund.md`, `refund-status.md`) | **Ready** | Up to 10 partial refunds per transaction within 60 days. Reversing completed payments, coupon-discounted maximum refundable amount calculation. |
| **Webhooks / IPN** | `docs/AUDIT.md` (Section 2.4 & 6.5), official v2 specs (`instant-payment-notification.md`) | **Ready** | True AWS SNS notification handling. Initial `SubscriptionConfirmation` GET handshake to `SubscribeURL`. RSA signature verification using downloaded X.509 cert from `https://sns.*.amazonaws.com`. Handling `Message` JSON. |
| **Dynamic Charging** | Official bKash Sandbox demo references | **[Coming Soon / Roadmap]** | Aggregator sub-merchant fees, fixed/percentage/slab charges, customer vs merchant fee-bearing modes. Clear badge: *Available in Phase 4*. |
| **Payouts & Disbursements** | Official bKash Sandbox demo references | **[Coming Soon / Roadmap]** | B2C, B2B, B2A salary and vendor disbursements. Clear badge: *Available in Phase 4*. |
| **Testing & Mock Simulator** | `Payment-Gateway-Integration/backend/services/bkash.service.js` simulation patterns | **Ready** | Built-in local mock bKash simulator for CI and unit tests without hitting sandbox or burning real rate limits. Contract tests and sanitized fixtures. |
| **Security Checklist** | `docs/AUDIT.md` (Section 6: Vulnerabilities 1–5) | **Ready** | Mandatory amount and invoice verification, log redaction of secrets and MSISDNs, pre-commit gitleaks, AWS SNS URL validation regex. |
| **Error Reference** | `docs/AUDIT.md` (Section 6 & bKash error tables `2001`–`2119`) | **Ready** | Complete lookup table mapping raw bKash integer codes (e.g. `2062` $\rightarrow$ `PaymentAlreadyCompletedError`, `2023` $\rightarrow$ `InsufficientBalanceError`) to user-friendly Bangla/English messages. |
| **Production Go-Live Checklist**| `docs/AUDIT.md` (Section 3 & 4) | **Ready** | Switching base URL to `tokenized.pay.bka.sh`, ensuring production SSL callbacks, Redis token caching configuration, IP whitelist requirements. |
| **FAQ & Migration** | Community comparison (`bkash-payment-gateway`, `react-bkash`) | **Ready** | Comparison matrix highlighting token caching, TypeScript strictness, zero dependencies, and edge compatibility. |

---

## 4. Design System & Tokens (Fintech Developer Aesthetic)

The design achieves a **clean, trustworthy fintech aesthetic** inspired by Stripe, Resend, and Vercel documentation.

### 4.1. Color Tokens (Electric Iris & Neutral Slate)
We avoid bKash pink to ensure zero trademark confusion and establish an authentic developer-tool identity.

* **Primary Accent (Electric Iris):**
  * Light mode: `accent-600` (`#4F46E5`) — accessible contrast on white.
  * Dark mode: `accent-500` (`#6366F1`) — luminous on dark surfaces.
  * Hover / Focus: `accent-700` (`#4338CA`) / `accent-400` (`#818CF8`).
  * Glow / Focus Ring: `rgba(99, 102, 241, 0.25)`.
* **Neutrals (Slate / Zinc):**
  * *Light Theme:* Surface `bg-slate-50` (`#F8FAFC`), Content Surface `bg-white` (`#FFFFFF`), Border `border-slate-200` (`#E2E8F0`), Headings `text-slate-900` (`#0F172A`), Body `text-slate-600` (`#475569`).
  * *Dark Theme:* Surface `bg-[#0B0F19]`, Content Surface `bg-[#111827]`, Border `border-slate-800` (`#1E293B`), Headings `text-slate-100` (`#F1F5F9`), Body `text-slate-400` (`#94A3B8`).
* **Semantic Accents:**
  * Success (Emerald): `#10B981` (for `Completed` status and copy success).
  * Warning (Amber): `#F59E0B` (for token limits and pending states).
  * Danger (Rose): `#F43F5E` (for failure states and security alerts).

### 4.2. Typography & Multilingual Stack
* **English Typography:** Inter (self-hosted variable font) + system sans-serif fallback (`system-ui, -apple-system, sans-serif`).
* **Bangla Typography:** `'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif`. Bangla requires increased line-height (`leading-relaxed` / `leading-loose`) to prevent diacritic/hasant vowel clipping.
* **Code / Monospace:** `'JetBrains Mono', 'Fira Code', ui-monospace, monospace` with balanced line-height.

### 4.3. Spacing & Elevation
* Grid-aligned 4px/8px rhythm.
* Subtle glassmorphism (`backdrop-blur-md bg-white/80 dark:bg-slate-900/80`) on sticky headers and modals.
* Elevation: Fine 1px borders (`border border-slate-200/80 dark:border-slate-800/80`) paired with diffused shadows (`shadow-sm` to `shadow-xl`).
* Motion: Smooth transitions (`150ms ease-out`), with complete suppression under `@media (prefers-reduced-motion: reduce)`.

---

## 5. UI Component Specifications

1. **Header / Navigation (`Navbar`)**:
   * Brand wordmark (shield glyph + `bkash-sdk` typography).
   * Navigation links: Docs, Playground, Examples, API, GitHub (with live release badge).
   * Global Search Bar trigger (`⌘K` / `/`).
   * Bangla / English language switcher (`BN` / `EN`).
   * Light / Dark mode toggle (persists to `localStorage`, applies `.dark` to `<html>`, zero flash of unstyled content).
2. **Docs Sidebar (`Sidebar`)**:
   * Sticky left sidebar with categorized navigation groups.
   * Visual indicator for active page and sub-links.
   * `Roadmap` / `Coming Soon` badge indicators on relevant items.
3. **On-Page Table of Contents (`ScrollspyTOC`)**:
   * Sticky right sidebar on large screens, highlighting current reading section using `IntersectionObserver`.
4. **Code Block with Package Manager Tabs (`CodeBlock`)**:
   * Build-time pre-rendered syntax highlighting.
   * Package manager tabs: `pnpm`, `npm`, `yarn`, `bun`. Selection is stored in `localStorage` and synchronizes across all tabs on the page.
   * 1-click Copy button with visual feedback (`Copied!` tooltip + checkmark icon).
   * Filename header badge (e.g. `server.ts`, `checkout.tsx`).
5. **Framework Tabs (`FrameworkTabs`)**:
   * Tabbed interface on Home and Guides (Express, Next.js, React, React Native, Vue, Angular).
6. **Search Modal (`SearchModal`)**:
   * Accessible dialog (`role="dialog"` with focus trap).
   * Lightweight in-memory fuzzy search over pre-built `search-index.json`.
   * Displays title, section breadcrumbs, and matched text snippets.
   * Full keyboard navigation (Arrow keys, Enter, Esc).
7. **Playground Simulator (`Playground`)**:
   * Pure client-side interactive payment simulator.
   * Visual simulated checkout widget:
     * Toggle amounts and invoice number.
     * Toggle Theme Tokens (Accent color picker, border radius slider, dark/light toggle).
     * Toggle Language (English / Bangla).
     * Simulate status outcomes: `Success`, `Failed (2023 Insufficient Balance)`, `Cancelled (User Abandoned)`, `Pending (Execute Timeout)`.
   * Live generated code preview dynamically updating as controls are toggled.
8. **Callouts & Alerts (`Callout`)**:
   * Clean GitHub-style alerts: `Note`, `Tip`, `Important`, `Security`, `Caution`.

---

## 6. Engineering & Build Architecture

### Folder Structure
```
website/
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── scripts/
│   ├── build.js            # Node static generator (partials, TOC, search index, syntax)
│   ├── build-search.js     # Extracts headings & text into dist/search-index.json
│   ├── highlight.js        # Build-time syntax highlighting for code fences
│   └── generate-sitemap.js # Generates dist/sitemap.xml and dist/robots.txt
├── src/
│   ├── assets/
│   │   ├── fonts/          # Self-hosted Inter & Hind Siliguri
│   │   └── images/         # Optimized WebP/SVG diagrams and social cards
│   ├── css/
│   │   └── input.css       # Tailwind entry point with design tokens & custom utilities
│   ├── js/
│   │   ├── main.js         # Shell bootstrap
│   │   ├── theme.js        # Zero-FOUC theme toggle
│   │   ├── tabs.js         # Synchronized package manager & framework tabs
│   │   ├── copy.js         # Clipboard utility
│   │   ├── search.js       # Search modal controller
│   │   ├── toc.js          # IntersectionObserver scrollspy
│   │   ├── i18n.js         # Bangla / English toggle engine
│   │   └── playground.js   # Interactive checkout simulator
│   ├── partials/
│   │   ├── head.html       # Meta tags, preloads, favicon, theme script
│   │   ├── navbar.html     # Brand, links, search trigger, toggles
│   │   ├── footer.html     # Disclaimer, sitemap links, license
│   │   └── sidebar.html    # Documentation navigation tree
│   └── pages/              # HTML source pages with {{partial}} placeholders
│       ├── index.html      # Home
│       ├── playground.html # Playground simulator
│       ├── examples.html   # Examples cards
│       ├── changelog.html  # Releases log
│       └── docs/           # 16 detailed documentation pages
└── dist/                   # Production-ready static output (deployable anywhere)
```

### Build Pipeline
1. **Tailwind CLI**: Compiles `src/css/input.css` $\rightarrow$ `dist/css/styles.css` with minification in production.
2. **Static Site Generator (`scripts/build.js`)**:
   - Injects shared partials (`navbar.html`, `footer.html`, `sidebar.html`, `head.html`).
   - Parses code blocks and applies syntax highlighting at build time (clean HTML, zero client runtime parser).
   - Extracts page titles, headings, and keywords to compile `dist/search-index.json` (< 25 KB).
   - Generates `dist/sitemap.xml` and `dist/robots.txt`.
3. **Asset Fingerprinting & Base-Path Awareness**:
   - Configurable `SITE_BASE_URL` allows running on custom root `/` or sub-path (e.g. GitHub Pages `/Bkash/`).
4. **Performance Targets**:
   - **Lighthouse Score:** $\ge 95$ across Performance, Accessibility, Best Practices, SEO.
   - **LCP:** $< 1.5\text{s}$ on mid-range devices.
   - **Zero Client JS Framework:** Pure vanilla ES modules. Total content-page JS $< 25\text{ KB}$ gzipped.

---

## 7. Quality, SEO, Accessibility & CI

* **SEO & Social Sharing**:
  * Semantic HTML5 (`<main>`, `<nav>`, `<article>`, `<aside>`, `<header>`, `<footer>`).
  * Unique `<title>` and `<meta name="description">` per page.
  * Canonical `<link rel="canonical">` on every route.
  * Open Graph and Twitter Card tags.
  * `JSON-LD` structured data schema (`SoftwareApplication` / `TechArticle`).
* **Accessibility (WCAG 2.2 AA)**:
  * Skip to content link (`#content`).
  * Full keyboard accessibility: tab order, focus rings (`focus-visible:ring-2 focus-visible:ring-indigo-500`), modal `Esc` close and focus trap.
  * Contrast ratio $\ge 4.5:1$ for normal text, $\ge 3:1$ for large text and UI borders across both light and dark themes.
  * Screen-reader text (`sr-only`) on icon-only buttons.
* **CI Validation Pipeline**:
  * HTML validation check (`html-validate`).
  * Broken internal link checker.
  * Prettier code format check.
  * Lighthouse CI runner enforcing $\ge 95$ score gate.

---

## 8. Summary of Open Questions (from `website/OPEN_QUESTIONS.md`)

Before proceeding to **Phase B (Design System + Shell + Home Page)**, the following key items are submitted for your decision:
1. **Scaffolding Sequencing:** The website will present the audited API contracts (`createBkash`, `useBkash`, Tokenized v2) with planned extensions (Vue/Angular/Dynamic Charging/Payouts) clearly badged as **`[Coming Soon / Roadmap]`**.
2. **Brand Palette:** Confirm approval of **Electric Iris / Deep Indigo** (`#4F46E5` / `#6366F1`) as the primary accent, avoiding any confusion with bKash pink.
3. **TypeDoc Location:** Confirm embedding generated TypeDoc under `website/dist/api/` with unified site navigation.
4. **Hosting Destination:** Confirm preferred target (GitHub Pages or Cloudflare Pages) for base-path configuration.

---

*Plan submitted. Awaiting user approval to start Phase B (Design system, build engine, and Home page).*
