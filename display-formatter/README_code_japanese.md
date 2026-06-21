# @amot/display-formatter — コード解説

本ドキュメントでは、`@amot/display-formatter` パッケージの **目的**、**アーキテクチャ**、および **各ファイルの実装内容** について説明します。

---

## 1. 本パッケージの役割

本パッケージは、**数値（number）** を AMOT / AMOT-LITE の UI 表示用 **文字列（string）** に変換します。

アプリ内の **すべての数値** に使用するわけではありません。**特定の表示箇所**（荷重値、試験結果、パラメータ表示、フォーマット設定プレビューなど）でのみ使用します。

```
機械データ → 数値として保持（SI） → 単位変換（別パッケージ） → formatDisplayValue() → UI 文字列
```

| 本パッケージが行うこと | 本パッケージが行わないこと |
|------------------------|---------------------------|
| 表示用数値フォーマット | 機械データの読み取り |
| AMOT 表示規則の適用 | 単位変換 |
| `step=1` による整数表示 | 入力範囲チェック |
| `fixedFraction` による桁パディング | データの保存 |

---

## 2. 表示フォーマット規則（AMOT 仕様）

フォーマッターは **絶対値** `|x|` に基づいてフォーマットを選択します。

| 値の範囲（\|x\|） | パターン | 整数桁 | 小数桁 | 表記法 |
|-------------------|----------|--------|--------|--------|
| `< 0.1` | `#.###E-##` | 1 | 3（仮数部） | 指数 |
| `0.1 – 9.999999` | `#.######` | 1 | 6 | 固定 |
| `10 – 99.99999` | `##.#####` | 2 | 5 | 固定 |
| `100 – 999.9999` | `###.####` | 3 | 4 | 固定 |
| `1,000 – 9,999.999` | `####.###` | 4 | 3 | 固定 |
| `10,000 – 99,999.99` | `#####.##` | 5 | 2 | 固定 |
| `100,000 – 999,999.9` | `######.#` | 6 | 1 | 固定 |
| `≥ 1,000,000` | `#.###E+##` | 1 | 3（仮数部） | 指数 |

**補足:**
- `#` は任意桁を意味します — デフォルトでは末尾のゼロは削除されます。
- 指数部は常に符号付き 2 桁です: `E-03`、`E+06`。
- コントロールで `step=1` が指定されている場合、値の大きさに関わらず整数として表示します。

---

## 3. パッケージ構成

```
display-formatter/
├── src/
│   ├── index.ts              ← 公開エントリポイント（エクスポート）
│   ├── types.ts              ← 型定義およびフォーマット規則データ
│   ├── formatDisplayValue.ts ← メインフォーマットロジック（有効）
│   └── DisplayFormatter.ts   ← 代替実装（エクスポートされていない）
├── tests/
│   └── formatDisplayValue.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md                 ← 開発者向け使用ガイド（英語）
├── README_Japanese.md        ← 開発者向け使用ガイド（日本語）
├── README_code.md            ← コード解説（英語）
└── README_code_japanese.md   ← 本ドキュメント（日本語）
```

**有効なコードパス:** `index.ts` → `formatDisplayValue.ts` → `types.ts`

> `DisplayFormatter.ts` はルールテーブル方式の旧来の代替実装です。`index.ts` からは **エクスポートされておらず**、現在のテストでも使用されていません。有効な `DisplayFormatter` クラスは `formatDisplayValue.ts` 内に定義されています。

---

## 4. ファイル別解説

### 4.1 `src/index.ts` — 公開 API エントリポイント

AMOT アプリケーションが import できるすべての機能を再エクスポートします。

```typescript
import {
  formatDisplayValue,
  DisplayFormatter,
  getDisplayFormatPattern,
  isScientificFormat,
} from '@amot/display-formatter';
```

| エクスポート | ソース | 目的 |
|-------------|--------|------|
| `formatDisplayValue` | `formatDisplayValue.ts` | メイン関数 — 1 つの数値をフォーマット |
| `DisplayFormatter` | `formatDisplayValue.ts` | 同等ロジックのクラスラッパー |
| `getDisplayFormatPattern` | `formatDisplayValue.ts` | 値に適用されるパターン文字列を返す |
| `isScientificFormat` | `formatDisplayValue.ts` | 指数表示かどうかを返す |
| `FIXED_DISPLAY_FORMATS` | `types.ts` | 固定小数点形式の範囲ルール配列 |
| `FormatDisplayValueOptions` | `types.ts` | オプション型（`step`、`fixedFraction`） |
| `SMALL_VALUE_SCIENTIFIC_FORMAT` | `types.ts` | 定数: `'#.###E-##'` |
| `LARGE_VALUE_SCIENTIFIC_FORMAT` | `types.ts` | 定数: `'#.###E+##'` |

