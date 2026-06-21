import {
  DEFAULT_DISPLAY_FORMAT_RULES,
  DisplayFormatOptions,
  DisplayFormatRule,
} from './types';

const SCIENTIFIC_MANTISSA_DECIMAL_PLACES = 3;
const SCIENTIFIC_EXPONENT_DIGITS = 2;

/**
 * Formats numeric values for display according to AMOT numerical display rules.
 */
export class DisplayFormatter {
  private readonly rules: readonly DisplayFormatRule[];

  constructor(rules: readonly DisplayFormatRule[] = DEFAULT_DISPLAY_FORMAT_RULES) {
    if (rules.length === 0) {
      throw new Error('DisplayFormatter requires at least one format rule.');
    }
    this.rules = rules;
  }

  /**
   * Formats a numeric value for UI display.
   *
   * @param value - The numeric value to format.
   * @param options - Optional formatting overrides (e.g. step=1 for integer display).
   * @returns The formatted string, or an empty string for null/undefined.
   */
  format(value: number | null | undefined, options?: DisplayFormatOptions): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (!Number.isFinite(value)) {
      return String(value);
    }

    if (Object.is(value, -0)) {
      return '0';
    }

    if (value === 0) {
      return '0';
    }

    if (options?.step === 1) {
      return formatInteger(value);
    }

    const sign = value < 0 ? '-' : '';
    const absValue = Math.abs(value);
    const rule = this.findRule(absValue);

    if (rule.scientific) {
      return sign + formatScientific(absValue);
    }

    return sign + formatFixed(absValue, rule.maxIntegerDigits, rule.maxDecimalPlaces);
  }

  /**
   * Returns the format rule that applies to the given absolute value.
   */
  getRuleForValue(absValue: number): DisplayFormatRule {
    return this.findRule(absValue);
  }

  private findRule(absValue: number): DisplayFormatRule {
    const rule = this.rules.find((entry) => absValue >= entry.min && absValue < entry.max);
    if (!rule) {
      throw new Error(`No display format rule found for value: ${absValue}`);
    }
    return rule;
  }
}

/**
 * Convenience function using the default AMOT display rules.
 */
export function formatDisplayValue(
  value: number | null | undefined,
  options?: DisplayFormatOptions,
): string {
  return defaultFormatter.format(value, options);
}

const defaultFormatter = new DisplayFormatter();

function formatInteger(value: number): string {
  return String(Math.round(value));
}

function formatFixed(
  absValue: number,
  maxIntegerDigits: number,
  maxDecimalPlaces: number,
): string {
  const factor = 10 ** maxDecimalPlaces;
  const rounded = Math.round(absValue * factor) / factor;

  const [integerPart, fractionalPart = ''] = rounded.toFixed(maxDecimalPlaces).split('.');
  const trimmedFraction = fractionalPart.replace(/0+$/, '');

  if (integerPart.length > maxIntegerDigits) {
    return formatScientific(absValue);
  }

  if (trimmedFraction.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${trimmedFraction}`;
}

function formatScientific(absValue: number): string {
  const exponent = Math.floor(Math.log10(absValue));
  const mantissa = absValue / 10 ** exponent;
  const factor = 10 ** SCIENTIFIC_MANTISSA_DECIMAL_PLACES;
  let roundedMantissa = Math.round(mantissa * factor) / factor;

  let adjustedExponent = exponent;

  if (roundedMantissa >= 10) {
    // Avoid carrying to the next exponent when rounding would exceed #.### capacity
    // (e.g. 0.099999 → 9.999E-02, not 1E-01).
    roundedMantissa = Math.floor(mantissa * factor) / factor;
  }

  if (roundedMantissa >= 10) {
    roundedMantissa /= 10;
    adjustedExponent += 1;
  } else if (roundedMantissa < 1 && roundedMantissa > 0) {
    roundedMantissa *= 10;
    adjustedExponent -= 1;
  }

  const mantissaText = trimTrailingZeros(
    roundedMantissa.toFixed(SCIENTIFIC_MANTISSA_DECIMAL_PLACES),
  );
  const exponentSign = adjustedExponent >= 0 ? '+' : '-';
  const exponentText = String(Math.abs(adjustedExponent)).padStart(
    SCIENTIFIC_EXPONENT_DIGITS,
    '0',
  );

  return `${mantissaText}E${exponentSign}${exponentText}`;
}

function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) {
    return value;
  }
  return value.replace(/\.?0+$/, '');
}
