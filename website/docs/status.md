---
title: Feature status
description: What is stable, beta, experimental or planned, with the evidence for each.
section: Reference
order: 12
---

# Feature status

This table is generated from the same data file as the website and the READMEs. A feature is only called **stable** when it is verified against the published documentation and covered by tests; **beta** means automated tests (and where noted a live sandbox run) but no end-to-end payment yet.

{{STATUS_TABLE}}

## Compatibility

| Runtime / tool | Status |
| --- | --- |
| Node.js 18, 20, 22 (`bkash-server`, CI) | Tested |
| Node.js 24 | Tested locally |
| Cloudflare Workers, Vercel Edge, Deno, Bun | Not tested |
| React, Vue 3, Svelte, Angular (jsdom behaviour tests) | Tested |
| React Native on a physical device | Not tested |
| Live sandbox, v1.2.0-beta create + query | Run on 2026-10-27 |
| Live sandbox, full payment with customer PIN | Not run by the maintainers yet |
| Live sandbox, v2 | Not run (needs v2 credentials) |
