// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, isRef, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { useBkash } from '../../src/vue.js';

describe('Regression AUD-05: Vue 3 Composable true reactivity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('provides true Vue 3 Ref objects for state, error, and paymentId', () => {
    const composable = useBkash();
    expect(isRef(composable.state)).toBe(true);
    expect(isRef(composable.error)).toBe(true);
    expect(isRef(composable.paymentId)).toBe(true);
  });

  it('updates Vue component template reactively when state transitions', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: 'PAY_VUE_TEST_999',
        redirectUrl: 'https://sandbox.payment.bkash.com/pay',
      }),
    });

    const TestComponent = defineComponent({
      setup() {
        const { state, paymentId, checkout } = useBkash();
        return { state, paymentId, checkout };
      },
      template: `
        <div>
          <span data-testid="state">{{ state }}</span>
          <span data-testid="paymentId">{{ paymentId }}</span>
          <button @click="checkout({ amount: 100, invoiceNumber: 'INV_VUE_REACT' })">Pay</button>
        </div>
      `,
    });

    const wrapper = mount(TestComponent);
    expect(wrapper.find('[data-testid="state"]').text()).toBe('idle');

    await wrapper.find('button').trigger('click');
    await nextTick();

    expect(wrapper.find('[data-testid="state"]').text()).toBe('awaiting_user');
    expect(wrapper.find('[data-testid="paymentId"]').text()).toBe('PAY_VUE_TEST_999');
  });
});
