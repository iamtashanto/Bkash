import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import { RedisTokenStore } from '../../src/stores/redis-token-store.js';
import { RedisSessionStore } from '../../src/stores/redis-session-store.js';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';
import type { PaymentSession } from '../../src/types.js';

describe('Real Redis Integration (Contention, Lease Expiry, Concurrency)', () => {
  let redis: Redis;
  let isRedisAvailable = false;
  let mockServer: MockBkashServer;
  let baseUrl: string;

  beforeAll(async () => {
    try {
      redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 });
      await redis.ping();
      isRedisAvailable = true;
    } catch {
      isRedisAvailable = false;
    }

    mockServer = new MockBkashServer();
    baseUrl = await mockServer.start();
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
    await mockServer.stop();
  });

  it('verifies real Redis service is reachable', () => {
    expect(isRedisAvailable).toBe(true);
  });

  describe('Distributed Token Lock (Multi-Worker Contention & Crash Recovery)', () => {
    it('enforces mutual exclusion across concurrent workers on real Redis', async () => {
      if (!isRedisAvailable) return;

      const store = new RedisTokenStore({ redis });
      const lockKey = `test:lock:${Date.now()}`;

      // 5 workers attempt to acquire the lock at the exact same millisecond
      const workers = ['worker-A', 'worker-B', 'worker-C', 'worker-D', 'worker-E'];
      const results = await Promise.all(
        workers.map((workerId) => store.acquireLock(lockKey, workerId, 5000))
      );

      const successfulAcquisitions = results.filter((r) => r === true);
      const failedAcquisitions = results.filter((r) => r === false);

      expect(successfulAcquisitions.length).toBe(1);
      expect(failedAcquisitions.length).toBe(4);

      // Identify the owner
      const winnerIndex = results.indexOf(true);
      const winner = workers[winnerIndex];

      // Non-owner cannot release the lock (compare-and-delete Lua script)
      const nonOwner = workers[(winnerIndex + 1) % workers.length];
      await store.releaseLock(lockKey, nonOwner);

      // Verify lock is still held in real Redis
      const valAfterWrongRelease = await redis.get(`bkash:token:lock:${lockKey}`);
      expect(valAfterWrongRelease).toBe(winner);

      // Owner releases lock
      await store.releaseLock(lockKey, winner);
      const valAfterCorrectRelease = await redis.get(`bkash:token:lock:${lockKey}`);
      expect(valAfterCorrectRelease).toBeNull();
    });

    it('recovers automatically from lock holder crash via TTL lease expiry', async () => {
      if (!isRedisAvailable) return;

      const store = new RedisTokenStore({ redis });
      const lockKey = `test:crash:${Date.now()}`;

      // Worker 1 acquires lock with a short 300ms TTL and "crashes" (no release called)
      const acquired1 = await store.acquireLock(lockKey, 'crashed-worker-1', 300);
      expect(acquired1).toBe(true);

      // Immediate attempt by Worker 2 fails
      const acquired2Immediate = await store.acquireLock(lockKey, 'worker-2', 5000);
      expect(acquired2Immediate).toBe(false);

      // Wait 400ms for lease to expire in Redis
      await new Promise((res) => setTimeout(res, 400));

      // Worker 2 should now acquire successfully
      const acquired2AfterExpiry = await store.acquireLock(lockKey, 'worker-2', 5000);
      expect(acquired2AfterExpiry).toBe(true);

      await store.releaseLock(lockKey, 'worker-2');
    });
  });

  describe('Session Store & Concurrent Execution Guard on Real Redis', () => {
    it('persists sessions and manages status updates in real Redis', async () => {
      if (!isRedisAvailable) return;

      const sessionStore = new RedisSessionStore({ redis });
      const paymentId = `PAY_REDIS_${Date.now()}`;

      const session: PaymentSession = {
        paymentId,
        orderId: 'ORD_9999',
        expectedOrder: {
          amount: '1550.00',
          currency: 'BDT',
          invoiceNumber: 'INV_REDIS_1',
        },
        status: 'Initiated',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await sessionStore.saveSession(session, 10);

      const retrieved = await sessionStore.getSession(paymentId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.paymentId).toBe(paymentId);
      expect(retrieved?.status).toBe('Initiated');

      await sessionStore.updateSessionStatus(paymentId, 'Completed');
      const updated = await sessionStore.getSession(paymentId);
      expect(updated?.status).toBe('Completed');
    });

    it('rejects concurrent duplicate executions via real Redis execution locks', async () => {
      if (!isRedisAvailable) return;

      const tokenStore = new RedisTokenStore({ redis });
      const sessionStore = new RedisSessionStore({ redis });

      const bkash = new BkashServer({
        apiVersion: 'v1.2.0-beta',
        appKey: 'test_app_key',
        appSecret: 'test_app_secret',
        username: 'test_user',
        password: 'test_password',
        baseUrl,
        tokenStore,
        sessionStore,
      });

      const paymentId = `CONCURRENT_PAY_${Date.now()}`;
      await sessionStore.saveSession(
        {
          paymentId,
          expectedOrder: {
            amount: '1550.00',
            currency: 'BDT',
            invoiceNumber: 'INV_1001',
          },
          status: 'Initiated',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        60
      );

      // Simulate simultaneous double-click / concurrent callback trigger
      const [res1, res2] = await Promise.allSettled([
        bkash.executePayment({ paymentId }),
        bkash.executePayment({ paymentId }),
      ]);

      const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
      const failures = [res1, res2].filter((r) => r.status === 'rejected');

      if (failures.length > 0) {
        console.log('FAILURES:', (failures as any[]).map((f) => f.reason?.message));
      }

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      const rejectedReason = (failures[0] as PromiseRejectedResult).reason;
      expect(rejectedReason.message).toMatch(/already in progress|Duplicate execution rejected/);
    });
  });
});
