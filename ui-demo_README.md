# ui-demo — Specification Document

A reference Electron + React application that demonstrates how to integrate the `unit-convert` package into a desktop UI. Use this project as a starting template when building your team's Electron application.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [How It Works](#how-it-works)
5. [Key Components](#key-components)
6. [Electron Architecture](#electron-architecture)
7. [Getting Started](#getting-started)
8. [Development Workflow](#development-workflow)
9. [Adapting for Your Application](#adapting-for-your-application)
10. [Integration Patterns Demonstrated](#integration-patterns-demonstrated)
11. [Future Improvements](#future-improvements)

---

## Overview

| Property | Value |
|---|---|
| Project name | `ui-demo` |
| Version | `0.0.0` |
| Type | Private reference / demo app |
| Primary dependency | `unit-convert` (local file link) |
| UI framework | React 19 |
| Desktop shell | Electron 42 |
| Bundler | Vite 8 |

**Purpose:** Show a working unit-converter UI with group selection, value input, unit selection, live unit conversion, and range validation with a modal error dialog.

---

## Project Structure

```
ui-demo/
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite bundler configuration
├── index.html                # HTML entry point
├── tsconfig.json             # Root TypeScript config
├── tsconfig.app.json         # App-specific TS config
├── tsconfig.node.json        # Node/Electron TS config
├── electron/
│   ├── main.ts               # Electron main process (window creation)
│   └── preload.ts            # Preload script (IPC bridge template)
├── src/
│   ├── main.tsx              # React DOM entry point
│   ├── App.tsx               # Root React component
│   ├── App.css               # Application styles (card, modal, inputs)
│   ├── index.css             # Global base styles
│   └── components/
│       └── Converter.tsx     # Main unit converter UI component
└── dist/                     # Production build output (vite build)
```

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| UI | React | ^19.2.6 |
| Desktop | Electron | ^42.4.0 |
| Bundler | Vite | ^8.0.12 |
| Language | TypeScript | ~6.0.2 |
| Unit library | unit-convert | `file:../unit-convert` |
| Dev orchestration | concurrently + wait-on | Dev server + Electron startup |

---

## How It Works

### Startup Flow

```
npm run dev
  │
  ├─ Vite dev server starts on http://localhost:5173
  │
  └─ wait-on detects server ready
       └─ Electron launches (electron .)
            └─ main.ts creates BrowserWindow
                 └─ Loads http://localhost:5173
                      └─ React renders Converter component
```

### User Interaction Flow

```
User selects Unit Group
  └─ getUnits(group) updates unit dropdown

User enters Value
  └─ Stored as string in React state

User blurs Value input (onBlur)
  └─ validate(group, unit, value) called
       ├─ Valid → no action
       └─ Invalid → modal shown with getRange() message

User changes Unit (with existing value)
  └─ hasValidValue() check runs first
  └─ convert(group, oldUnit, newUnit, value) updates display
```

---

## Key Components

### `src/components/Converter.tsx`

The core demo component. Demonstrates all `unit-convert` API functions:

| Function | Usage in Component |
|---|---|
| `getUnitGroups()` | Populates the "Unit Group" dropdown |
| `getUnits(group)` | Populates the "Unit" dropdown; refreshes on group change |
| `validate(group, unit, value)` | Called on input blur to check SI range |
| `getRange(group, unit)` | Builds user-friendly error message for the modal |
| `convert(group, from, to, value)` | Live conversion when user changes unit |

**State management:**

```typescript
const [group, setGroup] = useState(initialGroup);
const [units, setUnits] = useState(initialUnits);
const [unit, setUnit] = useState(initialUnits[0]);
const [value, setValue] = useState("");
const [showModal, setShowModal] = useState(false);
const [errorMessage, setErrorMessage] = useState("");
```

**Validation modal:** When input is out of range, the value is cleared, a modal appears with the allowed range, and focus returns to the input on dismiss.

### `src/App.tsx`

Minimal wrapper that renders the page title and `<Converter />`.

### `electron/main.ts`

Creates a `BrowserWindow` (900×700) with secure defaults:

```typescript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true
}
```

Loads the Vite dev server URL in development.

### `electron/preload.ts`

**Template for IPC-based integration** (not fully wired in current demo). Exposes:

```typescript
window.units = {
  getGroups: () => ipcRenderer.invoke("units:getGroups"),
  getUnits: (group) => ipcRenderer.invoke("units:getUnits", group),
  convert: (group, from, to, value) => ipcRenderer.invoke("units:convert", ...),
  validate: (group, unit, value) => ipcRenderer.invoke("units:validate", ...),
  getRange: (group, unit) => ipcRenderer.invoke("units:range", ...),
};
```

> The current demo imports `unit-convert` directly in the React renderer instead of using this IPC bridge. See [Integration Patterns](#integration-patterns-demonstrated) below.

---

## Electron Architecture

```
┌─────────────────────────────────────────────────┐
│  Main Process (electron/main.ts)              │
│  - Creates BrowserWindow                      │
│  - (Future) IPC handlers for unit-convert       │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  Preload (electron/preload.ts)                │
│  - contextBridge → window.units API           │
│  - (Template only — handlers not registered)    │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  Renderer (React + Vite)                      │
│  - Converter.tsx imports unit-convert directly  │
│  - User sees unit group / value / unit UI     │
└─────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- `unit-convert` built in the sibling directory

### Setup

```bash
# 1. Build the unit-convert package first
cd ../unit-convert
npm install
npm run build

# 2. Install and run the demo
cd ../ui-demo
npm install
npm run dev
```

This opens an Electron window with the unit converter UI.

### Production Build

```bash
npm run build
```

Outputs static files to `dist/`. For a full Electron production build, your team will need to add an electron-builder or similar packaging step (not included in this demo).

---

## Development Workflow

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite dev server + Electron concurrently |
| `npm run build` | Builds React app to `dist/` via Vite |

The `dev` script uses:

```json
"dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\""
```

---

## Adapting for Your Application

### Step 1 — Copy the dependency pattern

Add `unit-convert` to your `package.json`:

```json
"dependencies": {
  "unit-convert": "file:../unit-convert"
}
```

### Step 2 — Reuse Converter logic

Copy patterns from `Converter.tsx`:

1. Load groups and units on mount / group change.
2. Validate on blur.
3. Convert on unit change.
4. Show range errors to the user.

### Step 3 — Add display-format (optional)

```bash
npm install file:../display-format
```

```typescript
import { displayFormat } from "display-format";

// After conversion:
setValue(displayFormat(converted));
```

### Step 4 — Wire IPC for production (recommended)

In `electron/main.ts`, register handlers:

```typescript
import { ipcMain } from "electron";
import { convert, getUnitGroups, getUnits, validate, getRange } from "unit-convert";

ipcMain.handle("units:getGroups", () => getUnitGroups());
ipcMain.handle("units:getUnits", (_, group) => getUnits(group));
ipcMain.handle("units:convert", (_, group, from, to, value) => convert(group, from, to, value));
ipcMain.handle("units:validate", (_, group, unit, value) => validate(group, unit, value));
ipcMain.handle("units:range", (_, group, unit) => getRange(group, unit));
```

In `main.ts` webPreferences, add the preload script:

```typescript
webPreferences: {
  preload: path.join(__dirname, "preload.js"),
  nodeIntegration: false,
  contextIsolation: true
}
```

Then call `window.units.convert(...)` from React instead of direct imports.

---

## Integration Patterns Demonstrated

### Pattern A — Direct import (current implementation)

```typescript
// src/components/Converter.tsx
import { convert, validate, getRange, getUnitGroups, getUnits } from "unit-convert";
```

**Pros:** Simple, fast to prototype, full TypeScript support in renderer.  
**Cons:** Bundles `units.json` in the frontend; unit logic runs in renderer process.

**Best for:** Internal tools, rapid prototyping, trusted environments.

### Pattern B — IPC via preload (prepared, not active)

```typescript
// Renderer
const result = await window.units.convert(group, from, to, value);
```

**Pros:** Secure Electron defaults; conversion logic in main process; smaller renderer bundle.  
**Cons:** Requires IPC handler setup and async calls.

**Best for:** Production Electron apps with `contextIsolation: true`.

---

## Future Improvements

Your team may want to add:

| Item | Description |
|---|---|
| `display-format` integration | Format converted values before display |
| IPC handler wiring | Connect `preload.ts` API to `main.ts` handlers |
| electron-builder | Package for Windows/macOS distribution |
| TypeScript types for `window.units` | Declare global interface for preload API |
| Unit tests | Test conversion flows with Vitest or Jest |
| Persistent user preferences | Remember last-used group/unit |

---

## Related Projects

| Project | Path | Role |
|---|---|---|
| `unit-convert` | `../unit-convert` | Core conversion library used by this demo |
| `display-format` | `../display-format` | Optional display formatting companion library |

---

## Quick Start Checklist

- [ ] Build `unit-convert` (`npm run build` in `../unit-convert`)
- [ ] Run `npm install` in `ui-demo`
- [ ] Run `npm run dev`
- [ ] Select a unit group, enter a value, change units
- [ ] Test validation by entering an out-of-range value (e.g. very large Elong in mm)
- [ ] Review `Converter.tsx` as a template for your own components
