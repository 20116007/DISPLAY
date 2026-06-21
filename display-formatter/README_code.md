# @amot/display-formatter — Code Explanation

This document explains the **purpose**, **architecture**, and **implementation** of every file in the `@amot/display-formatter` package.

---

## 1. What this package does

This package converts a **numeric value** into a **display string** for the AMOT / AMOT-LITE UI.

It is used only at **specific display locations** (load value, test results, parameter readouts, format-settings preview, etc.) — not for every number in the application.

```
Machine data → stored as number (SI) → unit conversion (separate package) → formatDisplayValue() → UI string
```

| This package does | This package does NOT |
|-------------------|----------------------|
| Format numbers for display | Read machine data |
| Apply AMOT display rules | Convert units |
| Support `step=1` integer display | Validate input ranges |
| Support `fixedFraction` padding | Store data |

---

## 2. Display format rules (AMOT specification)

The formatter selects a format based on the **absolute value** `|x|`:

| Value range (\|x\|) | Pattern | Integer digits | Decimal digits | Notation |
|---------------------|---------|----------------|----------------|----------|
| `< 0.1` | `#.###E-##` | 1 | 3 (mantissa) | Scientific |
| `0.1 – 9.999999` | `#.######` | 1 | 6 | Fixed |
| `10 – 99.99999` | `##.#####` | 2 | 5 | Fixed |
| `100 – 999.9999` | `###.####` | 3 | 4 | Fixed |
| `1,000 – 9,999.999` | `####.###` | 4 | 3 | Fixed |
| `10,000 – 99,999.99` | `#####.##` | 5 | 2 | Fixed |
| `100,000 – 999,999.9` | `######.#` | 6 | 1 | Fixed |
| `≥ 1,000,000` | `#.###E+##` | 1 | 3 (mantissa) | Scientific |

**Notes:**
- `#` means optional digit — trailing zeros are removed by default.
- Scientific exponent is always 2 digits with sign: `E-03`, `E+06`.
- When a control specifies `step=1`, the value is shown as an integer regardless of magnitude.

---

## 3. Package structure

```
display-formatter/
├── src/
│   ├── index.ts              ← Public entry point (exports)
│   ├── types.ts              ← Type definitions and format rules data
│   ├── formatDisplayValue.ts ← Main formatting logic (ACTIVE)
│   └── DisplayFormatter.ts   ← Alternate implementation (NOT exported)
├── tests/
│   └── formatDisplayValue.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md                 ← Usage guide for developers
└── README_code.md            ← This file (code explanation)
```

**Active code path:** `index.ts` → `formatDisplayValue.ts` → `types.ts`

> `DisplayFormatter.ts` is an older alternate implementation with a rule-table approach. It is **not** exported from `index.ts` and is not used by the current tests. The active `DisplayFormatter` class lives inside `formatDisplayValue.ts`.

---

## 4. File-by-file explanation

### 4.1 `src/index.ts` — Public API entry point

This file re-exports everything the AMOT application can import:

```typescript
import {
  formatDisplayValue,
  DisplayFormatter,
  getDisplayFormatPattern,
  isScientificFormat,
} from '@amot/display-formatter';
```

| Export | Source | Purpose |
|--------|--------|---------|
| `formatDisplayValue` | `formatDisplayValue.ts` | Main function — format one number |
| `DisplayFormatter` | `formatDisplayValue.ts` | Class wrapper around the same logic |
| `getDisplayFormatPattern` | `formatDisplayValue.ts` | Returns pattern string for a value |
| `isScientificFormat` | `formatDisplayValue.ts` | Returns true if value uses scientific notation |
| `FIXED_DISPLAY_FORMATS` | `types.ts` | Array of fixed-decimal range rules |
| `FormatDisplayValueOptions` | `types.ts` | Options type (`step`, `fixedFraction`) |
| `SMALL_VALUE_SCIENTIFIC_FORMAT` | `types.ts` | Constant: `'#.###E-##'` |
| `LARGE_VALUE_SCIENTIFIC_FORMAT` | `types.ts` | Constant: `'#.###E+##'` |

Deprecated aliases (`DisplayFormatOptions`, `DisplayFormatRule`, `DEFAULT_DISPLAY_FORMAT_RULES`) are kept for backward compatibility.

