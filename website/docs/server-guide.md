---
title: Server guide
description: Configuration, stores, every BkashServer method, the HTTP handler and framework adapters.
section: Guides
order: 4
---

# Server guide

## Configuration

```ts
import { BkashServer } from 'bkash-server';

const bkash = new BkashServer({
  apiVersion: 'v1.2.0-beta', // required: 'v1.2.0-beta' | 'v2'
  appKey, appSecret, username, password,
  baseUrl: 'https://tokenized.sandbox.bka.sh',
  tokenStore,    // optional, see Stores
  sessionStore,  // optional, see Stores
  timeoutMs: 30000,
  webhookOptions: { /* see Webhooks */ },
});
```

| Option | Default | Notes |
| --- | --- | --- |
| `apiVersion` | none (required) | `v1.2.0-beta` has the most mileage. `v2` is the version bKash now lists as stable, but this SDK's v2 adapter is **experimental** until a sandbox end-to-end run with v2 credentials passes. |
| `baseUrl` | none (required) | Host only, for example `https://tokenized.sandbox.bka.sh` or `https://tokenized.pay.bka.sh`. The version path is added for you. |
| `tokenStore` | in-memory | Holds the `id_token`/`refresh_token` and the refresh lock. Use Redis or Upstash with more than one process. |
| `sessionStore` | in-memory | Remembers the expected order (and `agreementId`) per `paymentId` between create and execute. |
| `timeoutMs` | `30000` | bKash documents a 30 s default timeout. |

## Stores

bKash allows Grant Token and Refresh Token **at most twice per hour**; going over blocks refresh calls for an hour. The token store makes every process share one token.

```ts
import Redis from 'ioredis';
import { RedisTokenStore, RedisSessionStore } from 'bkash-server/redis';

const redis = new Redis(process.env.REDIS_URL!);
const bkash = new BkashServer({
  /* credentials */
  tokenStore: new RedisTokenStore({ redis }),
  sessionStore: new RedisSessionStore({ redis }),
});
```

`UpstashRestTokenStore` and `UpstashRestSessionStore` (exported from the root entry) work over HTTP for serverless platforms. The in-memory stores log a warning in production: they are for development only.

## Methods

| Method | Versions | Purpose |
| --- | --- | --- |
| `createPayment(params)` | v1, v2 | Start a payment. Pass `agreementId` (v2) to pay with a saved agreement. |
| `executePayment({ paymentId })` | v1, v2 | Execute, reconcile on timeout or 2062, and verify amount, currency and invoice. |
| `queryPayment(paymentId)` | v1, v2 | Current state of a payment. |
| `searchTransaction({ trxId })` | v1, v2 | Look up a completed transaction. |
| `refundPayment(params)` | v1, v2 | Full or partial refund; up to 10 partial refunds within 60 days. |
| `refundStatus(params)` | v1, v2 | Refund history. v2 returns every refund in `refunds`. |
| `createAgreement`, `executeAgreement`, `queryAgreement`, `cancelAgreement` | v2 | Account binding for repeat payments. |
| `capturePayment`, `voidPayment` | none | Throw `BkashFeatureNotSupportedError`: not implemented. |

### Verification

`executePayment` needs to know what you expected. Either let the `sessionStore` remember it from `createPayment`, or pass `expectedOrder`:

```ts
const result = await bkash.executePayment({
  paymentId,
  expectedOrder: { amount: '1550.00', currency: 'BDT', invoiceNumber: 'INV_1001' },
});
// throws BkashVerificationMismatchError if bKash reports anything else
```

### Agreements (v2)

```ts
// 1. Bind the account once per customer
const a = await bkash.createAgreement({ payerReference: '01XXXXXXXXX', callbackUrl });
// redirect the customer to a.redirectUrl, then, on the callback:
const done = await bkash.executeAgreement({ agreementId: a.agreementId! });
// store done.agreementId against your customer

// 2. Every later payment: the customer only enters the PIN
const p = await bkash.createPayment({ amount: '250.00', invoiceNumber, callbackUrl, agreementId });
// redirect to p.redirectUrl, then on the callback:
await bkash.executePayment({ paymentId: p.paymentId }); // agreementId is remembered by the sessionStore
```

If Execute Agreement times out, call `queryAgreement`: retry from Create only when the status is `Initiated`.

### Refunds

```ts
await bkash.refundPayment({ paymentId, trxId, amount: '100.00', reason: 'Item returned', sku: 'SKU-1' });
```

If a refund call times out, call `refundStatus` before retrying. A refund is a money movement: **do not expose it as a public route.** The HTTP handler does not provide one.

## HTTP handler

```ts
import { createBkashHandler } from 'bkash-server';

const handle = createBkashHandler(bkash, {
  basePath: '/api/bkash',
  resolveOrder: async (req, body) => ({ amount, currency: 'BDT', invoiceNumber }),
  callbackUrl: 'https://shop.example/api/bkash/callback', // optional fixed value
  allowedCallbackOrigins: ['https://shop.example'],       // for a client-supplied callbackUrl
  allowedRedirectOrigins: ['https://shop.example'],       // for returnUrl redirects
  onSuccess: async (result) => { await markPaid(result); },
  onError: async (error) => undefined,
});
```

| Route | Behaviour |
| --- | --- |
| `POST /create` | Needs `resolveOrder` (or the unsafe `allowClientAmount: true`). Ignores `amount`, `invoiceNumber`, `orderId` and `payerReference` from the browser. A browser `callbackUrl` is used only if its origin is in `allowedCallbackOrigins`. |
| `GET\|POST /callback` | Executes, verifies, then calls `onSuccess` or redirects to an allowlisted `returnUrl`. `cancel` and `failure` return 400 without executing. |
| `GET /status?paymentId=` | Minimal public fields only; the wallet number is masked. |
| `POST /webhook` | Verifies the SNS signature first. A message that fails verification gets 401. |

Errors are mapped to minimal responses: timeout → `202 {status:"unknown"}`, mismatch → `409`, duplicate → `409`, rate limit → `429`, other bKash errors → `400` with the code, anything else → `500` without internal details.

## Framework adapters

All adapters wrap the same handler.

```ts
import { createExpressHandler, createNextHandler, createFastifyHandler, createHonoHandler } from 'bkash-server/frameworks';
```

```ts
// Next.js App Router: app/api/bkash/[...route]/route.ts
export const { GET, POST } = createNextHandler(bkash, { basePath: '/api/bkash', resolveOrder });
```

Koa, Remix, SvelteKit and Astro adapters are also exported. Express, Fastify, Hono and Koa are tested inside the real frameworks; Next.js, Remix, SvelteKit and Astro are tested with the web-standard Request and Response they pass to handlers. See [feature status](../status/).

## Runtimes

The root entry uses `fetch` and Web Crypto and has no Node built-in imports; the webhook verifier lives in `bkash-server/webhook` because it needs `node:crypto`. Only Node.js is exercised in CI. Cloudflare Workers, Vercel Edge, Deno and Bun are **not tested**.
