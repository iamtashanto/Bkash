# bkash-client

[![CI](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml/badge.svg)](https://github.com/iamtashanto/Bkash/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/bkash-client.svg?color=indigo)](https://www.npmjs.com/package/bkash-client)

Universal, headless, tree-shakeable frontend client SDK for bKash payment integrations. Works with React, React Native, Vue, Svelte, Angular, and vanilla HTML `<script>` tags.

> **Disclaimer:** This is an open-source, community-maintained SDK and is **NOT** officially affiliated with, endorsed by, or sponsored by bKash Limited. "bKash" is a registered trademark of bKash Limited.

---

## Features

- **Headless State Machine:** Fully typed lifecycle (`idle`, `creating`, `awaiting_user`, `verifying`, `success`, `error`).
- **Zero Frontend Secrets:** Never touches merchant credentials or API keys; communicates strictly with your backend routes.
- **Framework Bindings:** First-class bindings for React (`useBkash`, `<BkashButton />`), React Native (`<BkashCheckout />`), Vue 3 (`useBkash`), Svelte store (`createBkashStore`), and Angular service (`BkashService`).
- **Drop-in Script Tag:** Standalone IIFE bundle for plain HTML/JS websites.

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
