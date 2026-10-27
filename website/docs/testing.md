---
title: Testing and sandbox
description: How to test against the bKash sandbox and with mocks, and the shared-credentials caveat.
section: Guides
order: 7
---

# Testing and sandbox

## The bKash sandbox

bKash provides a sandbox at `https://tokenized.sandbox.bka.sh` with test credentials, test wallet numbers, and a fixed test PIN and OTP. They are published in the bKash developer documentation and in the sandbox demo merchant portal (`merchantdemo.sandbox.bka.sh`); this documentation does not copy them.

- Sandbox calls cannot be made from a browser (CORS is not enabled). Always call from your server.
- **Shared credentials.** The widely-shared sandbox credentials are used by many people at once. Because Grant/Refresh Token are limited to two per hour per credential set, you may see errors that are not your bug. Ask bKash for dedicated sandbox credentials for CI.
- Failure scenarios (insufficient balance, debit block) use specific test wallets listed in the sandbox documentation.

## Run the scenarios

| Scenario | Expected result in your app |
| --- | --- |
| Success | `Completed`, order fulfilled once. |
| Wrong PIN, then success | Order still pending until `Completed`. |
| Customer cancels | `cancelled`, no fulfilment. |
| Insufficient balance wallet | Definite failure shown, order unpaid. |
| Close the tab after paying | Reconciliation finds `Completed` via Query Payment. |
| Open the callback URL by hand with `status=success` | Nothing is fulfilled. |
| Change the amount in dev tools | The server price is used. |

## Unit and integration tests without bKash

Point `baseUrl` at a local HTTP server that returns bKash-shaped responses. The SDK's own tests do this; the v2 conformance test (`packages/bkash-server/test/regression/v2-conformance.test.ts`) is a small example that serves only the documented v2 paths and fails on any other path.

```ts
const bkash = new BkashServer({ apiVersion: 'v2', /* creds */ baseUrl: 'http://127.0.0.1:4010' });
```

Remember that a mock proves you follow the documentation, not that the gateway behaves the same. Run the sandbox scenarios too.

## Tunnels

bKash must redirect the browser to your callback URL. On localhost this works from your own browser, but a server-to-server webhook needs a public URL (use a tunnelling tool).
