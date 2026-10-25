import { describe, it, expect } from 'vitest';
import { RedisTokenStore, type GenericRedisClient } from '../../src/stores/redis-token-store.js';
import { RedisSessionStore } from '../../src/stores/redis-session-store.js';

class MockRedisClient implements GenericRedisClient {
  public store = new Map<string, string>();

  public async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  public async set(key: string, value: string, ...args: unknown[]): Promise<unknown> {
    // Check NX
    if (args.includes('NX')) {
      if (this.store.has(key)) {
        return null;
      }
    }
    this.store.set(key, value);
    return 'OK';
  }

  public async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  public async eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown> {
    const key = String(args[0]);
    const expectedVal = String(args[1]);
    const currentVal = this.store.get(key);

    if (currentVal === expectedVal) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }
}

describe('RedisTokenStore & RedisSessionStore', () => {
  it('manages atomic distributed lock with compare-and-delete release', async () => {
    const redis = new MockRedisClient();
    const store = new RedisTokenStore({ redis });

    const owner1 = 'worker-1';
    const owner2 = 'worker-2';

    // 1. Worker 1 acquires lock
    const acquired1 = await store.acquireLock('my_app_key', owner1, 5000);
    expect(acquired1).toBe(true);

    // 2. Worker 2 tries to acquire same lock (must fail)
    const acquired2 = await store.acquireLock('my_app_key', owner2, 5000);
    expect(acquired2).toBe(false);

    // 3. Worker 2 attempts to release Worker 1's lock (must NOT delete it)
    await store.releaseLock('my_app_key', owner2);
    expect(redis.store.has('bkash:token:lock:my_app_key')).toBe(true);

    // 4. Worker 1 releases own lock (succeeds)
    await store.releaseLock('my_app_key', owner1);
    expect(redis.store.has('bkash:token:lock:my_app_key')).toBe(false);

    // 5. Worker 2 can now acquire the lock
    const acquired2Retry = await store.acquireLock('my_app_key', owner2, 5000);
    expect(acquired2Retry).toBe(true);
  });

  it('supports encryption-at-rest cipher hooks', async () => {
    const redis = new MockRedisClient();
    const cipher = {
      encrypt: (text: string) => `ENC_${text}`,
      decrypt: (text: string) => text.replace(/^ENC_/, ''),
    };

    const store = new RedisTokenStore({ redis, cipher });

    await store.set(
      'my_app_key',
      {
        idToken: 'raw_secret_token_123',
        refreshToken: 'raw_refresh_token_456',
        expiresIn: 3600,
        obtainedAt: Date.now(),
      },
      3600
    );

    // Verify stored string is encrypted in Redis
    const rawInRedis = await redis.get('bkash:token:my_app_key');
    expect(rawInRedis).toContain('ENC_raw_secret_token_123');

    // Verify retrieval returns decrypted plain token
    const retrieved = await store.get('my_app_key');
    expect(retrieved?.idToken).toBe('raw_secret_token_123');
    expect(retrieved?.refreshToken).toBe('raw_refresh_token_456');
  });

  it('saves and updates session in RedisSessionStore', async () => {
    const redis = new MockRedisClient();
    const sessionStore = new RedisSessionStore({ redis });

    await sessionStore.saveSession(
      {
        paymentId: 'PAY_REDIS_123',
        orderId: 'ORDER_555',
        expectedOrder: {
          amount: '1200.00',
          currency: 'BDT',
          invoiceNumber: 'INV_REDIS',
        },
        status: 'Initiated',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      3600
    );

    const session = await sessionStore.getSession('PAY_REDIS_123');
    expect(session?.orderId).toBe('ORDER_555');
    expect(session?.status).toBe('Initiated');

    await sessionStore.updateSessionStatus('PAY_REDIS_123', 'Completed');
    const updated = await sessionStore.getSession('PAY_REDIS_123');
    expect(updated?.status).toBe('Completed');
  });
});
