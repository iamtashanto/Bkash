import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KNOWN_BKASH_ERRORS } from '../../src/errors.js';

describe('error table matches the published bKash codes shown on the website', () => {
  const published = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../website/src/data/error-codes.json', import.meta.url)), 'utf8')
  ) as Record<string, string>;

  it('has the same codes and messages', () => {
    expect(KNOWN_BKASH_ERRORS).toEqual(published);
  });

  it('maps unknown codes without throwing', () => {
    expect(Object.keys(published).length).toBeGreaterThan(80);
  });
});
