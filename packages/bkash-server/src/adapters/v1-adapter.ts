import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentExecutionResult,
  RefundParams,
  RefundResult,
  RefundStatusParams,
  RefundStatusResult,
} from '../types.js';
import type { BkashVersionAdapter, GrantTokenResponse } from './adapter.interface.js';
import { BkashRateLimitError, mapBkashErrorCode } from '../errors.js';
import { formatAmount } from '../utils/sanitizer.js';

export interface V1AdapterConfig {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  baseUrl: string;
  timeoutMs: number;
}

export class V1Adapter implements BkashVersionAdapter {
  public readonly version = 'v1.2.0-beta';
  private config: V1AdapterConfig;

  constructor(config: V1AdapterConfig) {
    this.config = config;
  }

  private cleanBaseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(
    endpoint: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body?: unknown;
    }
  ): Promise<T> {
    const url = `${this.cleanBaseUrl()}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new BkashRateLimitError('bKash rate limit exceeded (HTTP 429). Max 2 calls/hr limit.');
      }

      const text = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        throw mapBkashErrorCode('PARSE_ERROR', `Failed to parse response from ${endpoint}: ${text}`, response.status);
      }

      const statusCode = String(data['statusCode'] ?? data['errorCode'] ?? '');
      const statusMessage = String(data['statusMessage'] ?? data['errorMessageEn'] ?? data['message'] ?? '');

      if (statusCode && statusCode !== '0000') {
        throw mapBkashErrorCode(statusCode, statusMessage, response.status, data);
      }

      return data as T;
    } catch (err: unknown) {
      if (err instanceof BkashRateLimitError) {
        throw err;
      }
      if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
        const timeoutErr = new Error(`Request to bKash endpoint ${endpoint} timed out after ${this.config.timeoutMs}ms`);
        timeoutErr.name = 'TimeoutError';
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async grantToken(): Promise<GrantTokenResponse> {
    const endpoint = '/tokenized/checkout/token/grant';
    const result = await this.request<{
      id_token: string;
      refresh_token?: string;
      expires_in: number | string;
    }>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        username: this.config.username,
        password: this.config.password,
      },
      body: {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
      },
    });

    return {
      idToken: result.id_token,
      refreshToken: result.refresh_token,
      expiresIn: Number(result.expires_in) || 3600,
    };
  }

  public async refreshToken(): Promise<GrantTokenResponse> {
    // v1.2.0-beta issues a grant call for refreshed tokens
    return this.grantToken();
  }

  public async createPayment(idToken: string, params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const endpoint = '/tokenized/checkout/create';
    const amountStr = formatAmount(params.amount);

    const result = await this.request<{
      paymentID: string;
      bkashURL: string;
      callbackURL: string;
      amount: string;
      currency: 'BDT';
      merchantInvoiceNumber: string;
      paymentCreateTime?: string;
    }>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: idToken,
        'X-APP-Key': this.config.appKey,
      },
      body: {
        mode: params.mode ?? '0011',
        payerReference: params.payerReference ?? ' ',
        callbackURL: params.callbackUrl,
        amount: amountStr,
        currency: 'BDT',
        intent: params.intent ?? 'sale',
        merchantInvoiceNumber: params.invoiceNumber,
      },
    });

    return {
      paymentId: result.paymentID,
      redirectUrl: result.bkashURL,
      callbackUrl: result.callbackURL,
      amount: result.amount,
      currency: 'BDT',
      invoiceNumber: result.merchantInvoiceNumber,
      status: 'Initiated',
      createdAt: result.paymentCreateTime || new Date().toISOString(),
    };
  }

  public async executePayment(idToken: string, paymentId: string): Promise<PaymentExecutionResult> {
    const endpoint = '/tokenized/checkout/execute';
    const result = await this.request<{
      paymentID: string;
      trxID: string;
      transactionStatus: 'Completed' | 'Authorized';
      amount: string;
      currency: 'BDT';
      merchantInvoiceNumber: string;
      customerMsisdn?: string;
      paymentExecuteTime?: string;
    }>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: idToken,
        'X-APP-Key': this.config.appKey,
      },
      body: {
        paymentID: paymentId,
      },
    });

    return {
      paymentId: result.paymentID,
      trxId: result.trxID,
      transactionStatus: result.transactionStatus,
      amount: formatAmount(result.amount),
      currency: result.currency ?? 'BDT',
      invoiceNumber: result.merchantInvoiceNumber,
      customerMsisdn: result.customerMsisdn,
      completedAt: result.paymentExecuteTime || new Date().toISOString(),
      reconciled: false,
      rawResponse: result as unknown as Record<string, unknown>,
    };
  }

  public async queryPayment(idToken: string, paymentId: string): Promise<PaymentExecutionResult> {
    const endpoint = '/tokenized/checkout/payment/status';
    const result = await this.request<{
      paymentID: string;
      trxID: string;
      transactionStatus: 'Completed' | 'Authorized';
      amount: string;
      currency: 'BDT';
      merchantInvoiceNumber: string;
      customerMsisdn?: string;
      paymentExecuteTime?: string;
    }>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: idToken,
        'X-APP-Key': this.config.appKey,
      },
      body: {
        paymentID: paymentId,
      },
    });

    return {
      paymentId: result.paymentID,
      trxId: result.trxID,
      transactionStatus: result.transactionStatus,
      amount: formatAmount(result.amount),
      currency: result.currency ?? 'BDT',
      invoiceNumber: result.merchantInvoiceNumber,
      customerMsisdn: result.customerMsisdn,
      completedAt: result.paymentExecuteTime || new Date().toISOString(),
      reconciled: true,
      rawResponse: result as unknown as Record<string, unknown>,
    };
  }

  public async searchTransaction(idToken: string, trxId: string): Promise<Record<string, unknown>> {
    const endpoint = '/tokenized/checkout/general/searchTransaction';
    return this.request<Record<string, unknown>>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: idToken,
        'X-APP-Key': this.config.appKey,
      },
      body: {
        trxID: trxId,
      },
    });
  }

  public async refundPayment(idToken: string, params: RefundParams): Promise<RefundResult> {
    const endpoint = '/tokenized/checkout/payment/refund';
    const result = await this.request<{
      refundTrxID: string;
      originalTrxID: string;
      amount: string;
      currency: 'BDT';
      completedTime?: string;
      transactionStatus: 'Completed';
    }>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: idToken,
        'X-APP-Key': this.config.appKey,
      },
      body: {
        paymentID: params.paymentId,
        trxID: params.trxId,
        amount: formatAmount(params.amount),
        reason: params.reason,
        sku: params.sku ?? 'N/A',
      },
    });

    return {
      refundTrxId: result.refundTrxID,
      originalTrxId: result.originalTrxID,
      amount: formatAmount(result.amount),
      currency: result.currency ?? 'BDT',
      completedAt: result.completedTime || new Date().toISOString(),
      transactionStatus: result.transactionStatus,
      rawResponse: result as unknown as Record<string, unknown>,
    };
  }

  public async refundStatus(idToken: string, params: RefundStatusParams): Promise<RefundStatusResult> {
    const endpoint = '/tokenized/checkout/payment/refund';
    const result = await this.request<{
      refundTrxID?: string;
      originalTrxID?: string;
      amount?: string;
      currency?: 'BDT';
      completedTime?: string;
      transactionStatus?: 'Completed';
    }>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: idToken,
        'X-APP-Key': this.config.appKey,
      },
      body: {
        paymentID: params.paymentId,
        trxID: params.trxId,
      },
    });

    return {
      refundTrxId: result.refundTrxID || '',
      originalTrxId: result.originalTrxID || params.trxId,
      amount: formatAmount(result.amount || '0'),
      currency: result.currency ?? 'BDT',
      completedAt: result.completedTime || new Date().toISOString(),
      transactionStatus: result.transactionStatus || 'Completed',
      rawResponse: result as unknown as Record<string, unknown>,
    };
  }
}
