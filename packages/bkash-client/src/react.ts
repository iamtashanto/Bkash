import { useState, useEffect, useCallback, createElement } from 'react';
import {
  BkashClient,
  type BkashClientOptions,
  type BkashClientState,
  type InitiateCheckoutParams,
} from './index.js';

export function useBkash(options?: BkashClientOptions) {
  const [client] = useState(() => new BkashClient(options));
  const [state, setState] = useState<BkashClientState>(client.getState());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    return client.subscribe((newState) => setState(newState));
  }, [client]);

  const checkout = useCallback(
    async (params: InitiateCheckoutParams) => {
      setError(null);
      try {
        await client.checkout(params);
      } catch (err: unknown) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [client]
  );

  const reset = useCallback(() => {
    setError(null);
    client.reset();
  }, [client]);

  return {
    state,
    error,
    paymentId: client.getPaymentId(),
    checkout,
    reset,
    client,
  };
}

export interface BkashButtonProps {
  amount: number | string;
  invoiceNumber: string;
  orderId?: string;
  options?: BkashClientOptions;
  className?: string;
  children?: any;
}

export function BkashButton({
  amount,
  invoiceNumber,
  orderId,
  options,
  className,
  children,
}: BkashButtonProps) {
  const { state, checkout } = useBkash(options);

  const handleClick = async () => {
    if (state === 'creating') return;
    await checkout({ amount, invoiceNumber, orderId });
  };

  return createElement(
    'button',
    {
      type: 'button',
      onClick: handleClick,
      disabled: state === 'creating',
      className: className || 'bkash-pay-btn',
    },
    children || (state === 'creating' ? 'Connecting to bKash...' : 'Pay with bKash')
  );
}
