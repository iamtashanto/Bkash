import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';
import { BkashError } from '../../src/errors.js';

describe('BkashServer Core Lifecycle & Config', () => {
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

  it('throws BkashError when apiVersion is omitted in 0.x', () => {
    expect(
      () =>
        new BkashServer({
          apiVersion: undefined as any,
          appKey: 'test_key',
          appSecret: 'test_secret',
          username: 'test_user',
          password: 'test_password',
          baseUrl,
        })
    ).toThrowError(/apiVersion is a required option in 0.x/);
  });

  it('throws BkashError when required credentials are missing', () => {
    expect(
      () =>
        new BkashServer({
          apiVersion: 'v1.2.0-beta',
          appKey: '',
          appSecret: 'test_secret',
          username: 'test_user',
          password: 'test_password',
          baseUrl,
        })
    ).toThrowError(/Missing required configuration parameters/);
  });

  it('executes a complete payment cycle successfully with PII masking', async () => {
    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
    });

    // 1. Create payment
    const createResult = await bkash.createPayment({
      amount: 1550,
      invoiceNumber: 'INV_1001',
      callbackUrl: 'https://merchant.example.com/callback',
    });

    expect(createResult.paymentId).toBe('BKASH_PAY_MOCK_12345');
    expect(createResult.redirectUrl).toContain('https://sandbox.payment.bkash.com/redirect/');
    expect(createResult.amount).toBe('1550.00');
    expect(createResult.status).toBe('Initiated');

    // 2. Execute payment with expected order verification
    const execResult = await bkash.executePayment({
      paymentId: createResult.paymentId,
      expectedOrder: {
        amount: 1550,
        currency: 'BDT',
        invoiceNumber: 'INV_1001',
      },
    });

    expect(execResult.paymentId).toBe(createResult.paymentId);
    expect(execResult.transactionStatus).toBe('Completed');
    expect(execResult.trxId).toBe('TRX_9999888877');
    expect(execResult.amount).toBe('1550.00');
    expect(execResult.currency).toBe('BDT');
    expect(execResult.invoiceNumber).toBe('INV_1001');
    expect(execResult.reconciled).toBe(false);

    // Verify PII is masked
    expect(execResult.customerMsisdn).toBe('017****5678');
  });
});
