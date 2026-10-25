import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';
import { BkashRateLimitError } from '../../src/errors.js';

describe('Rate Limit Handling & Fail-Fast Protection', () => {
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

  it('fails fast with BkashRateLimitError when bKash returns HTTP 429', async () => {
    mockServer.simulateRateLimit = true;

    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
    });

    try {
      await bkash.getValidToken();
      expect.fail('Should have thrown BkashRateLimitError');
    } catch (err) {
      expect(err).toBeInstanceOf(BkashRateLimitError);
      const rateLimitErr = err as BkashRateLimitError;
      expect(rateLimitErr.code).toBe('BKASH_RATE_LIMIT_EXCEEDED');
      expect(rateLimitErr.retryAfterMs).toBeGreaterThan(0);
      expect(rateLimitErr.retryAfterDate).toBeInstanceOf(Date);
    }
  });
});
