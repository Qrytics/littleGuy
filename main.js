'use strict';

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  screen,
  powerMonitor,
  shell,
} = require('electron');
const path = require('path');
const ActivityMonitor = require('./src/activity-monitor');
const ActivityLogger = require('./src/activity-logger');

let overlayWindow = null;
let recapWindow = null;
let tray = null;
let monitorInterval = null;
let currentState = 'idle';

// ─── PNG generation for tray icon ────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(d.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])), 0);
  return Buffer.concat([len, t, d, crcBuf]);
}

function buildPNG(width, height, getRGBA) {
  const { deflateSync } = require('zlib');
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getRGBA(x, y);
      raw.push(r, g, b, a);
    }
  }
  const compressed = deflateSync(Buffer.from(raw));
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = ihdr[11] = ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createTrayIconImage() {
  const size = 32;
  const pngBuf = buildPNG(size, size, (x, y) => {
    const cx = x - size / 2 + 0.5;
    const cy = y - size / 2 + 0.5;
    const dist = Math.sqrt(cx * cx + cy * cy);
    // Head circle
    if (dist <= 13) return [65, 105, 225, 255];   // #4169E1 blue
    // Ring
    if (dist <= 15) return [30, 70, 170, 255];    // darker ring
    return [0, 0, 0, 0]; // transparent
  });
  return nativeImage.createFromBuffer(pngBuf, { scaleFactor: 1 });
}

// ─── Window creation ──────────────────────────────────────────────────────────
function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 80,
    height: 100,
    x: width - 120,
    y: height - 130,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createRecapWindow() {
  if (recapWindow) {
    recapWindow.focus();
    return;
  }

  recapWindow = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'littleGuy — Daily Recap',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  recapWindow.loadFile(path.join(__dirname, 'src', 'recap.html'));
  recapWindow.once('ready-to-show', () => recapWindow.show());
  recapWindow.on('closed', () => {
    recapWindow = null;
  });
}

// ─── System tray ─────────────────────────────────────────────────────────────
function createTray() {
  const icon = createTrayIconImage();
  tray = new Tray(icon);
  tray.setToolTip('littleGuy — your desktop buddy');
  updateTrayMenu();
}

function updateTrayMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'littleGuy',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: `Status: ${currentState}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show / Hide buddy',
      click: () => {
        if (overlayWindow) {
          overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show();
        }
      },
    },
    {
      label: 'Daily Recap',
      click: () => showRecap(),
    },
    {
      label: 'Open log folder',
      click: () => shell.openPath(app.getPath('userData')),
    },
    { type: 'separator' },
    {
      label: 'Launch at startup',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        ActivityLogger.flush();
        app.quit();
      },
    },
  ]);
  if (tray) tray.setContextMenu(menu);
}

// ─── Activity monitoring loop ─────────────────────────────────────────────────
function setupActivityMonitoring() {
  const logger = ActivityLogger;

  monitorInterval = setInterval(async () => {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const winInfo = await ActivityMonitor.getActiveWindow();
    const newState = ActivityMonitor.classifyActivity(
      winInfo.processName,
      winInfo.windowTitle,
      idleSeconds
    );

    logger.record(winInfo.processName, winInfo.windowTitle, newState);

    if (newState !== currentState) {
      currentState = newState;
      updateTrayMenu();
    }

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('state-change', {
        state: currentState,
        processName: winInfo.processName,
        windowTitle: winInfo.windowTitle,
        idleSeconds,
      });
    }
  }, 2000);
}

// ─── Recap ────────────────────────────────────────────────────────────────────
function showRecap() {
  createRecapWindow();
  if (recapWindow && !recapWindow.isDestroyed()) {
    const data = ActivityLogger.getRecapData();
    recapWindow.webContents.on('did-finish-load', () => {
      recapWindow.webContents.send('recap-data', data);
    });
    recapWindow.webContents.send('recap-data', data);
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.on('set-click-through', (event, value) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setIgnoreMouseEvents(value, { forward: true });
});

ipcMain.on('move-window', (event, { dx, dy }) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const [x, y] = overlayWindow.getPosition();
  overlayWindow.setPosition(x + dx, y + dy);
});

ipcMain.handle('request-recap', () => {
  return ActivityLogger.getRecapData();
});

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createOverlayWindow();
  createTray();
  setupActivityMonitoring();
});

app.on('window-all-closed', (e) => {
  // Prevent quit when all windows close — we live in the tray
  e.preventDefault();
});

app.on('before-quit', () => {
  if (monitorInterval) clearInterval(monitorInterval);
  ActivityLogger.flush();
});
