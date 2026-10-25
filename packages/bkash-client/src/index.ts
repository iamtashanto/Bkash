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
   * Hook triggered on payment error or cancellation.
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

  public subscribe(listener: (state: BkashClientState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
      this.setState('error');
      const error = err instanceof Error ? err : new Error(String(err));
      this.options.onError?.(error);
      throw error;
    }
  }

  public reset(): void {
    this.currentPaymentId = null;
    this.setState('idle');
  }
}
