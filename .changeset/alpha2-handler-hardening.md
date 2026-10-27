---
"bkash-server": patch
"bkash-client": patch
---

0.1.0-alpha.2 (apply with `changeset pre enter alpha` so the version becomes 0.1.0-alpha.2).

Security: `POST /create` no longer forwards a client-supplied `callbackUrl` unless its origin is listed in `allowedCallbackOrigins` (otherwise `callbackUrl` option or `<origin><basePath>/callback`); `orderId` and `payerReference` are no longer read from the client body.

Money safety: an unconfirmed execution (timeout) returns 202 `status: "unknown"` ("do not pay again") instead of a generic failure; duplicate and mismatch outcomes have distinct statuses; raw internal error messages are not returned. A webhook that fails signature verification now gets 401 instead of 200.

Docs: removed unproven "edge-compatible/universal" claims (only Node is tested) and softened the token rate-limit statement. The `jsdom` devDependency is pinned to ^24 so tests run on Node 18.
