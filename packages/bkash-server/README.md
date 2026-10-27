# bkash-server

Type-safe server SDK for accepting [bKash](https://www.bkash.com) payments with the **Tokenized Checkout** API (v1.2.0-beta and v2) from Node.js.

[![CI](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml/badge.svg)](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/bkash-server)](https://www.npmjs.com/package/bkash-server)
[![license](https://img.shields.io/npm/l/bkash-server)](https://github.com/iamtashanto/Bkash/blob/main/LICENSE)

> **Unofficial.** Not affiliated with, endorsed by, or sponsored by bKash Limited. "bKash" is a trademark of bKash Limited.

**Documentation:** <https://iamtashanto.github.io/Bkash/docs/> · **Issues:** <https://github.com/iamtashanto/Bkash/issues> · **Changelog:** <https://github.com/iamtashanto/Bkash/releases>

## Why

- **The server decides the price.** The HTTP handler ignores amounts, invoices and callback URLs sent by the browser.
- **Verified payments.** A payment is only confirmed if bKash's result matches the amount, currency and invoice you expected.
- **Honest outcomes.** Timeouts and error 2062 are reconciled with Query Payment; anything still uncertain is reported as `unknown`, never as `failed`.
- **Token limit safe.** bKash allows two Grant/Refresh Token calls per hour. One shared token (memory, Redis or Upstash) and a refresh lock keep every process inside it.
- **Zero runtime dependencies**, ESM and CommonJS, full types.

## Install

```bash
npm install bkash-server
```

Requires Node.js 18 or newer (CI runs 18, 20 and 22). Cloudflare Workers, Vercel Edge, Deno and Bun are not tested.

## Quickstart

```ts
import express from 'express';
import { BkashServer } from 'bkash-server';
import { createExpressHandler } from 'bkash-server/frameworks';

const app = express();
const bkash = new BkashServer({
  apiVersion: 'v1.2.0-beta', // or 'v2'
  appKey: process.env.BKASH_APP_KEY!,
  appSecret: process.env.BKASH_APP_SECRET!,
  username: process.env.BKASH_USERNAME!,
  password: process.env.BKASH_PASSWORD!,
  baseUrl: process.env.BKASH_BASE_URL!, // https://tokenized.sandbox.bka.sh
});

app.use('/api/bkash', createExpressHandler(bkash, {
  resolveOrder: async () => ({ amount: 1550, currency: 'BDT', invoiceNumber: 'INV_1001' }),
}));
app.listen(3000);
```

Pair it with [`bkash-client`](https://www.npmjs.com/package/bkash-client) in the browser or app.

## What is supported

<!-- status:start -->
<!-- Generated from website/src/data/status.json. Do not edit by hand. -->
| Feature | Status | Evidence |
| --- | --- | --- |
| Tokenized Checkout v1.2.0-beta | Beta | automated tests against a local mock; live sandbox create+query run on 2026-10-27 (execute needs a customer PIN and is NOT TESTED live) |
| Tokenized Checkout v2 | Experimental | automated tests against a strict mock of the documented paths and fields; NOT TESTED against the live v2 sandbox |
| Token cache, refresh and lock | Beta | automated tests (concurrency, lease expiry); real Redis tests run in CI |
| Amount and invoice verification | Beta | automated tests |
| Timeout and 2062 reconciliation | Beta | automated tests against a mock |
| Web-standard HTTP handler | Beta | automated tests: tampering, allowlist, error mapping |
| Documented error-code table | Stable | automated tests compare the table with the published codes |
| Agreements (tokenized, v2) | Experimental | automated tests against a strict mock; NOT TESTED live. Not available with apiVersion v1.2.0-beta. |
| Refund and refund status | Experimental | automated tests; NOT TESTED live |
| Search transaction | Beta | automated tests |
| IPN / webhook (AWS SNS) verification | Experimental | automated tests with generated keys; NOT TESTED with a real bKash notification |
| Auth & Capture | Planned | Specification not public |
| Direct Charge / Linked Apps | Planned | Specification not public |
| Dynamic Charging | Planned | Specification not public |
| Disbursement, B2B and M2M payouts | Planned | Specification not public |
| Express adapter | Beta | automated tests |
| Next.js route handler | Experimental | automated tests (smoke) |
| Fastify, Hono, Koa, Remix, SvelteKit, Astro adapters | Experimental | automated tests (smoke) |
| Local bKash simulator package | Planned | - |
<!-- status:end -->

## Entry points

| Import | Contents |
| --- | --- |
| `bkash-server` | `BkashServer`, handler, errors, memory and Upstash stores |
| `bkash-server/frameworks` | Express, Next.js, Fastify, Hono, Koa, Remix, SvelteKit, Astro adapters |
| `bkash-server/redis` | `RedisTokenStore`, `RedisSessionStore` |
| `bkash-server/webhook` | IPN (AWS SNS) verifier. Needs `node:crypto`. Experimental |

## Security

Read the [security guide and production checklist](https://iamtashanto.github.io/Bkash/docs/security/) before going live. Report vulnerabilities privately through GitHub's "Report a vulnerability" form, not in public issues.

## License

MIT
