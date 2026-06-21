import {
  ALL_DISPLAY_FORMAT_PATTERNS,
  FIXED_DISPLAY_FORMATS,
  FormatDisplayValueOptions,
  DisplayFormatSpec,
  LARGE_VALUE_SCIENTIFIC_FORMAT,
  SMALL_VALUE_SCIENTIFIC_FORMAT,
} from './types';

export { ALL_DISPLAY_FORMAT_PATTERNS } from './types';

const SMALL_VALUE_THRESHOLD = 0.1;
const LARGE_VALUE_THRESHOLD = 1_000_000;
const SCIENTIFIC_MANTISSA_FRACTION_DIGITS = 3;
const SCIENTIFIC_EXPONENT_DIGITS = 2;

/**
 * Returns the display format pattern string for a numeric value
 * according to the AMOT numerical display format specification.
 */
export function getDisplayFormatPattern(value: number): string {
  if (!Number.isFinite(value)) {
    return 'special';
  }

  if (value === 0) {
    return '0';
  }

  const abs = Math.abs(value);

  if (abs < SMALL_VALUE_THRESHOLD) {
    return SMALL_VALUE_SCIENTIFIC_FORMAT;
  }

  if (abs >= LARGE_VALUE_THRESHOLD) {
    return LARGE_VALUE_SCIENTIFIC_FORMAT;
  }

  const spec = findFixedFormatSpec(abs);
  return buildFixedPattern(spec);
}

/**
 * Returns true when the value is formatted using scientific notation.
 */
export function isScientificFormat(value: number): boolean {
  const pattern = getDisplayFormatPattern(value);
  return pattern.includes('E');
}

/**
 * Formats a numeric value for UI display according to the AMOT
 * numerical display format specification.
 *
 * | Value Range (|x|)   | Display Format |
 * |---------------------|----------------|
 * | < 0.1               | #.###E-##      |
 * | 0.1 – 9.999999      | #.######       |
 * | 10 – 99.99999       | ##.#####       |
 * | 100 – 999.9999      | ###.####       |
 * | 1,000 – 9,999.999   | ####.###       |
 * | 10,000 – 99,999.99  | #####.##       |
 * | 100,000 – 999,999.9 | ######.#       |
 * | >= 1,000,000        | #.###E+##      |
 */
/**
 * Formats a numeric value using an explicitly selected display format pattern.
 */
export function formatDisplayValueWithPattern(
  value: number | null | undefined,
  pattern: string,
  options: FormatDisplayValueOptions = {},
): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (options.step === 1) {
    return formatInteger(value);
  }

  if (Number.isNaN(value)) {
    return 'NaN';
  }

  if (!Number.isFinite(value)) {
    return value > 0 ? 'Infinity' : '-Infinity';
  }

  if (Object.is(value, -0) || value === 0) {
    return '0';
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (isScientificPattern(pattern)) {
    return sign + formatScientific(abs, SCIENTIFIC_MANTISSA_FRACTION_DIGITS, options);
  }

  const spec = parseFixedPattern(pattern);
  if (!spec) {
    throw new RangeError(`Unsupported display format pattern: ${pattern}`);
  }

  return sign + formatFixed(abs, spec, options, false);
}

export function formatDisplayValue(
  value: number | null | undefined,
  options: FormatDisplayValueOptions = {},
): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (options.step === 1) {
    return formatInteger(value);
  }

  if (Number.isNaN(value)) {
    return 'NaN';
  }

  if (!Number.isFinite(value)) {
    return value > 0 ? 'Infinity' : '-Infinity';
  }

  if (Object.is(value, -0) || value === 0) {
    return '0';
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs < SMALL_VALUE_THRESHOLD) {
    return sign + formatScientific(abs, SCIENTIFIC_MANTISSA_FRACTION_DIGITS, options);
  }

  if (abs >= LARGE_VALUE_THRESHOLD) {
    return sign + formatScientific(abs, SCIENTIFIC_MANTISSA_FRACTION_DIGITS, options);
  }

  const spec = findFixedFormatSpec(abs);
  return sign + formatFixed(abs, spec, options, true);
}

/**
 * Class-based wrapper around the display formatting functions.
 */
export class DisplayFormatter {
  format(value: number | null | undefined, options?: FormatDisplayValueOptions): string {
    return formatDisplayValue(value, options);
  }

  formatWithPattern(
    value: number | null | undefined,
    pattern: string,
    options?: FormatDisplayValueOptions,
  ): string {
    return formatDisplayValueWithPattern(value, pattern, options);
  }

  getRuleForValue(absValue: number): DisplayFormatSpec {
    if (absValue < SMALL_VALUE_THRESHOLD || absValue >= LARGE_VALUE_THRESHOLD) {
      throw new Error('Scientific format ranges do not use fixed format specs.');
    }
    return findFixedFormatSpec(absValue);
  }

