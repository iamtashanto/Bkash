import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { sanitizeLogData, maskMsisdn } from '../../src/utils/sanitizer.js';
import {
  BkashApiError,
  BkashDuplicateExecutionError,
  BkashError,
  BkashRateLimitError,
  BkashTimeoutError,
  BkashVerificationMismatchError,
  BkashWebhookVerificationError,
  mapBkashErrorCode,
} from '../../src/errors.js';
import {
  createExpressHandler,
  createFastifyHandler,
  createHonoHandler,
  createNextHandler,
  createKoaHandler,
  createSvelteKitHandler,
  createRemixHandler,
  createAstroHandler,
  nodeToWebRequest,
  sendWebResponseToNode,
} from '../../src/frameworks/index.js';
import { BkashServer } from '../../src/server.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';
import { generateUUID } from '../../src/utils/crypto.js';

describe('Extended Core Coverage & Framework Adapters', () => {
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

  describe('Sanitizer & Crypto', () => {
    it('masks phone numbers of various lengths', () => {
      expect(maskMsisdn('')).toBe('');
      expect(maskMsisdn('12345')).toBe('***');
      expect(maskMsisdn('01712345678')).toBe('017****5678');
    });

    it('recursively sanitizes nested sensitive objects and arrays', () => {
      const data = {
        username: 'test_merchant',
        password: 'super_secret_password',
        appSecret: 'app_secret_value',
        customerMsisdn: '01811223344',
        nested: {
          id_token: 'bearer_token_xyz',
          meta: ['item1', { authorization: 'Bearer 123' }],
        },
      };

      const sanitized = sanitizeLogData(data) as any;
      expect(sanitized.username).toBe('test_merchant');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.appSecret).toBe('[REDACTED]');
      expect(sanitized.customerMsisdn).toBe('018****3344');
      expect(sanitized.nested.id_token).toBe('[REDACTED]');
      expect(sanitized.nested.meta[1].authorization).toBe('[REDACTED]');
    });

    it('generates a valid UUID string', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('Error Classes & Mapping', () => {
    it('constructs all error types with proper properties', () => {
      const baseErr = new BkashError('base message', 'BASE_CODE');
      expect(baseErr.code).toBe('BASE_CODE');
      expect(baseErr.timestamp).toBeDefined();

      const apiErr = new BkashApiError('api message', {
        externalCode: '2001',
        internalCode: 'invalid_credentials',
        httpStatus: 401,
        raw: { error: true },
      });
      expect(apiErr.code).toBe('BKASH_API_2001');
      expect(apiErr.httpStatus).toBe(401);

      const dupErr = new BkashDuplicateExecutionError('PAY_123');
      expect(dupErr.paymentId).toBe('PAY_123');
      expect(dupErr.code).toBe('BKASH_DUPLICATE_EXECUTION');

      const hookErr = new BkashWebhookVerificationError('invalid signature');
      expect(hookErr.reason).toBe('invalid signature');

      // Official table (developer.bka.sh): 2023 = Insufficient Balance, 2005 = Invalid frequency
      expect(mapBkashErrorCode('2023').message).toBe('Insufficient Balance');
      expect(mapBkashErrorCode('2005').message).toBe('Invalid frequency');
      expect(mapBkashErrorCode('2062').message).toBe('The payment has already been completed');

      const mappedUnknown = mapBkashErrorCode('9999', 'Custom unmapped message');
      expect(mappedUnknown.message).toBe('Custom unmapped message');
    });
  });

  describe('Framework Adapters Smoke Tests', () => {
    it('converts Node req to Web Request and pipes Web Response to Node res', async () => {
      const mockReq: any = {
        url: '/api/bkash/callback?paymentID=123&status=success',
        method: 'GET',
        headers: { host: 'localhost:3000' },
      };

      const webReq = await nodeToWebRequest(mockReq);
      expect(webReq.url).toBe('http://localhost:3000/api/bkash/callback?paymentID=123&status=success');

      let written = '';
      const mockRes: any = {
        statusCode: 200,
        headers: {},
        setHeader: (k: string, v: string) => {
          mockRes.headers[k] = v;
        },
        end: (buf: Buffer) => {
          written = buf.toString();
        },
      };

      const webRes = new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      await sendWebResponseToNode(webRes, mockRes);
      expect(mockRes.statusCode).toBe(200);
      expect(JSON.parse(written)).toEqual({ ok: true });
    });

    it('invokes createExpressHandler middleware', async () => {
      const opts = {
        resolveOrder: async () => ({
          amount: 100,
          currency: 'BDT' as const,
          invoiceNumber: 'INV_TEST',
        }),
      };
      const handler = createExpressHandler(bkash, opts);
      const req: any = {
        url: '/create',
        method: 'POST',
        headers: { host: 'localhost:3000', 'content-type': 'application/json' },
        body: {
          invoiceNumber: 'INV_EXP',
          callbackUrl: 'http://localhost/callback',
        },
      };
      let output = '';
      const res: any = {
        statusCode: 0,
        headers: {},
        setHeader: (k: string, v: string) => {
          res.headers[k] = v;
        },
        end: (buf: Buffer) => {
          output = buf.toString();
        },
      };

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(output).toContain('BKASH_PAY_MOCK_12345');
    });

    it('invokes createHonoHandler', async () => {
      const opts = {
        resolveOrder: async () => ({
          amount: 100,
          currency: 'BDT' as const,
          invoiceNumber: 'INV_TEST',
        }),
      };
      const honoHandler = createHonoHandler(bkash, opts);
      const req = new Request('http://localhost:3000/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: 'INV_HONO',
          callbackUrl: 'http://localhost/callback',
        }),
      });

      const res = await honoHandler({ req: { raw: req } });
      expect(res.status).toBe(200);
    });

    it('invokes createNextHandler', async () => {
      const opts = {
        resolveOrder: async () => ({
          amount: 100,
          currency: 'BDT' as const,
          invoiceNumber: 'INV_TEST',
        }),
      };
      const { POST } = createNextHandler(bkash, opts);
      const req = new Request('http://localhost:3000/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: 'INV_NEXT',
          callbackUrl: 'http://localhost/callback',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it('invokes createSvelteKitHandler, createRemixHandler, and createAstroHandler', async () => {
      const opts = {
        resolveOrder: async () => ({
          amount: 100,
          currency: 'BDT' as const,
          invoiceNumber: 'INV_TEST',
        }),
      };
      const svelteHandler = createSvelteKitHandler(bkash, opts);
      const remixHandler = createRemixHandler(bkash, opts);
      const astroHandler = createAstroHandler(bkash, opts);

      const makeReq = () =>
        new Request('http://localhost:3000/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceNumber: 'INV_MULTI',
            callbackUrl: 'http://localhost/callback',
          }),
        });

      const svelteRes = await svelteHandler({ request: makeReq() });
      expect(svelteRes.status).toBe(200);

      const remixRes = await remixHandler.action({ request: makeReq() });
      expect(remixRes.status).toBe(200);

      const astroRes = await astroHandler.POST({ request: makeReq() });
      expect(astroRes.status).toBe(200);
    });
    it('invokes createFastifyHandler and createKoaHandler', async () => {
      const opts = {
        resolveOrder: async () => ({
          amount: 100,
          currency: 'BDT' as const,
          invoiceNumber: 'INV_TEST',
        }),
      };
      const fastifyHandler = createFastifyHandler(bkash, opts);
      const req: any = {
        url: '/create',
        method: 'POST',
        headers: { host: 'localhost:3000', 'content-type': 'application/json' },
        body: {
          invoiceNumber: 'INV_FASTIFY',
          callbackUrl: 'http://localhost/callback',
        },
      };
      let fastifyOutput = '';
      const reply: any = {
        status: (code: number) => {
          reply.statusCode = code;
          return reply;
        },
        header: (k: string, v: string) => {
          return reply;
        },
        send: (body: string) => {
          fastifyOutput = body;
          return reply;
        },
      };

      await fastifyHandler(req, reply);
      expect(reply.statusCode).toBe(200);
      expect(fastifyOutput).toContain('BKASH_PAY_MOCK_12345');

      const koaHandler = createKoaHandler(bkash, opts);
      const koaCtx: any = {
        req: {
          url: '/create',
          method: 'POST',
          headers: { host: 'localhost:3000', 'content-type': 'application/json' },
        },
        request: {
          body: {
            invoiceNumber: 'INV_KOA',
            callbackUrl: 'http://localhost/callback',
          },
        },
        status: 200,
        set: (k: string, v: string) => {},
        body: null,
      };

      await koaHandler(koaCtx);
      expect(koaCtx.status).toBe(200);
      expect(JSON.stringify(koaCtx.body)).toContain('BKASH_PAY_MOCK_12345');
    });
  });

  describe('Search & Refund Methods', () => {
    it('executes searchTransaction and refundPayment', async () => {
      // searchTransaction
      const searchRes = await bkash.searchTransaction({ trxId: 'TRX_12345' });
      expect(searchRes).toBeDefined();

      // refundPayment
      const refundRes = await bkash.refundPayment({
        paymentId: 'BKASH_PAY_123',
        trxId: 'TRX_12345',
        amount: 50,
        reason: 'Customer return',
      });
      expect(refundRes.refundTrxId).toBeDefined();
      expect(refundRes.transactionStatus).toBe('Completed');
    });

    it('handles queryPayment', async () => {
      const queryRes = await bkash.queryPayment('BKASH_PAY_123');
      expect(queryRes).toBeDefined();
      expect(queryRes.paymentId).toBe('BKASH_PAY_123');
    });
  });
});
