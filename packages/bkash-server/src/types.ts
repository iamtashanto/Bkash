/**
 * Supported bKash API Versions.
 * In 0.x, apiVersion is a REQUIRED config option.
 */
export type BkashApiVersion = 'v1.2.0-beta' | 'v2';

/**
 * Verified Server Payment Status (derived strictly from bKash gateway responses).
 * Distinct from client UI states.
 */
export type BkashPaymentStatus = 'Initiated' | 'Completed' | 'Cancelled' | 'Failed' | 'PendingReconciliation';

/**
 * Expected order details supplied by caller or resolved from SessionStore
 * for mandatory cryptographic and financial verification.
 */
export interface ExpectedOrderDetails {
  /** Expected transaction amount in BDT (e.g. 1550 or "1550.00") */
  amount: number | string;
  /** Expected currency code, must be "BDT" */
  currency: 'BDT';
  /** Unique merchant invoice or reference number */
  invoiceNumber: string;
}

/**
 * Parameters for creating a payment session.
 */
export interface CreatePaymentParams {
  /** Transaction amount in BDT */
  amount: number | string;
  /** Unique merchant invoice number */
  invoiceNumber: string;
  /** Callback URL where bKash redirects browser after user action */
  callbackUrl: string;
  /** Optional merchant internal order identifier */
  orderId?: string;
  /** Checkout mode: "0011" (immediate) or "0001" (agreement + payment) */
  mode?: '0011' | '0001';
  /** Payment intent: "sale" (default) or "authorization" */
  intent?: 'sale' | 'authorization';
  /** Optional customer phone number or reference ID */
  payerReference?: string;
  /** v2 only: pay with a previously stored agreement (customer enters only the PIN). */
  agreementId?: string;
  /** Aggregator merchants only (max 80 chars). */
  subMerchantName?: string;
  /** Aggregator merchants only (max 255 chars, TLV format). */
  merchantAssociationInfo?: string;
  /** Custom tracking or order metadata */
  metadata?: Record<string, string>;
}

/**
 * Canonical result returned after payment creation.
 */
export interface CreatePaymentResult {
  paymentId: string;
  redirectUrl: string;
  callbackUrl: string;
  amount: string;
  currency: 'BDT';
  invoiceNumber: string;
  status: 'Initiated';
  createdAt: string;
}

/**
 * Parameters for executing a payment.
 */
export interface ExecutePaymentParams {
  /** The paymentId returned by createPayment */
  paymentId: string;
  /** v2 only: required when the payment was created with an agreement (remembered via SessionStore when configured). */
  agreementId?: string;
  /**
   * Expected order values for verification.
   * If omitted, resolved automatically if sessionStore is configured.
   */
  expectedOrder?: ExpectedOrderDetails;
}

/**
 * Canonical result returned upon verified payment execution or reconciliation.
 */
export interface PaymentExecutionResult {
  paymentId: string;
  trxId: string;
  transactionStatus: 'Completed' | 'Authorized';
  amount: string;
  currency: 'BDT';
  invoiceNumber: string;
  /** Masked customer phone number (e.g. "017****5678") */
  customerMsisdn?: string;
  completedAt: string;
  reconciled: boolean;
  /** Amount credited to the merchant after coupon discount, when reported by bKash. */
  creditedAmount?: string;
  couponAmount?: string;
  /** Maximum amount that can still be refunded, when reported by bKash. */
  maxRefundableAmount?: string;
  agreementId?: string;
  rawResponse: Record<string, unknown>;
}

/**
 * Parameters for querying payment status.
 */
export interface QueryPaymentParams {
  paymentId: string;
}

/**
 * Parameters for searching a transaction by TRX ID.
 */
export interface SearchTransactionParams {
  trxId: string;
}

/**
 * Parameters for refunding a transaction.
 */
export interface RefundParams {
  paymentId: string;
  trxId: string;
  amount: number | string;
  reason: string;
  sku?: string;
}

/**
 * Result returned upon initiating a refund.
 */
export interface RefundResult {
  refundTrxId: string;
  originalTrxId: string;
  amount: string;
  currency: 'BDT';
  completedAt: string;
  transactionStatus: 'Completed';
  rawResponse: Record<string, unknown>;
}

/**
 * Parameters for checking refund status.
 */
export interface RefundStatusParams {
  paymentId: string;
  trxId: string;
}

/**
 * Result returned from refund status check.
 */
export interface RefundStatusResult {
  refundTrxId: string;
  originalTrxId: string;
  amount: string;
  currency: 'BDT';
  completedAt: string;
  transactionStatus: 'Completed';
  /** v2: every refund recorded against the original transaction. */
  refunds?: Array<{
    refundTrxId: string;
    refundTransactionStatus: string;
    refundAmount: string;
    completedTime?: string;
  }>;
  rawResponse: Record<string, unknown>;
}

/**
 * Parameters for creating an agreement (account binding). v2 only.
 */
export interface CreateAgreementParams {
  /** Reference for the payer (255 chars max); a wallet number here is pre-filled on the bKash page. */
  payerReference: string;
  callbackUrl: string;
}

/**
 * Result returned from agreement creation.
 */
export interface CreateAgreementResult {
  paymentId: string;
  /** Store this against the customer once the agreement is executed. */
  agreementId?: string;
  redirectUrl: string;
  callbackUrl: string;
  status: 'Initiated';
}

