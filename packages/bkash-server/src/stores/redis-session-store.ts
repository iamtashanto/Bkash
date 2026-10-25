import type { BkashPaymentStatus, PaymentSession, SessionStore } from '../types.js';
import type { GenericRedisClient } from './redis-token-store.js';

export interface RedisSessionStoreOptions {
  redis: GenericRedisClient;
  keyPrefix?: string;
}

/**
 * Production Redis SessionStore.
 * Enables stateless callback resolution across multiple backend nodes.
 */
export class RedisSessionStore implements SessionStore {
  private redis: GenericRedisClient;
  private keyPrefix: string;

  constructor(options: RedisSessionStoreOptions) {
    this.redis = options.redis;
    this.keyPrefix = options.keyPrefix ?? 'bkash:session:';
  }

  private sessionKey(paymentId: string): string {
    return `${this.keyPrefix}${paymentId}`;
  }

  public async saveSession(session: PaymentSession, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(session);
    await this.redis.set(this.sessionKey(session.paymentId), serialized, 'EX', ttlSeconds);
  }

  public async getSession(paymentId: string): Promise<PaymentSession | null> {
    const raw = await this.redis.get(this.sessionKey(paymentId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PaymentSession;
    } catch {
      return null;
    }
  }

  public async updateSessionStatus(
    paymentId: string,
    status: BkashPaymentStatus
  ): Promise<void> {
    const session = await this.getSession(paymentId);
    if (session) {
      session.status = status;
      session.updatedAt = Date.now();
      // Keep existing TTL or reset to 1 hour
      await this.saveSession(session, 3600);
    }
  }

  public async deleteSession(paymentId: string): Promise<void> {
    await this.redis.del(this.sessionKey(paymentId));
  }
}
