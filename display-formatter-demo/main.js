const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const {
  formatDisplayValueWithPattern,
  ALL_DISPLAY_FORMAT_PATTERNS,
} = require('@amot/display-formatter');

function registerIpcHandlers() {
  ipcMain.handle('get-format-patterns', () => ALL_DISPLAY_FORMAT_PATTERNS);

  ipcMain.handle('format-value', (_event, payload) => {
    const { rawValue, pattern } = payload;
    const trimmed = String(rawValue ?? '').trim();

    if (trimmed === '') {
      return { formatted: '', error: null };
    }

    const numericValue = Number(trimmed);
    if (Number.isNaN(numericValue)) {
      return {
        formatted: '—',
        error: 'Please enter a valid number.',
      };
    }

    try {
      const formatted = formatDisplayValueWithPattern(numericValue, pattern);
      return { formatted, error: null };
    } catch (error) {
      return {
        formatted: '—',
        error: error instanceof Error ? error.message : 'Formatting failed.',
      };
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 760,
    height: 520,
    minWidth: 640,
    minHeight: 420,
    title: 'AMOT Display Formatter Demo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
