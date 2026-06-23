# unit-convert — 仕様書

エンジニアリング単位の変換、バリデーション、範囲チェックを行う TypeScript ライブラリです。デスクトップアプリケーション（Electron）、Web フロントエンド（React）、Node.js サービスから利用できます。

---

## 目次

1. [概要](#概要)
2. [プロジェクト構成](#プロジェクト構成)
3. [データモデル](#データモデル)
4. [変換の計算式](#変換の計算式)
5. [公開 API リファレンス](#公開-api-リファレンス)
6. [単位データベース](#単位データベース)
7. [ビルドパイプライン](#ビルドパイプライン)
8. [Electron アプリへの導入](#electron-アプリへの導入)
9. [使用例](#使用例)
10. [エラーハンドリング](#エラーハンドリング)
11. [統合パターン](#統合パターン)
12. [関連プロジェクト](#関連プロジェクト)

---

## 概要

| 項目 | 値 |
|---|---|
| パッケージ名 | `unit-convert` |
| バージョン | `1.0.0` |
| モジュール形式 | ES Module（`"type": "module"`） |
| エントリーポイント | `dist/index.js` |
| 型定義 | `dist/index.d.ts` |
| 実行時データ | `dist/data/units.json` |

**目的:** 同一物理グループ内の単位間で数値を変換する（例: `Elong` グループで `mm` → `in`）、SI 範囲に対する入力バリデーション、選択単位での最小/最大値の取得。

**対応ユニットグループ:** 39 グループ（Elong、Area、Volume、Mass、Pressure、Stress、Temperature、Energy、YarnStress、Metsuke、Kic などドメイン固有グループを含む）。

---

## プロジェクト構成

```
unit-convert/
├── package.json              # パッケージメタデータとビルドスクリプト
├── tsconfig.json             # TypeScript コンパイラ設定
├── UNIT.xlsx                 # ソース Excel ファイル（再生成時に必要）
├── src/
│   ├── index.ts              # 公開 API のエクスポート
│   ├── core/
│   │   └── converter.ts      # 変換・バリデーション・範囲処理のコアロジック
│   ├── types/
│   │   └── index.ts          # TypeScript インターフェース定義
│   ├── data/
│   │   └── units.json        # 生成された単位データベース（実行時の正）
│   └── scripts/
│       ├── excelToJson.ts    # UNIT.xlsx → units.json 変換
│       └── copyUnitsToDist.ts# コンパイル後に units.json を dist/ へコピー
└── dist/                     # コンパイル出力（`npm run build` で生成）
    ├── index.js
    ├── index.d.ts
    ├── core/
    ├── types/
    └── data/
        └── units.json
```

### 各ファイルの役割

| ファイル | 役割 |
|---|---|
| `src/index.ts` | 公開関数を再エクスポート。アプリケーションはここからのみインポートすること。 |
| `src/core/converter.ts` | 起動時に `units.json` を読み込み、変換・バリデーションの全ロジックを実装。 |
| `src/types/index.ts` | `UnitDefinition`、`UnitGroup`、`UnitsDatabase`、`UnitRange` インターフェースを定義。 |
| `src/data/units.json` | 全ユニットグループ、変換係数、オプションの SI 範囲を格納する JSON データベース。 |
| `src/scripts/excelToJson.ts` | ビルド時スクリプト。`UNIT.xlsx` を読み込み `units.json` を再生成。 |
| `src/scripts/copyUnitsToDist.ts` | ビルド後スクリプト。`units.json` を `dist/data/` にコピー。 |

---

## データモデル

### `UnitDefinition`

各単位には 2 つの変換係数があります:

```typescript
interface UnitDefinition {
  multi: number;  // 乗数
  plus: number;   // 加算オフセット（温度などアフィン変換用）
}
```

### `UnitGroup`

```typescript
interface UnitGroup {
  baseUnit: string;                        // SI または基準単位名
  units: Record<string, UnitDefinition>;   // グループ内の全単位
  min_SI?: number;                         // SI/基準単位での最小値（オプション）
  max_SI?: number;                         // SI/基準単位での最大値（オプション）
}
```

### `UnitsDatabase`

```typescript
interface UnitsDatabase {
  [group: string]: UnitGroup;
}
```

### JSON エントリの例

```json
{
  "Elong": {
    "baseUnit": "m",
    "units": {
      "m":  { "multi": 1,       "plus": 0 },
      "mm": { "multi": 1000,    "plus": 0 },
      "in": { "multi": 39.37008,"plus": 0 }
    },
    "min_SI": 0.01,
    "max_SI": 2000000
  }
}
```

---

## 変換の計算式

すべての変換は、グループの**基準（SI）単位**を中間ステップとして経由します。

### 基準単位への変換

```
baseValue = value / multi + plus
```

### 基準単位からの変換

```
displayValue = (baseValue - plus) * multi
```

### 直接変換（A → B）

```
baseValue = toBase(group, unitA, value)
result    = fromBase(group, unitB, baseValue)
```

### 温度の特別処理

Excel からデータ生成時、`Temperature` グループの `plus` オフセットは絶対値（`Math.abs(plus)`）として保存されます。°C、°F、K などのアフィン温度変換に対応します。

---

## 公開 API リファレンス

すべての関数はパッケージルートからエクスポートされます:

```typescript
import {
  convert,
  toBase,
  fromBase,
  getUnitGroups,
  getUnits,
  validate,
  getRange
} from "unit-convert";
```

### `getUnitGroups(): string[]`

利用可能な全ユニットグループ名を返します。

```typescript
const groups = getUnitGroups();
// ["Elong", "Area", "Volume", "Mass", ...]
```

### `getUnits(group: string): string[]`

グループ内の全単位名を返します。グループが存在しない場合は例外をスローします。

```typescript
const units = getUnits("Elong");
// ["m", "um", "mm", "cm", "in", "ft", "km"]
```

### `toBase(group, unit, value): number`

指定単位の値をグループの基準（SI）単位に変換します。

### `fromBase(group, unit, baseValue): number`

基準（SI）値を指定単位に変換します。

### `convert(group, fromUnit, toUnit, value): number`

同一グループ内の 2 単位間で直接変換します。

```typescript
const inches = convert("Elong", "mm", "in", 25.4);
// 1
```

### `validate(group, unit, value): ValidationResult`

値がグループの SI 範囲内かどうかをチェックします（範囲が定義されている場合）。

```typescript
interface ValidationResult {
  valid: boolean;
  valueSI: number;
  minSI: number;
  maxSI: number;
  message?: string;
}
```

- グループに `min_SI` / `max_SI` が未定義の場合、`valid` は常に `true`、`minSI`/`maxSI` は `NaN`。
- 範囲外の場合、`message` に人間が読めるエラーメッセージが含まれます。

### `getRange(group, unit): UnitRange | null`

選択した単位で表現された許容最小/最大値を返します。

```typescript
interface UnitRange {
  min: number;
  max: number;
  unit: string;
}
```

グループに SI 範囲が未定義の場合は `null` を返します。

---

## 単位データベース

データベースは `UNIT.xlsx` から生成され、**39 のユニットグループ**を含みます。代表的なグループ:

| グループ | 基準単位 | 単位の例 | SI 範囲あり |
|---|---|---|---|
| Elong | m | m, mm, cm, in, ft, km | はい |
| Area | m2 | mm2, cm2, m2, in2, ft2 | いいえ |
| Mass | kg | kg, g, lb | — |
| Pressure | Pa | Pa, MPa, psi, bar | — |
| Temperature | K | K, C, F | — |
| Energy | J | J, kJ, cal | — |
| Load | N | N, kN, lbf | — |

Excel からデータベースを再生成する手順:

1. `UNIT.xlsx` を `unit-convert/` ルートに配置。
2. `npm run generate` を実行（または `npm run build` で生成を含む）。

使用する Excel 列:

| 列名 | 用途 |
|---|---|
| `UnitGroup` | グループ名（例: `Elong`） |
| `Unit` または `Name` | 単位識別子 |
| `Multi` | 乗数係数 |
| `Plus` | オフセット係数 |
| `min_SI` | SI での最小許容値（基準単位行のみ） |
| `max_SI` | SI での最大許容値（基準単位行のみ） |

---

## ビルドパイプライン

```bash
cd unit-convert
npm install
npm run build
```

ビルド手順（`package.json` で定義）:

1. **`npm run generate`** — `excelToJson.ts` を実行し `UNIT.xlsx` から `src/data/units.json` を生成。
2. **`tsc`** — `src/` から `dist/` へ TypeScript をコンパイル。
3. **`copyUnitsToDist.ts`** — `src/data/units.json` を `dist/data/units.json` にコピー。

> **注意:** `UNIT.xlsx` がない場合、`generate` は失敗します。開発時は既存の `src/data/units.json` を使用し、`tsc && node src/scripts/copyUnitsToDist.ts` を手動実行できます。

---

## Electron アプリへの導入

### 方法 A — ローカルファイル依存（モノレポ向け推奨）

Electron アプリの `package.json`:

```json
{
  "dependencies": {
    "unit-convert": "file:../unit-convert"
  }
}
```

その後:

```bash
cd unit-convert && npm run build
cd ../your-electron-app && npm install
```

### 方法 B — npm link

```bash
cd unit-convert && npm run build && npm link
cd ../your-electron-app && npm link unit-convert
```

### レンダラー vs メインプロセス

| プロセス | 直接インポート | 備考 |
|---|---|---|
| **レンダラー**（React/Vue） | ✅ 対応 | 最もシンプル。`ui-demo` で使用。 |
| **メインプロセス** | ✅ 対応 | 変換を UI スレッド外で実行する場合。 |
| **Preload + IPC** | ✅ 本番向け推奨 | `contextBridge` 経由で安全な API を公開（`ui-demo/electron/preload.ts` 参照）。 |

アプリがインポートする前に `unit-convert` をビルド（`dist/` が存在すること）してください。

---

## 使用例

### 基本的な変換

```typescript
import { convert } from "unit-convert";

const result = convert("Pressure", "MPa", "psi", 1);
console.log(result);
```

### 単位ドロップダウンの構築

```typescript
import { getUnitGroups, getUnits } from "unit-convert";

const groups = getUnitGroups();
const elongUnits = getUnits("Elong");
```

### ユーザー入力のバリデーション

```typescript
import { validate, getRange } from "unit-convert";

const result = validate("Elong", "mm", 5000000);

if (!result.valid) {
  const range = getRange("Elong", "mm");
  console.error(
    `値は ${range?.min} から ${range?.max} ${range?.unit} の間で入力してください`
  );
}
```

### 単位変更時のライブ変換

```typescript
import { convert } from "unit-convert";

function onUnitChange(
  group: string,
  oldUnit: string,
  newUnit: string,
  currentValue: number
): number {
  return convert(group, oldUnit, newUnit, currentValue);
}
```

### display-format との組み合わせ

```typescript
import { convert } from "unit-convert";
import { displayFormat } from "display-format";

const raw = convert("Elong", "m", "mm", 1.234567);
const display = displayFormat(raw);
```

---

## エラーハンドリング

ルックアップ関数は無効な入力に対して `Error` をスローします:

| 条件 | エラーメッセージ |
|---|---|
| 不明なグループ | `Unknown group: {group}` または `Unknown unit group: {group}` |
| 不明な単位 | `Unknown unit: {unit}` |

`validate()` と `getRange()` は不明なグループ/単位で例外をスローしますが、範囲違反に対してはソフトな結果（`valid: false` または `null`）を返します。

グループ名/単位名が自由入力の場合は、try/catch でラップしてください。

---

## 統合パターン

### パターン 1 — React レンダラーへの直接インポート（最もシンプル）

参照 `ui-demo` プロジェクトで使用。コンポーネントから直接関数をインポート。

```typescript
import { convert, validate, getUnitGroups, getUnits } from "unit-convert";
```

### パターン 2 — Electron preload 経由の IPC ブリッジ（本番向け）

1. `electron/main.ts` に `unit-convert` 関数を呼ぶ IPC ハンドラを登録。
2. `electron/preload.ts` で `contextBridge.exposeInMainWorld` により型付き API を公開。
3. レンダラーから `window.units.convert(...)` を呼び出す。

`nodeIntegration: false` と `contextIsolation: true`（セキュアなデフォルト）を維持できます。

### パターン 3 — メインプロセスのみで変換

すべての変換をメインプロセスで実行し、フォーマット済み文字列のみレンダラーに送信。単位データをフロントエンドにバンドルしない場合に有効。

---

## 関連プロジェクト

| プロジェクト | 説明 |
|---|---|
| `display-format` | 数値の表示フォーマット（小数桁、科学表記）。 |
| `ui-demo` | `unit-convert` 統合を示す参照 Electron + React アプリ。 |

---

## クイックリファレンス

```
getUnitGroups()                    → string[]
getUnits(group)                    → string[]
toBase(group, unit, value)         → number
fromBase(group, unit, baseValue)   → number
convert(group, from, to, value)    → number
validate(group, unit, value)       → ValidationResult
getRange(group, unit)              → UnitRange | null
```
