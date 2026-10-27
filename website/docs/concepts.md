---
title: Core concepts
description: Payment states, the payment flow, and the rule that a created session is not a paid order.
section: Concepts
order: 3
---

# Core concepts

## The payment flow

1. **Create.** Your server calls Create Payment with the amount and invoice **you** decided. bKash returns a `paymentId` and a `bKashURL`.
2. **Redirect.** The customer is sent to `bKashURL`, where they enter wallet number, OTP and PIN.
3. **Callback.** bKash redirects the browser to your callback URL with a status (`success`, `failure` or `cancel`).
4. **Execute.** Your server calls Execute Payment for that `paymentId`. Only now is money moved.
5. **Verify and fulfil.** The SDK compares the result with the order you expected. Fulfil the order only if it matches.

## A created session is not a paid order

`createPayment` only reserves a `paymentId` (valid for 24 hours). The customer may close the tab, fail the PIN, or never return. **Mark an order paid only after `executePayment` returns `Completed`** with the amount and invoice you expected.

## The callback is not proof of payment

The callback is a browser redirect. Anyone can open `…/callback?paymentID=X&status=success` by hand. The SDK ignores the `status` query value when deciding success: it always calls Execute (and Query) on bKash and trusts that response. For the same reason `bkash-server` never takes an amount from the browser.

## Payment status on the server

| Value | Meaning |
| --- | --- |
| `Initiated` | Created, not yet executed (or the customer did not finish). |
| `Authorized` | Funds held (Auth & Capture; not implemented by this SDK). |
| `Completed` | Money moved. `trxId` is available. |

A `paymentId` can be executed **once**. After an execute attempt it can only be queried.

## Server status versus client UI state

The server answers with a payment status. The client turns it into UI state:

| Client state | When |
| --- | --- |
| `idle` | Nothing started. |
| `creating` | Waiting for your `/create` route. |
| `awaiting_user` | The bKash page is open. |
| `verifying` | The callback arrived; the server is executing. |
| `success` | The server reported `Completed`. |
| `pending` | Outcome unknown. Show "payment pending, do not pay again" and poll `/status`. |
| `timeout` | A request timed out; treat like `pending`. |
| `offline` | The device lost connectivity. |
| `cancelled` | The customer cancelled on the bKash page. |
| `error` | A definite failure. |

The important rule: **unknown is not failed.** If Execute does not answer within 30 seconds, call Query Payment. Retry from Create only if the status is `Initiated`; if it is `Completed`, confirm success. `bkash-server` does this for you and returns HTTP `202` with `status: "unknown"` when it still cannot tell.

## Idempotency and double clicks

The server holds a short lock per `paymentId` while executing, so two simultaneous callbacks for the same payment cannot both execute. The client disables the button while `creating`. Use a unique `merchantInvoiceNumber` per attempt.
