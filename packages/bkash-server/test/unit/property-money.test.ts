import { describe, it, expect } from 'vitest';
import { formatAmount } from '../../src/utils/sanitizer.js';

describe('Property & Mutation Tests for Money/Amount Handling', () => {
  it('correctly normalizes integers, floats, strings, and whitespace', () => {
    expect(formatAmount(1550)).toBe('1550.00');
    expect(formatAmount(1550.5)).toBe('1550.50');
    expect(formatAmount(1550.55)).toBe('1550.55');
    expect(formatAmount(1550.554)).toBe('1550.55'); // rounding down
    expect(formatAmount(1550.556)).toBe('1550.56'); // rounding up
    expect(formatAmount('1550')).toBe('1550.00');
    expect(formatAmount(' 1550.50 ')).toBe('1550.50');
    expect(formatAmount(0)).toBe('0.00');
    expect(formatAmount('0.05')).toBe('0.05');
  });

  it('handles large monetary amounts safely without exponential notation', () => {
    expect(formatAmount(10000000)).toBe('10000000.00');
    expect(formatAmount(99999999.99)).toBe('99999999.99');
  });

  it('throws TypeError on invalid or NaN amount values', () => {
    expect(() => formatAmount('abc')).toThrowError(TypeError);
    expect(() => formatAmount(NaN)).toThrowError(TypeError);
    expect(() => formatAmount('')).toThrowError(TypeError);
  });
});
