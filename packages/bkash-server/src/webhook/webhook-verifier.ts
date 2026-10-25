import type {
  BkashSnsMessage,
  BkashWebhookOptions,
  MessageStore,
  VerifiedWebhookPayload,
} from '../types.js';
import { BkashWebhookVerificationError } from '../errors.js';

export class MemoryMessageStore implements MessageStore {
  private messages = new Map<string, number>();

  public async has(messageId: string): Promise<boolean> {
    const expiresAt = this.messages.get(messageId);
    if (!expiresAt) return false;
    if (Date.now() >= expiresAt) {
      this.messages.delete(messageId);
      return false;
    }
    return true;
  }

  public async add(messageId: string, ttlSeconds: number): Promise<void> {
    this.messages.set(messageId, Date.now() + ttlSeconds * 1000);
  }
}

/**
 * Validates the SigningCertURL against AWS SNS strict security constraints.
 */
export function validateSigningCertUrl(certUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(certUrl);
  } catch {
    throw new BkashWebhookVerificationError(`Invalid SigningCertURL: "${certUrl}"`);
  }

  if (parsed.protocol !== 'https:') {
    throw new BkashWebhookVerificationError(`SigningCertURL must use HTTPS: "${certUrl}"`);
  }

  if (parsed.port || parsed.username || parsed.password) {
    throw new BkashWebhookVerificationError(
      `SigningCertURL must not contain non-standard port or user credentials: "${certUrl}"`
    );
  }

  const hostRegex = /^sns\.[a-z0-9-]+\.amazonaws\.com$/;
  if (!hostRegex.test(parsed.hostname)) {
    throw new BkashWebhookVerificationError(
      `SigningCertURL host "${parsed.hostname}" is not a legitimate AWS SNS host.`
    );
  }

  if (!parsed.pathname.endsWith('.pem')) {
    throw new BkashWebhookVerificationError(
      `SigningCertURL path "${parsed.pathname}" must end with .pem`
    );
  }
}

/**
 * Builds canonical string for AWS SNS message signature verification.
 */
export function buildSnsCanonicalString(msg: BkashSnsMessage): string {
  if (msg.Type === 'Notification') {
    let str = `Message\n${msg.Message}\nMessageId\n${msg.MessageId}\n`;
    if (msg.Subject) {
      str += `Subject\n${msg.Subject}\n`;
    }
    str += `Timestamp\n${msg.Timestamp}\nTopicArn\n${msg.TopicArn}\nType\n${msg.Type}\n`;
    return str;
  }

  if (msg.Type === 'SubscriptionConfirmation' || msg.Type === 'UnsubscribeConfirmation') {
    let str = `Message\n${msg.Message}\nMessageId\n${msg.MessageId}\nSubscribeURL\n${msg.SubscribeURL}\nTimestamp\n${msg.Timestamp}\n`;
    if ((msg as any).Token) {
      str += `Token\n${(msg as any).Token}\n`;
    }
    str += `TopicArn\n${msg.TopicArn}\nType\n${msg.Type}\n`;
    return str;
  }

  throw new BkashWebhookVerificationError(`Unsupported SNS message type: "${msg.Type}"`);
}

/**
 * AWS SNS Webhook Verifier for bKash Instant Payment Notifications (IPN).
 */
export class BkashWebhookVerifier {
  private options: BkashWebhookOptions;
  private certCache = new Map<string, { cert: string; expiresAt: number }>();
  private messageStore: MessageStore;

  constructor(options?: BkashWebhookOptions) {
    this.options = options || {};
    this.messageStore = this.options.messageStore || new MemoryMessageStore();
  }

  public async getSigningCertificate(certUrl: string): Promise<string> {
    validateSigningCertUrl(certUrl);

    const cached = this.certCache.get(certUrl);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.cert;
    }

    const res = await fetch(certUrl);
    if (!res.ok) {
      throw new BkashWebhookVerificationError(
        `Failed to fetch signing certificate from ${certUrl} (HTTP ${res.status})`
      );
    }

    const certText = await res.text();
    // Cache for 24 hours
    this.certCache.set(certUrl, {
      cert: certText,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return certText;
  }

  /**
   * Cryptographically verifies the incoming SNS payload and processes confirmation handshakes.
   */
  public async verify(payload: BkashSnsMessage | string): Promise<VerifiedWebhookPayload | null> {
    const msg: BkashSnsMessage =
      typeof payload === 'string' ? JSON.parse(payload) : payload;

    // 1. Topic ARN check
    if (
      this.options.allowedTopicArns &&
      this.options.allowedTopicArns.length > 0 &&
      !this.options.allowedTopicArns.includes(msg.TopicArn)
    ) {
      throw new BkashWebhookVerificationError(
        `TopicArn "${msg.TopicArn}" does not match configured allowed topics.`
      );
    }

    // 2. Freshness check
    const timestampMs = Date.parse(msg.Timestamp);
    if (isNaN(timestampMs)) {
      throw new BkashWebhookVerificationError(`Invalid message Timestamp: "${msg.Timestamp}"`);
    }

    const maxDrift = this.options.freshnessWindowMs ?? 15 * 60 * 1000;
    if (Math.abs(Date.now() - timestampMs) > maxDrift) {
      throw new BkashWebhookVerificationError(
        `Message Timestamp "${msg.Timestamp}" is outside allowable freshness window (${maxDrift}ms).`
      );
    }

    // 3. MessageId replay protection
    const alreadyProcessed = await this.messageStore.has(msg.MessageId);
    if (alreadyProcessed) {
      throw new BkashWebhookVerificationError(
        `Duplicate webhook rejected: MessageId "${msg.MessageId}" has already been processed.`
      );
    }

    // 4. Download and cache signing certificate
    const certPem = await this.getSigningCertificate(msg.SigningCertURL);

    // 5. Build canonical string
    const canonicalString = buildSnsCanonicalString(msg);

    // 6. Verify RSA signature
    const isValid = await this.verifySignature(
      canonicalString,
      msg.Signature,
      certPem,
      msg.SignatureVersion
    );

    if (!isValid) {
      throw new BkashWebhookVerificationError('RSA signature verification failed.');
    }

    // Mark MessageId as processed
    await this.messageStore.add(msg.MessageId, 3600);

    // 7. Handle SubscriptionConfirmation handshake
    if (msg.Type === 'SubscriptionConfirmation') {
      if (msg.SubscribeURL) {
        // Only fetch SubscribeURL AFTER verifying the signature!
        await fetch(msg.SubscribeURL);
      }
      return null;
    }

    let parsedMessage: Record<string, unknown> = {};
    try {
      parsedMessage = JSON.parse(msg.Message);
    } catch {
      parsedMessage = { raw: msg.Message };
    }

    return {
      messageId: msg.MessageId,
      topicArn: msg.TopicArn,
      type: msg.Type,
      data: parsedMessage,
      timestamp: msg.Timestamp,
    };
  }

  private async verifySignature(
    data: string,
    signatureBase64: string,
    certPem: string,
    signatureVersion: '1' | '2'
  ): Promise<boolean> {
    try {
      // Dynamic import to stay universal across environments
      const crypto = await import('node:crypto');
      const verifier = crypto.createVerify(
        signatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1'
      );
      verifier.update(data, 'utf8');
      return verifier.verify(certPem, signatureBase64, 'base64');
    } catch (err) {
      throw new BkashWebhookVerificationError(
        `Error during crypto verification: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
