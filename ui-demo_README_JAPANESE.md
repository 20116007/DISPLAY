# ui-demo — 仕様書

`unit-convert` パッケージをデスクトップ UI に統合する方法を示す参照用 Electron + React アプリケーションです。チームの Electron アプリケーション構築時のテンプレートとしてご利用ください。

---

## 目次

1. [概要](#概要)
2. [プロジェクト構成](#プロジェクト構成)
3. [技術スタック](#技術スタック)
4. [動作の仕組み](#動作の仕組み)
5. [主要コンポーネント](#主要コンポーネント)
6. [Electron アーキテクチャ](#electron-アーキテクチャ)
7. [はじめに](#はじめに)
8. [開発ワークフロー](#開発ワークフロー)
9. [自社アプリケーションへの適用](#自社アプリケーションへの適用)
10. [示されている統合パターン](#示されている統合パターン)
11. [今後の改善案](#今後の改善案)

---

## 概要

| 項目 | 値 |
|---|---|
| プロジェクト名 | `ui-demo` |
| バージョン | `0.0.0` |
| 種別 | 非公開参照 / デモアプリ |
| 主要依存 | `unit-convert`（ローカルファイルリンク） |
| UI フレームワーク | React 19 |
| デスクトップシェル | Electron 42 |
| バンドラー | Vite 8 |

**目的:** グループ選択、値入力、単位選択、ライブ単位変換、範囲バリデーションとモーダルエラーダイアログを備えた動作する単位変換 UI を提供。

---

## プロジェクト構成

```
ui-demo/
├── package.json              # 依存関係とスクリプト
├── vite.config.ts            # Vite バンドラー設定
├── index.html                # HTML エントリーポイント
├── tsconfig.json             # ルート TypeScript 設定
├── tsconfig.app.json         # アプリ用 TS 設定
├── tsconfig.node.json        # Node/Electron 用 TS 設定
├── electron/
│   ├── main.ts               # Electron メインプロセス（ウィンドウ作成）
│   └── preload.ts            # Preload スクリプト（IPC ブリッジテンプレート）
├── src/
│   ├── main.tsx              # React DOM エントリーポイント
│   ├── App.tsx               # ルート React コンポーネント
│   ├── App.css               # アプリケーションスタイル（カード、モーダル、入力）
│   ├── index.css             # グローバルベーススタイル
│   └── components/
│       └── Converter.tsx     # メイン単位変換 UI コンポーネント
└── dist/                     # 本番ビルド出力（vite build）
```

---

## 技術スタック

| レイヤー | 技術 | バージョン |
|---|---|---|
| UI | React | ^19.2.6 |
| デスクトップ | Electron | ^42.4.0 |
| バンドラー | Vite | ^8.0.12 |
| 言語 | TypeScript | ~6.0.2 |
| 単位ライブラリ | unit-convert | `file:../unit-convert` |
| 開発オーケストレーション | concurrently + wait-on | 開発サーバー + Electron 起動 |

---

## 動作の仕組み

### 起動フロー

```
npm run dev
  │
  ├─ Vite 開発サーバーが http://localhost:5173 で起動
  │
  └─ wait-on がサーバー準備完了を検知
       └─ Electron 起動（electron .）
            └─ main.ts が BrowserWindow を作成
                 └─ http://localhost:5173 を読み込み
                      └─ React が Converter コンポーネントをレンダリング
```

### ユーザー操作フロー

```
ユーザーがユニットグループを選択
  └─ getUnits(group) で単位ドロップダウンを更新

ユーザーが値を入力
  └─ React state に文字列として保存

ユーザーが値入力を離れる（onBlur）
  └─ validate(group, unit, value) を実行
       ├─ 有効 → 何もしない
       └─ 無効 → getRange() メッセージ付きモーダルを表示

ユーザーが単位を変更（既存の値がある場合）
  └─ 先に hasValidValue() チェック
  └─ convert(group, oldUnit, newUnit, value) で表示を更新
```

---

## 主要コンポーネント

### `src/components/Converter.tsx`

コアデモコンポーネント。`unit-convert` の全 API 関数の使用例を示します:

| 関数 | コンポーネント内での用途 |
|---|---|
| `getUnitGroups()` | 「Unit Group」ドロップダウンの構築 |
| `getUnits(group)` | 「Unit」ドロップダウンの構築。グループ変更時に更新 |
| `validate(group, unit, value)` | 入力 blur 時の SI 範囲チェック |
| `getRange(group, unit)` | モーダル用のユーザーフレンドリーなエラーメッセージ構築 |
| `convert(group, from, to, value)` | 単位変更時のライブ変換 |

**状態管理:**

```typescript
const [group, setGroup] = useState(initialGroup);
const [units, setUnits] = useState(initialUnits);
const [unit, setUnit] = useState(initialUnits[0]);
const [value, setValue] = useState("");
const [showModal, setShowModal] = useState(false);
const [errorMessage, setErrorMessage] = useState("");
```

**バリデーションモーダル:** 入力が範囲外の場合、値をクリアし、許容範囲を示すモーダルを表示。閉じると入力欄にフォーカスを戻します。

### `src/App.tsx`

ページタイトルと `<Converter />` をレンダリングする最小限のラッパー。

### `electron/main.ts`

セキュアなデフォルトで `BrowserWindow`（900×700）を作成:

```typescript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true
}
```

開発時は Vite 開発サーバー URL を読み込みます。

### `electron/preload.ts`

**IPC ベース統合のテンプレート**（現在のデモでは完全には接続されていません）。以下を公開:

```typescript
window.units = {
  getGroups: () => ipcRenderer.invoke("units:getGroups"),
  getUnits: (group) => ipcRenderer.invoke("units:getUnits", group),
  convert: (group, from, to, value) => ipcRenderer.invoke("units:convert", ...),
  validate: (group, unit, value) => ipcRenderer.invoke("units:validate", ...),
  getRange: (group, unit) => ipcRenderer.invoke("units:range", ...),
};
```

> 現在のデモは IPC ブリッジではなく、React レンダラーから `unit-convert` を直接インポートしています。詳細は[統合パターン](#示されている統合パターン)を参照。

---

## Electron アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│  メインプロセス (electron/main.ts)              │
│  - BrowserWindow 作成                           │
│  - （将来）unit-convert 用 IPC ハンドラ         │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  Preload (electron/preload.ts)                │
│  - contextBridge → window.units API           │
│  - （テンプレートのみ — ハンドラ未登録）         │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  レンダラー (React + Vite)                      │
│  - Converter.tsx が unit-convert を直接 import  │
│  - ユーザーはグループ / 値 / 単位 UI を操作     │
└─────────────────────────────────────────────────┘
```

---

## はじめに

### 前提条件

- Node.js 18+
- 兄弟ディレクトリで `unit-convert` がビルド済みであること

### セットアップ

```bash
# 1. 先に unit-convert パッケージをビルド
cd ../unit-convert
npm install
npm run build

# 2. デモのインストールと起動
cd ../ui-demo
npm install
npm run dev
```

単位変換 UI 付きの Electron ウィンドウが開きます。

### 本番ビルド

```bash
npm run build
```

静的ファイルを `dist/` に出力。完全な Electron 本番ビルドには、electron-builder などのパッケージング手順の追加が必要です（本デモには含まれていません）。

---

## 開発ワークフロー

| コマンド | 説明 |
|---|---|
| `npm run dev` | Vite 開発サーバー + Electron を同時起動 |
| `npm run build` | Vite で React アプリを `dist/` にビルド |

`dev` スクリプト:

```json
"dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\""
```

---

## 自社アプリケーションへの適用

### ステップ 1 — 依存関係パターンのコピー

`package.json` に `unit-convert` を追加:

```json
"dependencies": {
  "unit-convert": "file:../unit-convert"
}
```

### ステップ 2 — Converter ロジックの再利用

`Converter.tsx` から以下のパターンをコピー:

1. マウント時 / グループ変更時にグループと単位を読み込む。
2. blur 時にバリデーション。
3. 単位変更時に変換。
4. 範囲エラーをユーザーに表示。

### ステップ 3 — display-format の追加（オプション）

```bash
npm install file:../display-format
```

```typescript
import { displayFormat } from "display-format";
setValue(displayFormat(converted));
```

### ステップ 4 — 本番向け IPC の接続（推奨）

`electron/main.ts` でハンドラを登録:

```typescript
import { ipcMain } from "electron";
import { convert, getUnitGroups, getUnits, validate, getRange } from "unit-convert";

ipcMain.handle("units:getGroups", () => getUnitGroups());
ipcMain.handle("units:getUnits", (_, group) => getUnits(group));
ipcMain.handle("units:convert", (_, group, from, to, value) => convert(group, from, to, value));
ipcMain.handle("units:validate", (_, group, unit, value) => validate(group, unit, value));
ipcMain.handle("units:range", (_, group, unit) => getRange(group, unit));
```

`main.ts` の webPreferences に preload スクリプトを追加:

```typescript
webPreferences: {
  preload: path.join(__dirname, "preload.js"),
  nodeIntegration: false,
  contextIsolation: true
}
```

React からは直接インポートの代わりに `window.units.convert(...)` を呼び出します。

---

## 示されている統合パターン

### パターン A — 直接インポート（現在の実装）

```typescript
// src/components/Converter.tsx
import { convert, validate, getRange, getUnitGroups, getUnits } from "unit-convert";
```

**利点:** シンプル、プロトタイプが速い、レンダラーで完全な TypeScript サポート。  
**欠点:** `units.json` がフロントエンドにバンドルされる。変換ロジックがレンダラープロセスで実行。

**向いている用途:** 社内ツール、迅速なプロトタイピング、信頼できる環境。

### パターン B — preload 経由の IPC（準備済み、未アクティブ）

```typescript
const result = await window.units.convert(group, from, to, value);
```

**利点:** セキュアな Electron デフォルト。変換ロジックをメインプロセスで実行。レンダラーバンドルが小さい。  
**欠点:** IPC ハンドラのセットアップと非同期呼び出しが必要。

**向いている用途:** `contextIsolation: true` の本番 Electron アプリ。

---

## 今後の改善案

チームが追加を検討できる項目:

| 項目 | 説明 |
|---|---|
| `display-format` 統合 | 表示前に変換値をフォーマット |
| IPC ハンドラ接続 | `preload.ts` API を `main.ts` ハンドラに接続 |
| electron-builder | Windows/macOS 向け配布パッケージ |
| `window.units` の TypeScript 型 | preload API 用のグローバルインターフェース宣言 |
| ユニットテスト | Vitest や Jest で変換フローをテスト |
| ユーザー設定の永続化 | 最後に使用したグループ/単位を記憶 |

---

## 関連プロジェクト

| プロジェクト | パス | 役割 |
|---|---|---|
| `unit-convert` | `../unit-convert` | 本デモが使用するコア変換ライブラリ |
| `display-format` | `../display-format` | オプションの表示フォーマット用コンパニオンライブラリ |

---

## クイックスタートチェックリスト

- [ ] `unit-convert` をビルド（`../unit-convert` で `npm run build`）
- [ ] `ui-demo` で `npm install`
- [ ] `npm run dev` を実行
- [ ] ユニットグループを選択し、値を入力し、単位を変更
- [ ] 範囲外の値（例: mm で非常に大きな Elong）を入力してバリデーションをテスト
- [ ] `Converter.tsx` を自社コンポーネントのテンプレートとして参照
