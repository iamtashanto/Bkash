---
title: FAQ
description: Frequently asked questions about the SDK and bKash integration.
section: Reference
order: 11
---

# FAQ

## Is this the official bKash SDK?

No. It is an independent, unofficial project. It follows the public bKash developer documentation.

## v1.2.0-beta or v2?

bKash now lists v2 as the stable version and documents it at developer.bka.sh. This SDK's v1.2.0-beta adapter has been exercised against the live sandbox (create and query); the v2 adapter follows the v2 documentation but has only been tested against a strict mock. Choose `v1.2.0-beta` if you must have the most-exercised path, `v2` for agreements and the newest API. Check the [feature status](../status/).

## Does it support Auth & Capture, payouts, Direct Charge or Dynamic Charging?

Not yet. bKash describes these products, but does not publish their API specifications, so they cannot be implemented honestly. Ask bKash for the specification if you need them.

## Can I use it in the browser?

Use `bkash-client` in the browser. Use `bkash-server` only on a server: it holds your secrets.

## Can the customer be charged twice?

The SDK reduces the risk (single execute per `paymentId`, locks, reconciliation, "pending, do not pay again" UI). It cannot remove it if your own code creates several payments for one order. Use one invoice per attempt and mark the order paid only once.

## How do I test failures?

See [Testing and sandbox](../testing/).

## How are refunds limited?

bKash allows up to 10 partial refunds per transaction, within 60 days, up to `maxRefundableAmount`.

## Does it work on Cloudflare Workers, Bun or Deno?

The core uses `fetch` and Web Crypto, but only Node.js is tested. Treat other runtimes as unverified.

## Where do I report a bug or security issue?

Bugs: GitHub issues. Security: GitHub's private vulnerability report.