後方互換のため、非推奨エイリアス（`DisplayFormatOptions`、`DisplayFormatRule`、`DEFAULT_DISPLAY_FORMAT_RULES`）も提供しています。

---

### 4.2 `src/types.ts` — データ定義

#### `DisplayFormatSpec`

固定小数点形式の 1 つの範囲を表します。

```typescript
interface DisplayFormatSpec {
  minAbs: number;        // 下限（以上）、例: 0.1
  maxAbs: number | null; // 上限（未満）、例: 10
  integerDigits: number; // 小数点より前の最大桁数
  fractionDigits: number;// 小数点より後の最大桁数
}
```

定義例:

```typescript
{ minAbs: 10, maxAbs: 100, integerDigits: 2, fractionDigits: 5 }
// 10 – 99.99999 をカバー → パターン "##.#####"
```

#### `FIXED_DISPLAY_FORMATS`

`0.1` から `1,000,000` までの固定小数点形式 6 範囲を定義する配列です。指数表示の範囲（`< 0.1` および `≥ 1,000,000`）はコード内で別途処理され、この配列には含まれません。

この配列は、AMOT タスク仕様で要求されている **外部 JSON ファイルからの読み込み**（ユーザーによるカスタマイズ）に対応できるよう設計されています。

#### `FormatDisplayValueOptions`

```typescript
interface FormatDisplayValueOptions {
  fixedFraction?: boolean; // 末尾ゼロを削除せず、小数桁をパディング
  step?: number;           // 1 の場合、整数として表示
}
```

| オプション | 入力例 | 出力 | 使用場面 |
|-----------|--------|------|----------|
| （デフォルト） | `12.3` | `"12.3"` | 通常表示 |
| `fixedFraction: true` | `12.3` | `"12.30000"` | 固定幅表示 |
| `step: 1` | `42.789` | `"43"` | step=1 のコントロール |

---

### 4.3 `src/formatDisplayValue.ts` — コアロジック

メインの実装ファイルです。

#### 定数

```typescript
SMALL_VALUE_THRESHOLD = 0.1        // これ未満 → 指数表示 E-
LARGE_VALUE_THRESHOLD = 1_000_000  // これ以上 → 指数表示 E+
SCIENTIFIC_MANTISSA_FRACTION_DIGITS = 3  // 仮数部の最大小数桁
SCIENTIFIC_EXPONENT_DIGITS = 2           // 指数部は常に 2 桁
```

#### `formatDisplayValue(value, options?)` — メイン関数

**入力:** `number | null | undefined`  
**出力:** フォーマット済み `string`

**処理フロー:**

```
value
  │
  ├─ null / undefined ──────────────────→ "" を返す
  │
  ├─ options.step === 1 ────────────────→ 四捨五入した整数文字列を返す
  │
  ├─ NaN ───────────────────────────────→ "NaN" を返す
  │
  ├─ Infinity / -Infinity ──────────────→ "Infinity" / "-Infinity" を返す
  │
  ├─ 0 または -0 ───────────────────────→ "0" を返す
  │
  └─ 通常の数値
       │
       ├─ |value| < 0.1 ───────────────→ formatScientific()
       ├─ |value| >= 1,000,000 ────────→ formatScientific()
       └─ それ以外 ───────────────────→ formatFixed()
```

**処理例** — `formatDisplayValue(1234.56789)`:

1. null ではない、step=1 ではない、NaN/Infinity ではない、ゼロではない
2. `|1234.56789|` は 1,000 ～ 10,000 の範囲
3. ルール: `integerDigits=4`、`fractionDigits=3`
4. 3 桁に四捨五入 → `1234.568`
5. 末尾ゼロを削除 → `"1234.568"`

#### `getDisplayFormatPattern(value)` — パターン参照

値に適用されるパターン文字列を、実際のフォーマット処理なしで返します。

```typescript
getDisplayFormatPattern(42)       // "##.#####"
getDisplayFormatPattern(0.05)     // "#.###E-##"
getDisplayFormatPattern(2000000)  // "#.###E+##"
getDisplayFormatPattern(0)        // "0"
```

