import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { BkashServer } from '../../src/server.js';
import { createExpressHandler } from '../../src/frameworks/index.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';
import type { Server } from 'node:http';

describe('Regression AUD-01: Verbatim README Quickstart Execution', () => {
  let mockServer: MockBkashServer;
  let baseUrl: string;
  let app: express.Express;
  let server: Server;
  let appPort: number;

  beforeAll(async () => {
    mockServer = new MockBkashServer();
    baseUrl = await mockServer.start();

    // Verbatim quickstart code from README:
    app = express();
    app.use(express.json());

    const bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'test_key',
      appSecret: 'test_secret',
      username: 'test_user',
      password: 'test_password',
      baseUrl,
    });

    app.use(
      '/api/bkash',
      createExpressHandler(bkash, {
        resolveOrder: async (req, body) => ({
          amount: 1550,
          currency: 'BDT',
          invoiceNumber: 'INV_1001',
        }),
      })
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        appPort = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await mockServer.stop();
  });

  it('runs verbatim README quickstart through create and callback without crashing', async () => {
    // 1. Create payment session via quickstart endpoint
    const createRes = await fetch(`http://localhost:${appPort}/api/bkash/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 1550,
        invoiceNumber: 'INV_1001',
        callbackUrl: `http://localhost:${appPort}/api/bkash/callback`,
      }),
    });

    expect(createRes.status).toBe(200);
    const createData = (await createRes.json()) as any;
    expect(createData.success).toBe(true);
    expect(createData.paymentId).toBeDefined();

    // 2. Callback redirect from bKash gateway
    const callbackRes = await fetch(
      `http://localhost:${appPort}/api/bkash/callback?paymentID=${createData.paymentId}&status=success`
    );

    const callbackData = (await callbackRes.json()) as any;
    // On current code without default sessionStore, this returns HTTP 500 with error:
    // "expectedOrder must be provided directly or resolvable via SessionStore"
    expect(callbackRes.status).toBe(200);
    expect(callbackData.success).toBe(true);
    expect(callbackData.transactionStatus).toBe('Completed');
  });
});
