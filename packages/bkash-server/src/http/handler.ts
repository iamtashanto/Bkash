import type { BkashServer } from '../server.js';
import type { PaymentExecutionResult, VerifiedWebhookPayload } from '../types.js';

export interface BkashHandlerOptions {
  /** Optional base path prefix (e.g. "/api/bkash") */
  basePath?: string;
  /** Hook called when payment completes successfully */
  onSuccess?: (
    result: PaymentExecutionResult,
    req: Request
  ) => Promise<Response | void> | Response | void;
  /** Hook called when payment fails */
  onError?: (
    error: Error,
    req: Request
  ) => Promise<Response | void> | Response | void;
  /** Hook called when a verified webhook notification is processed */
  onWebhook?: (
    payload: VerifiedWebhookPayload,
    req: Request
  ) => Promise<Response | void> | Response | void;
}

export class BkashHttpHandler {
  private bkash: BkashServer;
  private options: BkashHandlerOptions;

  constructor(bkash: BkashServer, options?: BkashHandlerOptions) {
    this.bkash = bkash;
    this.options = options || {};
  }

  /**
   * Framework-agnostic handler with a Web-standard signature:
   * handle(request: Request): Promise<Response>
   */
  public async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const basePath = (this.options.basePath || '').replace(/\/+$/, '');
    let path = url.pathname;
    if (basePath && path.startsWith(basePath)) {
      path = path.slice(basePath.length);
    }
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    try {
      // 1. Create Payment: POST /create
      if (request.method === 'POST' && path === '/create') {
        const body = (await request.json()) as any;
        const result = await this.bkash.createPayment(body);
        return new Response(JSON.stringify({ success: true, ...result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 2. Callback: GET or POST /callback
      if ((request.method === 'GET' || request.method === 'POST') && path === '/callback') {
        let paymentId: string | null = null;
        let status: string | null = null;

        if (request.method === 'GET') {
          paymentId = url.searchParams.get('paymentID') || url.searchParams.get('paymentId');
          status = url.searchParams.get('status');
        } else {
          const body = ((await request.json().catch(() => ({}))) || {}) as Record<string, any>;
          paymentId = body.paymentID || body.paymentId || url.searchParams.get('paymentId');
          status = body.status || url.searchParams.get('status');
        }

        if (status === 'cancel' || status === 'failure') {
          const err = new Error(`Payment ${status}: User aborted or payment failed at bKash gateway.`);
          if (this.options.onError) {
            const customRes = await this.options.onError(err, request);
            if (customRes) return customRes;
          }
          return new Response(JSON.stringify({ success: false, status, message: err.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (!paymentId) {
          const err = new Error('Callback missing paymentId parameter.');
          if (this.options.onError) {
            const customRes = await this.options.onError(err, request);
            if (customRes) return customRes;
          }
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const result = await this.bkash.executePayment({ paymentId });

        if (this.options.onSuccess) {
          const customRes = await this.options.onSuccess(result, request);
          if (customRes) return customRes;
        }

        return new Response(JSON.stringify({ success: true, ...result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 3. Webhook: POST /webhook
      if (request.method === 'POST' && path === '/webhook') {
        const rawBody = await request.text();
        const verified = await this.bkash.webhook.verify(rawBody);

        if (verified) {
          // If transaction info is in webhook, query to confirm before completing
          const paymentId = (verified.data as any)?.paymentID || (verified.data as any)?.paymentId;
          if (paymentId) {
            await this.bkash.queryPayment({ paymentId });
          }

          if (this.options.onWebhook) {
            const customRes = await this.options.onWebhook(verified, request);
            if (customRes) return customRes;
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found', path }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (this.options.onError) {
        const customRes = await this.options.onError(error, request);
        if (customRes) return customRes;
      }
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

/**
 * Creates a standard Web Request handler.
 */
export function createBkashHandler(
  bkash: BkashServer,
  options?: BkashHandlerOptions
): BkashHttpHandler {
  return new BkashHttpHandler(bkash, options);
}
