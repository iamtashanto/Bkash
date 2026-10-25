import { createElement, useRef } from 'react';

export interface BkashCheckoutProps {
  /** The checkout redirectUrl received from backend */
  redirectUrl: string;
  /** The expected callback URL prefix to intercept */
  callbackUrl: string;
  /** Hook called when callback redirect succeeds */
  onSuccess: (paymentId: string) => void;
  /** Hook called when user cancels */
  onCancel?: () => void;
  /** Hook called on error */
  onError?: (error: Error) => void;
  /** Optional WebView component (passed in or resolved from react-native-webview) */
  WebViewComponent?: any;
}

let cachedWebView: any = null;
let attemptedRequire = false;

function resolveWebView() {
  if (attemptedRequire) return cachedWebView;
  attemptedRequire = true;
  try {
    // Attempt dynamic require in React Native / Expo environment
    const rnw = typeof require !== 'undefined' ? require('react-native-webview') : null;
    cachedWebView = rnw?.WebView || rnw?.default || rnw;
  } catch {
    cachedWebView = null;
  }
  return cachedWebView;
}

/**
 * React Native WebView Checkout wrapper with deep link and callback URL interception.
 * Works with Expo and React Native CLI.
 *
 * Automatically resolves `react-native-webview` from peer dependencies or accepts
 * an explicit `WebViewComponent` prop.
 */
export function BkashCheckout({
  redirectUrl,
  callbackUrl,
  onSuccess,
  onCancel,
  onError,
  WebViewComponent,
}: BkashCheckoutProps) {
  const Component = WebViewComponent || resolveWebView();

  if (!Component) {
    throw new Error(
      'BkashCheckout requires "react-native-webview" to render in React Native / Expo. ' +
      'Please install it by running:\n' +
      '  npx expo install react-native-webview\n' +
      'or\n' +
      '  npm install react-native-webview\n' +
      'Alternatively, pass your WebView component via the WebViewComponent prop.'
    );
  }

  const webViewRef = useRef<any>(null);

  const handleNavigationStateChange = (navState: { url: string }) => {
    const { url } = navState;

    if (url.startsWith(callbackUrl)) {
      try {
        const parsed = new URL(url);
        const status = parsed.searchParams.get('status');
        const paymentId =
          parsed.searchParams.get('paymentID') || parsed.searchParams.get('paymentId');

        if (status === 'cancel') {
          onCancel?.();
        } else if (status === 'failure') {
          onError?.(new Error('bKash payment failed.'));
        } else if (status === 'success' && paymentId) {
          onSuccess(paymentId);
        }
      } catch (err: unknown) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  return createElement(Component, {
    ref: webViewRef,
    source: { uri: redirectUrl },
    onNavigationStateChange: handleNavigationStateChange,
    startInLoadingState: true,
  });
}
