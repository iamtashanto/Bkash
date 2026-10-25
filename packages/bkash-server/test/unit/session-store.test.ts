import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';
import { MemorySessionStore } from '../../src/stores/memory-session-store.js';

describe('SessionStore Integration & Background Reconcile', () => {
  let mockServer: MockBkashServer;
  let baseUrl: string;

  beforeAll(async () => {
    mockServer = new MockBkashServer();
    baseUrl = await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.reset();
  });

  it('stores session on createPayment and resolves expectedOrder automatically on executePayment', async () => {
    const sessionStore = new MemorySessionStore({ suppressWarning: true });
    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
      sessionStore,
    });

    // 1. Create payment with orderId
    const createResult = await bkash.createPayment({
      amount: 1550,
      invoiceNumber: 'INV_1001',
      callbackUrl: 'https://merchant.example.com/callback',
      orderId: 'ORDER_9999',
    });

    // Verify session stored
    const savedSession = await sessionStore.getSession(createResult.paymentId);
    expect(savedSession).not.toBeNull();
    expect(savedSession?.orderId).toBe('ORDER_9999');
    expect(savedSession?.status).toBe('Initiated');
    expect(savedSession?.expectedOrder.amount).toBe(1550);

    // 2. Execute payment WITHOUT providing expectedOrder in params (resolved from SessionStore)
    const execResult = await bkash.executePayment({
      paymentId: createResult.paymentId,
    });

    expect(execResult.transactionStatus).toBe('Completed');
    expect(execResult.amount).toBe('1550.00');

    // Verify session updated to Completed
    const updatedSession = await sessionStore.getSession(createResult.paymentId);
    expect(updatedSession?.status).toBe('Completed');
  });

  it('reconciles payment in background job via reconcile()', async () => {
    const sessionStore = new MemorySessionStore({ suppressWarning: true });
    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
      sessionStore,
    });

    // Seed session in store
    await sessionStore.saveSession(
      {
        paymentId: 'BKASH_PAY_RECONCILE_JOB',
        orderId: 'ORDER_777',
        expectedOrder: {
          amount: 1550,
          currency: 'BDT',
          invoiceNumber: 'INV_1001',
        },
        status: 'Initiated',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      3600
    );

    // Execute background reconciliation
    const reconciledResult = await bkash.reconcile('BKASH_PAY_RECONCILE_JOB');

    expect(reconciledResult.paymentId).toBe('BKASH_PAY_RECONCILE_JOB');
    expect(reconciledResult.transactionStatus).toBe('Completed');
    expect(reconciledResult.reconciled).toBe(true);

    const session = await sessionStore.getSession('BKASH_PAY_RECONCILE_JOB');
    expect(session?.status).toBe('Completed');
  });
});
