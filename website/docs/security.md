---
title: Security and production checklist
description: Threat model, what the SDK enforces, and a checklist to complete before going live.
section: Guides
order: 6
---

# Security and production checklist

## What the SDK enforces

| Risk | Control |
| --- | --- |
| The customer changes the price | `POST /create` requires `resolveOrder`. The browser's `amount`, `invoiceNumber`, `orderId` and `payerReference` are ignored. |
| A forged callback marks an order paid | The callback only triggers Execute and Query against bKash; `status=success` in the URL is not trusted. |
| Wrong amount or invoice confirmed | `executePayment` throws `BkashVerificationMismatchError` unless amount, currency and invoice match what you expected. |
| Redirect to an attacker's site | The browser's `callbackUrl` is ignored unless its origin is in `allowedCallbackOrigins`. Post-payment `returnUrl` redirects need `allowedRedirectOrigins`. |
| Double execution | A per-payment lock rejects concurrent executes. |
| Token lockout | One shared token and a refresh lock; Grant/Refresh stay within two calls per hour. |
| Secrets in logs | Secrets and wallet numbers are redacted from SDK logs and API responses (wallet numbers are masked as `017****5678`). |
| Fake webhooks | The SNS signature, certificate host and replay window are checked; failures get `401`. |

## What stays your responsibility

- **Authentication of your own routes.** `/status` takes a `paymentId`; decide who may read it. `resolveOrder` should read the order from the logged-in user's session or database.
- **Refunds.** Refund and Search are server methods; the HTTP handler has no refund route. If you add one, protect it with admin authorization.
- **Idempotent fulfilment.** `onSuccess` may run again if your server restarts mid-way; make fulfilment idempotent on `trxId`.
- **Credentials.** Keep `app_secret`, `password` and `refresh_token` on the server only. Rotate them if exposed.
- **HTTPS everywhere**, including the callback URL.

## Production checklist

- [ ] Real credentials and the production base URL (`https://tokenized.pay.bka.sh`) are in your secret manager, not in the repository.
- [ ] `tokenStore` and `sessionStore` use Redis or Upstash (not memory) if you run more than one process.
- [ ] `resolveOrder` reads price and invoice from your database. `allowClientAmount` is not set.
- [ ] `allowedCallbackOrigins` / `callbackUrl` are set to your own domain.
- [ ] Callback URL is public HTTPS and reachable by bKash's redirect (not `localhost`).
- [ ] Every payment attempt has a unique invoice number.
- [ ] Fulfilment happens only after `executePayment` returns `Completed`, and is idempotent.
- [ ] A job reconciles payments that stay `unknown` or `Initiated` using `queryPayment`.
- [ ] The UI shows "payment pending, do not pay again" for `pending` and `timeout`.
- [ ] Webhook endpoint (if used) is registered with bKash and answers `200` quickly.
- [ ] You ran the full flow in the sandbox (success, wrong PIN, cancel, insufficient balance) with **your** integration.
- [ ] You made one small real payment and one refund before announcing.
- [ ] Logs and error tracking do not capture request bodies containing wallet numbers.

## Reporting a vulnerability

Do not open a public issue for a security problem. Use GitHub's private "Report a vulnerability" form on the repository. See `SECURITY.md` in the repository for the supported-versions policy.
