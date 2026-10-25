import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';

describe('Token Concurrency & Single-Flight Mutex', () => {
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

  it('coalesces 10 concurrent getValidToken() calls into exactly 1 network request', async () => {
    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
    });

    // Launch 10 simultaneous token requests
    const promises = Array.from({ length: 10 }, () => bkash.getValidToken());
    const tokens = await Promise.all(promises);

    // All 10 requests must receive the exact same token string
    expect(tokens.length).toBe(10);
    const firstToken = tokens[0];
    expect(firstToken).toBe('mock_id_token_1');
    for (const t of tokens) {
      expect(t).toBe(firstToken);
    }

    // Mock server must have been called exactly ONCE
    expect(mockServer.grantCallCount).toBe(1);
  });
});
