/**
 * Describes a fixed-decimal display format for a value range.
 */
export interface DisplayFormatSpec {
  /** Lower bound (inclusive) for absolute value. */
  minAbs: number;
  /** Upper bound (exclusive) for absolute value, or null for unbounded. */
  maxAbs: number | null;
  /** Maximum integer digits before the decimal point. */
  integerDigits: number;
  /** Maximum fractional digits after the decimal point. */
  fractionDigits: number;
}

/** Pattern for values with |x| < 0.1 */
export const SMALL_VALUE_SCIENTIFIC_FORMAT = '#.###E-##' as const;

/** Pattern for values with |x| >= 1,000,000 */
export const LARGE_VALUE_SCIENTIFIC_FORMAT = '#.###E+##' as const;

/**
 * All AMOT display format patterns in specification order.
 */
export const ALL_DISPLAY_FORMAT_PATTERNS: readonly string[] = [
  SMALL_VALUE_SCIENTIFIC_FORMAT,
  '#.######',
  '##.#####',
  '###.####',
  '####.###',
  '#####.##',
  '######.#',
  LARGE_VALUE_SCIENTIFIC_FORMAT,
] as const;

/**
 * Fixed-decimal format specifications for the non-scientific ranges.
 *
 * | Value Range (|x|)   | Display Format |
 * |---------------------|----------------|
 * | 0.1 – 9.999999      | #.######       |
 * | 10 – 99.99999       | ##.#####       |
 * | 100 – 999.9999      | ###.####       |
 * | 1,000 – 9,999.999   | ####.###       |
 * | 10,000 – 99,999.99  | #####.##       |
 * | 100,000 – 999,999.9 | ######.#       |
 */
export const FIXED_DISPLAY_FORMATS: readonly DisplayFormatSpec[] = [
  { minAbs: 0.1, maxAbs: 10, integerDigits: 1, fractionDigits: 6 },
  { minAbs: 10, maxAbs: 100, integerDigits: 2, fractionDigits: 5 },
  { minAbs: 100, maxAbs: 1_000, integerDigits: 3, fractionDigits: 4 },
  { minAbs: 1_000, maxAbs: 10_000, integerDigits: 4, fractionDigits: 3 },
  { minAbs: 10_000, maxAbs: 100_000, integerDigits: 5, fractionDigits: 2 },
  { minAbs: 100_000, maxAbs: 1_000_000, integerDigits: 6, fractionDigits: 1 },
] as const;

/**
 * Options for {@link formatDisplayValue}.
 */
export interface FormatDisplayValueOptions {
  /**
   * When true, fractional digits are padded to the maximum allowed by the
   * format rule instead of trimming trailing zeros.
   */
  fixedFraction?: boolean;

  /**
   * When set to 1, the value is displayed as an integer (no decimal places).
   * This corresponds to controls where step=1 is specified.
   */
  step?: number;
}

/** @deprecated Use {@link FormatDisplayValueOptions} instead. */
export type DisplayFormatOptions = FormatDisplayValueOptions;

/** @deprecated Use {@link DisplayFormatSpec} instead. */
export type DisplayFormatRule = DisplayFormatSpec & {
  min: number;
  max: number;
  maxIntegerDigits: number;
  maxDecimalPlaces: number;
  scientific?: boolean;
};

/** @deprecated Use {@link FIXED_DISPLAY_FORMATS} instead. */
export const DEFAULT_DISPLAY_FORMAT_RULES: readonly DisplayFormatRule[] =
  FIXED_DISPLAY_FORMATS.map((spec) => ({
    ...spec,
    min: spec.minAbs,
    max: spec.maxAbs ?? Infinity,
    maxIntegerDigits: spec.integerDigits,
    maxDecimalPlaces: spec.fractionDigits,
    scientific: false,
  }));
