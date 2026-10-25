import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';

describe('Regression AUD-12: refundStatus support in V1Adapter', () => {
  let mockServer: MockBkashServer;
  let baseUrl: string;
  let bkash: BkashServer;

  beforeAll(async () => {
    mockServer = new MockBkashServer();
    baseUrl = await mockServer.start();

    bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
    });
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it('queries refundStatus successfully with V1Adapter', async () => {
    const result = await bkash.refundStatus({
      paymentId: 'BKASH_PAY_MOCK_12345',
      trxId: 'TRX_12345',
    });

    expect(result).toBeDefined();
    expect(result.refundTrxId).toBe('REF_99998888');
    expect(result.originalTrxId).toBe('TRX_12345');
    expect(result.amount).toBe('50.00');
    expect(result.transactionStatus).toBe('Completed');
  });
});
