import { describe, it, expect } from 'vitest';
import * as RootIndex from '../../src/index.js';

describe('Regression AUD-07: Webhook verifier moved to Node-only subpath', () => {
  it('does NOT expose BkashWebhookVerifier or MemoryMessageStore in root entry to remain edge-safe', () => {
    // Root entry must remain edge-safe without Node crypto / webhook verifier
    expect((RootIndex as any).BkashWebhookVerifier).toBeUndefined();
    expect((RootIndex as any).MemoryMessageStore).toBeUndefined();
  });

  it('exposes BkashWebhookVerifier from webhook subpath module', async () => {
    const WebhookModule = await import('../../src/webhook.js');
    expect(WebhookModule.BkashWebhookVerifier).toBeDefined();
    expect(WebhookModule.MemoryMessageStore).toBeDefined();
    // Must be marked EXPERIMENTAL in JSDoc / metadata
    expect(WebhookModule.IS_WEBHOOK_EXPERIMENTAL).toBe(true);
  });
});
