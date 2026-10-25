import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { BkashFeatureNotSupportedError } from '../../src/errors.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';

describe('Regression AUD-03/AUD-13: Unsupported features fail loudly with BkashFeatureNotSupportedError', () => {
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

  it('fails loudly with BkashFeatureNotSupportedError when calling agreement methods', async () => {
    await expect((bkash as any).createAgreement({ payerReference: '01712345678' }))
      .rejects.toThrowError(BkashFeatureNotSupportedError);
    await expect((bkash as any).createAgreement({ payerReference: '01712345678' }))
      .rejects.toThrowError(/agreements.*not supported/i);

    await expect((bkash as any).executeAgreement({ paymentId: 'PAY_1' }))
      .rejects.toThrowError(BkashFeatureNotSupportedError);
    await expect((bkash as any).cancelAgreement({ agreementId: 'AGR_1' }))
      .rejects.toThrowError(BkashFeatureNotSupportedError);
  });

  it('fails loudly with BkashFeatureNotSupportedError when calling auth & capture methods', async () => {
    await expect((bkash as any).capturePayment({ paymentId: 'PAY_1', amount: 100 }))
      .rejects.toThrowError(BkashFeatureNotSupportedError);
    await expect((bkash as any).capturePayment({ paymentId: 'PAY_1', amount: 100 }))
      .rejects.toThrowError(/auth-and-capture.*not supported/i);

    await expect((bkash as any).voidPayment({ paymentId: 'PAY_1' }))
      .rejects.toThrowError(BkashFeatureNotSupportedError);
  });
});
