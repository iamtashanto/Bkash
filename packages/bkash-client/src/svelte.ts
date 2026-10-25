import {
  BkashClient,
  type BkashClientOptions,
  type BkashClientState,
  type InitiateCheckoutParams,
} from './index.js';

export interface BkashSvelteStore {
  subscribe: (run: (value: { state: BkashClientState; paymentId: string | null }) => void) => () => void;
  checkout: (params: InitiateCheckoutParams) => Promise<void>;
  reset: () => void;
}

/**
 * Svelte readable store wrapper for bKash Client.
 */
export function createBkashStore(options?: BkashClientOptions): BkashSvelteStore {
  const client = new BkashClient(options);

  return {
    subscribe: (run) => {
      run({ state: client.getState(), paymentId: client.getPaymentId() });
      return client.subscribe((state) => {
        run({ state, paymentId: client.getPaymentId() });
      });
    },
    checkout: (params) => client.checkout(params),
    reset: () => client.reset(),
  };
}
