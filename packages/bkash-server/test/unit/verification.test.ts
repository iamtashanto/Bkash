import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';
import { BkashVerificationMismatchError } from '../../src/errors.js';

describe('Financial & Order Verification Guards', () => {
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

  it('throws BkashVerificationMismatchError when returned amount does not match expectedOrder', async () => {
    mockServer.simulateAmountMismatch = '999.00'; // Attacker attempts to pay 999 instead of 1550

    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
    });

    await expect(
      bkash.executePayment({
        paymentId: 'BKASH_AMOUNT_MISMATCH_TEST',
        expectedOrder: {
          amount: 1550,
          currency: 'BDT',
          invoiceNumber: 'INV_1001',
        },
      })
    ).rejects.toThrowError(BkashVerificationMismatchError);
  });

  it('throws BkashVerificationMismatchError when currency does not match BDT', async () => {
    mockServer.simulateCurrencyMismatch = 'USD';

    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
    });

    await expect(
      bkash.executePayment({
        paymentId: 'BKASH_CURRENCY_MISMATCH_TEST',
        expectedOrder: {
          amount: 1550,
          currency: 'BDT',
          invoiceNumber: 'INV_1001',
        },
      })
    ).rejects.toThrowError(BkashVerificationMismatchError);
  });

  it('throws BkashVerificationMismatchError when returned invoiceNumber does not match expectedOrder', async () => {
    mockServer.simulateInvoiceMismatch = 'INV_DIFFERENT_9999';

    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
    });

    await expect(
      bkash.executePayment({
        paymentId: 'BKASH_INVOICE_MISMATCH_TEST',
        expectedOrder: {
          amount: 1550,
          currency: 'BDT',
          invoiceNumber: 'INV_1001',
        },
      })
    ).rejects.toThrowError(BkashVerificationMismatchError);
  });
});
