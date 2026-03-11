'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Receive activity state updates pushed from the main process */
  onStateChange: (callback) => {
    ipcRenderer.on('state-change', (_event, payload) => callback(payload));
  },

  /** Receive recap data pushed from the main process */
  onRecapData: (callback) => {
    ipcRenderer.on('recap-data', (_event, data) => callback(data));
  },

  /** Tell the main process whether the window should pass mouse events through */
  setClickThrough: (value) => {
    ipcRenderer.send('set-click-through', value);
  },

  /** Ask the main process to move the overlay window by (dx, dy) pixels */
  moveWindow: (dx, dy) => {
    ipcRenderer.send('move-window', { dx, dy });
  },

  /** Request a fresh recap payload from the main process */
  requestRecap: () => ipcRenderer.invoke('request-recap'),
});
