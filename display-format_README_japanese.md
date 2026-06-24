# display-format — 仕様書

数値を UI 向けの表示文字列にフォーマットする TypeScript ライブラリです。**画面用の表示文字列（`display`）** と **計算に安全な数値（`value`）** の両方を返します。Electron、React、Node.js アプリケーションで `unit-convert` と併用するために設計されています。

---

## 目次

1. [概要](#概要)
2. [プロジェクト構成](#プロジェクト構成)
3. [戻り値の設計](#戻り値の設計)
4. [フォーマットルール](#フォーマットルール)
5. [科学表記の形式](#科学表記の形式)
6. [公開 API リファレンス](#公開-api-リファレンス)
7. [ビルド手順](#ビルド手順)
8. [Electron アプリへの導入](#electron-アプリへの導入)
9. [使用例](#使用例)
10. [出力リファレンス表](#出力リファレンス表)
11. [エッジケース](#エッジケース)
12. [unit-convert との統合](#unit-convert-との統合)

---

## 概要

| 項目 | 値 |
|---|---|
| パッケージ名 | `display-format` |
| バージョン | `1.0.0` |
| モジュール形式 | CommonJS |
| エントリーポイント | `dist/index.js` |
| 型定義 | `dist/index.d.ts` |

**目的:** 生の `number` 値を以下に変換します:
- `display` — UI に表示するフォーマット済み文字列
- `value` — 以降の計算に使用する安全な数値（ルールに応じて丸め/切り捨てされる場合あり）

**公開関数:** `displayFormat(value, options?)` のみ。

---

## プロジェクト構成

```
display-format/
├── package.json              # パッケージメタデータとビルドスクリプト
├── tsconfig.json             # TypeScript コンパイラ設定
├── test-run.ts               # 手動テストスクリプト（開発者向け）
├── src/
│   ├── index.ts              # 公開 API のエクスポート
│   ├── types.ts              # DisplayFormatOptions と DisplayFormatResult
│   ├── displayFormat.ts      # メインフォーマット関数
│   ├── rules.ts              # 値の大きさに基づくルール選択
│   └── scientific.ts           # 科学表記文字列フォーマッター
└── dist/                     # コンパイル出力（`npm run build` で生成）
    ├── index.js
    ├── index.d.ts
    ├── displayFormat.js
    ├── rules.js
    ├── scientific.js
    └── types.js
```

### 各ファイルの役割

| ファイル | 役割 |
|---|---|
| `src/index.ts` | `displayFormat`、`DisplayFormatOptions`、`DisplayFormatResult` をエクスポート。 |
| `src/types.ts` | オプションと結果のインターフェースを定義。 |
| `src/displayFormat.ts` | メインエントリ: null/無効値の処理、`step` オーバーライド、ルール分岐、`{ value, display }` の構築。 |
| `src/rules.ts` | `getFormatRule(value)` — 絶対値に基づき `fixed`、`integer`、`scientific` を選択。 |
| `src/scientific.ts` | `formatScientific(value, decimals)` — `X.XXXE±XX` 形式の表示文字列を生成。 |
| `test-run.ts` | サンプル出力を表示。ビルド後に `node test-run.ts` で実行。 |

---

## 戻り値の設計

単純な文字列フォーマッターとは異なり、`displayFormat` は 2 つのフィールドを持つオブジェクトを返します:

```typescript
interface DisplayFormatResult {
  value: number;    // 計算に安全な数値
  display: string;  // UI 表示用の文字列
}
```

| フィールド | 用途 |
|---|---|
| `display` | 入力欄やラベルに表示する文字列（例: `"56.00000"`、`"1.000E-05"`）。 |
| `value` | アプリが保持または次の計算に渡す数値。表示精度に合わせて丸め/切り捨てされる場合があります。 |

### ルールタイプ別の動作

| ルール | `display` | `value` |
|---|---|---|
| `fixed` | `value.toFixed(decimals)` | 元の入力数値（変更なし） |
| `integer` | `Math.round(value)` の文字列 | 丸めた整数 |
| `scientific` | 科学表記文字列 | 切り捨てた仮数部 × 10^指数（文字列からの逆パースではなく数値計算） |
| `step: 1` | 丸め整数の文字列 | 丸めた整数 |
| `null` / `undefined` / `NaN` / `Infinity` | `""` | `0` |

---

## フォーマットルール

`getFormatRule(value)` は**絶対値**を使用してルールを選択します:

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
  ├─ null / undefined  → { value: 0, display: "" }
  ├─ NaN / ±Infinity   → { value: 0, display: "" }
  ├─ options.step === 1  → { value: round(value), display: "..." }
  │
  └─ getFormatRule(value)
       ├─ "fixed"       → { value: 元の値, display: toFixed(decimals) }
       ├─ "integer"     → { value: round(value), display: "..." }
       └─ "scientific"  → { value: 切り捨て数値, display: formatScientific(...) }
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

| 入力 | `display` | `value` |
|---|---|---|
| `0.00001` | `1.000E-05` | `0.00001`（仮数部 3 桁に切り捨て） |
| `999999999` | `9.999E+08` | `999900000` |
| `0` | `0.000E+00` | [エッジケース](#エッジケース)を参照 |

**切り捨て:** 仮数部は `Math.floor`（ゼロ方向への切り捨て）を使用します。切り捨てにより仮数部が `≥ 10` になった場合、指数を 1 増やし仮数部を 10 で割ります。

科学表記の場合、`value` は切り捨てた仮数部と指数から数値計算で求めます。**表示文字列をパースして数値に戻すことはしません。**

---

## 公開 API リファレンス

### インポート

```typescript
// CommonJS
const { displayFormat } = require("display-format");

// TypeScript
import { displayFormat } from "display-format";
import type { DisplayFormatOptions, DisplayFormatResult } from "display-format";
```

### `displayFormat(value, options?): DisplayFormatResult`

```typescript
function displayFormat(
  value: number | null | undefined,
  options?: DisplayFormatOptions
): DisplayFormatResult;
```

### `DisplayFormatOptions`

```typescript
interface DisplayFormatOptions {
  step?: number;  // step === 1 の場合、最も近い整数に丸める
}
```

### `DisplayFormatResult`

```typescript
interface DisplayFormatResult {
  value: number;    // 計算に安全な値
  display: string;  // UI 表示用の文字列
}
```

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

function ValueDisplay({ raw }: { raw: number }) {
  const { value, display } = displayFormat(raw);

  return (
    <span title={`保持値: ${value}`}>
      {display}
    </span>
  );
}
```

### 単位変換後の使用

```typescript
import { convert } from "unit-convert";
import { displayFormat } from "display-format";

const converted = convert("Elong", "m", "mm", 1.23456789);
const { value, display } = displayFormat(converted);

// display を UI に表示、value を次の計算に使用
console.log(display); // "1234.568"
console.log(value);   // 1.23456789（fixed ルールは元の値を保持）
```

---

## 使用例

### 基本的なフォーマット

```typescript
import { displayFormat } from "display-format";

displayFormat(56);
// { value: 56, display: "56.00000" }

displayFormat(345.67);
// { value: 345.67, display: "345.6700" }

displayFormat(0.00001);
// { value: 0.00001, display: "1.000E-05" }

displayFormat(999999999);
// { value: 999900000, display: "9.999E+08" }
```

### UI には `display`、状態には `value` を使用

```typescript
function handleBlur(rawInput: string) {
  const num = Number(rawInput);
  const { value, display } = displayFormat(num);

  setDisplayText(display);   // ユーザーが見る値
  setStoredValue(value);     // アプリが計算に使う値
}
```

### 整数ステップモード（`step = 1`）

`step={1}` の入力フィールド向け:

```typescript
displayFormat(56.7, { step: 1 });
// { value: 57, display: "57" }

displayFormat(56.4, { step: 1 });
// { value: 56, display: "56" }
```

### 空入力の安全な処理

```typescript
const userInput: number | null = getInput();
const { value, display } = displayFormat(userInput);

// display === ""  → 空欄を表示
// value === 0     → 計算用の安全なデフォルト値
```

---

## 出力リファレンス表

| 入力 | `display` | `value` | ルール |
|---|---|---|---|
| `56` | `56.00000` | `56` | fixed, 6 桁 |
| `345.67` | `345.6700` | `345.67` | fixed, 4 桁 |
| `5600` | `5600.000` | `5600` | fixed, 3 桁 |
| `34897654` | `34897654` | `34897654` | integer |
| `0.00001` | `1.000E-05` | `~0.00001` | scientific |
| `0` | `0.000E+00` | エッジケース参照 | scientific |
| `0.1` | `0.100000` | `0.1` | fixed, 6 桁 |
| `10` | `10.00000` | `10` | fixed, 6 桁 |
| `11` | `11.00000` | `11` | fixed, 5 桁 |
| `999999999` | `9.999E+08` | `999900000` | scientific |
| `0.099999999` | `9.999E-02` | `~0.09999` | scientific |
| `1000000.1` | `1000000` | `1000000` | integer |
| `1000000.523456789` | `1000001` | `1000001` | integer |
| `null` | `""` | `0` | 無効入力 |
| `NaN` | `""` | `0` | 無効入力 |

---

## エッジケース

| シナリオ | 動作 |
|---|---|
| 負の値 | ルール選択に絶対値を使用。符号は出力に保持 |
| ちょうど `0.1` | 科学表記ではなく fixed 形式（`0.100000`） |
| `0.1` 未満の値（例: `0.099999999`） | 科学表記 |
| `null` / `undefined` / `NaN` / `Infinity` | `{ value: 0, display: "" }` |
| 入力 `0` | `display` は `0.000E+00`。科学表記パスで `log10(0)` により `value` が `NaN` になる場合あり — UI では `0` を明示的に処理することを推奨 |
| 科学表記の `value` と `display` | `value` は表示精度に合わせて切り捨て。生の入力とわずかに異なる場合あり |

---

## unit-convert との統合

Electron 単位変換 UI の推奨パイプライン:

```typescript
import { convert, validate } from "unit-convert";
import { displayFormat } from "display-format";

function formatConvertedValue(
  group: string,
  fromUnit: string,
  toUnit: string,
  inputValue: number
): DisplayFormatResult | null {
  const validation = validate(group, fromUnit, inputValue);
  if (!validation.valid) return null;

  const converted = convert(group, fromUnit, toUnit, inputValue);
  return displayFormat(converted);
}

// React コンポーネント内:
const result = formatConvertedValue(group, unit, newUnit, Number(value));
if (result) {
  setDisplayValue(result.display);  // 入力欄に表示
  setStoredValue(result.value);     // 次の変換に使用
}
```

| ステップ | パッケージ | 関数 | 用途 |
|---|---|---|---|
| 1. バリデーション | `unit-convert` | `validate()` | 入力範囲チェック |
| 2. 単位変換 | `unit-convert` | `convert()` | 単位変換 |
| 3. フォーマット | `display-format` | `displayFormat()` | `display` → UI、`value` → 状態 |

---

## クイックリファレンス

```
displayFormat(value)                  → { value, display }
displayFormat(value, { step: 1 })     → 整数丸め結果
displayFormat(null)                   → { value: 0, display: "" }
displayFormat(NaN)                    → { value: 0, display: "" }

// 典型的な UI パターン:
const { value, display } = displayFormat(num);
setInputDisplay(display);
setCalculationValue(value);
```
