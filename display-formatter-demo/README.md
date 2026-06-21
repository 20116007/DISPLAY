# Display Formatter Demo

Electron demo app for `@amot/display-formatter`.  
Located next to the `display-formatter` package (not inside it).

## UI

1. **Value** — enter any number
2. **Display Format** — select one of the 8 AMOT format patterns:
   - `#.###E-##`
   - `#.######`
   - `##.#####`
   - `###.####`
   - `####.###`
   - `#####.##`
   - `######.#`
   - `#.###E+##`
3. **Formatted Value** — updates live when value or format changes

## Run

```bash
# Build the formatter package first
cd ../display-formatter
npm install
npm run build

# Start the demo
cd ../display-formatter-demo
npm install
npm start
```

## Project layout

```
A&D_Project/
├── display-formatter/       ← npm package
└── display-formatter-demo/  ← this Electron demo
```
