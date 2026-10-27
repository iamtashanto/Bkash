---
title: Error reference
description: SDK error classes, what they mean, and every documented bKash error code.
section: Reference
order: 9
---

# Error reference

## SDK error classes

All errors extend `BkashError` and have a stable `code`.

| Class | Code | Cause | What to do |
| --- | --- | --- | --- |
| `BkashApiError` | `BKASH_API_<externalCode>` | bKash answered with an error code. `externalCode`, `httpStatus` and `raw` are available. | Look the code up below. Show the message to the customer, not the code. |
| `BkashRateLimitError` | `BKASH_RATE_LIMIT` | The Grant/Refresh Token limit was hit (HTTP 429). | Wait for `retryAfterMs`. Check that every process shares one token store. |
| `BkashVerificationMismatchError` | `BKASH_VERIFICATION_MISMATCH` | bKash's result differs from the amount, currency or invoice you expected. | Do **not** fulfil. Investigate; this can indicate tampering or a bug. |
| `BkashTimeoutError` | `BKASH_TIMEOUT` | Execute timed out and Query Payment could not confirm the outcome. | Outcome is **unknown**. Show "pending, do not pay again" and re-query later. |
| `BkashDuplicateExecutionError` | `BKASH_DUPLICATE_EXECUTION` | Another execute is in progress, or error 2062 without a `Completed` payment. | Wait and query the payment. |
| `BkashWebhookVerificationError` | `BKASH_WEBHOOK_VERIFICATION` | An IPN message failed verification. | Reject it. Do not act on its content. |
| `BkashFeatureNotSupportedError` | `BKASH_FEATURE_NOT_SUPPORTED` | The feature is not implemented, or not available for the configured `apiVersion`. | See [feature status](../status/). |

## HTTP handler responses

| Situation | Status | Body |
| --- | --- | --- |
| Outcome unknown (timeout) | `202` | `{ success:false, status:"unknown", error }` |
| Mismatch / duplicate | `409` | `{ success:false, status:"mismatch" \| "duplicate" }` |
| Rate limited | `429` | `{ success:false }` |
| bKash error | `400` | `{ success:false, code, error }` |
| Customer cancelled or failed | `400` | `{ success:false, status }` |
| Webhook failed verification | `401` | `{ success:false }` |
| Unexpected error | `500` | `{ success:false, error:"bKash request failed." }` (no internals) |

## bKash error codes

These are copied from the published bKash error tables (payment and refund). Meanings are bKash's wording. The mapping in `KNOWN_BKASH_ERRORS` is checked against this table by a test.

{{ERROR_TABLE}}

Not every code is in a table (for example `9999` for invalid credentials appears in responses). Unknown codes keep bKash's own message.
