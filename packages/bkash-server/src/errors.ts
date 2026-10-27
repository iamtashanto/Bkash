/**
 * Base error class for all bKash SDK exceptions.
 */
export class BkashError extends Error {
  public readonly code: string;
  public readonly timestamp: string;

  constructor(message: string, code: string = 'BKASH_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Standard API error returned by bKash HTTP endpoints.
 * All unknown or unmapped bKash error codes cleanly map to this class.
 */
export class BkashApiError extends BkashError {
  public readonly externalCode?: string;
  public readonly internalCode?: string;
  public readonly httpStatus?: number;
  public readonly raw?: unknown;

  constructor(
    message: string,
    options?: {
      externalCode?: string;
      internalCode?: string;
      httpStatus?: number;
      raw?: unknown;
    }
  ) {
    super(message, options?.externalCode ? `BKASH_API_${options.externalCode}` : 'BKASH_API_ERROR');
    this.externalCode = options?.externalCode;
    this.internalCode = options?.internalCode;
    this.httpStatus = options?.httpStatus;
    this.raw = options?.raw;
  }
}

/**
 * Thrown when bKash rate limit (2 calls / hour) is threatened or returned.
 * Prevents cascading credential lockout with fail-fast behavior and retry-after hint.
 */
export class BkashRateLimitError extends BkashError {
  public readonly retryAfterMs: number;
  public readonly retryAfterDate: Date;

  constructor(message: string, retryAfterMs: number = 3600000) {
    super(message, 'BKASH_RATE_LIMIT_EXCEEDED');
    this.retryAfterMs = retryAfterMs;
    this.retryAfterDate = new Date(Date.now() + retryAfterMs);
  }
}

/**
 * Thrown when payment execution amount, currency, or invoice number
 * fails verification against expected order values.
 * This is a hard security error flagging financial discrepancy or tampering.
 */
export class BkashVerificationMismatchError extends BkashError {
  public readonly field: 'amount' | 'currency' | 'invoiceNumber';
  public readonly expected: string;
  public readonly actual: string;

  constructor(field: 'amount' | 'currency' | 'invoiceNumber', expected: string, actual: string) {
    super(
      `Financial verification failed for ${field}: expected "${expected}", received "${actual}". Transaction rejected.`,
      'BKASH_VERIFICATION_MISMATCH'
    );
    this.field = field;
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Thrown when an execution request exceeds the timeout threshold
 * and subsequent auto-reconciliation cannot confirm payment completion.
 */
export class BkashTimeoutError extends BkashError {
  public readonly paymentId: string;
  public readonly timeoutMs: number;

  constructor(paymentId: string, timeoutMs: number) {
    super(
      `Execution request for paymentId "${paymentId}" timed out after ${timeoutMs}ms and reconciliation could not confirm completion.`,
      'BKASH_TIMEOUT'
    );
    this.paymentId = paymentId;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when error 2062 ("The payment has already been completed")
 * is received but reconciliation query fails to locate a Completed transaction.
 */
export class BkashDuplicateExecutionError extends BkashError {
  public readonly paymentId: string;

  constructor(paymentId: string, message: string = 'Payment already completed or duplicate execution rejected.') {
    super(message, 'BKASH_DUPLICATE_EXECUTION');
    this.paymentId = paymentId;
  }
}

/**
 * Thrown when an incoming webhook fails AWS SNS signature,
 * certificate URL host, or replay checks.
 */
export class BkashWebhookVerificationError extends BkashError {
  public readonly reason: string;

  constructor(reason: string) {
    super(`Webhook verification failed: ${reason}`, 'BKASH_WEBHOOK_VERIFICATION_FAILED');
    this.reason = reason;
  }
}

/**
 * Thrown when a public method for an unsupported or roadmap feature
 * (e.g. agreements, auth-and-capture, payouts) is invoked.
 */
export class BkashFeatureNotSupportedError extends BkashError {
  public readonly feature: string;

  constructor(feature: string, apiVersion?: string, detail?: string) {
    super(
      `Feature "${feature}" is not supported` +
        (apiVersion ? ` with apiVersion "${apiVersion}"` : ' by bkash-server yet') +
        `.${detail ? ' ' + detail : ''} See the feature status table in the documentation.`,
      'BKASH_FEATURE_NOT_SUPPORTED'
    );
    this.feature = feature;
  }
}

/**
 * Known bKash Error Code descriptions.
 */
export const KNOWN_BKASH_ERRORS: Record<string, string> = {
  '2001': 'Invalid credentials (app_key, app_secret, username, or password)',
  '2002': 'Payment ID does not exist or has expired',
  '2005': 'Customer wallet has insufficient balance',
  '2006': 'Customer entered an incorrect bKash PIN',
  '2007': 'OTP verification failed or expired',
  '2029': 'Duplicate merchant invoice number',
  '2062': 'The payment has already been completed',
  '2119': 'Customer cancelled payment on bKash interface',
};

/**
 * Maps any raw bKash error response to a typed BkashApiError.
 * Unknown codes outside 2001-2119 map cleanly without error.
 */
export function mapBkashErrorCode(
  code: string | undefined,
  message?: string,
  httpStatus?: number,
  raw?: unknown
): BkashApiError {
  const externalCode = code ?? 'UNKNOWN';
  const description = message || KNOWN_BKASH_ERRORS[externalCode] || `bKash API returned error code ${externalCode}`;

  return new BkashApiError(description, {
    externalCode,
    httpStatus,
    raw,
  });
}
