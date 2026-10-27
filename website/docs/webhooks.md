---
title: Webhooks (IPN)
description: Verify bKash Instant Payment Notifications delivered through AWS SNS.
section: Guides
order: 8
---

# Webhooks (IPN)

bKash can send Instant Payment Notifications to a URL you register with them. Notifications are delivered through AWS SNS and cover payments made through the payment gateway, the bKash app, USSD and QR.

> **Status: experimental.** The verifier is tested with generated keys and certificates. It has **not** been tested against a real bKash notification yet.

## Verify and handle

```ts
import { BkashWebhookVerifier } from 'bkash-server/webhook';
```

With the HTTP handler, `POST /webhook` does this for you: it reads the raw body, verifies the SNS signature, confirms the subscription on a `SubscriptionConfirmation` message (only after the signature is valid), and calls `onWebhook` for verified notifications. A message that fails verification receives `401`.

```ts
createBkashHandler(bkash, {
  onWebhook: async (payload) => {
    // payload.data holds the notification fields, for example trxID, amount, transactionStatus
  },
});
```

## What is checked

- Signature (SHA-1 or SHA-256 per `SignatureVersion`) against the signing certificate.
- The certificate URL must be an HTTPS `sns.<region>.amazonaws.com` URL.
- Optional `allowedTopicArns`, a freshness window, and replay protection through a message store.

## Rules for your listener

- Respond quickly with HTTP `200`; do the real work asynchronously.
- Do not treat a notification as the only proof of payment. Confirm with Query Payment or Search Transaction for orders you created.
- Notifications can repeat. Deduplicate on `trxID`.
- `webhookOptions.messageStore` should be shared storage (Redis) when you run several instances.