デバッグ、UI ヒント、フォーマット設定プレビュー画面などに有用です。

#### `isScientificFormat(value)` — 指数表示判定

値が指数表示の範囲（`|x| < 0.1` または `|x| ≥ 1,000,000`）に該当する場合、`true` を返します。

#### `DisplayFormatter` クラス

同一関数へ委譲する薄いラッパーです。

```typescript
const formatter = new DisplayFormatter();

formatter.format(123.456);              // formatDisplayValue(123.456) と同じ
formatter.getDisplayFormatPattern(42);  // getDisplayFormatPattern(42) と同じ
formatter.getRuleForValue(55);          // 範囲 10–100 の DisplayFormatSpec を返す
formatter.isScientificFormat(0.01);     // true
```

`getRuleForValue()` は固定小数点形式の範囲でのみ使用できます。指数表示の範囲ではエラーをスローします。

---

#### 内部ヘルパー関数

##### `findFixedFormatSpec(abs)`

`FIXED_DISPLAY_FORMATS` から以下の条件を満たすルールを検索します。

```
abs >= entry.minAbs  AND  abs < entry.maxAbs
```

##### `buildFixedPattern(spec)`

仕様からパターン文字列を生成します。

```typescript
{ integerDigits: 2, fractionDigits: 5 } → "##.#####"
```

##### `formatFixed(abs, spec, options)`

固定小数点形式の範囲で値をフォーマットします。

**処理手順:**
1. `spec.fractionDigits` 桁に四捨五入
2. `splitNumber()` で整数部と小数部に分割
3. `fixedFraction: true` の場合 → 小数部をゼロでパディング
4. それ以外 → 小数部の末尾ゼロを削除
5. `"整数.小数"` または小数部がない場合は `"整数"` を返す

**例:**

```
入力:  12.345678, spec = { integerDigits: 2, fractionDigits: 5 }
四捨五入:  12.34568
出力: "12.34568"
```

##### `formatScientific(abs, mantissaFractionDigits, options)`

指数表示（`#.###E±##`）で値をフォーマットします。

**処理手順:**
1. 指数を計算: `Math.floor(Math.log10(abs))`
2. 仮数部を計算: `abs / 10^exponent`
3. 仮数部を 3 桁に四捨五入すると ≥ 10 になる場合（例: `0.0999999`）、範境界付近の精度を保持するため一時的に最大 6 桁を使用
4. 仮数部を四捨五入
5. 2 桁の指数部を含む文字列 `{mantissa}E{sign}{exponent}` を生成

**例:**

```
0.00123   → exponent=-3, mantissa=1.23   → "1.23E-03"
0.05      → exponent=-2, mantissa=5     → "5E-02"
1234567   → exponent=6,  mantissa=1.235  → "1.235E+06"
0.0999999 → exponent=-2, mantissa=9.99999 → "9.99999E-02"
```

##### `splitNumber(value, fractionDigits)`

`toFixed()` を使用して四捨五入済み数値を `[整数部, 小数部]` の文字列配列に分割し、浮動小数点の表示アーティファクトを回避します。

```typescript
splitNumber(12.3, 5)  → ["12", "30000"]
splitNumber(5, 3)     → ["5", "000"]
```

##### `roundToFractionDigits(value, fractionDigits)`

N 桁への標準的な四捨五入:

```typescript
roundToFractionDigits(1.23456, 3) → 1.235
roundToFractionDigits(42.7, 0)    → 43
```

##### `trimFraction(integerPart, fractionPart)`

小数部の末尾ゼロを削除し、最終文字列を組み立てます。

```typescript
trimFraction("12", "30000") → "12.3"
trimFraction("5", "000")    → "5"
```

##### `formatInteger(value)`

`step: 1` の場合に使用:

```typescript
formatInteger(42.789) → "43"
formatInteger(-12.3)  → "-12"
```

---

## 5. AMOT アプリケーションでの動作

### フォーマッターを呼び出す箇所

**計測値 / パラメータの表示箇所** でのみ使用します。

```
✅ 試験中の荷重値表示
✅ 試験結果値（最大荷重、応力など）
✅ TACT 画面のパラメータ表示
✅ フォーマット設定プレビュー（設定 → フォーマット設定）
✅ グラフの軸ラベル / ツールチップ（計測データ）

❌ ページ番号、バージョン文字列、サンプル ID
❌ 日付 / 時刻文字列、UI カウンター
❌ 内部計算、データベース保存
```