---

### 4.2 `src/types.ts` — Data definitions

#### `DisplayFormatSpec`

Describes one fixed-decimal format range:

```typescript
interface DisplayFormatSpec {
  minAbs: number;        // Lower bound (inclusive), e.g. 0.1
  maxAbs: number | null; // Upper bound (exclusive), e.g. 10
  integerDigits: number; // Max digits before decimal point
  fractionDigits: number;// Max digits after decimal point
}
```

Example entry:

```typescript
{ minAbs: 10, maxAbs: 100, integerDigits: 2, fractionDigits: 5 }
// Covers 10 – 99.99999 → pattern "##.#####"
```

#### `FIXED_DISPLAY_FORMATS`

Array of 6 rules covering the fixed-decimal ranges from `0.1` to `1,000,000`. Scientific ranges (`< 0.1` and `≥ 1,000,000`) are handled separately in code, not in this array.

This array is designed so it can later be **loaded from an external JSON file** for user customization (as requested in the AMOT task specification).

#### `FormatDisplayValueOptions`

```typescript
interface FormatDisplayValueOptions {
  fixedFraction?: boolean; // Pad decimal places instead of trimming zeros
  step?: number;           // When 1, display as integer
}
```

| Option | Example input | Output | When to use |
|--------|---------------|--------|-------------|
| (default) | `12.3` | `"12.3"` | Normal display |
| `fixedFraction: true` | `12.3` | `"12.30000"` | Fixed-width display |
| `step: 1` | `42.789` | `"43"` | Controls with step=1 |

---

### 4.3 `src/formatDisplayValue.ts` — Core logic

This is the main implementation file.

#### Constants

```typescript
SMALL_VALUE_THRESHOLD = 0.1        // Below this → scientific E-
LARGE_VALUE_THRESHOLD = 1_000_000  // At or above → scientific E+
SCIENTIFIC_MANTISSA_FRACTION_DIGITS = 3  // Max mantissa decimals
SCIENTIFIC_EXPONENT_DIGITS = 2           // Exponent always 2 digits
```

#### `formatDisplayValue(value, options?)` — Main function

**Input:** `number | null | undefined`  
**Output:** formatted `string`

**Processing flow:**

```
value
  │
  ├─ null / undefined ──────────────────→ return ""
  │
  ├─ options.step === 1 ────────────────→ return rounded integer string
  │
  ├─ NaN ───────────────────────────────→ return "NaN"
  │
  ├─ Infinity / -Infinity ──────────────→ return "Infinity" / "-Infinity"
  │
  ├─ 0 or -0 ───────────────────────────→ return "0"
  │
  └─ normal number
       │
       ├─ |value| < 0.1 ───────────────→ formatScientific()
       ├─ |value| >= 1,000,000 ────────→ formatScientific()
       └─ otherwise ───────────────────→ formatFixed()
```

**Example walkthrough** — `formatDisplayValue(1234.56789)`:

1. Not null, not step=1, not NaN/Infinity, not zero
2. `|1234.56789|` is between 1,000 and 10,000
3. Rule: `integerDigits=4`, `fractionDigits=3`
4. Round to 3 decimals → `1234.568`
5. Trim trailing zeros → `"1234.568"`

#### `getDisplayFormatPattern(value)` — Pattern lookup

Returns the pattern string that would apply to a value, without formatting it.

```typescript
getDisplayFormatPattern(42)       // "##.#####"
getDisplayFormatPattern(0.05)     // "#.###E-##"
getDisplayFormatPattern(2000000)  // "#.###E+##"
getDisplayFormatPattern(0)        // "0"
```

Useful for debugging, UI hints, or the format-settings preview screen.

#### `isScientificFormat(value)` — Scientific check

Returns `true` when the value falls in a scientific-notation range (`|x| < 0.1` or `|x| ≥ 1,000,000`).

#### `DisplayFormatter` class

Thin wrapper that delegates to the same functions:

```typescript
const formatter = new DisplayFormatter();

formatter.format(123.456);              // same as formatDisplayValue(123.456)
formatter.getDisplayFormatPattern(42);  // same as getDisplayFormatPattern(42)
formatter.getRuleForValue(55);          // returns DisplayFormatSpec for range 10–100
formatter.isScientificFormat(0.01);     // true
```

