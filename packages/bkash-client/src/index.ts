/**
 * @bkash/client
 * Headless and UI client library for bKash payment flows.
 */

export type BkashClientState =
  | 'idle'
  | 'creating'
  | 'awaiting_user'
  | 'verifying'
  | 'success'
  | 'error';

export interface BkashClientCheckoutOptions {
  /** Endpoint on the merchant backend to create payment session */
  createUrl: string;
  /** Callback triggered when payment enters error state */
  onError?: (error: Error) => void;
  /** Callback triggered when server confirms payment is Completed */
  onSuccess?: (paymentId: string) => void;
  /** Callback triggered if user aborts checkout */
  onCancel?: () => void;
}

export class BkashClient {
  private state: BkashClientState = 'idle';

  public getState(): BkashClientState {
    return this.state;
  }
}
