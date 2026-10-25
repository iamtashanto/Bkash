import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';
import { BkashHttpHandler } from '../../src/http/handler.js';
import { MemorySessionStore } from '../../src/stores/memory-session-store.js';

describe('Web-Standard HTTP Handler & Framework Adapters', () => {
  let mockServer: MockBkashServer;
  let baseUrl: string;
  let bkash: BkashServer;
  let sessionStore: MemorySessionStore;

  beforeAll(async () => {
    mockServer = new MockBkashServer();
    baseUrl = await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.reset();
    sessionStore = new MemorySessionStore({ suppressWarning: true });
    bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
      sessionStore,
    });
  });

  it('handles POST /create returning redirectUrl and paymentId', async () => {
    const handler = new BkashHttpHandler(bkash, { basePath: '/api/bkash' });

    const req = new Request('http://localhost:3000/api/bkash/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 1550,
        invoiceNumber: 'INV_1001',
        callbackUrl: 'http://localhost:3000/api/bkash/callback',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.paymentId).toBe('BKASH_PAY_MOCK_12345');
    expect(data.redirectUrl).toContain('https://sandbox.payment.bkash.com');
  });

  it('handles GET /callback executing and verifying payment', async () => {
    const handler = new BkashHttpHandler(bkash, { basePath: '/api/bkash' });

    // Seed session
    await sessionStore.saveSession(
      {
        paymentId: 'BKASH_PAY_CALLBACK_TEST',
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

    const req = new Request(
      'http://localhost:3000/api/bkash/callback?paymentID=BKASH_PAY_CALLBACK_TEST&status=success',
      { method: 'GET' }
    );

    const res = await handler.handle(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.transactionStatus).toBe('Completed');
    expect(data.amount).toBe('1550.00');
  });

  it('handles user cancellation at GET /callback', async () => {
    const onError = vi.fn();
    const handler = new BkashHttpHandler(bkash, {
      basePath: '/api/bkash',
      onError,
    });

    const req = new Request(
      'http://localhost:3000/api/bkash/callback?paymentID=BKASH_CANCELLED&status=cancel',
      { method: 'GET' }
    );

    const res = await handler.handle(req);
    expect(res.status).toBe(400);
    expect(onError).toHaveBeenCalled();
  });
});
