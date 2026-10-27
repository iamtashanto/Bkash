import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import Koa from 'koa';
import { BkashServer } from '../../src/server.js';
import {
  createExpressHandler,
  createFastifyHandler,
  createHonoHandler,
  createKoaHandler,
  createNextHandler,
  createRemixHandler,
  createSvelteKitHandler,
  createAstroHandler,
} from '../../src/frameworks.js';
import { MockBkashServer } from '../mocks/mock-bkash-server.js';

const order = async () => ({ amount: 1550, currency: 'BDT' as const, invoiceNumber: 'INV_FW_1' });
const closeServer = (server: http.Server) =>
  new Promise<void>((resolve) => {
    (server as http.Server & { closeAllConnections?: () => void }).closeAllConnections?.();
    server.close(() => resolve());
  });

const options = { basePath: '/api/bkash', resolveOrder: order };

describe('adapters inside the real frameworks', () => {
  let mock: MockBkashServer;
  let bkash: BkashServer;
  const closers: Array<() => Promise<void>> = [];
  const urls: Record<string, string> = {};

  const listen = (server: http.Server) =>
    new Promise<string>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`))
    );

  beforeAll(async () => {
    mock = new MockBkashServer();
    const baseUrl = await mock.start();
    bkash = new BkashServer({
      apiVersion: 'v1.2.0-beta',
      appKey: 'k',
      appSecret: 's',
      username: 'u',
      password: 'p',
      baseUrl,
    });

    // Express (with and without a JSON body parser)
    const ex = express();
    ex.use('/api/bkash', express.json(), createExpressHandler(bkash, options));
    const exServer = http.createServer(ex);
    urls.express = await listen(exServer);
    closers.push(() => closeServer(exServer as http.Server));

    const exRaw = express();
    exRaw.use('/api/bkash', createExpressHandler(bkash, options));
    const exRawServer = http.createServer(exRaw);
    urls.expressNoParser = await listen(exRawServer);
    closers.push(() => closeServer(exRawServer as http.Server));

    // Fastify
    const fy = Fastify();
    fy.all('/api/bkash/*', createFastifyHandler(bkash, options));
    await fy.listen({ port: 0, host: '127.0.0.1' });
    urls.fastify = `http://127.0.0.1:${(fy.server.address() as AddressInfo).port}`;
    closers.push(() => fy.close());

    // Hono
    const hono = new Hono();
    hono.all('/api/bkash/*', createHonoHandler(bkash, options));
    const honoServer = serve({ fetch: hono.fetch, port: 0, hostname: '127.0.0.1' });
    await new Promise((r) => setTimeout(r, 50));
    urls.hono = `http://127.0.0.1:${(honoServer.address() as AddressInfo).port}`;
    closers.push(() => closeServer(honoServer as http.Server));

    // Koa
    const koa = new Koa();
    koa.use(createKoaHandler(bkash, options));
    const koaServer = http.createServer(koa.callback());
    urls.koa = await listen(koaServer);
    closers.push(() => closeServer(koaServer as http.Server));
  });

  afterAll(async () => {
    for (const c of closers) await c();
    await mock.stop();
  });

  for (const name of ['express', 'expressNoParser', 'fastify', 'hono', 'koa']) {
    it(`${name}: POST /create uses the server price and ignores the browser body`, async () => {
      const res = await fetch(`${urls[name]}/api/bkash/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: 1, callbackUrl: 'https://evil.test/x' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; paymentId: string; amount: string };
      expect(body.success).toBe(true);
      expect(body.paymentId).toBeTruthy();
      expect(String(body.amount)).toContain('1550');
    });

    it(`${name}: unknown route is not handled as a payment route`, async () => {
      const res = await fetch(`${urls[name]}/api/bkash/refund`, { method: 'POST', body: '{}' });
      expect(res.status).toBe(404);
    });
  }

  it('web-standard adapters (Next, Remix, SvelteKit, Astro) answer the same requests', async () => {
    const req = () =>
      new Request('https://shop.example/api/bkash/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: 1 }),
      });
    const next = createNextHandler(bkash, options);
    const remix = createRemixHandler(bkash, options);
    const kit = createSvelteKitHandler(bkash, options);
    const astro = createAstroHandler(bkash, options);
    const results = await Promise.all([
      next.POST(req()),
      remix.action({ request: req() }),
      kit({ request: req() }),
      astro.POST({ request: req() }),
    ]);
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(((await r.json()) as { amount: string }).amount).toContain('1550');
    }
  });
});
