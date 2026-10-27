# bkash-server

[![CI](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml/badge.svg)](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/bkash-server.svg?color=indigo)](https://www.npmjs.com/package/bkash-server)

Type-safe bKash payment gateway SDK for Node.js and other fetch-based JavaScript runtimes (alpha).

> **Disclaimer:** This is an open-source, community-maintained SDK and is **NOT** officially affiliated with, endorsed by, or sponsored by bKash Limited. "bKash" is a registered trademark of bKash Limited.

---

## Features

- **Fetch-based core:** uses `fetch` and Web Crypto with no Node built-ins in the root entry. Tested on Node.js (>=18); Cloudflare Workers, Vercel Edge, Deno and Bun are NOT TESTED.
- **Fail-Safe Token Management:** Proactive 50-minute rotation, single-flight Promise deduplication, and distributed Redis lease to prevent the catastrophic **2 calls / hour** credential lockout.
- **Auto-Reconciliation Engine:** Native recovery on bKash Error `2062` ("payment already completed") and network timeouts (>30s) via background status queries.
- **Strict Financial Guard:** Mandatory runtime verification of `amount`, `currency === "BDT"`, and `invoiceNumber` on every transaction execution.
- **Web-Standard Handler:** Framework-agnostic `handle(request: Request): Promise<Response>` with plug-and-play adapters for Express, Fastify, Hono, Next.js, Koa, SvelteKit, Remix, and Astro.
- **AWS SNS Webhook Verifier:** Cryptographic X.509 RSA signature verification with URL host constraints, cert caching, and replay protection.
- **PII & Secrets Sanitization:** Automatic phone number masking (`017****5678`) and credential redaction from debug logs.

---

## Installation

```bash
# npm
npm install bkash-server

# pnpm
pnpm add bkash-server

# bun
bun add bkash-server
```

---

## 10-Line Quickstart (Express / Node.js)

```typescript
import express from 'express';
import { BkashServer } from 'bkash-server';
import { createExpressHandler } from 'bkash-server/frameworks';

const app = express();
const bkash = new BkashServer({
  apiVersion: 'v1.2.0-beta', // Required in 0.x: 'v1.2.0-beta' (stable) or 'v2' (experimental)
  appKey: process.env.BKASH_APP_KEY!,
  appSecret: process.env.BKASH_APP_SECRET!,
  username: process.env.BKASH_USERNAME!,
  password: process.env.BKASH_PASSWORD!,
  baseUrl: process.env.BKASH_BASE_URL!, // e.g. https://tokenized.sandbox.bka.sh
});

// Mount Web-standard payment endpoints (/create, /callback, /status, /webhook)
// Secure order resolution: amount/invoice must ALWAYS be resolved server-side
app.use(
  '/api/bkash',
  createExpressHandler(bkash, {
    resolveOrder: async (req, body) => ({
      amount: 1550,
      currency: 'BDT',
      invoiceNumber: 'INV_1001',
    }),
  })
);
app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## Web-Standard Usage (Next.js App Router / Cloudflare Workers / Hono)

```typescript
// app/api/bkash/[...route]/route.ts (Next.js App Router)
import { BkashServer } from 'bkash-server';
import { createNextHandler } from 'bkash-server/frameworks';

const bkash = new BkashServer({
  apiVersion: 'v1.2.0-beta',
  appKey: process.env.BKASH_APP_KEY!,
  appSecret: process.env.BKASH_APP_SECRET!,
  username: process.env.BKASH_USERNAME!,
  password: process.env.BKASH_PASSWORD!,
  baseUrl: process.env.BKASH_BASE_URL!,
});

const { GET, POST } = createNextHandler(bkash, {
  basePath: '/api/bkash',
  resolveOrder: async (req, body) => ({
    amount: 1550,
    currency: 'BDT',
    invoiceNumber: 'INV_1001',
  }),
});
export { GET, POST };
```

---

## Choosing Stores

| Environment | TokenStore | SessionStore | Notes |
| :--- | :--- | :--- | :--- |
| **Local Development** | `MemoryTokenStore` (default) | `MemorySessionStore` (default) | Logs warning in `NODE_ENV=production`. |
| **Production (Server)** | `RedisTokenStore` (`bkash-server/redis`) | `RedisSessionStore` (`bkash-server/redis`) | Atomic Lua release; prevents multi-instance lockout. |
| **Edge / Serverless** | `UpstashRestTokenStore` | `UpstashRestSessionStore` | 100% fetch-based Upstash REST API; zero Node dependencies. |

---

## License

MIT © [Antigravity Open Source & Contributors](https://github.com/iamtashanto/Bkash)
