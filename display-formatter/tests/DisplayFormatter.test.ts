import { describe, expect, it } from 'vitest';
import { DisplayFormatter, formatDisplayValue } from '../src';

describe('DisplayFormatter', () => {
  const formatter = new DisplayFormatter();

  it('delegates formatting to formatDisplayValue', () => {
    expect(formatter.format(1234.567)).toBe('1234.567');
    expect(formatter.format(0.00123)).toBe('1.23E-03');
  });

  it('returns display format pattern', () => {
    expect(formatter.getDisplayFormatPattern(42)).toBe('##.#####');
  });

  it('detects scientific format ranges', () => {
    expect(formatter.isScientificFormat(0.01)).toBe(true);
    expect(formatter.isScientificFormat(42)).toBe(false);
  });

  it('returns fixed format spec for in-range values', () => {
    const rule = formatter.getRuleForValue(55);
    expect(rule.minAbs).toBe(10);
    expect(rule.maxAbs).toBe(100);
    expect(rule.integerDigits).toBe(2);
    expect(rule.fractionDigits).toBe(5);
  });

  it('supports step=1 integer display', () => {
    expect(formatter.format(42.789, { step: 1 })).toBe('43');
  });
});

describe('formatDisplayValue integration', () => {
  it('is exported as a standalone function', () => {
    expect(formatDisplayValue(99999.99)).toBe('99999.99');
  });
});
