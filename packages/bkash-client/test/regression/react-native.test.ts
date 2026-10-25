// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { BkashCheckout } from '../../src/react-native.js';

describe('Regression AUD-02: React Native BkashCheckout WebView & No <div>', () => {
  it('throws an actionable error and does NOT return a <div> when WebView is missing', () => {
    // Suppress console.error from React's uncaught boundary in tests
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        React.createElement(BkashCheckout, {
          redirectUrl: 'https://sandbox.payment.bkash.com/pay',
          callbackUrl: 'https://example.com/callback',
          onSuccess: vi.fn(),
        })
      );
    }).toThrowError(/react-native-webview/i);

    spy.mockRestore();
  });

  it('renders custom WebView component and intercepts callback url', () => {
    const MockWebView = vi.fn((props: any, ref: any) => {
      return React.createElement('div', { ref, 'data-testid': 'mock-webview', 'data-uri': props.source.uri });
    });
    const ForwardedWebView = React.forwardRef(MockWebView);
    const onSuccess = vi.fn();
    const onCancel = vi.fn();

    const { getByTestId } = render(
      React.createElement(BkashCheckout, {
        redirectUrl: 'https://sandbox.payment.bkash.com/pay',
        callbackUrl: 'https://example.com/callback',
        onSuccess,
        onCancel,
        WebViewComponent: ForwardedWebView,
      })
    );

    const view = getByTestId('mock-webview');
    expect(view).toBeDefined();
    expect(view.getAttribute('data-uri')).toBe('https://sandbox.payment.bkash.com/pay');

    // Verify navigation interception
    const callArgs = MockWebView.mock.calls[0][0];
    const { onNavigationStateChange } = callArgs;
    expect(onNavigationStateChange).toBeDefined();

    // Trigger cancel callback
    onNavigationStateChange({ url: 'https://example.com/callback?status=cancel' });
    expect(onCancel).toHaveBeenCalled();

    // Trigger success callback
    onNavigationStateChange({ url: 'https://example.com/callback?status=success&paymentID=PAY_123' });
    expect(onSuccess).toHaveBeenCalledWith('PAY_123');
  });
});
