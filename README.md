# bKash Payment Gateway SDK (Monorepo)

[![CI Matrix](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml/badge.svg)](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Type-safe open-source TypeScript monorepo for integrating **bKash** payments into web applications, mobile apps, and serverless environments.

> **Disclaimer:** This is an unofficial community project and is **NOT** affiliated with, endorsed by, or sponsored by bKash Limited. "bKash" is a registered trademark of bKash Limited.

---

## Packages in this Monorepo

| Package                                   | Version         | Description                                                                                      | Readme                                                    |
| :---------------------------------------- | :-------------- | :----------------------------------------------------------------------------------------------- | :-------------------------------------------------------- |
| [`bkash-server`](./packages/bkash-server) | `0.1.0-alpha.1` | Fetch-based backend SDK with token mutex, order resolution guard, and Web-standard HTTP handler. | [Server Documentation](./packages/bkash-server/README.md) |
| [`bkash-client`](./packages/bkash-client) | `0.1.0-alpha.1` | Headless client SDK with bindings for React, React Native, Vue 3, Svelte, and Angular.           | [Client Documentation](./packages/bkash-client/README.md) |

---

## Design Principles & Architecture

1. **Headless-First (AUD-10):**
   In `0.1.x`, `bkash-client` is strictly **headless**. We provide state machines, hooks, and lifecycle management without opinionated CSS stylesheets, pre-packaged themes, or modal dialogs. Developers retain 100% control over their checkout UI and brand styling. Styled components and theme presets are planned for future releases.

2. **Server-Enforced Order Security:**
   Payment amount, currency, and invoice numbers must **NEVER** originate from untrusted client-side payloads. `bkash-server` mandates a server-side `resolveOrder(req, body)` callback that inspects session data or databases before initiating any transaction.

3. **Lockout Prevention:**
   bKash rate-limits token requests (reported as low as 2 grant-token calls per hour; confirm for your account). The server core implements proactive 50-minute rotation, single-flight in-memory deduplication, and atomic Redis locks to guarantee that multiple servers or worker processes never exhaust token quotas.

4. **Multi-Runtime Compatibility:**
   The core server entry (`bkash-server`) has zero Node.js built-in dependencies (`fs`, `crypto`, `http`). It is intended to run on Node.js >=18 and other fetch-based runtimes; only Node.js is exercised in CI today (Workers, Edge, Deno and Bun are NOT TESTED). Specialized Node features (such as AWS SNS X.509 RSA signature verification) reside in subpath imports (`bkash-server/webhook`).

---

## 10-Line Backend Quickstart (Express)

```typescript
import express from "express";
import { BkashServer } from "bkash-server";
import { createExpressHandler } from "bkash-server/frameworks";

const app = express();
const bkash = new BkashServer({
  apiVersion: "v1.2.0-beta", // Required: 'v1.2.0-beta' (stable) or 'v2' (experimental)
  appKey: process.env.BKASH_APP_KEY!,
  appSecret: process.env.BKASH_APP_SECRET!,
  username: process.env.BKASH_USERNAME!,
  password: process.env.BKASH_PASSWORD!,
  baseUrl: process.env.BKASH_BASE_URL!, // e.g. https://tokenized.sandbox.bka.sh
});

// Mount /create, /callback, and /status endpoints
app.use(
  "/api/bkash",
  createExpressHandler(bkash, {
    resolveOrder: async (req, body) => ({
      amount: 1550,
      currency: "BDT",
      invoiceNumber: "INV_1001",
    }),
  }),
);

app.listen(3000, () => console.log("Listening on port 3000"));
```

---

## Known Limitations for Alpha (AUD-04)

- **Android Hardware Back Button:**
  In `0.1.x-alpha`, `<BkashCheckout />` for React Native does not automatically hook into Android's native hardware `BackHandler`. If the user presses the device back button during a payment, applications must intercept the back action via React Navigation or custom back listeners to prompt confirmation before dismissal. Built-in Android `BackHandler` integration is scheduled for the Beta release.
- **Webhook Verifier Status:**
  `bkash-server/webhook` is marked **EXPERIMENTAL** pending live verification against production AWS SNS notification payloads delivered by bKash.
- **Roadmap Features:**
  Agreements (tokenized 1-click checkouts), pre-authorization Auth & Capture, and Payout disbursements are scheduled for Phase 7 and will fail loudly with `BkashFeatureNotSupportedError` if called in 0.1.x.

---

## Repository Scripts

```bash
# Install workspace dependencies
pnpm install

# Run entire test suite across monorepo
pnpm test

# Build all packages (ESM + CJS + DTS)
pnpm build

# Typecheck workspace
pnpm typecheck
```

---

## License

MIT © [Antigravity Open Source & Contributors](https://github.com/iamtashanto/Bkash)
