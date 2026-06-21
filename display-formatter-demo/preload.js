const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('formatterApi', {
  getFormatPatterns: () => ipcRenderer.invoke('get-format-patterns'),
  formatValue: (rawValue, pattern) =>
    ipcRenderer.invoke('format-value', { rawValue, pattern }),
});
