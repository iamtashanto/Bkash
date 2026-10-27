---
title: Getting started
description: Install the packages, run a server, and take a sandbox payment end to end.
section: Start here
order: 2
---

# Getting started

## Requirements

- Node.js 18 or newer for `bkash-server` (CI runs Node 18, 20 and 22).
- bKash **sandbox credentials**: `app_key`, `app_secret`, `username`, `password`. Request them from bKash or use the credentials in the bKash sandbox documentation. Never commit them; load them from environment variables.

## Install

```bash
npm install bkash-server bkash-client
```

## Environment

```bash
BKASH_APP_KEY=...
BKASH_APP_SECRET=...
BKASH_USERNAME=...
BKASH_PASSWORD=...
BKASH_BASE_URL=https://tokenized.sandbox.bka.sh
```

The base URL is the bKash host. The SDK adds the API version path (`/v1.2.0-beta` or `/v2/tokenized-checkout`) itself. A base URL that already ends in the version path is also accepted.

## A server in ten lines (Express)

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
  baseUrl: process.env.BKASH_BASE_URL!,
});

app.use('/api/bkash', createExpressHandler(bkash, {
  // You decide what the customer pays. Anything the browser sends is ignored.
  resolveOrder: async () => ({ amount: 1550, currency: 'BDT', invoiceNumber: 'INV_1001' }),
}));

app.listen(3000);
```

This mounts `POST /create`, `GET|POST /callback`, `GET /status` and `POST /webhook`.

## A checkout button (React)

```tsx
import { useBkash, BkashButton } from 'bkash-client/react';

export function CheckoutPage() {
  const { state, error } = useBkash({ createUrl: '/api/bkash/create' });
  return (
    <div>
      <BkashButton>Pay with bKash</BkashButton>
      {state === 'pending' && <p>Payment pending. Do not pay again.</p>}
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

## Take a sandbox payment

1. Start the server and open the page with the button.
2. Click the button. The browser is redirected to bKash's hosted page.
3. Enter a sandbox wallet number, then the sandbox OTP and PIN published in the bKash sandbox documentation.
4. bKash redirects to `/api/bkash/callback`. The server executes the payment, verifies amount and invoice, and answers with the verified result.

> Sandbox credentials are often **shared by many developers**. If you get error `9999` or rate-limit errors, someone else may have used the hourly token quota. Ask bKash for your own sandbox credentials.

## Next

- [Server guide](../server-guide/) for configuration, stores and every method.
- [Production checklist](../security/#production-checklist) before you switch the base URL to production.
