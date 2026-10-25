import { generateUUID } from './utils/crypto.js';
import type {
  AgreementResult,
  BkashPaymentStatus,
  BkashServerConfig,
  CancelAgreementParams,
  CapturePaymentParams,
  CaptureResult,
  CreateAgreementParams,
  CreateAgreementResult,
  CreatePaymentParams,
  CreatePaymentResult,
  ExpectedOrderDetails,
  ExecuteAgreementParams,
  ExecutePaymentParams,
  PaymentExecutionResult,
  PaymentSession,
  QueryPaymentParams,
  RefundParams,
  RefundResult,
  RefundStatusParams,
  RefundStatusResult,
  SearchTransactionParams,
  TokenData,
  TokenStore,
  VoidPaymentParams,
  VoidResult,
} from './types.js';
import type { BkashVersionAdapter } from './adapters/adapter.interface.js';
import { V1Adapter } from './adapters/v1-adapter.js';
import { V2Adapter } from './adapters/v2-adapter.js';
import { MemoryTokenStore } from './stores/memory-token-store.js';
import { BkashWebhookVerifier } from './webhook/webhook-verifier.js';
import { BkashHttpHandler, type BkashHandlerOptions } from './http/handler.js';
import {
  BkashApiError,
  BkashDuplicateExecutionError,
  BkashError,
  BkashRateLimitError,
  BkashTimeoutError,
  BkashVerificationMismatchError,
} from './errors.js';
import { formatAmount, maskMsisdn } from './utils/sanitizer.js';

export class BkashServer {
  public readonly config: BkashServerConfig;
  public readonly adapter: BkashVersionAdapter;
  public readonly tokenStore: TokenStore;
  public readonly webhook: BkashWebhookVerifier;
  private activeRefreshPromise: Promise<string> | null = null;
  private workerInstanceId: string;

  constructor(config: BkashServerConfig) {
    if (!config || !config.apiVersion) {
      throw new BkashError(
        'apiVersion is a required option in 0.x. Choose "v1.2.0-beta" (stable-in-practice) or "v2" (experimental).',
        'BKASH_CONFIG_ERROR'
      );
    }

    if (!config.appKey || !config.appSecret || !config.username || !config.password || !config.baseUrl) {
      throw new BkashError(
        'Missing required configuration parameters: appKey, appSecret, username, password, and baseUrl are mandatory.',
        'BKASH_CONFIG_ERROR'
      );
    }

    this.config = {
      timeoutMs: 30000,
      debug: false,
      ...config,
    };

    this.workerInstanceId = generateUUID();
    this.tokenStore = config.tokenStore ?? new MemoryTokenStore({ cipher: config.tokenCipher });
    this.webhook = new BkashWebhookVerifier(config.webhookOptions);

    if (config.apiVersion === 'v1.2.0-beta') {
      this.adapter = new V1Adapter({
        appKey: config.appKey,
        appSecret: config.appSecret,
        username: config.username,
        password: config.password,
        baseUrl: config.baseUrl,
        timeoutMs: this.config.timeoutMs!,
      });
    } else if (config.apiVersion === 'v2') {
      this.adapter = new V2Adapter({
        appKey: config.appKey,
        appSecret: config.appSecret,
        username: config.username,
        password: config.password,
        baseUrl: config.baseUrl,
        timeoutMs: this.config.timeoutMs!,
      });
    } else {
      throw new BkashError(`Unsupported apiVersion: "${config.apiVersion}". Supported versions: "v1.2.0-beta", "v2".`);
    }
  }

  /**
   * Retrieves a valid token from TokenStore or safely refreshes it.
   * Utilizes single-flight deduplication and proactive refresh at the 50th minute.
   */
  public async getValidToken(): Promise<string> {
    const cached = await this.tokenStore.get(this.config.appKey);
    const now = Date.now();

    // Check if cached token is still valid (with 5-minute safety margin)
    if (cached && now < cached.obtainedAt + (cached.expiresIn - 300) * 1000) {
      // Proactive refresh check: if token is between 50 and 55 minutes old, trigger refresh
      const isPast50Min = now - cached.obtainedAt >= 3000 * 1000;
      if (!isPast50Min) {
        return cached.idToken;
      }
    }

    // Single-flight deduplication: coalesce parallel requests into a single promise
    if (this.activeRefreshPromise) {
      return this.activeRefreshPromise;
    }

    this.activeRefreshPromise = this.executeTokenRefresh(cached)
      .finally(() => {
        this.activeRefreshPromise = null;
      });

    return this.activeRefreshPromise;
  }

