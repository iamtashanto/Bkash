import { describe, it, expect, vi, afterEach } from 'vitest';
import { BkashClient } from '../../src/index.js';

describe('checkout does not need (or send) an amount', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts no amount or invoice when called without arguments', async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({ redirectUrl: 'https://pay.example/x', paymentId: 'P1' }), { status: 200 });
    });
    const client = new BkashClient({ createUrl: '/api/bkash/create', callbackUrl: 'https://shop.example/cb' });
    await client.checkout();
    expect(client.getState()).toBe('awaiting_user');
    expect(body.amount).toBeUndefined();
    expect(body.invoiceNumber).toBeUndefined();
  });
});