`getRuleForValue()` only works for fixed-decimal ranges. It throws an error for scientific ranges.

---

#### Internal helper functions

##### `findFixedFormatSpec(abs)`

Searches `FIXED_DISPLAY_FORMATS` for the rule where:

```
abs >= entry.minAbs  AND  abs < entry.maxAbs
```

##### `buildFixedPattern(spec)`

Builds a pattern string from a spec:

```typescript
{ integerDigits: 2, fractionDigits: 5 } → "##.#####"
```

##### `formatFixed(abs, spec, options)`

Formats a value in a fixed-decimal range.

**Steps:**
1. Round to `spec.fractionDigits` decimal places
2. Split into integer and fraction parts using `splitNumber()`
3. If `fixedFraction: true` → pad fraction with zeros
4. Otherwise → trim trailing zeros from fraction
5. Return `"integer.fraction"` or just `"integer"` if no fraction

**Example:**

```
Input:  12.345678, spec = { integerDigits: 2, fractionDigits: 5 }
Round:  12.34568
Output: "12.34568"
```

##### `formatScientific(abs, mantissaFractionDigits, options)`

Formats a value in scientific notation (`#.###E±##`).

**Steps:**
1. Calculate exponent: `Math.floor(Math.log10(abs))`
2. Calculate mantissa: `abs / 10^exponent`
3. If rounding mantissa to 3 digits would give ≥ 10 (e.g. `0.0999999`), use up to 6 digits temporarily to preserve precision near range boundaries
4. Round mantissa
5. Build string: `{mantissa}E{sign}{exponent}` with 2-digit exponent

**Examples:**

```
0.00123   → exponent=-3, mantissa=1.23   → "1.23E-03"
0.05      → exponent=-2, mantissa=5     → "5E-02"
1234567   → exponent=6,  mantissa=1.235  → "1.235E+06"
0.0999999 → exponent=-2, mantissa=9.99999 → "9.99999E-02"
```

##### `splitNumber(value, fractionDigits)`

Splits a rounded number into `[integerPart, fractionPart]` strings using `toFixed()` to avoid floating-point display artifacts.

```typescript
splitNumber(12.3, 5)  → ["12", "30000"]
splitNumber(5, 3)     → ["5", "000"]
```

##### `roundToFractionDigits(value, fractionDigits)`

Standard rounding to N decimal places:

```typescript
roundToFractionDigits(1.23456, 3) → 1.235
roundToFractionDigits(42.7, 0)    → 43
```

##### `trimFraction(integerPart, fractionPart)`

Removes trailing zeros from the fraction and assembles the final string:

```typescript
trimFraction("12", "30000") → "12.3"
trimFraction("5", "000")    → "5"
```

##### `formatInteger(value)`

Used when `step: 1`:

```typescript
formatInteger(42.789) → "43"
formatInteger(-12.3)  → "-12"
```

---

## 5. How it works in the AMOT application

### Where to call the formatter

Only at **measurement / parameter display locations**:

```
✅ Load value display during test
✅ Test result values (max load, stress, etc.)
✅ Parameter readouts on TACT screen
✅ Format settings preview (設定 → フォーマット設定)
✅ Graph axis labels / tooltips for measurement data

❌ Page numbers, version strings, sample IDs
❌ Date/time strings, UI counters
❌ Internal calculations or database storage
```

### Integration example

```typescript
// In AMOT app — displayHelper.ts
import { convertFromSI } from '@amot/unit-conversion';
import { formatDisplayValue } from '@amot/display-formatter';

export function formatForDisplay(
  siValue: number,
  unitGroup: string,
  selectedUnit: string,
  options?: { step?: number; fixedFraction?: boolean },
): string {
  const converted = convertFromSI(siValue, unitGroup, selectedUnit);
  return formatDisplayValue(converted, options);
}
```

```typescript
// In a React / Electron UI component — LoadDisplay.tsx
function LoadDisplay({ loadSI }: { loadSI: number }) {
  const text = formatForDisplay(loadSI, 'force', settings.forceUnit);
  return <span>{text} {settings.forceUnit}</span>;
}
```

