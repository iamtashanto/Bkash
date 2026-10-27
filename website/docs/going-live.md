---
title: Going live
description: Switch from sandbox to production safely.
section: Guides
order: 13
---

# Going live

1. Get production credentials from bKash (merchant portal or relationship manager). Sandbox credentials do not work in production.
2. Put them in your secret manager and set `baseUrl` to `https://tokenized.pay.bka.sh`.
3. Complete the [production checklist](../security/#production-checklist).
4. Deploy with a shared Redis token store if you run more than one process.
5. Make **one small real payment** and one refund. Confirm the order, the `trxId` and the money movement in the merchant portal.
6. Watch logs for `unknown` outcomes and reconcile them with `queryPayment`.

## Migrating from a hand-written or community integration

- Replace your token handling with the SDK's store. Do not keep a second place that calls Grant Token, or you will exceed the hourly limit.
- Move price decisions to `resolveOrder`. Remove any code that reads an amount from the request body.
- Treat the callback as a trigger for Execute, not as proof.
- Keep your existing invoice numbering; they must be unique per attempt.
- Run old and new side by side in the sandbox before switching the route.
