# Release Readiness Checklist

**Target Release:** `0.1.0-alpha.1` (Dist-Tag: `alpha`)  
**Package:** `bkash-server`, `bkash-client`  
**License:** MIT  
**Current Status:** **AUTOMATED CHECKS ONLY (NOT READY FOR RELEASE)**

---

## 1. Automated Verification Matrix

| Verification Item | Tested Environments | Status | Evidence Location |
| :--- | :--- | :---: | :--- |
| **Packaging Lint** | `publint` (all exports) | **PASSED** | Clean check in `docs/internal/EVIDENCE.md` |
| **Type Integrity (attw)** | Node10, Node16 (CJS/ESM), Bundler | **PASSED** | 100% 🟢 table in `docs/internal/EVIDENCE.md` |
| **Edge / Node-Free Root** | No `@types/node`, `skipLibCheck: false` | **PASSED** | Output in `docs/internal/EVIDENCE.md` |
| **Package Managers** | npm, pnpm, Yarn Classic, Yarn Berry (NM & PnP), Bun | **PASSED** | Clean install/import outputs in `docs/internal/EVIDENCE.md` |
| **Runtimes (Local)** | Node.js v24 (macOS), Bun v1.3, Deno v2.9 | **PASSED** | Execution outputs in `docs/internal/EVIDENCE.md` |
| **Runtimes (CI Matrix)** | Node.js 18, 20, 22 on Ubuntu | **CONFIGURED** | Added to `.github/workflows/ci.yml` |
| **Real Redis Integration** | Distributed token lock, crash recovery, concurrent execution | **PASSED** | `test/integration/real-redis.test.ts` (localhost:6379) |
| **Cryptographic Webhook** | Real RSA-SHA256 & RSA-SHA1 signatures with X.509 cert | **PASSED** | `test/unit/webhook-crypto.test.ts` |
| **Secret Scan (Gitleaks)** | Git history and working tree | **PASSED** | 0 leaks found across 1.91 MB |

---

## 2. Gating Items & Open Prerequisites (DO NOT RELEASE UNTIL RESOLVED)

| Item | Scope | Status | Notes / Blocker Description |
| :--- | :--- | :---: | :--- |
| **Pre-Release Audit Fixes** | Monorepo Core | **OPEN ❌** | Must fix 3 Blockers (sessionStore default, React Native `<div>`, status.json roadmap claims) from `docs/internal/PRE_RELEASE_AUDIT.md`. |
| **Sandbox E2E Run** | Live Gateway | **OPEN ❌** | Must be executed by human owner using live bKash Merchant Sandbox credentials (v1.2.0-beta). |
| **Physical Device UX** | Mobile Client | **OPEN ❌** | Must be tested on physical iOS and Android devices for hardware back, orientation, keyboard, and in-app browser cancellation. |
| **Cloudflare workerd / Edge** | Edge Handlers | **OPEN ❌** | Not yet executed in miniflare/wrangler environment; currently verified via Web standard `handle` tests only. |
| **Example Apps CI** | Frameworks | **OPEN ❌** | Standalone apps for 10 frameworks (Express, Fastify, Hono, Next.js, SvelteKit, Remix, Astro, Nuxt, NestJS) to be built in separate CI jobs. |
| **Bangla Copy Review** | i18n | **OPEN ❌** | Needs native-speaker review for all currency formatting, numerals, and translation strings before claims are published. |
| **External Security Audit** | Threat Model | **OPEN ❌** | Internal audit complete; external pen-test / security review pending. |
| **Shadow-Mode Dogfooding** | Production | **OPEN ❌** | Rollout in existing production project under shadow mode (logging mismatches without processing real funds). |

---

## 3. Decision

* **Automated Quality Checks:** **PASSED (WITH EVIDENCE)**
* **Release Approval:** **NO-GO (BLOCKED ON TIER 1 AUDIT FIXES & OWNER SANDBOX E2E)**