### Data flow diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌────────┐
│   Machine   │────→│  AMOT App    │────→│ Unit Conversion │────→│ Display Formatter│────→│   UI   │
│  (sensor)   │     │ (store in SI)│     │  (SI → kN, mm)  │     │ (number → string)│     │(label) │
└─────────────┘     └──────────────┘     └─────────────────┘     └──────────────────┘     └────────┘
                          ↑                                              ↑
                    NOT formatted here                            ONLY formatted here
                    (raw number stored)                          (at display locations)
```

---

## 6. Tests — `tests/formatDisplayValue.test.ts`

Tests are organized by category:

| Test group | What it verifies |
|------------|-----------------|
| `getDisplayFormatPattern` | Correct pattern string for each range |
| `isScientificFormat` | Scientific vs fixed detection |
| Edge cases | Zero, null, undefined, NaN, Infinity, negative values |
| Small values (`< 0.1`) | Scientific notation `E-` |
| Range boundaries | `0.1`, `10`, `100`, `1,000,000` transitions |
| Fixed decimal ranges | All 6 fixed ranges with rounding |
| Large values (`≥ 1M`) | Scientific notation `E+` |
| `step=1` option | Integer display |
| `fixedFraction` option | Zero-padding |
| `FIXED_DISPLAY_FORMATS` | Rule table completeness |

Run tests:

```bash
npm test
```

---

## 7. Build and publish

```bash
npm install     # Install dependencies
npm test        # Run all tests
npm run build   # Compile TypeScript → dist/
```

Build output:

```
dist/
├── index.js          # Compiled JavaScript
├── index.d.ts        # TypeScript type declarations
├── formatDisplayValue.js
├── formatDisplayValue.d.ts
├── types.js
└── types.d.ts
```

The AMOT Electron app imports from `@amot/display-formatter`, which resolves to `dist/index.js`.

---

## 8. Quick reference — Public API

### `formatDisplayValue(value, options?)`

```typescript
formatDisplayValue(1234.567);                    // "1234.567"
formatDisplayValue(0.00123);                     // "1.23E-03"
formatDisplayValue(1_234_567);                   // "1.235E+06"
formatDisplayValue(42.789, { step: 1 });         // "43"
formatDisplayValue(12.3, { fixedFraction: true }); // "12.30000"
formatDisplayValue(null);                         // ""
```

### `getDisplayFormatPattern(value)`

```typescript
getDisplayFormatPattern(500);  // "###.####"
getDisplayFormatPattern(0.05); // "#.###E-##"
```

### `isScientificFormat(value)`

```typescript
isScientificFormat(0.01);       // true
isScientificFormat(12.34);      // false
```

### `DisplayFormatter` class

```typescript
const f = new DisplayFormatter();
f.format(99.99999);           // "99.99999"
f.getRuleForValue(55);        // { minAbs: 10, maxAbs: 100, ... }
f.getDisplayFormatPattern(42); // "##.#####"
```

---

## 9. Design decisions

| Decision | Reason |
|----------|--------|
| Separate package from unit conversion | Independent responsibility; can be used/tested alone |
| Rules in `types.ts` as data | Future: export to JSON for user customization |
| `formatDisplayValue()` as main API | Simplest usage for UI components |
| `DisplayFormatter` class also provided | For apps that need multiple formatter instances or custom rules |
| Trailing zeros trimmed by default | Matches `#` optional-digit semantics in AMOT spec |
| `step: 1` bypasses all format rules | Per spec: "unless otherwise specified (e.g., step=1)" |
| Null/undefined → empty string | Safe for UI binding when data is not yet loaded |
| SI values never passed here directly | Unit conversion must happen first in the host app |

---

## 10. Future extensions (planned)

As described in the AMOT task specification:

1. **External rule file** — Load `FIXED_DISPLAY_FORMATS` from a user-editable JSON file
2. **Custom formatter instances** — `new DisplayFormatter(customRules)` for per-parameter overrides
3. **Integration helper in AMOT app** — Thin wrapper combining unit conversion + formatting

These are not implemented inside this package yet; the current structure supports them.
