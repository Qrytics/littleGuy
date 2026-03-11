'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Existing ──────────────────────────────────────────────────────────────

  /** Receive activity state updates pushed from the main process */
  onStateChange: (cb) => {
    ipcRenderer.on('state-change', (_e, payload) => cb(payload));
  },

  /** Receive recap data pushed from the main process */
  onRecapData: (cb) => {
    ipcRenderer.on('recap-data', (_e, data) => cb(data));
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

  // ── Companion config / name ───────────────────────────────────────────────

  /** Receive companion config (name, colors) from the main process */
  onCompanionConfig: (cb) => {
    ipcRenderer.on('companion-config', (_e, cfg) => cb(cfg));
  },

  // ── Walking ───────────────────────────────────────────────────────────────

  /** Receive walking-mode updates (walking: bool, direction: ±1) */
  onWalkingUpdate: (cb) => {
    ipcRenderer.on('walking-update', (_e, data) => cb(data));
  },

  // ── Dialogue bubbles ──────────────────────────────────────────────────────

  /** Receive a dialogue line to display as a speech bubble */
  onDialogue: (cb) => {
    ipcRenderer.on('dialogue', (_e, data) => cb(data));
  },

  // ── Buddy interactions ────────────────────────────────────────────────────

  /** Triggered when another companion is within greeting distance */
  onBuddyNearby: (cb) => {
    ipcRenderer.on('buddy-nearby', (_e) => cb());
  },

  // ── Petting ───────────────────────────────────────────────────────────────

  /** Notify main process the companion was pet (click without drag) */
  petCompanion: () => {
    ipcRenderer.send('pet-companion');
  },

  // ── Minigame ──────────────────────────────────────────────────────────────

  /** Ask main process to open the minigame window */
  openMinigame: () => {
    ipcRenderer.send('open-minigame');
  },
});
