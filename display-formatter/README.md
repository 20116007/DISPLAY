# @amot/display-formatter

Numerical display formatter for **AMOT** and **AMOT-LITE** Electron applications.

Internal data is stored in SI units; this package formats converted values for UI display according to the AMOT numerical display specification. It is a **standalone package**, separate from `@amot/unit-conversion`.

## Display Rules

| Value Range | Display Format |
|-------------|----------------|
| < 0.1 | `#.###E-##` |
| 0.1 – 9.999999 | `#.######` |
| 10 – 99.99999 | `##.#####` |
| 100 – 999.9999 | `###.####` |
| 1,000 – 9,999.999 | `####.###` |
| 10,000 – 99,999.99 | `#####.##` |
| 100,000 – 999,999.9 | `######.#` |
| 1,000,000 and above | `#.###E+##` |

When a control specifies `step=1`, values are displayed as integers regardless of magnitude.

## Installation

```bash
npm install @amot/display-formatter
```

Local development:

```bash
cd display-formatter
npm install
npm run build
npm test
```

Link into the Electron app:

```bash
npm link
# In the AMOT project:
npm link @amot/display-formatter
```

## Usage

```typescript
import {
  formatDisplayValue,
  getDisplayFormatPattern,
  isScientificFormat,
  DisplayFormatter,
} from '@amot/display-formatter';

// Basic formatting
formatDisplayValue(1234.567);        // "1234.567"
formatDisplayValue(0.00123);         // "1.23E-03"
formatDisplayValue(1_234_567);       // "1.235E+06"

// step=1 → integer display
formatDisplayValue(42.789, { step: 1 }); // "43"

// fixedFraction → pad decimal places
formatDisplayValue(12.3, { fixedFraction: true }); // "12.30000"

// Inspect which format pattern applies
getDisplayFormatPattern(42);         // "##.#####"
isScientificFormat(0.01);            // true

// Class-based usage
const formatter = new DisplayFormatter();
formatter.format(99999.99);          // "99999.99"
```

## Integration with Unit Conversion

Use this package **after** unit conversion:

```typescript
import { formatDisplayValue } from '@amot/display-formatter';
// import { convertFromSI } from '@amot/unit-conversion';

const siValue = 1234.567;
// const displayValue = convertFromSI(siValue, unitGroup, selectedUnit);
const displayText = formatDisplayValue(siValue);
```

## API

| Export | Description |
|--------|-------------|
| `formatDisplayValue(value, options?)` | Format a number for display |
| `getDisplayFormatPattern(value)` | Return the pattern string (e.g. `##.#####`) |
| `isScientificFormat(value)` | Whether scientific notation is used |
| `DisplayFormatter` | Class wrapper with the same methods |
| `FIXED_DISPLAY_FORMATS` | Fixed-decimal range definitions |

### `FormatDisplayValueOptions`

| Property | Type | Description |
|----------|------|-------------|
| `step` | `number` | When `1`, display as integer |
| `fixedFraction` | `boolean` | Pad fractional digits to maximum width |

## Development

```bash
npm install
npm test
npm run build
```

## License

UNLICENSED — internal A&D project use.