  private async executeTokenRefresh(current?: TokenData | null): Promise<string> {
    const lockKey = this.config.appKey;
    const acquired = await this.tokenStore.acquireLock(lockKey, this.workerInstanceId, 15000);

    if (!acquired) {
      // Lock held by another worker. Wait and poll store for the freshly minted token.
      if ('waitForToken' in this.tokenStore && typeof (this.tokenStore as any).waitForToken === 'function') {
        const polled = await (this.tokenStore as any).waitForToken(lockKey, 3000, 200);
        if (polled) {
          return polled.idToken;
        }
      } else {
        // Fallback polling for MemoryTokenStore / custom store
        for (let i = 0; i < 15; i++) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const fresh = await this.tokenStore.get(lockKey);
          if (fresh && Date.now() < fresh.obtainedAt + (fresh.expiresIn - 300) * 1000) {
            return fresh.idToken;
          }
        }
      }
    }

    try {
      let freshData: { idToken: string; refreshToken?: string; expiresIn: number };

      if (this.config.apiVersion === 'v2' && current?.refreshToken) {
        try {
          freshData = await this.adapter.refreshToken(current.refreshToken);
        } catch (err) {
          if (err instanceof BkashRateLimitError) {
            throw err;
          }
          // If refresh token fails, fallback to grant
          freshData = await this.adapter.grantToken();
        }
      } else {
        freshData = await this.adapter.grantToken();
      }

      const tokenPayload: TokenData = {
        idToken: freshData.idToken,
        refreshToken: freshData.refreshToken,
        expiresIn: freshData.expiresIn || 3600,
        obtainedAt: Date.now(),
      };

      await this.tokenStore.set(this.config.appKey, tokenPayload, tokenPayload.expiresIn);
      return tokenPayload.idToken;
    } finally {
      await this.tokenStore.releaseLock(lockKey, this.workerInstanceId);
    }
  }

  /**
   * Create a payment session and obtain redirect URL.
   */
  public async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!params.amount || !params.invoiceNumber || !params.callbackUrl) {
      throw new BkashError('amount, invoiceNumber, and callbackUrl are required to create a payment.');
    }

    const token = await this.getValidToken();
    const result = await this.adapter.createPayment(token, params);

    // Save session if sessionStore is configured
    if (this.config.sessionStore) {
      const session: PaymentSession = {
        paymentId: result.paymentId,
        orderId: params.orderId,
        expectedOrder: {
          amount: params.amount,
          currency: 'BDT',
          invoiceNumber: params.invoiceNumber,
        },
        status: 'Initiated',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await this.config.sessionStore.saveSession(session, 3600);
    }

    return result;
  }

  /**
   * Execute and verify a payment session.
   * Handles error 2062, timeouts, auto-reconciliation, and performs mandatory financial verification.
   */
  public async executePayment(params: ExecutePaymentParams): Promise<PaymentExecutionResult> {
    if (!params || !params.paymentId) {
      throw new BkashError('paymentId is required for executePayment.');
    }

    let expectedOrder: ExpectedOrderDetails | undefined = params.expectedOrder;

    // Resolve expectedOrder from SessionStore if not supplied directly
    if (!expectedOrder && this.config.sessionStore) {
      const session = await this.config.sessionStore.getSession(params.paymentId);
      if (session) {
        expectedOrder = session.expectedOrder;
      }
    }

    if (!expectedOrder) {
      throw new BkashError(
        'expectedOrder (amount, currency, invoiceNumber) must be provided directly or resolvable via SessionStore for execution verification.'
      );
    }

    const execLockKey = `exec:${params.paymentId}`;
    const acquired = await this.tokenStore.acquireLock(execLockKey, this.workerInstanceId, 30000);
    if (!acquired) {
      throw new BkashError(
        `Execution for paymentId "${params.paymentId}" is already in progress. Duplicate execution rejected.`
      );
    }

    try {
      const token = await this.getValidToken();
      let executionResult: PaymentExecutionResult;

      try {
        executionResult = await this.adapter.executePayment(token, params.paymentId);
      } catch (err: unknown) {
        // Case 1: Error 2062 ("The payment has already been completed")
        const is2062 =
          err instanceof BkashApiError &&
          (err.externalCode === '2062' || String(err.raw && (err.raw as any).statusCode) === '2062');

        if (is2062) {
          if (this.config.sessionStore) {
            await this.config.sessionStore.updateSessionStatus(params.paymentId, 'PendingReconciliation');
          }
          const queryResult = await this.adapter.queryPayment(token, params.paymentId);
          if (queryResult.transactionStatus === 'Completed') {
            executionResult = { ...queryResult, reconciled: true };
          } else {
            throw new BkashDuplicateExecutionError(
              params.paymentId,
              'bKash returned error 2062 but queryPayment did not return a Completed transaction.'
            );
          }
        }
        // Case 2: Timeout (>30s) or socket hangup
        else if (
          (err && typeof err === 'object' && (err as any).name === 'TimeoutError') ||
          (err instanceof Error && err.message.toLowerCase().includes('timed out'))
        ) {
          if (this.config.sessionStore) {
            await this.config.sessionStore.updateSessionStatus(params.paymentId, 'PendingReconciliation');
          }
          const queryResult = await this.adapter.queryPayment(token, params.paymentId);
          if (queryResult.transactionStatus === 'Completed') {
            executionResult = { ...queryResult, reconciled: true };
          } else {
            throw new BkashTimeoutError(params.paymentId, this.config.timeoutMs || 30000);
          }
        } else {
          if (this.config.sessionStore) {
            await this.config.sessionStore.updateSessionStatus(params.paymentId, 'Failed');
          }
          throw err;
        }
      }

      // Mandatory Financial Verification
      const expectedAmountFormatted = formatAmount(expectedOrder.amount);
      const actualAmountFormatted = formatAmount(executionResult.amount);

      if (actualAmountFormatted !== expectedAmountFormatted) {
        if (this.config.sessionStore) {
          await this.config.sessionStore.updateSessionStatus(params.paymentId, 'Failed');
        }
        throw new BkashVerificationMismatchError('amount', expectedAmountFormatted, actualAmountFormatted);
      }

      if (executionResult.currency !== 'BDT') {
        if (this.config.sessionStore) {
          await this.config.sessionStore.updateSessionStatus(params.paymentId, 'Failed');
        }
        throw new BkashVerificationMismatchError('currency', 'BDT', executionResult.currency);
      }

      if (executionResult.invoiceNumber !== expectedOrder.invoiceNumber) {
        if (this.config.sessionStore) {
          await this.config.sessionStore.updateSessionStatus(params.paymentId, 'Failed');
        }
        throw new BkashVerificationMismatchError(
          'invoiceNumber',
          expectedOrder.invoiceNumber,
          executionResult.invoiceNumber
        );
      }

      // Successful verification
      if (this.config.sessionStore) {
        await this.config.sessionStore.updateSessionStatus(params.paymentId, 'Completed');
      }

      // Mask customer PII before returning
      return {
        ...executionResult,
        customerMsisdn: executionResult.customerMsisdn ? maskMsisdn(executionResult.customerMsisdn) : undefined,
      };
    } finally {
      await this.tokenStore.releaseLock(execLockKey, this.workerInstanceId);
    }
  }

  /**
   * Public reconciliation method for asynchronous jobs / cron workers.
   */
  public async reconcile(
    paymentId: string,
    expectedOrder?: ExpectedOrderDetails
  ): Promise<PaymentExecutionResult> {
    let order = expectedOrder;
    if (!order && this.config.sessionStore) {
      const session = await this.config.sessionStore.getSession(paymentId);
      if (session) {
        order = session.expectedOrder;
      }
    }

    const token = await this.getValidToken();
    const result = await this.adapter.queryPayment(token, paymentId);

    if (order) {
      const expectedAmountFormatted = formatAmount(order.amount);
      const actualAmountFormatted = formatAmount(result.amount);
      if (actualAmountFormatted !== expectedAmountFormatted) {
        throw new BkashVerificationMismatchError('amount', expectedAmountFormatted, actualAmountFormatted);
      }
      if (result.currency !== 'BDT') {
        throw new BkashVerificationMismatchError('currency', 'BDT', result.currency);
      }
      if (result.invoiceNumber !== order.invoiceNumber) {
        throw new BkashVerificationMismatchError('invoiceNumber', order.invoiceNumber, result.invoiceNumber);
      }
    }

    if (this.config.sessionStore) {
      const newStatus: BkashPaymentStatus =
        result.transactionStatus === 'Completed' ? 'Completed' : 'Initiated';
      await this.config.sessionStore.updateSessionStatus(paymentId, newStatus);
    }

    return {
      ...result,
      customerMsisdn: result.customerMsisdn ? maskMsisdn(result.customerMsisdn) : undefined,
    };
  }

  /**
   * Query payment status by paymentId.
   */
  public async queryPayment(params: QueryPaymentParams): Promise<PaymentExecutionResult> {
    const token = await this.getValidToken();
    const result = await this.adapter.queryPayment(token, params.paymentId);
    return {
      ...result,
      customerMsisdn: result.customerMsisdn ? maskMsisdn(result.customerMsisdn) : undefined,
    };
  }

  /**
   * Search transaction status by TRX ID.
   */
  public async searchTransaction(params: SearchTransactionParams): Promise<Record<string, unknown>> {
    const token = await this.getValidToken();
    return this.adapter.searchTransaction(token, params.trxId);
  }

  /**
   * Refund a completed transaction.
   */
  public async refundPayment(params: RefundParams): Promise<RefundResult> {
    const token = await this.getValidToken();
    return this.adapter.refundPayment(token, params);
  }

  /**
   * Check status of a refund transaction.
   */
  public async refundStatus(params: RefundStatusParams): Promise<RefundStatusResult> {
    if (!this.adapter.refundStatus) {
      throw new BkashError(`refundStatus is not supported by adapter "${this.adapter.version}".`);
    }
    const token = await this.getValidToken();
    return this.adapter.refundStatus(token, params);
  }

  /**
   * Create an agreement session (Mode 0000 or 0001).
   */
  public async createAgreement(params: CreateAgreementParams): Promise<CreateAgreementResult> {
    if (!this.adapter.createAgreement) {
      throw new BkashError(`createAgreement is not supported by adapter "${this.adapter.version}".`);
    }
    const token = await this.getValidToken();
    return this.adapter.createAgreement(token, params);
  }

  /**
   * Execute an agreement session.
   */
  public async executeAgreement(params: ExecuteAgreementParams): Promise<AgreementResult> {
    if (!this.adapter.executeAgreement) {
      throw new BkashError(`executeAgreement is not supported by adapter "${this.adapter.version}".`);
    }
    const token = await this.getValidToken();
    const result = await this.adapter.executeAgreement(token, params);
    return {
      ...result,
      customerMsisdn: result.customerMsisdn ? maskMsisdn(result.customerMsisdn) : undefined,
    };
  }

  /**
   * Cancel an active agreement.
   */
  public async cancelAgreement(params: CancelAgreementParams): Promise<Record<string, unknown>> {
    if (!this.adapter.cancelAgreement) {
      throw new BkashError(`cancelAgreement is not supported by adapter "${this.adapter.version}".`);
    }
    const token = await this.getValidToken();
    return this.adapter.cancelAgreement(token, params);
  }

  /**
   * Capture an authorized payment.
   */
  public async capturePayment(params: CapturePaymentParams): Promise<CaptureResult> {
    if (!this.adapter.capturePayment) {
      throw new BkashError(`capturePayment is not supported by adapter "${this.adapter.version}".`);
    }
    const token = await this.getValidToken();
    return this.adapter.capturePayment(token, params);
  }

  /**
   * Void an authorized payment.
   */
  public async voidPayment(params: VoidPaymentParams): Promise<VoidResult> {
    if (!this.adapter.voidPayment) {
      throw new BkashError(`voidPayment is not supported by adapter "${this.adapter.version}".`);
    }
    const token = await this.getValidToken();
    return this.adapter.voidPayment(token, params);
  }

  /**
   * Creates a Web-Standard HTTP Request handler for this server instance.
   */
  public createHandler(options?: BkashHandlerOptions): BkashHttpHandler {
    return new BkashHttpHandler(this, options);
  }
}

