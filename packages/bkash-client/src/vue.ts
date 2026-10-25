import {
  BkashClient,
  type BkashClientOptions,
  type BkashClientState,
  type InitiateCheckoutParams,
} from './index.js';

/**
 * Vue 3 Composable for bKash Checkout.
 */
export function useBkash(options?: BkashClientOptions) {
  const client = new BkashClient(options);
  let state: BkashClientState = client.getState();
  let error: Error | null = null;

  client.subscribe((newState) => {
    state = newState;
  });

  const checkout = async (params: InitiateCheckoutParams) => {
    error = null;
    try {
      await client.checkout(params);
    } catch (err: unknown) {
      error = err instanceof Error ? err : new Error(String(err));
      throw error;
    }
  };

  const reset = () => {
    error = null;
    client.reset();
  };

  return {
    getState: () => state,
    getError: () => error,
    getPaymentId: () => client.getPaymentId(),
    checkout,
    reset,
    client,
  };
}
