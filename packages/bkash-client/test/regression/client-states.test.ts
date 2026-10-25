import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BkashClient } from '../../src/index.js';

describe('Regression AUD-08: Client states (pending, cancelled, timeout, offline)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('transitions to pending when timeout occurs and never displays failed', async () => {
    const transitions: string[] = [];
    const client = new BkashClient({
      onStateChange: (s) => transitions.push(s),
    });

    // Mock fetch that hangs or times out
    global.fetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    await expect(
      client.checkout({ amount: 100, invoiceNumber: 'INV_TIMEOUT' })
    ).rejects.toThrow();

    // After a timeout or abort, state MUST be 'pending' (or 'timeout'), NOT 'error'
    expect(client.getState()).toBe('pending');
    expect(client.getStateMessage()).toContain('pending');
    expect(client.getStateMessage()).toContain('do not pay again');
  });

  it('supports explicit cancellation and transitions to cancelled', () => {
    const onCancel = vi.fn();
    const client = new BkashClient({ onCancel });

    client.cancel();
    expect(client.getState()).toBe('cancelled');
    expect(onCancel).toHaveBeenCalled();
  });

  it('detects offline state when network is disconnected', async () => {
    const client = new BkashClient();
    
    // Simulate offline
    Object.defineProperty(global, 'navigator', {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    await expect(
      client.checkout({ amount: 100, invoiceNumber: 'INV_OFFLINE' })
    ).rejects.toThrow(/offline/i);

    expect(client.getState()).toBe('offline');
  });
});
