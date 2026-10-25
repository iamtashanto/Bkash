import { ref, readonly, type Ref, type DeepReadonly } from 'vue';
import {
  BkashClient,
  type BkashClientOptions,
  type BkashClientState,
  type InitiateCheckoutParams,
} from './index.js';

export interface UseBkashReturn {
  state: DeepReadonly<Ref<BkashClientState>>;
  error: DeepReadonly<Ref<Error | null>>;
  paymentId: DeepReadonly<Ref<string | null>>;
  getState: () => BkashClientState;
  getError: () => Error | null;
  getPaymentId: () => string | null;
  checkout: (params: InitiateCheckoutParams) => Promise<void>;
  reset: () => void;
  client: BkashClient;
}

/**
 * Vue 3 Composable for bKash Checkout.
 * Provides deep reactivity via Vue 3 Refs, compatible with <script setup> and JSX templates.
 */
export function useBkash(options?: BkashClientOptions): UseBkashReturn {
  const client = new BkashClient(options);
  const state = ref<BkashClientState>(client.getState());
  const error = ref<Error | null>(null);
  const paymentId = ref<string | null>(client.getPaymentId());

  client.subscribe((newState) => {
    state.value = newState;
    paymentId.value = client.getPaymentId();
  });

  const checkout = async (params: InitiateCheckoutParams) => {
    error.value = null;
    try {
      await client.checkout(params);
      paymentId.value = client.getPaymentId();
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      error.value = errObj;
      throw errObj;
    }
  };

  const reset = () => {
    error.value = null;
    client.reset();
    paymentId.value = null;
  };

  return {
    state: readonly(state),
    error: readonly(error),
    paymentId: readonly(paymentId),
    getState: () => state.value,
    getError: () => error.value,
    getPaymentId: () => paymentId.value,
    checkout,
    reset,
    client,
  };
}
