import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import { BkashServer } from '../../src/server.js';
import { V1Adapter } from '../../src/adapters/v1-adapter.js';

/**
 * Strict mock: only the exact paths and field names documented at developer.bka.sh (v2)
 * are served. Anything else is a 404, so a wrong endpoint or field name fails the test.
 */
const calls: Array<{
  path: string;
  body: Record<string, any>;
  headers: http.IncomingHttpHeaders;
}> = [];

const routes: Record<string, (b: Record<string, any>) => Record<string, any>> = {
  '/v2/tokenized-checkout/auth/grant-token': () => ({
    statusCode: '0000',
    statusMessage: 'Successful',
    token_type: 'Bearer',
    id_token: 'ID',
    refresh_token: 'RF',
    expires_in: 3600,
  }),
  '/v2/tokenized-checkout/payment/create': (b) => ({
    paymentId: 'TR1',
    paymentCreateTime: '2026-10-27T10:00:00GMT+0600',
    transactionStatus: 'Initiated',
    amount: b.amount,
    currency: 'BDT',
    merchantInvoiceNumber: b.merchantInvoiceNumber,
    intent: 'sale',
    bKashURL: 'https://pay.example/TR1',
    callbackURL: b.callbackURL,
  }),
  '/v2/tokenized-checkout/payment/execute': () => ({
    paymentId: 'TR1',
    trxId: 'TRX1',
    transactionStatus: 'Completed',
    amount: '2.90',
    currency: 'BDT',
    intent: 'sale',
    merchantInvoiceNumber: 'inv-1',
    payerAccount: '01770618575',
    maxRefundableAmount: '2.90',
    creditedAmount: '2.90',
  }),
  '/v2/tokenized-checkout/query/payment': () => ({
    paymentId: 'TR1',
    trxId: 'TRX1',
    transactionStatus: 'Completed',
    amount: '2.90',
    currency: 'BDT',
    merchantInvoice: 'inv-1',
    payerAccount: '01770618575',
  }),
  '/v2/tokenized-checkout/general/search-transaction': () => ({
    trxId: 'TRX1',
    transactionStatus: 'Completed',
    amount: '2.90',
  }),
  '/v2/tokenized-checkout/refund/payment/transaction': (b) => ({
    originalTrxId: b.trxId,
    refundTrxId: 'RTRX1',
    refundTransactionStatus: 'Completed',
    refundAmount: b.refundAmount,
    currency: 'BDT',
    completedTime: '2026-10-27T10:05:00GMT+0600',
  }),
  '/v2/tokenized-checkout/refund/payment/status': () => ({
    originalTrxId: 'TRX1',
    originalTrxAmount: '2.90',
    refundTransactions: [
      {
        refundTrxId: 'RTRX1',
        refundTransactionStatus: 'Completed',
        refundAmount: '1.00',
        completedTime: 't',
      },
    ],
  }),
  '/v2/tokenized-checkout/agreement/create': (b) => ({
    paymentId: 'AG-P1',
    agreementId: 'AGR1',
    agreementStatus: 'Initiated',
    payerReference: b.payerReference,
    bKashURL: 'https://pay.example/AGR1',
    callbackURL: b.callbackURL,
  }),
  '/v2/tokenized-checkout/agreement/execute': (b) => ({
    agreementId: b.agreementId,
    payerReference: 'ref',
    agreementStatus: 'Completed',
    payerAccount: '01770618575',
  }),
  '/v2/tokenized-checkout/query/agreement': (b) => ({
    agreementId: b.agreementId,
    agreementStatus: 'Completed',
    verificationStatus: 'Complete',
    payerAccount: '01770618575',
  }),
  '/v2/tokenized-checkout/agreement/cancel': (b) => ({
    agreementId: b.agreementId,
    agreementStatus: 'Cancelled',
  }),
  '/v2/tokenized-checkout/payment-with-agreement/create': (b) => ({
    paymentId: 'TR2',
    agreementId: b.agreementId,
    transactionStatus: 'Initiated',
    amount: b.amount,
    currency: 'BDT',
    merchantInvoiceNumber: b.merchantInvoiceNumber,
    bkashURL: 'https://pay.example/TR2',
    callbackURL: b.callbackURL,
  }),
  '/v2/tokenized-checkout/payment-with-agreement/execute': (b) => ({
    paymentId: b.paymentId,
    agreementId: b.agreementId,
    trxId: 'TRX2',
    transactionStatus: 'Completed',
    amount: '5.00',
    currency: 'BDT',
    merchantInvoiceNumber: 'inv-2',
    payerAccount: '01770618575',
  }),
};

