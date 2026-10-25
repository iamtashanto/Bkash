import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BkashServer } from '../../src/server.js';
import { BkashHttpHandler } from '../../src/http/handler.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';

describe('Security Audit: HTTP Handler & Payment Tampering Protection', () => {
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

  describe('1. Amount Tampering Prevention via resolveOrder', () => {
    it('enforces server-side resolveOrder and ignores client-supplied tampered amounts', async () => {
      const handler = new BkashHttpHandler(bkash, {
        resolveOrder: async (req, body) => {
          // Server looks up order from internal session/database
          return {
            amount: 1550,
            currency: 'BDT',
            invoiceNumber: 'INV_SECURE_1001',
          };
        },
      });

      // Attacker attempts to pay 1 BDT for a 1550 BDT order
      const clientReq = new Request('http://localhost:3000/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1, // Attacker tamper attempt
          invoiceNumber: 'INV_TAMPERED',
          callbackUrl: 'http://localhost:3000/callback',
        }),
      });

      const res = await handler.handle(clientReq);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);

      // Verify server session stored the genuine amount (1550.00), not the tampered 1 BDT
      const session = await bkash.sessionStore.getSession(data.paymentId);
      expect(session?.expectedOrder.amount).toBe(1550);
      expect(session?.expectedOrder.invoiceNumber).toBe('INV_SECURE_1001');
    });

    it('rejects client-supplied amounts by default if resolveOrder is not provided', async () => {
      // Handler configured without resolveOrder and without allowClientAmount
      const handler = new BkashHttpHandler(bkash);

      const clientReq = new Request('http://localhost:3000/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 100,
          invoiceNumber: 'INV_UNSECURE',
          callbackUrl: 'http://localhost:3000/callback',
        }),
      });

      const res = await handler.handle(clientReq);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toMatch(/resolveOrder|client-supplied amount/i);
    });
  });

  describe('2. Open Redirect Protection on Callback', () => {
    it('rejects arbitrary redirect destinations not in allowedRedirectOrigins', async () => {
      const handler = new BkashHttpHandler(bkash, {
        allowedRedirectOrigins: ['https://merchant.example.com'],
        resolveOrder: async () => ({
          amount: 100,
          currency: 'BDT',
          invoiceNumber: 'INV_100',
        }),
      });

      // Attacker attempts open redirect to malicious phishing page
      const callbackReq = new Request(
        'http://localhost:3000/callback?paymentID=BKASH_PAY_MOCK_12345&status=success&returnUrl=https://evil-phishing.com/steal-creds'
      );

      const res = await handler.handle(callbackReq);
      // Response must NOT redirect to evil-phishing.com
      const location = res.headers.get('location');
      expect(location == null || !location.includes('evil-phishing.com')).toBe(true);
    });
  });

  describe('3. Public Status Endpoint & Data Minimization', () => {
    it('exposes minimal public status fields without leaking customer MSISDN or tokens', async () => {
      const handler = new BkashHttpHandler(bkash);

      const statusReq = new Request('http://localhost:3000/status?paymentId=BKASH_PAY_MOCK_12345');
      const res = await handler.handle(statusReq);

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.transactionStatus).toBeDefined();

      // Verify no sensitive tokens or customer PII are leaked
      expect(data.id_token).toBeUndefined();
      expect(data.idToken).toBeUndefined();
      expect(data.app_secret).toBeUndefined();
      expect(data.appSecret).toBeUndefined();
      expect(data.password).toBeUndefined();
      if (data.customerMsisdn) {
        expect(data.customerMsisdn).toMatch(/\*\*\*/); // Masked if present
      }
    });
  });
});
