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
 * bKash error codes and descriptions, transcribed from the published error-code tables
 * (developer.bka.sh, payment and refund). Codes outside this table map to a generic message.
 */
export const KNOWN_BKASH_ERRORS: Record<string, string> = {
  '503': 'System is undergoing maintenance. Please try again later',
  '2001': 'Invalid App Key',
  '2002': 'Invalid Payment ID',
  '2003': 'Process failed',
  '2004': 'Invalid firstPaymentDate',
  '2005': 'Invalid frequency',
  '2006': 'Invalid amount',
  '2007': 'Invalid currency',
  '2008': 'Invalid intent',
  '2009': 'Invalid Wallet',
  '2010': 'Invalid OTP',
  '2011': 'Invalid PIN',
  '2012': 'Invalid Receiver MSISDN',
  '2013': 'Resend Limit Exceeded',
  '2014': 'Wrong PIN',
  '2015': 'Wrong PIN count exceeded',
  '2016': 'Wrong verification code',
  '2017': 'Wrong verification limit exceeded',
  '2018': 'OTP verification time expired',
  '2019': 'PIN verification time expired',
  '2020': 'Exception Occurred',
  '2021': 'Invalid Mandate ID',
  '2022': 'The mandate does not exist',
  '2023': 'Insufficient Balance',
  '2024': 'Exception occurred',
  '2025': 'Invalid request body',
  '2026': 'The reversal amount cannot be greater than the original transaction amount',
  '2027': 'The mandate corresponding to the payer reference number already exists and cannot be created again',
  '2028': 'Reverse failed because the transaction serial number does not exist',
  '2029': 'Duplicate for all transactions',
  '2030': 'Invalid mandate request type',
  '2031': 'Invalid merchant invoice number',
  '2032': 'Invalid transfer type',
  '2033': 'Transaction not found',
  '2034': 'The transaction cannot be reversed because the original transaction has been reversed',
  '2035': 'Reverse failed because the initiator has no permission to reverse the transaction',
  '2036': 'The direct debit mandate is not in Active state',
  '2037': 'The account of the debit party is in a state which prohibits execution of this transaction',
  '2038': 'Debit party identity tag prohibits execution of this transaction',
  '2039': 'The account of the credit party is in a state which prohibits execution of this transaction',
  '2040': 'Credit party identity tag prohibits execution of this transaction',
  '2041': 'Credit party identity is in a state which does not support the current service',
  '2042': 'Reverse failed because the initiator has no permission to reverse the transaction.',
  '2043': 'The security credential of the subscriber is incorrect.',
  '2044': 'Identity has not subscribed to a product that contains the expected service or the identity is not in Active status.',
  '2045': 'The MSISDN of the customer does not exist.',
  '2046': 'Identity has not subscribed to a product that contains requested service.',
  '2047': 'TLV Data Format Error',
  '2048': 'Invalid Payer Reference',
  '2049': 'Invalid Merchant Callback URL',
  '2050': 'Agreement already exists between payer and merchant',
  '2051': 'Invalid Agreement ID',
  '2052': 'Agreement is in incomplete state',
  '2053': 'Agreement has already been cancelled',
  '2054': 'Agreement execution pre-requisite hasn\'t been met',
  '2055': 'Invalid Agreement State',
  '2056': 'Invalid Payment State',
  '2057': 'Not a bKash Account',
  '2058': 'Not a Customer Wallet',
  '2059': 'Multiple OTP request for a single session denied',
  '2060': 'Payment execution pre-requisite hasn\'t been met',
  '2061': 'This action can only be performed by the agreement or payment initiator party',
  '2062': 'The payment has already been completed',
  '2063': 'Mode is not valid as per request data',
  '2064': 'This product mode currently unavailable',
  '2065': 'Mendatory field missing',
  '2066': 'Agreement is not shared with other merchant',
  '2067': 'Invalid permission',
  '2068': 'Transaction has already been completed',
  '2069': 'Transaction has already been cancelled',
  '2071': 'Refund after %s days not allowed',
  '2072': 'Refund amount not valid',
  '2073': 'Invalid SKU',
  '2074': 'The transaction cannot be reversed',
  '2075': 'SKU Character Limit Exceeded',
  '2076': 'Reason Character Limit Exceeded',
  '2077': 'Invalid TrxID',
  '2078': 'Invalid Reason',
  '2079': 'Invalid app Token',
  '2080': 'The identity is not permitted to initiate this transaction',
  '2081': 'The identity of the debit or credit party is in a state which prohibits the execution of this transaction',
  '2082': 'The merchant is not permitted to initiate this transaction',
  '2116': 'The agreement execution has already been completed',
  '2117': 'The payment execution has already been completed',
  '2118': 'The Platform value is invalid',
  '2119': 'The authorized payment has already been processed',
  '2127': 'Transaction not yet completed',
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
