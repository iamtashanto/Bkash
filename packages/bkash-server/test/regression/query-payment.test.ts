import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';

describe('Regression AUD-06: queryPayment parameter flexibility', () => {
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

  it('accepts string paymentId directly and object QueryPaymentParams', async () => {
    // 1. Calling queryPayment with raw string paymentId
    const resFromString = await bkash.queryPayment('PAY_TEST_STR_123');
    expect(resFromString).toBeDefined();
    expect(resFromString.transactionStatus).toBe('Completed');

    // 2. Calling queryPayment with object { paymentId }
    const resFromObject = await bkash.queryPayment({ paymentId: 'PAY_TEST_OBJ_123' });
    expect(resFromObject).toBeDefined();
    expect(resFromObject.transactionStatus).toBe('Completed');
  });

  it('rejects queryPayment with empty or invalid parameter', async () => {
    await expect((bkash as any).queryPayment('')).rejects.toThrowError(/paymentId/i);
    await expect((bkash as any).queryPayment(null)).rejects.toThrowError(/paymentId/i);
  });
});
