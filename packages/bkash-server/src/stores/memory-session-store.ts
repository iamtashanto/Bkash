import type { BkashPaymentStatus, PaymentSession, SessionStore } from '../types.js';

/**
 * In-memory SessionStore for local testing.
 */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, { data: PaymentSession; expiresAt: number }>();

  constructor(options?: { suppressWarning?: boolean }) {
    const isProduction =
      typeof process !== 'undefined' && process.env?.['NODE_ENV'] === 'production';

    if (isProduction && !options?.suppressWarning) {
      console.warn(
        '\x1b[33m[bkash-server WARNING]\x1b[0m Using MemorySessionStore in a production environment! ' +
          'Payment callbacks arriving at different server instances will fail to resolve the session. ' +
          'Please configure RedisSessionStore in production.'
      );
    }
  }

  public async saveSession(session: PaymentSession, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.sessions.set(session.paymentId, { data: { ...session }, expiresAt });
  }

  public async getSession(paymentId: string): Promise<PaymentSession | null> {
    const entry = this.sessions.get(paymentId);
    if (!entry) {
      return null;
    }
    if (Date.now() >= entry.expiresAt) {
      this.sessions.delete(paymentId);
      return null;
    }
    return { ...entry.data };
  }

  public async updateSessionStatus(
    paymentId: string,
    status: BkashPaymentStatus
  ): Promise<void> {
    const entry = this.sessions.get(paymentId);
    if (entry) {
      entry.data.status = status;
      entry.data.updatedAt = Date.now();
    }
  }

  public async deleteSession(paymentId: string): Promise<void> {
    this.sessions.delete(paymentId);
  }
}
