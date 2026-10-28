# bkash-client

Headless checkout bindings for [bKash](https://www.bkash.com) payments: React, React Native, Vue 3, Svelte, Angular and plain JavaScript. Pairs with [`bkash-server`](https://www.npmjs.com/package/bkash-server).

[![CI](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml/badge.svg)](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/bkash-client)](https://www.npmjs.com/package/bkash-client)
[![license](https://img.shields.io/npm/l/bkash-client)](https://github.com/iamtashanto/Bkash/blob/main/LICENSE)

> **Unofficial.** Not affiliated with, endorsed by, or sponsored by bKash Limited. "bKash" is a trademark of bKash Limited.

**Documentation:** <https://bkash-sdk.tashanto.com/docs/client-guide/> · **Issues:** <https://github.com/iamtashanto/Bkash/issues>

## Why

- **Never holds secrets or prices.** It only calls your own `/create` route; the server decides the amount.
- **States that tell the truth.** `idle`, `creating`, `awaiting_user`, `verifying`, `success`, `pending`, `timeout`, `offline`, `cancelled`, `error`. An unknown outcome shows "payment pending, do not pay again", not a failure.
- **Headless.** No CSS, no modal: you own the markup and the brand.

## Install

```bash
npm install bkash-client
```

Optional peers: `react`, `vue`, `react-native` and `react-native-webview` (only for the matching binding).

## Quickstart (React)

```tsx
import { useBkash, BkashButton } from 'bkash-client/react';

export function CheckoutPage() {
  const { state, error } = useBkash({ createUrl: '/api/bkash/create' });
  return (
    <div>
      <BkashButton>Pay with bKash</BkashButton>
      {state === 'pending' && <p>Payment pending. Do not pay again.</p>}
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

Other bindings (React Native, Vue, Svelte, Angular, vanilla) are in the [client guide](https://bkash-sdk.tashanto.com/docs/client-guide/).

## What is supported

<!-- status:start -->
<!-- Generated from website/src/data/status.json. Do not edit by hand. -->
| Feature | Status | Evidence |
| --- | --- | --- |
| React hook and button | Beta | automated tests (React Testing Library) |
| Vue 3 composable | Beta | automated tests (Vue Test Utils) |
| Svelte store | Beta | automated tests |
| Angular service | Beta | automated tests |
| React Native WebView checkout | Experimental | automated tests (React Native Testing Library); NOT TESTED on a device |
<!-- status:end -->

> **Android back button:** `BkashCheckout` does not handle the hardware back button yet. Confirm with your navigation library before leaving a payment in progress.

## License

MIT

---

Developed by [TA Shanto](https://tashanto.com) · [npm](https://www.npmjs.com/package/bkash-client) · [GitHub](https://github.com/iamtashanto/Bkash)
