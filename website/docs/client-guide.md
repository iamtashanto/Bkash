---
title: Client guide
description: Headless bindings for React, React Native, Vue, Svelte, Angular and plain JavaScript.
section: Guides
order: 5
---

# Client guide

`bkash-client` is **headless**: it provides state and behaviour, not styles. It never touches credentials; it only calls your own `/create` route. It does not send an amount: **the server decides the price.**

## States

`idle` → `creating` → `awaiting_user` → `verifying` → `success`, with `pending`, `timeout`, `offline`, `cancelled` and `error` as other exits. `getStateMessage()` returns a plain-language message; for `pending` and `timeout` it says not to pay again.

## React

```tsx
import { useBkash, BkashButton } from 'bkash-client/react';

const { state, error, checkout, reset } = useBkash({
  createUrl: '/api/bkash/create',
  onSuccess: (paymentId) => router.push(`/orders/${paymentId}`),
});
```

`<BkashButton>` is a plain `<button>`; pass `className` to style it.

## React Native and Expo

Install `react-native-webview`, then:

```tsx
import { WebView } from 'react-native-webview';
import { BkashCheckout } from 'bkash-client/react-native';

<BkashCheckout
  redirectUrl={redirectUrl}                 // from your /create route
  callbackUrl="https://shop.example/api/bkash/callback"
  WebViewComponent={WebView}
  onSuccess={(paymentId) => navigation.navigate('Success', { paymentId })}
  onCancel={() => navigation.goBack()}
  onError={(e) => alert(e.message)}
/>
```

- The component renders no HTML elements and intercepts navigation to your callback URL.
- **Android back button:** not handled automatically in this release. Use `BackHandler` or your navigation library to confirm before leaving a payment in progress.
- Status: **experimental**. It is tested with React Native Testing Library, not on physical devices.

## Vue 3

```ts
import { useBkash } from 'bkash-client/vue';
const { state, checkout } = useBkash({ createUrl: '/api/bkash/create' });
```

`state` is a reactive ref.

## Svelte

```ts
import { createBkashStore } from 'bkash-client/svelte';
const bkash = createBkashStore({ createUrl: '/api/bkash/create' });
// $bkash in templates
```

## Angular

```ts
import { BkashService } from 'bkash-client/angular';
const service = new BkashService({ createUrl: '/api/bkash/create' });
```

## Plain JavaScript

```ts
import { BkashClient } from 'bkash-client';
const client = new BkashClient({ createUrl: '/api/bkash/create', onSuccess: (id) => console.log(id) });
await client.checkout({});
```

A standalone bundle for `<script>` tags is included in the package (`dist/bkash-client.browser.global.js`).

## Styling levels

This release is headless only: you bring the markup and CSS. Slot-based and themed components are planned, not available.
