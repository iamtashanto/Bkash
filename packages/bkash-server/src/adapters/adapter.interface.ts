import type {
  AgreementResult,
  CancelAgreementParams,
  QueryAgreementParams,
  QueryAgreementResult,
  CapturePaymentParams,
  CaptureResult,
  CreateAgreementParams,
  CreateAgreementResult,
  CreatePaymentParams,
  CreatePaymentResult,
  ExecuteAgreementParams,
  PaymentExecutionResult,
  RefundParams,
  RefundResult,
  RefundStatusParams,
  RefundStatusResult,
  VoidPaymentParams,
  VoidResult,
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

  executePayment(idToken: string, paymentId: string, agreementId?: string): Promise<PaymentExecutionResult>;

  queryPayment(idToken: string, paymentId: string): Promise<PaymentExecutionResult>;

  searchTransaction(idToken: string, trxId: string): Promise<Record<string, unknown>>;

  refundPayment(idToken: string, params: RefundParams): Promise<RefundResult>;

  refundStatus?(idToken: string, params: RefundStatusParams): Promise<RefundStatusResult>;

  createAgreement?(idToken: string, params: CreateAgreementParams): Promise<CreateAgreementResult>;

  executeAgreement?(idToken: string, params: ExecuteAgreementParams): Promise<AgreementResult>;

  queryAgreement?(idToken: string, params: QueryAgreementParams): Promise<QueryAgreementResult>;

  cancelAgreement?(idToken: string, params: CancelAgreementParams): Promise<Record<string, unknown>>;

  capturePayment?(idToken: string, params: CapturePaymentParams): Promise<CaptureResult>;

  voidPayment?(idToken: string, params: VoidPaymentParams): Promise<VoidResult>;
}