describe('bKash v2 conformance with the documented API shapes', () => {
  let server: http.Server;
  let bkash: BkashServer;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : {};
        calls.push({ path: req.url || '', body, headers: req.headers });
        const handler = routes[req.url || ''];
        res.setHeader('content-type', 'application/json');
        if (!handler) {
          res.statusCode = 404;
          return res.end(JSON.stringify({ message: 'no such route' }));
        }
        res.end(JSON.stringify(handler(body)));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    bkash = new BkashServer({
      apiVersion: 'v2',
      appKey: 'k',
      appSecret: 's',
      username: 'u',
      password: 'p',
      baseUrl: `http://127.0.0.1:${port}/v2`, // a trailing /v2 must not be doubled
    });
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  beforeEach(() => {
    calls.length = 0;
  });

  const last = () => calls[calls.length - 1];

  it('creates a payment with the documented fields and no legacy "mode"', async () => {
    const r = await bkash.createPayment({
      amount: '2.90',
      invoiceNumber: 'inv-1',
      callbackUrl: 'https://m.example/cb',
    });
    const c = calls.find((x) => x.path.endsWith('/payment/create'))!;
    expect(Object.keys(c.body).sort()).toEqual(
      ['amount', 'callbackURL', 'currency', 'intent', 'merchantInvoiceNumber', 'payerReference'].sort()
    );
    expect(c.headers['x-app-key']).toBe('k');
    expect(r.paymentId).toBe('TR1');
    expect(r.redirectUrl).toBe('https://pay.example/TR1');
  });

  it('executes with {paymentId} and verifies amount/invoice, exposing refund fields', async () => {
    await bkash.createPayment({
      amount: '2.90',
      invoiceNumber: 'inv-1',
      callbackUrl: 'https://m.example/cb',
    });
    const r = await bkash.executePayment({ paymentId: 'TR1' });
    expect(last().path).toBe('/v2/tokenized-checkout/payment/execute');
    expect(last().body).toEqual({ paymentId: 'TR1' });
    expect(r.trxId).toBe('TRX1');
    expect(r.maxRefundableAmount).toBe('2.90');
    expect(r.customerMsisdn).not.toContain('01770618575');
  });

  it('queries, searches, refunds and reads refund status on the documented paths', async () => {
    const q = await bkash.queryPayment('TR1');
    expect(last().path).toBe('/v2/tokenized-checkout/query/payment');
    expect(last().body).toEqual({ paymentId: 'TR1' });
    expect(q.invoiceNumber).toBe('inv-1');

    await bkash.searchTransaction({ trxId: 'TRX1' });
    expect(last().path).toBe('/v2/tokenized-checkout/general/search-transaction');
    expect(last().body).toEqual({ trxId: 'TRX1' });

    const rf = await bkash.refundPayment({
      paymentId: 'TR1',
      trxId: 'TRX1',
      amount: '1',
      reason: 'r',
      sku: 's',
    });
    expect(last().path).toBe('/v2/tokenized-checkout/refund/payment/transaction');
    expect(last().body).toEqual({
      paymentId: 'TR1',
      trxId: 'TRX1',
      refundAmount: '1.00',
      reason: 'r',
      sku: 's',
    });
    expect(rf.refundTrxId).toBe('RTRX1');

    const st = await bkash.refundStatus({ paymentId: 'TR1', trxId: 'TRX1' });
    expect(last().path).toBe('/v2/tokenized-checkout/refund/payment/status');
    expect(st.refunds).toHaveLength(1);
  });

  it('runs the full agreement lifecycle and pays with an agreement', async () => {
    const ag = await bkash.createAgreement({
      payerReference: '01770618575',
      callbackUrl: 'https://m.example/cb',
    });
    expect(ag.agreementId).toBe('AGR1');
    expect(ag.redirectUrl).toBe('https://pay.example/AGR1');

    const ex = await bkash.executeAgreement({ agreementId: 'AGR1' });
    expect(last().body).toEqual({ agreementId: 'AGR1' });
    expect(ex.agreementStatus).toBe('Completed');
    expect(ex.customerMsisdn).not.toContain('01770618575');

    const qa = await bkash.queryAgreement({ agreementId: 'AGR1' });
    expect(last().path).toBe('/v2/tokenized-checkout/query/agreement');
    expect(qa.verificationStatus).toBe('Complete');

    const pay = await bkash.createPayment({
      amount: '5.00',
      invoiceNumber: 'inv-2',
      callbackUrl: 'https://m.example/cb',
      agreementId: 'AGR1',
    });
    expect(last().path).toBe('/v2/tokenized-checkout/payment-with-agreement/create');
    expect(last().body.agreementId).toBe('AGR1');
    expect(pay.redirectUrl).toBe('https://pay.example/TR2');

    // agreementId is remembered from createPayment, so the caller does not have to resend it
    const done = await bkash.executePayment({ paymentId: 'TR2' });
    expect(last().path).toBe('/v2/tokenized-checkout/payment-with-agreement/execute');
    expect(last().body).toEqual({ paymentId: 'TR2', agreementId: 'AGR1' });
    expect(done.transactionStatus).toBe('Completed');

    await bkash.cancelAgreement({ agreementId: 'AGR1' });
    expect(last().path).toBe('/v2/tokenized-checkout/agreement/cancel');
  });
});

describe('v1.2.0-beta base URL', () => {
  it('adds the /v1.2.0-beta prefix on bka.sh hosts but leaves custom hosts alone', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(u);
      return new Response(JSON.stringify({ statusCode: '0000', id_token: 'x', expires_in: 3600 }), { status: 200 });
    });
    const mk = (baseUrl: string) =>
      new V1Adapter({
        appKey: 'k',
        appSecret: 's',
        username: 'u',
        password: 'p',
        baseUrl,
        timeoutMs: 1000,
      });
    await mk('https://tokenized.sandbox.bka.sh').grantToken();
    await mk('https://tokenized.sandbox.bka.sh/v1.2.0-beta/').grantToken();
    await mk('https://proxy.example.com/bkash').grantToken();
    vi.unstubAllGlobals();
    expect(urls).toEqual([
      'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant',
      'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant',
      'https://proxy.example.com/bkash/tokenized/checkout/token/grant',
    ]);
  });
});
