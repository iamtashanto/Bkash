import type {
  AgreementResult,
  CancelAgreementParams,
  CreateAgreementParams,
  CreateAgreementResult,
  ExecuteAgreementParams,
  QueryAgreementParams,
  QueryAgreementResult,
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

export interface V2AdapterConfig {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  baseUrl: string;
  timeoutMs: number;
}

/**
 * Tokenized Checkout v2 Adapter.
 *
 * Request/response shapes follow https://developer.bka.sh (v2 docs). Still flagged
 * EXPERIMENTAL until an owner-run sandbox end-to-end passes with v2 credentials.
 */
export class V2Adapter implements BkashVersionAdapter {
  public readonly version = 'v2';
  public readonly isExperimental = true;
  private config: V2AdapterConfig;

  constructor(config: V2AdapterConfig) {
    this.config = config;
  }

  private cleanBaseUrl(): string {
    // Accept either the bare host or a base that already includes a version path.
    return this.config.baseUrl.replace(/\/+$/, '').replace(/\/(v2|v1\.2\.0-beta)$/i, '');
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
        throw new BkashRateLimitError('bKash v2 rate limit exceeded (HTTP 429). Max 2 calls/hr limit.');
      }

      const text = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        throw mapBkashErrorCode(
          'PARSE_ERROR',
          `Failed to parse v2 response from ${endpoint}: ${text}`,
          response.status
        );
      }

      const statusCode = String(data['statusCode'] ?? data['externalCode'] ?? data['errorCode'] ?? '');
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
        const timeoutErr = new Error(
          `Request to bKash v2 endpoint ${endpoint} timed out after ${this.config.timeoutMs}ms`
        );
        timeoutErr.name = 'TimeoutError';
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async grantToken(): Promise<GrantTokenResponse> {
    const endpoint = '/v2/tokenized-checkout/auth/grant-token';
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

  public async refreshToken(refreshToken: string): Promise<GrantTokenResponse> {
    const endpoint = '/v2/tokenized-checkout/auth/refresh-token';
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
        refresh_token: refreshToken,
      },
    });

    return {
      idToken: result.id_token,
      refreshToken: result.refresh_token || refreshToken,
      expiresIn: Number(result.expires_in) || 3600,
    };
  }

  private headers(idToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-APP-Key': this.config.appKey,
    };
  }

  private post<T>(endpoint: string, idToken: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers: this.headers(idToken),
      body,
    });
  }

  public async createPayment(idToken: string, params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const withAgreement = Boolean(params.agreementId);
    const endpoint = withAgreement
      ? '/v2/tokenized-checkout/payment-with-agreement/create'
      : '/v2/tokenized-checkout/payment/create';

    const body: Record<string, unknown> = {
      callbackURL: params.callbackUrl,
      amount: formatAmount(params.amount),
      currency: 'BDT',
      intent: params.intent ?? 'sale',
      merchantInvoiceNumber: params.invoiceNumber,
    };
    if (withAgreement) {
      body.agreementId = params.agreementId;
    } else {
      body.payerReference = params.payerReference || params.invoiceNumber;
    }
    if (params.subMerchantName) body.subMerchantName = params.subMerchantName;
    if (params.merchantAssociationInfo) body.merchantAssociationInfo = params.merchantAssociationInfo;

    const result = await this.post<Record<string, any>>(endpoint, idToken, body);

    return {
      paymentId: pick(result, 'paymentId', 'paymentID'),
      redirectUrl: pick(result, 'bKashURL', 'bkashURL'),
      callbackUrl: pick(result, 'callbackURL') || params.callbackUrl,
      amount: result.amount,
      currency: 'BDT',
      invoiceNumber: result.merchantInvoiceNumber,
      status: 'Initiated',
      createdAt: result.paymentCreateTime || new Date().toISOString(),
    };
  }

  private toExecution(result: Record<string, any>, paymentId: string, reconciled: boolean): PaymentExecutionResult {
    return {
      paymentId: pick(result, 'paymentId', 'paymentID') || paymentId,
      trxId: pick(result, 'trxId', 'trxID'),
      transactionStatus: result.transactionStatus,
      amount: formatAmount(result.amount),
      currency: result.currency ?? 'BDT',
      invoiceNumber: pick(result, 'merchantInvoiceNumber', 'merchantInvoice', 'invoiceNumber'),
      customerMsisdn: result.payerAccount ?? result.customerMsisdn,
      completedAt: result.paymentExecuteTime || result.paymentUpdateTime || new Date().toISOString(),
      reconciled,
      creditedAmount: result.creditedAmount,
      couponAmount: result.couponAmount,
      maxRefundableAmount: result.maxRefundableAmount,
      agreementId: result.agreementId,
      rawResponse: result,
    };
  }

  public async executePayment(
    idToken: string,
    paymentId: string,
    agreementId?: string
  ): Promise<PaymentExecutionResult> {
    const result = agreementId
      ? await this.post<Record<string, any>>('/v2/tokenized-checkout/payment-with-agreement/execute', idToken, {
          paymentId,
          agreementId,
        })
      : await this.post<Record<string, any>>('/v2/tokenized-checkout/payment/execute', idToken, { paymentId });
    return this.toExecution(result, paymentId, false);
  }

  public async queryPayment(idToken: string, paymentId: string): Promise<PaymentExecutionResult> {
    const result = await this.post<Record<string, any>>('/v2/tokenized-checkout/query/payment', idToken, {
      paymentId,
    });
    return this.toExecution(result, paymentId, true);
  }

  public async searchTransaction(idToken: string, trxId: string): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/v2/tokenized-checkout/general/search-transaction', idToken, {
      trxId,
    });
  }

  public async refundPayment(idToken: string, params: RefundParams): Promise<RefundResult> {
    const result = await this.post<Record<string, any>>('/v2/tokenized-checkout/refund/payment/transaction', idToken, {
      paymentId: params.paymentId,
      trxId: params.trxId,
      refundAmount: formatAmount(params.amount),
      reason: params.reason,
      sku: params.sku ?? 'N/A',
    });

    return {
      refundTrxId: pick(result, 'refundTrxId', 'refundTrxID'),
      originalTrxId: pick(result, 'originalTrxId', 'originalTrxID') || params.trxId,
      amount: formatAmount(result.refundAmount ?? result.amount),
      currency: result.currency ?? 'BDT',
      completedAt: result.completedTime || new Date().toISOString(),
      transactionStatus: result.refundTransactionStatus ?? result.transactionStatus,
      rawResponse: result,
    };
  }

  public async refundStatus(idToken: string, params: RefundStatusParams): Promise<RefundStatusResult> {
    const result = await this.post<Record<string, any>>('/v2/tokenized-checkout/refund/payment/status', idToken, {
      paymentId: params.paymentId,
      trxId: params.trxId,
    });

    const refunds = Array.isArray(result.refundTransactions)
      ? result.refundTransactions.map((r: Record<string, any>) => ({
          refundTrxId: String(r.refundTrxId ?? r.refundTrxID ?? ''),
          refundTransactionStatus: String(r.refundTransactionStatus ?? ''),
          refundAmount: String(r.refundAmount ?? ''),
          completedTime: r.completedTime,
        }))
      : [];
    const last = refunds[refunds.length - 1];

    return {
      refundTrxId: last?.refundTrxId ?? '',
      originalTrxId: pick(result, 'originalTrxId', 'originalTrxID') || params.trxId,
      amount: formatAmount(last?.refundAmount || '0'),
      currency: 'BDT',
      completedAt: last?.completedTime || new Date().toISOString(),
      transactionStatus: (last?.refundTransactionStatus as 'Completed') || 'Completed',
      refunds,
      rawResponse: result,
    };
  }

  public async createAgreement(idToken: string, params: CreateAgreementParams): Promise<CreateAgreementResult> {
    const result = await this.post<Record<string, any>>('/v2/tokenized-checkout/agreement/create', idToken, {
      payerReference: params.payerReference,
      callbackURL: params.callbackUrl,
    });
    return {
      paymentId: pick(result, 'paymentId', 'paymentID'),
      agreementId: result.agreementId,
      redirectUrl: pick(result, 'bKashURL', 'bkashURL'),
      callbackUrl: result.callbackURL || params.callbackUrl,
      status: 'Initiated',
    };
  }

  public async executeAgreement(idToken: string, params: ExecuteAgreementParams): Promise<AgreementResult> {
    const result = await this.post<Record<string, any>>('/v2/tokenized-checkout/agreement/execute', idToken, {
      agreementId: params.agreementId,
    });
    return {
      agreementId: result.agreementId ?? params.agreementId,
      payerReference: result.payerReference ?? '',
      agreementStatus: result.agreementStatus,
      customerMsisdn: result.payerAccount,
      rawResponse: result,
    };
  }

  public async cancelAgreement(idToken: string, params: CancelAgreementParams): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/v2/tokenized-checkout/agreement/cancel', idToken, {
      agreementId: params.agreementId,
    });
  }

  public async queryAgreement(idToken: string, params: QueryAgreementParams): Promise<QueryAgreementResult> {
    const result = await this.post<Record<string, any>>('/v2/tokenized-checkout/query/agreement', idToken, {
      agreementId: params.agreementId,
    });
    return {
      agreementId: result.agreementId ?? params.agreementId,
      agreementStatus: result.agreementStatus,
      verificationStatus: result.verificationStatus,
      payerReference: result.payerReference,
      customerMsisdn: result.payerAccount,
      rawResponse: result,
    };
  }
}

function pick(obj: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return String(obj[k]);
  }
  return '';
}