  getDisplayFormatPattern(value: number): string {
    return getDisplayFormatPattern(value);
  }

  isScientificFormat(value: number): boolean {
    return isScientificFormat(value);
  }
}

function findFixedFormatSpec(abs: number): DisplayFormatSpec {
  const spec = FIXED_DISPLAY_FORMATS.find(
    (entry) => abs >= entry.minAbs && (entry.maxAbs === null || abs < entry.maxAbs),
  );

  if (!spec) {
    throw new RangeError(`No display format found for absolute value: ${abs}`);
  }

  return spec;
}

function buildFixedPattern(spec: DisplayFormatSpec): string {
  const integerPart = '#'.repeat(spec.integerDigits);
  const fractionPart = '#'.repeat(spec.fractionDigits);
  return `${integerPart}.${fractionPart}`;
}

function isScientificPattern(pattern: string): boolean {
  return pattern.includes('E');
}

function parseFixedPattern(pattern: string): DisplayFormatSpec | null {
  if (isScientificPattern(pattern)) {
    return null;
  }

  const parts = pattern.split('.');
  if (parts.length !== 2) {
    return null;
  }

  return {
    minAbs: 0,
    maxAbs: null,
    integerDigits: parts[0].length,
    fractionDigits: parts[1].length,
  };
}

function formatInteger(value: number): string {
  return String(Math.round(value));
}

function formatFixed(
  abs: number,
  spec: DisplayFormatSpec,
  options: FormatDisplayValueOptions,
  enforceIntegerDigits = true,
): string {
  const rounded = roundToFractionDigits(abs, spec.fractionDigits);
  const [integerPart, fractionPart = ''] = splitNumber(rounded, spec.fractionDigits);

  if (enforceIntegerDigits && integerPart.length > spec.integerDigits) {
    throw new RangeError(
      `Value ${abs} exceeds integer digit capacity (${spec.integerDigits}) for its range`,
    );
  }

  if (options.fixedFraction) {
    const paddedFraction = fractionPart.padEnd(spec.fractionDigits, '0');
    return paddedFraction.length > 0
      ? `${integerPart}.${paddedFraction}`
      : `${integerPart}.${'0'.repeat(spec.fractionDigits)}`;
  }

  const trimmedFraction = fractionPart.replace(/0+$/, '');
  return trimmedFraction.length > 0
    ? `${integerPart}.${trimmedFraction}`
    : integerPart;
}

function formatScientific(
  abs: number,
  mantissaFractionDigits: number,
  options: FormatDisplayValueOptions,
): string {
  let exponent = Math.floor(Math.log10(abs));
  let mantissa = abs / Math.pow(10, exponent);

  let fractionDigits = mantissaFractionDigits;
  if (roundToFractionDigits(mantissa, fractionDigits) >= 10) {
    fractionDigits = 6;
    exponent = Math.floor(Math.log10(abs));
    mantissa = abs / Math.pow(10, exponent);
  }

  const roundedMantissa = roundToFractionDigits(mantissa, fractionDigits);
  if (roundedMantissa >= 10) {
    exponent += 1;
    mantissa = abs / Math.pow(10, exponent);
  } else {
    mantissa = roundedMantissa;
  }

  const [integerPart, fractionPart = ''] = splitNumber(
    roundToFractionDigits(mantissa, fractionDigits),
    fractionDigits,
  );

  const mantissaText = options.fixedFraction
    ? `${integerPart}.${fractionPart.padEnd(fractionDigits, '0')}`
    : trimFraction(integerPart, fractionPart);

  const exponentSign = exponent < 0 ? '-' : '+';
  const exponentMagnitude = Math.abs(exponent)
    .toString()
    .padStart(SCIENTIFIC_EXPONENT_DIGITS, '0');

  return `${mantissaText}E${exponentSign}${exponentMagnitude}`;
}

function splitNumber(value: number, fractionDigits: number): [string, string] {
  const text = value.toFixed(fractionDigits);
  const dotIndex = text.indexOf('.');
  if (dotIndex === -1) {
    return [text, ''];
  }

  return [text.slice(0, dotIndex), text.slice(dotIndex + 1)];
}

function trimFraction(integerPart: string, fractionPart: string): string {
  const trimmedFraction = fractionPart.replace(/0+$/, '');
  return trimmedFraction.length > 0
    ? `${integerPart}.${trimmedFraction}`
    : integerPart;
}

function roundToFractionDigits(value: number, fractionDigits: number): number {
  if (fractionDigits <= 0) {
    return Math.round(value);
  }

  const factor = Math.pow(10, fractionDigits);
  return Math.round(value * factor) / factor;
}