/**
 * Parameters for executing an agreement after the customer verified wallet + OTP.
 */
export interface ExecuteAgreementParams {
  agreementId: string;
}

/**
 * Result returned upon agreement execution.
 */
export interface AgreementResult {
  agreementId: string;
  payerReference: string;
  agreementStatus: string;
  /** Masked payer wallet number. */
  customerMsisdn?: string;
  rawResponse: Record<string, unknown>;
}

/**
 * Parameters for cancelling a stored agreement.
 */
export interface CancelAgreementParams {
  agreementId: string;
}

/**
 * Parameters for querying an agreement (reconcile an incomplete binding).
 */
export interface QueryAgreementParams {
  agreementId: string;
}

export interface QueryAgreementResult {
  agreementId: string;
  agreementStatus: string;
  verificationStatus?: string;
  payerReference?: string;
  customerMsisdn?: string;
  rawResponse: Record<string, unknown>;
}

/**
 * Parameters for capturing an authorized payment.
 */
export interface CapturePaymentParams {
  paymentId: string;
  amount: number | string;
}

/**
 * Result returned upon payment capture.
 */
export interface CaptureResult {
  paymentId: string;
  trxId: string;
  amount: string;
  currency: 'BDT';
  transactionStatus: 'Completed';
  rawResponse: Record<string, unknown>;
}

/**
 * Parameters for voiding an authorized payment.
 */
export interface VoidPaymentParams {
  paymentId: string;
}

/**
 * Result returned upon voiding an authorized payment.
 */
export interface VoidResult {
  paymentId: string;
  transactionStatus: 'Voided' | 'Cancelled';
  rawResponse: Record<string, unknown>;
}

/**
 * AWS SNS Webhook Payload.
 */
export interface BkashSnsMessage {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: '1' | '2';
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  UnsubscribeURL?: string;
}

/**
 * Verified webhook notification result.
 */
export interface VerifiedWebhookPayload {
  messageId: string;
  topicArn: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Options for Webhook Verifier.
 */
export interface BkashWebhookOptions {
  /** Optional allowed Topic ARNs to prevent spoofing */
  allowedTopicArns?: string[];
  /** Allowed clock drift window in milliseconds (default: 15 minutes) */
  freshnessWindowMs?: number;
  /** Replay cache store for MessageId */
  messageStore?: MessageStore;
}

/**
 * Message store interface for webhook deduplication.
 */
export interface MessageStore {
  has(messageId: string): Promise<boolean>;
  add(messageId: string, ttlSeconds: number): Promise<void>;
}

/**
 * Token payload structure stored in TokenStore.
 */
export interface TokenData {
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
  obtainedAt: number; // Unix epoch ms
}

/**
 * Optional encryption-at-rest cipher hook for token payloads.
 */
export interface TokenCipher {
  encrypt(plainText: string): Promise<string> | string;
  decrypt(cipherText: string): Promise<string> | string;
}

/**
 * Token storage interface with distributed lock & lease.
 */
export interface TokenStore {
  /** Retrieve currently stored token */
  get(appKey: string): Promise<TokenData | null>;
  /** Save token with TTL in seconds */
  set(appKey: string, token: TokenData, ttlSeconds: number): Promise<void>;
  /** Invalidate stored token */
  clear(appKey: string): Promise<void>;
  /**
   * Acquire a distributed mutual exclusion lease.
   * @param appKey Unique key for the lock
   * @param ownerToken Unique UUID identifying this worker instance
   * @param ttlMs Lease TTL to prevent deadlocks if holder crashes
   */
  acquireLock(appKey: string, ownerToken: string, ttlMs: number): Promise<boolean>;
  /**
   * Release distributed lock using compare-and-delete.
   */
  releaseLock(appKey: string, ownerToken: string): Promise<void>;
}

/**
 * Payment session stored in SessionStore for order resolution.
 */
export interface PaymentSession {
  paymentId: string;
  orderId?: string;
  agreementId?: string;
  expectedOrder: ExpectedOrderDetails;
  status: BkashPaymentStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * Session storage interface for orderId <-> paymentId mapping.
 */
export interface SessionStore {
  saveSession(session: PaymentSession, ttlSeconds: number): Promise<void>;
  getSession(paymentId: string): Promise<PaymentSession | null>;
  updateSessionStatus(paymentId: string, status: BkashPaymentStatus): Promise<void>;
  deleteSession(paymentId: string): Promise<void>;
}

/**
 * Configuration options for BkashServer.
 */
export interface BkashServerConfig {
  /**
   * Required in 0.x. Choose 'v1.2.0-beta' (stable-in-practice) or 'v2' (experimental).
   */
  apiVersion: BkashApiVersion;
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  /** Sandbox or Production base URL */
  baseUrl: string;
  /** Custom token storage (defaults to MemoryTokenStore with dev warning) */
  tokenStore?: TokenStore;
  /** Optional payment session store for orderId <-> paymentId resolution */
  sessionStore?: SessionStore;
  /** Optional encryption-at-rest cipher hook */
  tokenCipher?: TokenCipher;
  /** Optional webhook options (allowedTopicArns, freshnessWindowMs, messageStore) */
  webhookOptions?: BkashWebhookOptions;
  /** Timeout for HTTP requests in ms (default: 30000) */
  timeoutMs?: number;
  /** Enable debug logging (PII and secrets are always sanitized) */
  debug?: boolean;
}
