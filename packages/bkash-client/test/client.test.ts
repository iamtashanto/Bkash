import { describe, it, expect } from 'vitest';
import { BkashClient } from '../src/index.js';

describe('BkashClient', () => {
  it('initializes with idle state', () => {
    const client = new BkashClient();
    expect(client.getState()).toBe('idle');
  });
});
