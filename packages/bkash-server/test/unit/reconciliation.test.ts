import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';

describe('Auto-Reconciliation on 2062 & Timeout', () => {
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

  it('automatically reconciles via queryPayment when execute returns 2062', async () => {
    mockServer.simulate2062OnExecute = true;

    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
    });

    const result = await bkash.executePayment({
      paymentId: 'BKASH_PAY_2062_TEST',
      expectedOrder: {
        amount: 1550,
        currency: 'BDT',
        invoiceNumber: 'INV_1001',
      },
    });

    expect(result.paymentId).toBe('BKASH_PAY_2062_TEST');
    expect(result.transactionStatus).toBe('Completed');
    expect(result.reconciled).toBe(true);
    expect(result.trxId).toBe('TRX_RECONCILED_8888');

    // Both execute and query must have been called
    expect(mockServer.executeCallCount).toBe(1);
    expect(mockServer.queryCallCount).toBe(1);
  });

  it('automatically reconciles via queryPayment when execute request times out', async () => {
    mockServer.simulateTimeoutOnExecuteMs = 300; // longer than 150ms timeout

    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
      timeoutMs: 150, // Short timeout for testing
    });

    const result = await bkash.executePayment({
      paymentId: 'BKASH_PAY_TIMEOUT_TEST',
      expectedOrder: {
        amount: 1550,
        currency: 'BDT',
        invoiceNumber: 'INV_1001',
      },
    });

    expect(result.paymentId).toBe('BKASH_PAY_TIMEOUT_TEST');
    expect(result.transactionStatus).toBe('Completed');
    expect(result.reconciled).toBe(true);
    expect(result.trxId).toBe('TRX_RECONCILED_8888');

    // Query must have been called to recover the transaction
    expect(mockServer.queryCallCount).toBe(1);
  });
});
