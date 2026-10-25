import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BkashClient } from '../src/index.js';
import { useBkash } from '../src/vue.js';
import { createBkashStore } from '../src/svelte.js';
import { BkashService } from '../src/angular.js';

describe('Frontend Client Bindings (Headless, Vue, Svelte, Angular)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('manages state transitions correctly during checkout', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: 'PAY_MOCK_123',
        redirectUrl: 'https://sandbox.payment.bkash.com/pay',
      }),
    });

    const transitions: string[] = [];
    const client = new BkashClient({
      onStateChange: (state) => transitions.push(state),
    });

    expect(client.getState()).toBe('idle');

    await client.checkout({
      amount: 1550,
      invoiceNumber: 'INV_1001',
    });

    expect(client.getState()).toBe('awaiting_user');
    expect(client.getPaymentId()).toBe('PAY_MOCK_123');
    expect(transitions).toEqual(['creating', 'awaiting_user']);

    client.reset();
    expect(client.getState()).toBe('idle');
    expect(client.getPaymentId()).toBeNull();
  });

  it('binds Vue 3 composable with reactive state', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: 'PAY_VUE_123',
        redirectUrl: 'https://sandbox.payment.bkash.com/pay',
      }),
    });

    const { getState, getPaymentId, checkout, reset } = useBkash();
    expect(getState()).toBe('idle');

    await checkout({ amount: 500, invoiceNumber: 'INV_VUE' });
    expect(getState()).toBe('awaiting_user');
    expect(getPaymentId()).toBe('PAY_VUE_123');

    reset();
    expect(getState()).toBe('idle');
  });

  it('binds Svelte store with reactive subscription', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: 'PAY_SVELTE_123',
        redirectUrl: 'https://sandbox.payment.bkash.com/pay',
      }),
    });

    const store = createBkashStore();
    const values: any[] = [];
    const unsubscribe = store.subscribe((val) => values.push(val));

    await store.checkout({ amount: 750, invoiceNumber: 'INV_SVELTE' });
    expect(values[values.length - 1].state).toBe('awaiting_user');
    expect(values[values.length - 1].paymentId).toBe('PAY_SVELTE_123');

    store.reset();
    expect(values[values.length - 1].state).toBe('idle');
    unsubscribe();
  });

  it('binds Angular plain-TS service seamlessly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: 'PAY_ANGULAR_123',
        redirectUrl: 'https://sandbox.payment.bkash.com/pay',
      }),
    });

    const service = new BkashService();
    expect(service.getState()).toBe('idle');

    await service.checkout({ amount: 2000, invoiceNumber: 'INV_NG' });
    expect(service.getState()).toBe('awaiting_user');
    expect(service.getPaymentId()).toBe('PAY_ANGULAR_123');
  });
});
