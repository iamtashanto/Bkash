import {
  BkashClient,
  type BkashClientOptions,
  type BkashClientState,
  type InitiateCheckoutParams,
} from './index.js';

/**
 * Plain TypeScript Service for Angular applications.
 *
 * Design Decision & Justification:
 * Modern Angular (16+) seamlessly imports standard TypeScript services directly
 * without requiring the heavy complexity of ng-packagr / Angular Package Format (APF),
 * ensuring broad compatibility across Angular 16, 17, 18, and 19 without version pinning.
 */
export class BkashService {
  private client: BkashClient;

  constructor(options?: BkashClientOptions) {
    this.client = new BkashClient(options);
  }

  public getState(): BkashClientState {
    return this.client.getState();
  }

  public getPaymentId(): string | null {
    return this.client.getPaymentId();
  }

  public subscribe(listener: (state: BkashClientState) => void): () => void {
    return this.client.subscribe(listener);
  }

  public checkout(params: InitiateCheckoutParams): Promise<void> {
    return this.client.checkout(params);
  }

  public reset(): void {
    this.client.reset();
  }
}
