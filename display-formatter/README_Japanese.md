# @amot/display-formatter

**AMOT** および **AMOT-LITE** の Electron アプリケーション向け数値表示フォーマッター。

アプリ内部ではデータを SI 単位で保持しますが、UI 表示時には本パッケージを使用して AMOT 数値表示仕様に従った文字列に変換します。本パッケージは `@amot/unit-conversion`（単位変換）とは **独立したスタンドアロンパッケージ** です。

## 表示フォーマット規則

| 値の範囲 | 表示フォーマット |
|----------|------------------|
| < 0.1 | `#.###E-##` |
| 0.1 – 9.999999 | `#.######` |
| 10 – 99.99999 | `##.#####` |
| 100 – 999.9999 | `###.####` |
| 1,000 – 9,999.999 | `####.###` |
| 10,000 – 99,999.99 | `#####.##` |
| 100,000 – 999,999.9 | `######.#` |
| 1,000,000 以上 | `#.###E+##` |

コントロールで `step=1` が指定されている場合、値の大きさに関わらず整数として表示します。

## インストール

```bash
npm install @amot/display-formatter
```

ローカル開発時:

```bash
cd display-formatter
npm install
npm run build
npm test
```

Electron アプリへのリンク:

```bash
npm link
# AMOT プロジェクト側:
npm link @amot/display-formatter
```

## 使用方法

```typescript
import {
  formatDisplayValue,
  getDisplayFormatPattern,
  isScientificFormat,
  DisplayFormatter,
} from '@amot/display-formatter';

// 基本的なフォーマット
formatDisplayValue(1234.567);        // "1234.567"
formatDisplayValue(0.00123);         // "1.23E-03"
formatDisplayValue(1_234_567);       // "1.235E+06"

// step=1 → 整数表示
formatDisplayValue(42.789, { step: 1 }); // "43"

// fixedFraction → 小数桁をパディング
formatDisplayValue(12.3, { fixedFraction: true }); // "12.30000"

// 適用されるフォーマットパターンの確認
getDisplayFormatPattern(42);         // "##.#####"
isScientificFormat(0.01);            // true

// クラスベースの使用
const formatter = new DisplayFormatter();
formatter.format(99999.99);          // "99999.99"
```

## 単位変換との連携

本パッケージは **単位変換の後** に使用してください:

```typescript
import { formatDisplayValue } from '@amot/display-formatter';
// import { convertFromSI } from '@amot/unit-conversion';

const siValue = 1234.567;
// const displayValue = convertFromSI(siValue, unitGroup, selectedUnit);
const displayText = formatDisplayValue(siValue);
```

## API

| エクスポート | 説明 |
|-------------|------|
| `formatDisplayValue(value, options?)` | 数値を表示用にフォーマット |
| `getDisplayFormatPattern(value)` | パターン文字列を返す（例: `##.#####`） |
| `isScientificFormat(value)` | 指数表示かどうかを返す |
| `DisplayFormatter` | 同等機能を持つクラスラッパー |
| `FIXED_DISPLAY_FORMATS` | 固定小数点形式の範囲定義 |

### `FormatDisplayValueOptions`

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `step` | `number` | `1` の場合、整数として表示 |
| `fixedFraction` | `boolean` | 小数桁を最大桁数までパディング |

## 開発

```bash
npm install
npm test
npm run build
```

## ライセンス

UNLICENSED — A&D 社内プロジェクト用。
