# display-format — 仕様書

数値を人間が読みやすい表示文字列にフォーマットする TypeScript ライブラリです。値の大きさに応じて小数精度または科学表記を自動選択します。Electron、React、Node.js アプリケーションで `unit-convert` と併用するために設計されています。

---

## 目次

1. [概要](#概要)
2. [プロジェクト構成](#プロジェクト構成)
3. [フォーマットルール](#フォーマットルール)
4. [科学表記の形式](#科学表記の形式)
5. [公開 API リファレンス](#公開-api-リファレンス)
6. [ビルド手順](#ビルド手順)
7. [Electron アプリへの導入](#electron-アプリへの導入)
8. [使用例](#使用例)
9. [出力リファレンス表](#出力リファレンス表)
10. [エッジケース](#エッジケース)
11. [unit-convert との統合](#unit-convert-との統合)

---

## 概要

| 項目 | 値 |
|---|---|
| パッケージ名 | `display-format` |
| バージョン | `1.0.0` |
| モジュール形式 | CommonJS |
| エントリーポイント | `dist/index.js` |
| 型定義 | `dist/index.d.ts` |

**目的:** 生の `number` 値を適切な精度の表示文字列に変換。非常に小さい数、非常に大きい数、整数丸めを設定可能なルールに基づいて処理。

**公開関数:** `displayFormat(value, options?)` のみ。

---

## プロジェクト構成

```
display-format/
├── package.json           # パッケージメタデータとビルドスクリプト
├── tsconfig.json          # TypeScript コンパイラ設定
├── test-run.ts            # 手動テストスクリプト（パッケージ API の一部ではない）
├── src/
│   ├── index.ts           # 公開 API のエクスポート
│   ├── displayFormat.ts   # メインフォーマット関数とオプション型
│   ├── rules.ts           # 値の大きさに基づくフォーマットルール選択
│   └── scientific.ts      # 科学表記フォーマッター
└── dist/                  # コンパイル出力（`npm run build` で生成）
    ├── index.js
    ├── index.d.ts
    ├── displayFormat.js
    ├── rules.js
    └── scientific.js
```

### 各ファイルの役割

| ファイル | 役割 |
|---|---|
| `src/index.ts` | `displayFormat` と `DisplayFormatOptions` をエクスポート。 |
| `src/displayFormat.ts` | エントリ関数: null/NaN/Infinity の処理、step オーバーライド、ルールへの委譲。 |
| `src/rules.ts` | `getFormatRule(value)` — 絶対値に基づき `fixed`、`integer`、`scientific` を選択。 |
| `src/scientific.ts` | `formatScientific(value, decimals)` — `X.XXXE±XX` 形式の文字列を生成。 |
| `test-run.ts` | サンプル出力を表示する開発者向けユーティリティ。ビルド後に `npx ts-node test-run.ts` で実行。 |

---

## フォーマットルール

`getFormatRule(value)` は入力の**絶対値**を使用してルールを選択します:

| 絶対値の範囲 | ルールタイプ | 小数桁数 |
|---|---|---|
| `< 0.1` | scientific | 3 |
| `< 10` | fixed | 6 |
| `< 100` | fixed | 5 |
| `< 1,000` | fixed | 4 |
| `< 10,000` | fixed | 3 |
| `< 100,000` | fixed | 2 |
| `< 1,000,000` | fixed | 1 |
| `< 100,000,000` | integer | —（丸め） |
| `≥ 100,000,000` | scientific | 3 |

### 処理フロー

```
displayFormat(value, options)
  │
  ├─ null / undefined  → ""
  ├─ NaN / ±Infinity   → ""
  ├─ options.step === 1  → Math.round(value).toString()
  │
  └─ getFormatRule(value)
       ├─ "fixed"       → value.toFixed(decimals)
       ├─ "integer"      → Math.round(value).toString()
       └─ "scientific"  → formatScientific(value, decimals)
```

---

## 科学表記の形式

出力パターン: `{符号}{仮数部}E{指数符号}{指数}`

| 要素 | 形式 | 例 |
|---|---|---|
| 符号 | `-` または空 | `-` |
| 仮数部 | 固定小数、切り捨て（丸めではない） | `1.000` |
| 指数符号 | `+` または `-` | `+` |
| 指数 | 2 桁ゼロパディング | `05` |

**例:**

| 入力 | 出力 |
|---|---|
| `0` | `0.000E+00` |
| `0.00001` | `1.000E-05` |
| `999999999` | `9.999E+08` |

**切り捨て動作:** 仮数部は `Math.floor`（ゼロ方向への切り捨て）を使用し、通常の四捨五入は行いません。切り捨てにより仮数部が `≥ 10` になった場合、指数を 1 増やし仮数部を 10 で割ります。

---

## 公開 API リファレンス

### インポート

```typescript
// CommonJS
const { displayFormat } = require("display-format");

// TypeScript / ES Module（対応バンドラー使用時）
import { displayFormat } from "display-format";
import type { DisplayFormatOptions } from "display-format";
```

### `displayFormat(value, options?): string`

```typescript
function displayFormat(
  value: number | null | undefined,
  options?: DisplayFormatOptions
): string;
```

### `DisplayFormatOptions`

```typescript
interface DisplayFormatOptions {
  step?: number;  // step === 1 の場合、最も近い整数に丸める
}
```

### 戻り値

| 入力 | 戻り値 |
|---|---|
| `null` | `""` |
| `undefined` | `""` |
| `NaN` | `""` |
| `Infinity` / `-Infinity` | `""` |
| 有効な数値 | 上記ルールに従ったフォーマット文字列 |

---

## ビルド手順

```bash
cd display-format
npm install
npm run build
```

`tsc` を実行し、コンパイル済み JavaScript と `.d.ts` ファイルを `dist/` に出力します。

### 手動テスト

```bash
npm run build
node test-run.ts
```

---

## Electron アプリへの導入

### ローカルファイル依存

```json
{
  "dependencies": {
    "display-format": "file:../display-format"
  }
}
```

```bash
cd display-format && npm run build
cd ../your-electron-app && npm install
```

### React レンダラーでの使用

```tsx
import { displayFormat } from "display-format";

function ValueDisplay({ value }: { value: number }) {
  return <span>{displayFormat(value)}</span>;
}
```

### 単位変換後の使用

```typescript
import { convert } from "unit-convert";
import { displayFormat } from "display-format";

const converted = convert("Elong", "m", "mm", 1.23456789);
const label = `${displayFormat(converted)} mm`;
```

---

## 使用例

### 基本的なフォーマット

```typescript
import { displayFormat } from "display-format";

displayFormat(56);           // "56.00000"
displayFormat(345.67);       // "345.6700"
displayFormat(5600);         // "5600.000"
displayFormat(34897654);     // "34897654"
displayFormat(0.00001);      // "1.000E-05"
```

### 整数ステップモード（step=1 入力用）

入力フィールドが `step={1}` の場合、`{ step: 1 }` を渡して整数に丸めます:

```typescript
displayFormat(56.7, { step: 1 });  // "57"
displayFormat(56.4, { step: 1 });  // "56"
```

### 空入力の安全な処理

```typescript
const userInput: number | null = getInput();
const text = displayFormat(userInput);  // null の場合は ""
```

### フォームフィールドの blur 時

```typescript
function handleBlur(rawValue: string) {
  const num = Number(rawValue);
  const formatted = displayFormat(num);
  setDisplayValue(formatted);
}
```

---

## 出力リファレンス表

| 入力値 | 出力文字列 | 適用ルール |
|---|---|---|
| `56` | `56.00000` | fixed, 6 桁 |
| `345.67` | `345.6700` | fixed, 4 桁 |
| `5600` | `5600.000` | fixed, 3 桁 |
| `34897654` | `34897654` | integer |
| `0.00001` | `1.000E-05` | scientific |
| `0` | `0.000E+00` | scientific |
| `0.1` | `0.100000` | fixed, 6 桁 |
| `10` | `10.00000` | fixed, 6 桁 |
| `11` | `11.00000` | fixed, 5 桁 |
| `999999999` | `9.999E+08` | scientific |
| `0.099999999` | `9.999E-02` | scientific |
| `1000000.1` | `1000000` | integer |
| `1000000.523456789` | `1000000` | integer |

---

## エッジケース

| シナリオ | 動作 |
|---|---|
| 負の値 | ルール選択に絶対値を使用。符号は出力に保持 |
| ちょうど `0.1` | 科学表記ではなく fixed 形式（`0.100000`） |
| `0.1` 未満の値（例: `0.099999999`） | 科学表記 |
| `1000000.1` | integer ルール適用（abs < 100,000,000）→ `1000000` に丸め |
| 空入力フィールドからの null | `""` を返す — 例外はスローしない |

---

## unit-convert との統合

Electron 単位変換 UI の推奨表示パイプライン:

```typescript
import { convert, validate } from "unit-convert";
import { displayFormat } from "display-format";

function formatConvertedValue(
  group: string,
  fromUnit: string,
  toUnit: string,
  value: number
): string {
  const validation = validate(group, fromUnit, value);
  if (!validation.valid) return "";

  const converted = convert(group, fromUnit, toUnit, value);
  return displayFormat(converted);
}
```

| ステップ | パッケージ | 関数 |
|---|---|---|
| 1. 入力バリデーション | `unit-convert` | `validate()` |
| 2. 単位変換 | `unit-convert` | `convert()` |
| 3. 表示フォーマット | `display-format` | `displayFormat()` |

---

## クイックリファレンス

```
displayFormat(value)                  → string
displayFormat(value, { step: 1 })     → 整数丸め文字列
displayFormat(null)                   → ""
displayFormat(NaN)                    → ""
```
