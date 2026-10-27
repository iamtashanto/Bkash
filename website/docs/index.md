---
title: Introduction
description: What bkash-server and bkash-client are, what they are not, and where to start.
section: Start here
order: 1
---

# bkash-server and bkash-client

TypeScript SDKs for accepting [bKash](https://www.bkash.com) payments through the **Tokenized Checkout** API, from any JavaScript backend (`bkash-server`) and any frontend or mobile app (`bkash-client`).

> **Unofficial.** This is a community project. It is not affiliated with, endorsed by, or sponsored by bKash Limited. "bKash" is a trademark of bKash Limited.

## What you get

- A typed server client for the documented Tokenized Checkout v1.2.0-beta and v2 APIs: grant/refresh token, create, execute, query, search, refund, refund status, and (v2) agreements.
- A token manager that keeps you inside bKash's documented limit of two Grant/Refresh calls per hour, even across several server instances.
- A payment guard that refuses to confirm a payment whose amount, currency or invoice differs from the order **you** expected.
- Honest handling of uncertain outcomes: a timeout or error 2062 is reconciled with Query Payment, and if that cannot confirm anything the result is reported as *unknown*, never as *failed*.
- A web-standard HTTP handler plus adapters for Express, Next.js, Fastify, Hono, Koa, Remix, SvelteKit and Astro.
- Headless client bindings for React, React Native, Vue 3, Svelte and Angular.

## What it is not

- It is not a hosted service and it never sees your customers' PINs; the customer enters wallet, OTP and PIN on bKash's own page.
- It is not production-proven yet. Read the [feature status](../status/) before you rely on a feature.
- Auth & Capture, Direct Charge, Dynamic Charging and payouts are not implemented, because their API specifications are not public.

## Where to start

1. [Getting started](../getting-started/): a working server and checkout button in about ten lines.
2. [Core concepts](../concepts/): payment states and why a created session is not a paid order.
3. [Security and production checklist](../security/): read this before going live.
