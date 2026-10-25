import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UpstashRestTokenStore,
  UpstashRestSessionStore,
} from '../../src/stores/upstash-rest-store.js';

describe('UpstashRestTokenStore & UpstashRestSessionStore (Edge-Ready)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('performs atomic acquireLock and releaseLock via Upstash REST API', async () => {
    let storedVal: string | null = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      const [cmd, ...args] = JSON.parse(init.body);

      if (cmd === 'SET' && args.includes('NX')) {
        const key = args[0];
        const val = args[1];
        if (storedVal) {
          return { ok: true, json: async () => ({ result: null }) };
        }
        storedVal = val;
        return { ok: true, json: async () => ({ result: 'OK' }) };
      }

      if (cmd === 'EVAL') {
        storedVal = null;
        return { ok: true, json: async () => ({ result: 1 }) };
      }

      if (cmd === 'GET') {
        return { ok: true, json: async () => ({ result: storedVal }) };
      }

      return { ok: true, json: async () => ({ result: 'OK' }) };
    });

    const store = new UpstashRestTokenStore({
      url: 'https://mock-db.upstash.io',
      token: 'mock_upstash_token',
    });

    // 1. Worker 1 acquires lock
    const acquired1 = await store.acquireLock('test_app', 'owner-1', 5000);
    expect(acquired1).toBe(true);

    // 2. Worker 2 attempts same lock (must fail)
    const acquired2 = await store.acquireLock('test_app', 'owner-2', 5000);
    expect(acquired2).toBe(false);

    // 3. Worker 1 releases lock
    await store.releaseLock('test_app', 'owner-1');

    // 4. Worker 2 can now acquire
    const acquired2Retry = await store.acquireLock('test_app', 'owner-2', 5000);
    expect(acquired2Retry).toBe(true);
  });

  it('stores and retrieves session via UpstashRestSessionStore', async () => {
    const memory = new Map<string, string>();

    global.fetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
      const [cmd, key, val] = JSON.parse(init.body);
      if (cmd === 'SET') {
        memory.set(key, val);
        return { ok: true, json: async () => ({ result: 'OK' }) };
      }
      if (cmd === 'GET') {
        return { ok: true, json: async () => ({ result: memory.get(key) || null }) };
      }
      return { ok: true, json: async () => ({ result: 'OK' }) };
    });

    const sessionStore = new UpstashRestSessionStore({
      url: 'https://mock-db.upstash.io',
      token: 'mock_token',
    });

    await sessionStore.saveSession(
      {
        paymentId: 'UPSTASH_PAY_1',
        expectedOrder: {
          amount: '1550.00',
          currency: 'BDT',
          invoiceNumber: 'INV_UPSTASH',
        },
        status: 'Initiated',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      3600
    );

    const retrieved = await sessionStore.getSession('UPSTASH_PAY_1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.expectedOrder.amount).toBe('1550.00');
    expect(retrieved?.status).toBe('Initiated');
  });
});
