# Changelog

## 0.1.0 (2026-10-27)

First non-alpha release of `bkash-server` and `bkash-client`. It is **not yet validated end to end against the live bKash gateway** (see the feature status in the documentation).

### Security and correctness
- `POST /create` ignores the browser's `callbackUrl` unless its origin is allowlisted; `orderId` and `payerReference` are never read from the browser.
- Unconfirmed outcomes (timeouts) are reported as `status: "unknown"` (HTTP 202), not as failures; raw internal errors are not returned; unverified webhooks get 401.
- The error table now contains all 87 published bKash codes; several descriptions were wrong.

### Features
- v2 adapter aligned with the published API (endpoints, field names, refund history, refundable-amount fields).
- Agreements (v2): create, execute, query, cancel, and payments with an agreement.
- `bkash-server` adds `/v1.2.0-beta` on bka.sh hosts. `bkash-client` `checkout()` needs no amount.

### Documentation
- New documentation site, package READMEs and a generated feature-status table.

### Known gaps
- Auth & Capture, Direct Charge, Dynamic Charging and payouts are not implemented (no public specification).
- Webhook (IPN) verification and React Native on devices are untested against real inputs.

## 0.1.0-alpha.1

First public alpha (deprecated; superseded by 0.1.0).
