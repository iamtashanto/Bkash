# bkash-client

[![CI](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml/badge.svg)](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/bkash-client.svg?color=indigo)](https://www.npmjs.com/package/bkash-client)

Headless, tree-shakeable frontend client SDK for bKash payment integrations. Works with React, React Native, Vue, Svelte, Angular, and vanilla HTML `<script>` tags.

> **Disclaimer:** This is an open-source, community-maintained SDK and is **NOT** officially affiliated with, endorsed by, or sponsored by bKash Limited. "bKash" is a registered trademark of bKash Limited.

---

## Features

- **Headless-First Architecture (0.1.x):** Unstyled, headless state machines and hooks (`useBkash`, `<BkashButton />`, `<BkashCheckout />`). Zero opinionated CSS or bundled stylesheets, giving you 100% control over layout and styling. Pre-packaged themes are planned for post-0.1.
- **Client States:** Fully typed state machine (`idle`, `creating`, `awaiting_user`, `verifying`, `success`, `pending`, `cancelled`, `timeout`, `offline`, `error`). Unknown or timed-out transactions present "payment pending, do not pay again" rather than false errors.
- **Zero Frontend Secrets:** Never touches merchant credentials or API keys; communicates strictly with your backend routes.
- **Framework Bindings:** First-class bindings for React (`useBkash`, `<BkashButton />`), React Native (`<BkashCheckout />`), Vue 3 (`useBkash` with deep Refs), Svelte store (`createBkashStore`), and Angular service (`BkashService`).
- **Drop-in Script Tag:** Standalone IIFE bundle for plain HTML/JS websites.

> **Alpha Limitation (AUD-04):** On Android devices, `<BkashCheckout />` does not automatically attach a native `BackHandler`. Developers must manage Android hardware back actions in their navigation container until built-in BackHandler integration lands in beta.

---

## Installation

```bash
# npm
npm install bkash-client

# pnpm
pnpm add bkash-client

# bun
bun add bkash-client
```

---

## Quickstart (React)

```tsx
import React from 'react';
import { useBkash, BkashButton } from 'bkash-client/react';

export function CheckoutPage() {
  const { state, error, checkout } = useBkash({
    createUrl: '/api/bkash/create',
  });

  return (
    <div>
      <h2>Order Summary</h2>
      <BkashButton
        amount={1550}
        invoiceNumber="INV_1001"
        orderId="ORD_555"
        className="btn-bkash"
      >
        Pay 1,550 BDT with bKash
      </BkashButton>
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

---

## React Native / Expo

```tsx
import React from 'react';
import { WebView } from 'react-native-webview';
import { BkashCheckout } from 'bkash-client/react-native';

export function PaymentScreen({ route, navigation }: any) {
  const { redirectUrl } = route.params;

  return (
    <BkashCheckout
      redirectUrl={redirectUrl}
      callbackUrl="https://merchant.example.com/api/bkash/callback"
      WebViewComponent={WebView}
      onSuccess={(paymentId) => {
        navigation.navigate('Success', { paymentId });
      }}
      onCancel={() => {
        navigation.goBack();
      }}
      onError={(err) => {
        alert(err.message);
      }}
    />
  );
}
```

---

## License

MIT © [Antigravity Open Source & Contributors](https://github.com/iamtashanto/Bkash)
