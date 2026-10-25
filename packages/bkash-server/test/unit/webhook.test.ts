import { describe, it, expect, vi } from 'vitest';
import {
  BkashWebhookVerifier,
  validateSigningCertUrl,
  buildSnsCanonicalString,
} from '../../src/webhook/webhook-verifier.js';
import { BkashWebhookVerificationError } from '../../src/errors.js';
import type { BkashSnsMessage } from '../../src/types.js';

describe('AWS SNS Webhook Verifier & Security Guards', () => {
  it('validates SigningCertURL strictly against AWS SNS constraints', () => {
    // Valid URL
    expect(() =>
      validateSigningCertUrl(
        'https://sns.ap-southeast-1.amazonaws.com/SimpleNotificationService-ac565b8b1a6c5d002d285f9598aa1d9b.pem'
      )
    ).not.toThrow();

    // Rejects non-HTTPS
    expect(() =>
      validateSigningCertUrl(
        'http://sns.ap-southeast-1.amazonaws.com/SimpleNotificationService.pem'
      )
    ).toThrowError(/must use HTTPS/);

    // Rejects attacker host
    expect(() =>
      validateSigningCertUrl('https://evil-attacker.com/fake-cert.pem')
    ).toThrowError(/not a legitimate AWS SNS host/);

    // Rejects non-pem extension
    expect(() =>
      validateSigningCertUrl(
        'https://sns.us-east-1.amazonaws.com/SimpleNotificationService.crt'
      )
    ).toThrowError(/must end with \.pem/);

    // Rejects port injection
    expect(() =>
      validateSigningCertUrl(
        'https://sns.us-east-1.amazonaws.com:8443/SimpleNotificationService.pem'
      )
    ).toThrowError(/must not contain non-standard port/);
  });

  it('builds canonical string matching SNS specification', () => {
    const notificationMsg: BkashSnsMessage = {
      Type: 'Notification',
      MessageId: 'msg-12345',
      TopicArn: 'arn:aws:sns:ap-southeast-1:123456789012:bkash-topic',
      Subject: 'bKash IPN Notification',
      Message: '{"paymentID":"PAY_123","amount":"1550.00"}',
      Timestamp: '2026-10-25T15:30:00.000Z',
      SignatureVersion: '1',
      Signature: 'dummy_sig',
      SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/cert.pem',
    };

    const canonical = buildSnsCanonicalString(notificationMsg);
    expect(canonical).toContain('Message\n{"paymentID":"PAY_123","amount":"1550.00"}\n');
    expect(canonical).toContain('MessageId\nmsg-12345\n');
    expect(canonical).toContain('Subject\nbKash IPN Notification\n');
    expect(canonical).toContain('TopicArn\narn:aws:sns:ap-southeast-1:123456789012:bkash-topic\n');
    expect(canonical).toContain('Type\nNotification\n');
  });

  it('rejects duplicate webhooks via MessageId replay protection', async () => {
    const verifier = new BkashWebhookVerifier();

    // Mock verifySignature and getSigningCertificate
    (verifier as any).getSigningCertificate = vi.fn().mockResolvedValue('MOCK_CERT');
    (verifier as any).verifySignature = vi.fn().mockResolvedValue(true);

    const validMsg: BkashSnsMessage = {
      Type: 'Notification',
      MessageId: 'replay-test-id-999',
      TopicArn: 'arn:aws:sns:ap-southeast-1:123456789012:bkash-topic',
      Message: '{"paymentID":"PAY_123","trxID":"TRX_999"}',
      Timestamp: new Date().toISOString(),
      SignatureVersion: '2',
      Signature: 'valid_sig',
      SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/cert.pem',
    };

    // First attempt succeeds
    const res1 = await verifier.verify(validMsg);
    expect(res1?.messageId).toBe('replay-test-id-999');

    // Second attempt with same MessageId must be rejected
    await expect(verifier.verify(validMsg)).rejects.toThrowError(
      /Duplicate webhook rejected/
    );
  });

  it('rejects messages outside allowable freshness window', async () => {
    const verifier = new BkashWebhookVerifier({ freshnessWindowMs: 60000 }); // 1 min window

    const staleMsg: BkashSnsMessage = {
      Type: 'Notification',
      MessageId: 'stale-id-123',
      TopicArn: 'arn:aws:sns:ap-southeast-1:123456789012:bkash-topic',
      Message: '{"paymentID":"PAY_123"}',
      Timestamp: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
      SignatureVersion: '1',
      Signature: 'sig',
      SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/cert.pem',
    };

    await expect(verifier.verify(staleMsg)).rejects.toThrowError(
      /outside allowable freshness window/
    );
  });

  it('handles fuzz testing with malformed/truncated payloads safely', async () => {
    const verifier = new BkashWebhookVerifier();

    // Fuzz inputs
    const fuzzInputs = [
      '',
      '{',
      '{"Type": "InvalidType"}',
      '{"Type": "Notification", "MessageId": 123}',
      '{"Type": "Notification", "MessageId": "x", "Timestamp": "NOT_A_DATE"}',
      '{"Type": "Notification", "MessageId": "x", "Timestamp": "2026-01-01", "SigningCertURL": "http://evil.com"}',
    ];

    for (const input of fuzzInputs) {
      await expect(verifier.verify(input as any)).rejects.toThrow();
    }
  });
});
