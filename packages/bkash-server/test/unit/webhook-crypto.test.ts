import { describe, it, expect, beforeAll, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  BkashWebhookVerifier,
  buildSnsCanonicalString,
} from '../../src/webhook/webhook-verifier.js';
import type { BkashSnsMessage } from '../../src/types.js';

describe('Real Cryptographic AWS SNS Webhook Verification', () => {
  let privateKey: string;
  let certificatePem: string;

  beforeAll(() => {
    // Generate real 2048-bit RSA keypair in-memory
    const { privateKey: privKey, publicKey: pubKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = privKey;

    // Create an X.509 certificate using crypto.X509Certificate or self-signed cert
    // In Node 18+, crypto.createSign().sign() and crypto.createVerify().verify() accept public keys or X.509 certs.
    // Node crypto.createVerify accepts the public key PEM or X.509 cert PEM directly.
    certificatePem = pubKey;
  });

  function signMessage(canonicalString: string, version: '1' | '2'): string {
    const algorithm = version === '2' ? 'RSA-SHA256' : 'RSA-SHA1';
    const signer = crypto.createSign(algorithm);
    signer.update(canonicalString, 'utf8');
    return signer.sign(privateKey, 'base64');
  }

  it('cryptographically verifies SignatureVersion 2 (RSA-SHA256) Notification', async () => {
    const verifier = new BkashWebhookVerifier();
    vi.spyOn(verifier, 'getSigningCertificate').mockResolvedValue(certificatePem);

    const msg: BkashSnsMessage = {
      Type: 'Notification',
      MessageId: `msg-${Date.now()}-v2`,
      TopicArn: 'arn:aws:sns:ap-southeast-1:123456789012:bkash-ipn-topic',
      Subject: 'bKash IPN Notification',
      Message: JSON.stringify({
        paymentID: 'PAY_REAL_SIG_2',
        trxID: 'TRX_999888',
        amount: '1550.00',
        transactionStatus: 'Completed',
      }),
      Timestamp: new Date().toISOString(),
      SignatureVersion: '2',
      Signature: '',
      SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/SimpleNotificationService.pem',
    };

    const canonical = buildSnsCanonicalString(msg);
    msg.Signature = signMessage(canonical, '2');

    const result = await verifier.verify(msg);
    expect(result).not.toBeNull();
    expect(result?.messageId).toBe(msg.MessageId);
    expect((result?.data as any).paymentID).toBe('PAY_REAL_SIG_2');
  });

  it('cryptographically verifies SignatureVersion 1 (RSA-SHA1) Notification', async () => {
    const verifier = new BkashWebhookVerifier();
    vi.spyOn(verifier, 'getSigningCertificate').mockResolvedValue(certificatePem);

    const msg: BkashSnsMessage = {
      Type: 'Notification',
      MessageId: `msg-${Date.now()}-v1`,
      TopicArn: 'arn:aws:sns:ap-southeast-1:123456789012:bkash-ipn-topic',
      Subject: 'bKash IPN Notification v1',
      Message: JSON.stringify({
        paymentID: 'PAY_REAL_SIG_1',
        amount: '500.00',
      }),
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1',
      Signature: '',
      SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/SimpleNotificationService.pem',
    };

    const canonical = buildSnsCanonicalString(msg);
    msg.Signature = signMessage(canonical, '1');

    const result = await verifier.verify(msg);
    expect(result).not.toBeNull();
    expect(result?.messageId).toBe(msg.MessageId);
  });

  it('cryptographically verifies SubscriptionConfirmation handshake and triggers fetch', async () => {
    const verifier = new BkashWebhookVerifier();
    vi.spyOn(verifier, 'getSigningCertificate').mockResolvedValue(certificatePem);

    const msg: BkashSnsMessage = {
      Type: 'SubscriptionConfirmation',
      MessageId: `sub-${Date.now()}`,
      TopicArn: 'arn:aws:sns:ap-southeast-1:123456789012:bkash-ipn-topic',
      Message: 'You have chosen to subscribe to the topic...',
      SubscribeURL: 'https://sns.ap-southeast-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=...',
      Timestamp: new Date().toISOString(),
      SignatureVersion: '2',
      Signature: '',
      SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/SimpleNotificationService.pem',
    };

    const canonical = buildSnsCanonicalString(msg);
    msg.Signature = signMessage(canonical, '2');

    // Mock global fetch for SubscribeURL
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const result = await verifier.verify(msg);
    expect(result).toBeNull(); // SubscriptionConfirmation returns null
    expect(fetchSpy).toHaveBeenCalledWith(msg.SubscribeURL);
  });

  describe('Negative Security Guards & Rejection Verification', () => {
    it('rejects tampered message body with RSA signature failure', async () => {
      const verifier = new BkashWebhookVerifier();
      vi.spyOn(verifier, 'getSigningCertificate').mockResolvedValue(certificatePem);

      const msg: BkashSnsMessage = {
        Type: 'Notification',
        MessageId: `tamper-${Date.now()}`,
        TopicArn: 'arn:aws:sns:ap-southeast-1:123456789012:bkash-ipn-topic',
        Message: JSON.stringify({ paymentID: 'PAY_ORIGINAL', amount: '100.00' }),
        Timestamp: new Date().toISOString(),
        SignatureVersion: '2',
        Signature: '',
        SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/SimpleNotificationService.pem',
      };

      const canonical = buildSnsCanonicalString(msg);
      msg.Signature = signMessage(canonical, '2');

      // Attacker tampers the message payload from 100 to 100000
      msg.Message = JSON.stringify({ paymentID: 'PAY_ORIGINAL', amount: '100000.00' });

      await expect(verifier.verify(msg)).rejects.toThrowError(/RSA signature verification failed/);
    });

    it('rejects message if TopicArn does not match allowed topics', async () => {
      const verifier = new BkashWebhookVerifier({
        allowedTopicArns: ['arn:aws:sns:ap-southeast-1:123456789012:legit-topic'],
      });

      const msg: BkashSnsMessage = {
        Type: 'Notification',
        MessageId: 'id-wrong-topic',
        TopicArn: 'arn:aws:sns:ap-southeast-1:999999999999:attacker-topic',
        Message: 'test',
        Timestamp: new Date().toISOString(),
        SignatureVersion: '2',
        Signature: 'fake',
        SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/cert.pem',
      };

      await expect(verifier.verify(msg)).rejects.toThrowError(/does not match configured allowed topics/);
    });

    it('rejects message if Timestamp is older than freshness window', async () => {
      const verifier = new BkashWebhookVerifier({ freshnessWindowMs: 60000 }); // 1 minute

      const msg: BkashSnsMessage = {
        Type: 'Notification',
        MessageId: 'id-stale',
        TopicArn: 'arn:aws:sns:ap-southeast-1:123456789012:legit-topic',
        Message: 'test',
        Timestamp: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
        SignatureVersion: '2',
        Signature: 'fake',
        SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/cert.pem',
      };

      await expect(verifier.verify(msg)).rejects.toThrowError(/outside allowable freshness window/);
    });

    it('rejects duplicate MessageId to prevent replay attacks', async () => {
      const verifier = new BkashWebhookVerifier();
      vi.spyOn(verifier, 'getSigningCertificate').mockResolvedValue(certificatePem);

      const msg: BkashSnsMessage = {
        Type: 'Notification',
        MessageId: `replay-${Date.now()}`,
        TopicArn: 'arn:aws:sns:ap-southeast-1:123456789012:bkash-topic',
        Message: '{"status":"Completed"}',
        Timestamp: new Date().toISOString(),
        SignatureVersion: '2',
        Signature: '',
        SigningCertURL: 'https://sns.ap-southeast-1.amazonaws.com/cert.pem',
      };

      const canonical = buildSnsCanonicalString(msg);
      msg.Signature = signMessage(canonical, '2');

      const res1 = await verifier.verify(msg);
      expect(res1?.messageId).toBe(msg.MessageId);

      // Replay attempt must fail
      await expect(verifier.verify(msg)).rejects.toThrowError(/Duplicate webhook rejected/);
    });
  });
});
