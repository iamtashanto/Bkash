// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, renderHook, act } from '@testing-library/react';
import { get } from 'svelte/store';
import { useBkash, BkashButton } from '../src/react.js';
import { createBkashStore } from '../src/svelte.js';
import { BkashService } from '../src/angular.js';

describe('Real Framework Behavioral Tests (React, Svelte, Angular)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('React Testing Library Behavioral Verification', () => {
    it('updates hook state reactively on checkout with renderHook', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          paymentId: 'PAY_HOOK_123',
          redirectUrl: 'https://sandbox.payment.bkash.com/pay',
        }),
      });

      const { result } = renderHook(() => useBkash());
      expect(result.current.state).toBe('idle');
      expect(result.current.paymentId).toBeNull();

      await act(async () => {
        await result.current.checkout({
          amount: 500,
          invoiceNumber: 'INV_REACT_HOOK',
        });
      });

      expect(result.current.state).toBe('awaiting_user');
      expect(result.current.paymentId).toBe('PAY_HOOK_123');

      act(() => {
        result.current.reset();
      });
      expect(result.current.state).toBe('idle');
    });

    it('renders BkashButton, disables during creation, and invokes checkout on click', async () => {
      let resolveCheckout: (value: any) => void;
      const checkoutPromise = new Promise((resolve) => {
        resolveCheckout = resolve;
      });

      global.fetch = vi.fn().mockReturnValue(checkoutPromise);

      const { getByRole } = render(
        React.createElement(BkashButton, {
          amount: 1200,
          invoiceNumber: 'INV_BTN_1',
        })
      );

      const button = getByRole('button');
      expect(button.textContent).toBe('Pay with bKash');
      expect(button.hasAttribute('disabled')).toBe(false);

      // Trigger click
      fireEvent.click(button);

      // During creation, button must be disabled and show loading state
      expect(button.hasAttribute('disabled')).toBe(true);
      expect(button.textContent).toBe('Connecting to bKash...');

      // Finish checkout network call
      await act(async () => {
        resolveCheckout({
          ok: true,
          json: async () => ({
            paymentId: 'PAY_BTN_SUCCESS',
            redirectUrl: 'https://sandbox.payment.bkash.com/pay',
          }),
        });
      });
    });
  });

  describe('Svelte Store Behavioral Verification', () => {
    it('complies with Svelte Store contract and supports get(store)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          paymentId: 'PAY_SVELTE_CONTRACT',
          redirectUrl: 'https://sandbox.payment.bkash.com/pay',
        }),
      });

      const store = createBkashStore();

      // Verify Svelte get() reads current state immediately
      const initial = get(store);
      expect(initial.state).toBe('idle');
      expect(initial.paymentId).toBeNull();

      // Trigger checkout
      await store.checkout({ amount: 300, invoiceNumber: 'INV_SV_1' });

      const updated = get(store);
      expect(updated.state).toBe('awaiting_user');
      expect(updated.paymentId).toBe('PAY_SVELTE_CONTRACT');

      store.reset();
      expect(get(store).state).toBe('idle');
    });
  });

  describe('Angular Service Behavioral Verification', () => {
    it('manages checkout state transitions and subscription lifecycle in Angular service', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          paymentId: 'PAY_ANGULAR_LIFECYCLE',
          redirectUrl: 'https://sandbox.payment.bkash.com/pay',
        }),
      });

      const service = new BkashService();
      const states: string[] = [];
      const unsubscribe = service.subscribe((s) => states.push(s));

      expect(service.getState()).toBe('idle');

      await service.checkout({ amount: 999, invoiceNumber: 'INV_NG_LIFECYCLE' });

      expect(service.getState()).toBe('awaiting_user');
      expect(service.getPaymentId()).toBe('PAY_ANGULAR_LIFECYCLE');
      expect(states).toContain('creating');
      expect(states).toContain('awaiting_user');

      unsubscribe();
      service.reset();
      // Listener should not receive reset after unsubscribe
      expect(states[states.length - 1]).toBe('awaiting_user');
      expect(service.getState()).toBe('idle');
    });
  });
});