### 連携例

```typescript
// AMOT アプリ内 — displayHelper.ts
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
// React / Electron UI コンポーネント — LoadDisplay.tsx
function LoadDisplay({ loadSI }: { loadSI: number }) {
  const text = formatForDisplay(loadSI, 'force', settings.forceUnit);
  return <span>{text} {settings.forceUnit}</span>;
}
```

### データフロー図

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌────────┐
│   機械      │────→│  AMOT アプリ  │────→│   単位変換       │────→│ 表示フォーマッター │────→│   UI   │
│ （センサー） │     │（SI で保持）  │     │（SI → kN, mm）  │     │（数値 → 文字列）  │     │（ラベル）│
└─────────────┘     └──────────────┘     └─────────────────┘     └──────────────────┘     └────────┘
                          ↑                                              ↑
                   ここではフォーマットしない                    ここでのみフォーマットする
                   （生の数値を保持）                           （表示箇所のみ）
```

---

## 6. テスト — `tests/formatDisplayValue.test.ts`

テストはカテゴリ別に構成されています。

| テストグループ | 検証内容 |
|---------------|----------|
| `getDisplayFormatPattern` | 各範囲の正しいパターン文字列 |
| `isScientificFormat` | 指数表示 / 固定表示の判定 |
| エッジケース | ゼロ、null、undefined、NaN、Infinity、負の値 |
| 小さい値（`< 0.1`） | 指数表示 `E-` |
| 範囲境界 | `0.1`、`10`、`100`、`1,000,000` の遷移 |
| 固定小数点形式 | 6 つの固定範囲すべての四捨五入 |
| 大きい値（`≥ 1M`） | 指数表示 `E+` |
| `step=1` オプション | 整数表示 |
| `fixedFraction` オプション | ゼロパディング |
| `FIXED_DISPLAY_FORMATS` | ルールテーブルの完全性 |

テスト実行:

```bash
npm test
```

---

## 7. ビルドと公開

```bash
npm install     # 依存関係のインストール
npm test        # 全テスト実行
npm run build   # TypeScript を dist/ にコンパイル
```

ビルド出力:

```
dist/
├── index.js          # コンパイル済み JavaScript
├── index.d.ts        # TypeScript 型宣言
├── formatDisplayValue.js
├── formatDisplayValue.d.ts
├── types.js
└── types.d.ts
```

AMOT Electron アプリは `@amot/display-formatter` から import し、`dist/index.js` に解決されます。

---

## 8. クイックリファレンス — 公開 API

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

### `DisplayFormatter` クラス

```typescript
const f = new DisplayFormatter();
f.format(99.99999);           // "99.99999"
f.getRuleForValue(55);        // { minAbs: 10, maxAbs: 100, ... }
f.getDisplayFormatPattern(42); // "##.#####"
```

---

## 9. 設計上の判断

| 判断 | 理由 |
|------|------|
| 単位変換とは別パッケージ | 責務を分離し、単独で使用・テスト可能 |
| ルールを `types.ts` にデータとして定義 | 将来 JSON へのエクスポート（ユーザーカスタマイズ）に対応 |
| `formatDisplayValue()` をメイン API に | UI コンポーネントから最もシンプルに使用可能 |
| `DisplayFormatter` クラスも提供 | 複数インスタンスやカスタムルールが必要な場合に対応 |
| デフォルトで末尾ゼロを削除 | AMOT 仕様の `#`（任意桁）の意味に合致 |
| `step: 1` はすべての規則をバイパス | 仕様: 「別途指定がない限り（例: step=1）」 |
| null/undefined → 空文字列 | データ未読込時の UI バインディングに安全 |
| SI 値を直接渡さない | 単位変換はホストアプリ側で先に実行 |

---

## 10. 将来の拡張（計画）

AMOT タスク仕様に記載されている内容:

1. **外部ルールファイル** — ユーザー編集可能な JSON ファイルから `FIXED_DISPLAY_FORMATS` を読み込み
2. **カスタムフォーマッターインスタンス** — パラメータごとの上書き用 `new DisplayFormatter(customRules)`
3. **AMOT アプリ内の連携ヘルパー** — 単位変換 + フォーマットを組み合わせた薄いラッパー

これらは現時点では本パッケージ内に未実装ですが、現在の構成は将来の拡張に対応できる設計になっています。
