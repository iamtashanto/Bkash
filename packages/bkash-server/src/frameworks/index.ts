import type { BkashServer } from '../server.js';
import { BkashHttpHandler, type BkashHandlerOptions } from '../http/handler.js';

/**
 * Universal Node.js req/res to Web Standard Request converter.
 */
export async function nodeToWebRequest(req: any): Promise<Request> {
  const protocol = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, String(value));
      }
    }
  }

  const method = req.method || 'GET';
  let body: any = null;

  if (method !== 'GET' && method !== 'HEAD') {
    if (req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      if (chunks.length > 0) {
        body = Buffer.concat(chunks);
      }
    }
  }

  return new Request(url, {
    method,
    headers,
    body,
  });
}

/**
 * Pipes a Web Standard Response to a Node.js ServerResponse.
 */
export async function sendWebResponseToNode(webRes: Response, res: any): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((val, key) => {
    res.setHeader(key, val);
  });
  const arrayBuffer = await webRes.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

/**
 * Express middleware adapter.
 */
export function createExpressHandler(bkash: BkashServer, options?: BkashHandlerOptions) {
  const handler = new BkashHttpHandler(bkash, options);
  return async (req: any, res: any, next?: any) => {
    try {
      const webReq = await nodeToWebRequest(req);
      const webRes = await handler.handle(webReq);
      if (webRes.status === 404 && next) {
        return next();
      }
      await sendWebResponseToNode(webRes, res);
    } catch (err) {
      if (next) next(err);
      else {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err) }));
      }
    }
  };
}

/**
 * Fastify plugin adapter.
 */
export function createFastifyHandler(bkash: BkashServer, options?: BkashHandlerOptions) {
  const handler = new BkashHttpHandler(bkash, options);
  return async (fastifyReq: any, fastifyReply: any) => {
    const webReq = await nodeToWebRequest(fastifyReq.raw);
    const webRes = await handler.handle(webReq);
    fastifyReply.status(webRes.status);
    webRes.headers.forEach((val, key) => fastifyReply.header(key, val));
    const data = await webRes.text();
    return fastifyReply.send(data);
  };
}

/**
 * Hono middleware adapter.
 */
export function createHonoHandler(bkash: BkashServer, options?: BkashHandlerOptions) {
  const handler = new BkashHttpHandler(bkash, options);
  return async (c: any) => {
    return handler.handle(c.req.raw);
  };
}

/**
 * Next.js App Router Route Handler (GET and POST).
 */
export function createNextHandler(bkash: BkashServer, options?: BkashHandlerOptions) {
  const handler = new BkashHttpHandler(bkash, options);
  return {
    GET: (request: Request) => handler.handle(request),
    POST: (request: Request) => handler.handle(request),
  };
}

/**
 * Koa middleware adapter.
 */
export function createKoaHandler(bkash: BkashServer, options?: BkashHandlerOptions) {
  const handler = new BkashHttpHandler(bkash, options);
  return async (ctx: any, next?: any) => {
    const webReq = await nodeToWebRequest(ctx.req);
    const webRes = await handler.handle(webReq);
    if (webRes.status === 404 && next) {
      return next();
    }
    ctx.status = webRes.status;
    webRes.headers.forEach((val, key) => ctx.set(key, val));
    ctx.body = await webRes.text();
  };
}

/**
 * SvelteKit RequestHandler adapter.
 */
export function createSvelteKitHandler(bkash: BkashServer, options?: BkashHandlerOptions) {
  const handler = new BkashHttpHandler(bkash, options);
  return async ({ request }: { request: Request }) => {
    return handler.handle(request);
  };
}

/**
 * Remix / React Router loader & action adapter.
 */
export function createRemixHandler(bkash: BkashServer, options?: BkashHandlerOptions) {
  const handler = new BkashHttpHandler(bkash, options);
  return {
    loader: ({ request }: { request: Request }) => handler.handle(request),
    action: ({ request }: { request: Request }) => handler.handle(request),
  };
}

/**
 * Astro API endpoint handler.
 */
export function createAstroHandler(bkash: BkashServer, options?: BkashHandlerOptions) {
  const handler = new BkashHttpHandler(bkash, options);
  return {
    GET: ({ request }: { request: Request }) => handler.handle(request),
    POST: ({ request }: { request: Request }) => handler.handle(request),
    ALL: ({ request }: { request: Request }) => handler.handle(request),
  };
}
