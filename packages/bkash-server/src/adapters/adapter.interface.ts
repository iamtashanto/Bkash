import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentExecutionResult,
  RefundParams,
  RefundResult,
} from '../types.js';

export interface GrantTokenResponse {
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface BkashVersionAdapter {
  readonly version: string;

  grantToken(): Promise<GrantTokenResponse>;

  refreshToken(refreshToken: string): Promise<GrantTokenResponse>;

  createPayment(idToken: string, params: CreatePaymentParams): Promise<CreatePaymentResult>;

  executePayment(idToken: string, paymentId: string): Promise<PaymentExecutionResult>;

  queryPayment(idToken: string, paymentId: string): Promise<PaymentExecutionResult>;

  searchTransaction(idToken: string, trxId: string): Promise<Record<string, unknown>>;

  refundPayment(idToken: string, params: RefundParams): Promise<RefundResult>;
}
