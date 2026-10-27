---
title: Troubleshooting
description: Common problems and how to fix them.
section: Reference
order: 10
---

# Troubleshooting

## `9999` or invalid credentials

Check `appKey`, `appSecret`, `username` and `password` for stray spaces and make sure they belong to the environment of your `baseUrl` (sandbox credentials do not work on production). With shared sandbox credentials, another developer may have used up the hourly token quota; wait an hour or request your own credentials.

## 404 or HTML instead of JSON from bKash

Check `baseUrl`. Use the host only (`https://tokenized.sandbox.bka.sh`). With `apiVersion: 'v1.2.0-beta'` the SDK adds `/v1.2.0-beta`; with `v2` it adds `/v2/tokenized-checkout`. If you route through your own proxy host, the SDK does not add a version path, so include it yourself.

## `expectedOrder … must be provided directly or resolvable via SessionStore`

`executePayment` does not know what to verify against. Configure a `sessionStore` (the default memory store works on one process) or pass `expectedOrder`.

## The callback never arrives

The callback URL must be public HTTPS and match what you sent. On localhost the redirect works in your own browser; for bKash to reach a server URL use a tunnel. Confirm the URL is on `allowedCallbackOrigins` if the browser supplies it.

## `Client-supplied amounts are disabled`

`POST /create` needs `resolveOrder`. This is deliberate: see [Security](../security/).

## Error 2062 / "payment already completed"

The customer reloaded the callback or two requests raced. The SDK queries the payment and returns the completed result with `reconciled: true`.

## Customer paid but the page shows pending

Call `queryPayment(paymentId)`. If it is `Completed`, fulfil the order. A background job should do this for old `pending` payments.

## `BkashFeatureNotSupportedError`

You called an agreement method with `apiVersion: 'v1.2.0-beta'` (agreements need `v2` in this SDK), or Auth & Capture, which is not implemented.

## Many 429 / rate-limit errors in production

Several processes are each requesting tokens. Use a shared `RedisTokenStore` (or Upstash) so they reuse one token.

## CORS errors in the browser

bKash APIs cannot be called from a browser. Call them from your server; the browser only talks to your own routes.

## Node 18: `jsdom` or tooling errors in your own tests

Not related to the SDK; check your test tool's supported Node versions.
