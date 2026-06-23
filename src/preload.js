const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getInitialState() {
    return ipcRenderer.invoke('pet:get-initial-state');
  },
  notifyClick() {
    ipcRenderer.send('pet:click');
  },
  notifyDoubleClick() {
    ipcRenderer.send('pet:double-click');
  },
  showContextMenu() {
    ipcRenderer.send('pet:context-menu');
  },
  disableClickThrough() {
    ipcRenderer.send('pet:disable-click-through');
  },
  notifyAnimationComplete(state) {
    ipcRenderer.send('pet:animation-complete', state);
  },
  onStateChange(callback) {
    ipcRenderer.on('pet-state', (_event, state) => callback(state));
  },
  onSettingsChange(callback) {
    ipcRenderer.on('pet-settings', (_event, settings) => callback(settings));
  }
});
