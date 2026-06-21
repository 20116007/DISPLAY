import { describe, expect, it } from 'vitest';
import {
  formatDisplayValue,
  formatDisplayValueWithPattern,
  getDisplayFormatPattern,
  isScientificFormat,
  FIXED_DISPLAY_FORMATS,
} from '../src/index';

describe('getDisplayFormatPattern', () => {
  it('returns scientific pattern for small values', () => {
    expect(getDisplayFormatPattern(0.05)).toBe('#.###E-##');
    expect(getDisplayFormatPattern(-0.001)).toBe('#.###E-##');
  });

  it('returns fixed patterns by range', () => {
    expect(getDisplayFormatPattern(0.5)).toBe('#.######');
    expect(getDisplayFormatPattern(42)).toBe('##.#####');
    expect(getDisplayFormatPattern(500)).toBe('###.####');
    expect(getDisplayFormatPattern(5000)).toBe('####.###');
    expect(getDisplayFormatPattern(50000)).toBe('#####.##');
    expect(getDisplayFormatPattern(500000)).toBe('######.#');
  });

  it('returns large scientific pattern', () => {
    expect(getDisplayFormatPattern(2_000_000)).toBe('#.###E+##');
  });

  it('returns 0 for zero', () => {
    expect(getDisplayFormatPattern(0)).toBe('0');
  });
});

describe('isScientificFormat', () => {
  it('detects scientific ranges', () => {
    expect(isScientificFormat(0.01)).toBe(true);
    expect(isScientificFormat(5_000_000)).toBe(true);
    expect(isScientificFormat(12.34)).toBe(false);
  });
});

describe('formatDisplayValue', () => {
  describe('edge cases', () => {
    it('formats zero', () => {
      expect(formatDisplayValue(0)).toBe('0');
    });

    it('returns empty string for null/undefined', () => {
      expect(formatDisplayValue(null)).toBe('');
      expect(formatDisplayValue(undefined)).toBe('');
    });

    it('formats non-finite values', () => {
      expect(formatDisplayValue(Number.NaN)).toBe('NaN');
      expect(formatDisplayValue(Number.POSITIVE_INFINITY)).toBe('Infinity');
      expect(formatDisplayValue(Number.NEGATIVE_INFINITY)).toBe('-Infinity');
    });

    it('preserves sign', () => {
      expect(formatDisplayValue(-12.345)).toBe('-12.345');
      expect(formatDisplayValue(-0.05)).toBe('-5E-02');
    });
  });

  describe('small values (< 0.1) — #.###E-##', () => {
    it('formats typical small values', () => {
      expect(formatDisplayValue(0.05)).toBe('5E-02');
      expect(formatDisplayValue(0.00123)).toBe('1.23E-03');
      expect(formatDisplayValue(0.0999999)).toBe('9.99999E-02');
    });

    it('respects mantissa precision (max 3 fractional digits)', () => {
      expect(formatDisplayValue(0.00123456)).toBe('1.235E-03');
    });
  });

  describe('range boundaries', () => {
    it('uses fixed format at 0.1', () => {
      expect(formatDisplayValue(0.1)).toBe('0.1');
      expect(getDisplayFormatPattern(0.1)).toBe('#.######');
    });

    it('uses next range at 10', () => {
      expect(formatDisplayValue(10)).toBe('10');
      expect(getDisplayFormatPattern(10)).toBe('##.#####');
    });

    it('uses next range at 100', () => {
      expect(formatDisplayValue(100)).toBe('100');
      expect(getDisplayFormatPattern(100)).toBe('###.####');
    });

    it('uses scientific at 1,000,000', () => {
      expect(formatDisplayValue(1_000_000)).toBe('1E+06');
      expect(getDisplayFormatPattern(1_000_000)).toBe('#.###E+##');
    });

    it('uses fixed format just below 1,000,000', () => {
      expect(formatDisplayValue(999_999.9)).toBe('999999.9');
      expect(getDisplayFormatPattern(999_999.9)).toBe('######.#');
    });
  });

  describe('fixed decimal ranges', () => {
    it('formats 0.1 – 9.999999 as #.######', () => {
      expect(formatDisplayValue(0.1234567)).toBe('0.123457');
      expect(formatDisplayValue(9.999999)).toBe('9.999999');
    });

    it('formats 10 – 99.99999 as ##.#####', () => {
      expect(formatDisplayValue(12.345678)).toBe('12.34568');
      expect(formatDisplayValue(99.99999)).toBe('99.99999');
    });

    it('formats 100 – 999.9999 as ###.####', () => {
      expect(formatDisplayValue(123.456789)).toBe('123.4568');
      expect(formatDisplayValue(999.9999)).toBe('999.9999');
    });

    it('formats 1,000 – 9,999.999 as ####.###', () => {
      expect(formatDisplayValue(1234.56789)).toBe('1234.568');
      expect(formatDisplayValue(9999.999)).toBe('9999.999');
    });

    it('formats 10,000 – 99,999.99 as #####.##', () => {
      expect(formatDisplayValue(12345.678)).toBe('12345.68');
      expect(formatDisplayValue(99999.99)).toBe('99999.99');
    });

    it('formats 100,000 – 999,999.9 as ######.#', () => {
      expect(formatDisplayValue(123456.78)).toBe('123456.8');
      expect(formatDisplayValue(999999.9)).toBe('999999.9');
    });
  });

  describe('large values (>= 1,000,000) — #.###E+##', () => {
    it('formats large values in scientific notation', () => {
      expect(formatDisplayValue(1_234_567)).toBe('1.235E+06');
      expect(formatDisplayValue(9_876_543)).toBe('9.877E+06');
    });
  });

  describe('step=1 option', () => {
    it('formats as integer when step is 1', () => {
      expect(formatDisplayValue(42.789, { step: 1 })).toBe('43');
      expect(formatDisplayValue(0.00123, { step: 1 })).toBe('0');
    });
  });

  describe('fixedFraction option', () => {
    it('pads fractional digits in fixed format', () => {
      expect(formatDisplayValue(12.3, { fixedFraction: true })).toBe('12.30000');
    });

    it('pads fractional digits in scientific format', () => {
      expect(formatDisplayValue(0.05, { fixedFraction: true })).toBe('5.000E-02');
    });
  });

  describe('FIXED_DISPLAY_FORMATS', () => {
    it('covers all non-scientific ranges without gaps', () => {
      expect(FIXED_DISPLAY_FORMATS).toHaveLength(6);
      expect(FIXED_DISPLAY_FORMATS[0]?.minAbs).toBe(0.1);
      expect(FIXED_DISPLAY_FORMATS.at(-1)?.maxAbs).toBe(1_000_000);
    });
  });
});

describe('formatDisplayValueWithPattern', () => {
  it('formats with selected fixed pattern', () => {
    expect(formatDisplayValueWithPattern(12.345678, '##.#####')).toBe('12.34568');
    expect(formatDisplayValueWithPattern(1234.5678, '####.###')).toBe('1234.568');
  });

  it('formats with selected scientific patterns', () => {
    expect(formatDisplayValueWithPattern(0.00123, '#.###E-##')).toBe('1.23E-03');
    expect(formatDisplayValueWithPattern(1234567, '#.###E+##')).toBe('1.235E+06');
  });
});
