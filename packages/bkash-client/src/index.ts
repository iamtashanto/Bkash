/**
 * @bkash/client
 * Universal, headless client SDK for bKash payment integrations.
 */

export type BkashClientState =
  | 'idle'
  | 'creating'
  | 'awaiting_user'
  | 'verifying'
  | 'success'
  | 'pending'
  | 'cancelled'
  | 'timeout'
  | 'offline'
  | 'error';

export interface BkashClientOptions {
  /**
   * Endpoint on merchant backend to create payment session.
   * Defaults to "/api/bkash/create".
   */
  createUrl?: string;
  /**
   * Callback URL registered with merchant backend.
   */
  callbackUrl?: string;
  /**
   * Hook triggered on state transition.
   */
  onStateChange?: (state: BkashClientState) => void;
  /**
   * Hook triggered when payment completes successfully.
   */
  onSuccess?: (paymentId: string) => void;
  /**
   * Hook triggered on payment error.
   */
  onError?: (error: Error) => void;
  /**
   * Hook triggered if user cancels payment.
   */
  onCancel?: () => void;
}

export interface InitiateCheckoutParams {
  amount: number | string;
  invoiceNumber: string;
  orderId?: string;
  payerReference?: string;
  metadata?: Record<string, string>;
}

export class BkashClient {
  private state: BkashClientState = 'idle';
  private options: BkashClientOptions;
  private currentPaymentId: string | null = null;
  private listeners = new Set<(state: BkashClientState) => void>();

  constructor(options?: BkashClientOptions) {
    this.options = {
      createUrl: '/api/bkash/create',
      ...options,
    };
  }

  public getState(): BkashClientState {
    return this.state;
  }

  public getPaymentId(): string | null {
    return this.currentPaymentId;
  }

  /**
   * Returns human-readable UI guidance for the current client state.
   * Specifically guarantees that unknown or timed-out outcomes are presented as
   * "payment pending, do not pay again" rather than a false failure.
   */
  public getStateMessage(): string {
    switch (this.state) {
      case 'idle':
        return 'Ready to initiate checkout.';
      case 'creating':
        return 'Initializing payment session with bKash...';
      case 'awaiting_user':
        return 'Redirecting to bKash secure payment page...';
      case 'verifying':
        return 'Verifying payment with bKash...';
      case 'success':
        return 'Payment completed successfully!';
      case 'pending':
      case 'timeout':
        return 'Payment pending, do not pay again. Please wait while your transaction is reconciled with bKash.';
      case 'cancelled':
        return 'Payment was cancelled.';
      case 'offline':
        return 'Device is offline. Please check your internet connection before retrying.';
      case 'error':
        return 'An error occurred during checkout.';
      default:
        return '';
    }
  }

  public subscribe(listener: (state: BkashClientState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public cancel(): void {
    this.setState('cancelled');
    this.options.onCancel?.();
  }

  public setPending(paymentId?: string): void {
    if (paymentId) this.currentPaymentId = paymentId;
    this.setState('pending');
  }

  private setState(newState: BkashClientState): void {
    this.state = newState;
    this.options.onStateChange?.(newState);
    this.listeners.forEach((fn) => fn(newState));
  }

  /**
   * Initiates payment flow by calling the merchant backend,
   * obtaining the gateway URL, and redirecting the customer.
   */
  public async checkout(params: InitiateCheckoutParams): Promise<void> {
    // Offline pre-check
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState('offline');
      const offlineErr = new Error('Device is offline. Please check your internet connection.');
      this.options.onError?.(offlineErr);
      throw offlineErr;
    }

    try {
      this.setState('creating');

      const defaultCallback = typeof window !== 'undefined' ? window.location?.href : '';
      const res = await fetch(this.options.createUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: params.amount,
          invoiceNumber: params.invoiceNumber,
          orderId: params.orderId,
          callbackUrl: this.options.callbackUrl || defaultCallback,
          payerReference: params.payerReference,
          metadata: params.metadata,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create payment session: HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        redirectUrl?: string;
        paymentId?: string;
        error?: string;
      };
      if (!data.redirectUrl || !data.paymentId) {
        throw new Error(data.error || 'Invalid session response from payment server.');
      }

      this.currentPaymentId = data.paymentId;
      this.setState('awaiting_user');

      // Launch bKash Hosted Checkout
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = data.redirectUrl;
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const isTimeout =
        error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        /timeout|abort/i.test(error.message);

      if (isTimeout) {
        // Under AUD-08: timeout / unknown outcome MUST display pending ("do not pay again")
        this.setState('pending');
      } else {
        this.setState('error');
      }

      this.options.onError?.(error);
      throw error;
    }
  }

  public reset(): void {
    this.currentPaymentId = null;
    this.setState('idle');
  }
}
