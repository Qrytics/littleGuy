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
  dialog,
} = require('electron');
const path = require('path');
const ActivityMonitor = require('./src/activity-monitor');
const ActivityLogger  = require('./src/activity-logger');
const CompanionStore  = require('./src/companion-store');

// ─── App-level state ──────────────────────────────────────────────────────────

let tray          = null;
let recapWindow   = null;
let minigameWindow = null;
let monitorInterval = null;
let walkingInterval = null;
let dialogueInterval = null;
let interactionInterval = null;
let currentState  = 'idle';

/**
 * Map<companionId, { window: BrowserWindow, config: object, walkVx: number }>
 */
const companions = new Map();

// ─── PNG / tray icon generation ───────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(d.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])), 0);
  return Buffer.concat([len, t, d, crcBuf]);
}

function buildPNG(width, height, getRGBA) {
  const { deflateSync } = require('zlib');
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getRGBA(x, y);
      raw.push(r, g, b, a);
    }
  }
  const compressed = deflateSync(Buffer.from(raw));
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = ihdr[11] = ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createTrayIconImage() {
  const size = 32;
  const pngBuf = buildPNG(size, size, (x, y) => {
    const cx = x - size / 2 + 0.5, cy = y - size / 2 + 0.5;
    const dist = Math.sqrt(cx * cx + cy * cy);
    if (dist <= 13) return [65, 105, 225, 255];
    if (dist <= 15) return [30, 70, 170, 255];
    return [0, 0, 0, 0];
  });
  return nativeImage.createFromBuffer(pngBuf, { scaleFactor: 1 });
}

// ─── Companion window creation ────────────────────────────────────────────────

function defaultPosition() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { x: width - 120, y: height - 190 };
}

function createCompanionWindow(cfg) {
  const { x, y } = (cfg.x != null && cfg.y != null)
    ? { x: cfg.x, y: cfg.y }
    : defaultPosition();

  const win = new BrowserWindow({
    width: 80,
    height: 160,
    x,
    y,
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

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.setAlwaysOnTop(true, 'screen-saver');

  // When renderer is ready, push initial config
  win.webContents.on('did-finish-load', () => {
    sendCompanionConfig(win, cfg);
  });

  win.on('closed', () => {
    companions.delete(cfg.id);
    updateTrayMenu();
  });

  return win;
}

function sendCompanionConfig(win, cfg) {
  if (!win || win.isDestroyed()) return;
  const typeData = CompanionStore.COMPANION_TYPES[cfg.type] || CompanionStore.COMPANION_TYPES.default;
  win.webContents.send('companion-config', {
    id:   cfg.id,
    name: cfg.name,
    colors: {
      hair:  typeData.hair,
      skin:  typeData.skin,
      shirt: typeData.shirt,
      pants: typeData.pants,
      shoes: typeData.shoes,
    },
  });
}

// ─── Spawn all stored companions ──────────────────────────────────────────────

function spawnAllCompanions() {
  const cfgs = CompanionStore.getCompanions();
  for (const cfg of cfgs) {
    if (companions.has(cfg.id)) continue; // already spawned
    const win = createCompanionWindow(cfg);
    companions.set(cfg.id, { window: win, config: cfg, walkVx: 0.8 });
  }
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  const icon = createTrayIconImage();
  tray = new Tray(icon);
  tray.setToolTip('littleGuy — your desktop buddy');
  updateTrayMenu();
}

function buildCompanionSubmenu(id, cfg) {
  const typeItems = Object.entries(CompanionStore.COMPANION_TYPES).map(([key, info]) => ({
    label: info.label,
    type: 'radio',
    checked: cfg.type === key,
    click: () => {
      CompanionStore.updateCompanion(id, { type: key });
      const entry = companions.get(id);
      if (entry) {
        entry.config.type = key;
        sendCompanionConfig(entry.window, entry.config);
      }
      updateTrayMenu();
    },
  }));

  return [
    {
      label: `Rename "${cfg.name}"…`,
      click: async () => {
        const entry = companions.get(id);
        if (!entry) return;
        const result = await dialog.showInputBox
          ? dialog.showInputBox({ title: 'Rename', defaultValue: cfg.name })
          : { response: 0, checkboxChecked: false };

        // Electron doesn't have showInputBox — use a prompt-style approach
        // We'll emit IPC to a hidden input window, but the simplest method
        // is a native dialog with message + buttons.  Here we fallback to
        // prompting in the renderer via a keyboard-shortcut-free approach:
        promptRename(id, cfg);
      },
    },
    { label: 'Companion Type', enabled: false },
    ...typeItems,
    { type: 'separator' },
    {
      label: 'Show / Hide',
      click: () => {
        const entry = companions.get(id);
        if (!entry) return;
        const win = entry.window;
        win.isVisible() ? win.hide() : win.show();
      },
    },
    {
      label: 'Remove companion',
      click: () => {
        const entry = companions.get(id);
        if (entry) {
          entry.window.destroy();
          companions.delete(id);
        }
        CompanionStore.removeCompanion(id);
        updateTrayMenu();
      },
    },
  ];
}

/** Opens a small input dialog by re-using a BrowserWindow approach. */
function promptRename(id, cfg) {
  const entry = companions.get(id);
  if (!entry) return;

  const promptWin = new BrowserWindow({
    width: 320,
    height: 140,
    title: 'Rename companion',
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const html = `<!DOCTYPE html><html><head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'unsafe-inline'">
    <style>
      body { font-family: monospace; padding: 16px; background: #1a1a2e; color: #eee; }
      input { width: 100%; padding: 6px; margin: 8px 0; background: #0d0d1a; color: #eee; border: 1px solid #4169e1; border-radius: 3px; font-family: monospace; font-size: 13px; }
      button { padding: 6px 16px; background: #4169e1; border: none; border-radius: 4px; color: #fff; font-family: monospace; cursor: pointer; margin-right: 8px; }
    </style>
    </head><body>
    <label>New name for <b>${cfg.name}</b>:</label>
    <input id="n" value="${cfg.name.replace(/"/g, '&quot;')}" maxlength="20" />
    <button onclick="done()">OK</button>
    <button onclick="window.close()">Cancel</button>
    <script>
      document.getElementById('n').select();
      function done() {
        const v = document.getElementById('n').value.trim();
        if (v) { window.location.hash = encodeURIComponent(v); }
        window.close();
      }
      document.getElementById('n').addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
    </script>
    </body></html>`;

  promptWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  promptWin.on('closed', () => {
    // Read the name from the hash — the renderer sets it before closing
    const url = promptWin.webContents.getURL();
    const hash = decodeURIComponent(url.split('#')[1] || '');
    if (hash && hash.length > 0 && hash !== 'undefined') {
      const newName = hash.slice(0, 20);
      CompanionStore.updateCompanion(id, { name: newName });
      entry.config.name = newName;
      sendCompanionConfig(entry.window, entry.config);
      updateTrayMenu();
    }
  });
}

function updateTrayMenu() {
  const settings = CompanionStore.getSettings();
  const companionItems = [];

  for (const [id, { config }] of companions) {
    companionItems.push({
      label: `🐾 ${config.name}`,
      submenu: buildCompanionSubmenu(id, config),
    });
  }

  const menu = Menu.buildFromTemplate([
    { label: 'littleGuy', enabled: false },
    { type: 'separator' },
    { label: `Status: ${currentState}`, enabled: false },
    { type: 'separator' },
    ...companionItems,
    {
      label: 'Add New Companion',
      click: () => {
        const cfg = CompanionStore.addCompanion();
        const win = createCompanionWindow(cfg);
        companions.set(cfg.id, { window: win, config: cfg, walkVx: 0.8 });
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Walking Mode',
      type: 'checkbox',
      checked: settings.walkingEnabled,
      click: (item) => {
        CompanionStore.updateSettings({ walkingEnabled: item.checked });
        if (!item.checked) {
          // Notify all companions to stop walking animation
          for (const { window: win } of companions.values()) {
            if (win && !win.isDestroyed()) {
              win.webContents.send('walking-update', { walking: false, direction: 1 });
            }
          }
        }
      },
    },
    {
      label: 'Dialogue Bubbles',
      type: 'checkbox',
      checked: settings.dialogueEnabled,
      click: (item) => {
        CompanionStore.updateSettings({ dialogueEnabled: item.checked });
      },
    },
    { type: 'separator' },
    {
      label: 'Daily Recap',
      click: () => showRecap(),
    },
    {
      label: 'Play Minigame',
      click: () => openMinigame(),
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
      click: (item) => { app.setLoginItemSettings({ openAtLogin: item.checked }); },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        ActivityLogger.flush();
        CompanionStore.save();
        app.quit();
      },
    },
  ]);

  if (tray) tray.setContextMenu(menu);
}

// ─── Activity monitoring ──────────────────────────────────────────────────────

function setupActivityMonitoring() {
  monitorInterval = setInterval(async () => {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const winInfo     = await ActivityMonitor.getActiveWindow();
    const newState    = ActivityMonitor.classifyActivity(
      winInfo.processName, winInfo.windowTitle, idleSeconds
    );

    ActivityLogger.record(winInfo.processName, winInfo.windowTitle, newState);

    if (newState !== currentState) {
      currentState = newState;
      updateTrayMenu();
    }

    for (const { window: win } of companions.values()) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('state-change', {
          state:       currentState,
          processName: winInfo.processName,
          windowTitle: winInfo.windowTitle,
          idleSeconds,
        });
      }
    }
  }, 2000);
}

// ─── Walking loop ─────────────────────────────────────────────────────────────

function setupWalkingLoop() {
  walkingInterval = setInterval(() => {
    const settings = CompanionStore.getSettings();
    if (!settings.walkingEnabled) return;

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    for (const [id, entry] of companions) {
      const { window: win, config } = entry;
      if (!win || win.isDestroyed()) continue;

      let vx = entry.walkVx || 0.8;

      // Occasionally change direction or pause
      const rand = Math.random();
      if (rand < 0.003) vx = -vx;

      const [cx, cy] = win.getPosition();
      let nx = cx + vx;
      let ny = cy;

      // Bounce off horizontal edges
      if (nx < 0 || nx > width - 80) {
        vx = -vx;
        nx = Math.max(0, Math.min(width - 80, nx));
      }
      // Keep within vertical bounds
      ny = Math.max(0, Math.min(height - 160, ny));

      entry.walkVx = vx;

      win.setPosition(Math.round(nx), Math.round(ny));

      // Save position periodically (throttled)
      if (Math.random() < 0.01) {
        CompanionStore.updateCompanion(id, { x: Math.round(nx), y: Math.round(ny) });
      }

      win.webContents.send('walking-update', {
        walking:   true,
        direction: vx >= 0 ? 1 : -1,
      });
    }
  }, 80);
}

// ─── Dialogue loop ────────────────────────────────────────────────────────────

const DIALOGUE_LINES = {
  idle:    ['...', 'Hmm.', '*yawns*', "What's up?", 'Hey there!', 'Bored?'],
  active:  ['Interesting!', "Ooh, what's that?", 'You got this!', 'Looking good!'],
  typing:  ['Click clack!', 'Type type type!', 'On a roll!', 'Go go go!', '📝'],
  coding:  ['Nice code!', "You're on fire!", 'Bug free? 👀', 'So many commits!', '🚀'],
  sleeping:['Zzz…', '*snore*', 'Shhh…', 'Nap time…'],
  walking: ['Exploring!', 'Stretch!', 'La la la~', 'Just walking 🐾'],
};

function setupDialogueLoop() {
  function maybeSendDialogue() {
    const settings = CompanionStore.getSettings();
    if (!settings.dialogueEnabled) return;

    const lines = DIALOGUE_LINES[currentState] || DIALOGUE_LINES.idle;
    const text  = lines[Math.floor(Math.random() * lines.length)];

    for (const { window: win } of companions.values()) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('dialogue', { text });
      }
    }
  }

  function scheduleNext() {
    // Random 45–120 second intervals
    const ms = 45_000 + Math.random() * 75_000;
    dialogueInterval = setTimeout(() => {
      maybeSendDialogue();
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}

// ─── Buddy interaction loop ───────────────────────────────────────────────────

function setupInteractionLoop() {
  interactionInterval = setInterval(() => {
    if (companions.size < 2) return;

    const entries = [...companions.values()];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i], b = entries[j];
        if (!a.window || a.window.isDestroyed()) continue;
        if (!b.window || b.window.isDestroyed()) continue;

        const [ax, ay] = a.window.getPosition();
        const [bx, by] = b.window.getPosition();
        const dist = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);

        if (dist < 200) {
          a.window.webContents.send('buddy-nearby');
          b.window.webContents.send('buddy-nearby');
        }
      }
    }
  }, 3000);
}

// ─── Recap window ─────────────────────────────────────────────────────────────

function showRecap() {
  if (recapWindow) { recapWindow.focus(); return; }

  recapWindow = new BrowserWindow({
    width: 600, height: 500,
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
  recapWindow.on('closed', () => { recapWindow = null; });

  const data = ActivityLogger.getRecapData();
  recapWindow.webContents.on('did-finish-load', () => {
    recapWindow.webContents.send('recap-data', data);
  });
}

// ─── Minigame window ──────────────────────────────────────────────────────────

function openMinigame() {
  if (minigameWindow && !minigameWindow.isDestroyed()) {
    minigameWindow.focus();
    return;
  }

  minigameWindow = new BrowserWindow({
    width: 420, height: 380,
    title: 'littleGuy — Minigame',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  minigameWindow.loadFile(path.join(__dirname, 'src', 'minigame.html'));
  minigameWindow.on('closed', () => { minigameWindow = null; });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.on('set-click-through', (event, value) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setIgnoreMouseEvents(value, { forward: true });
});

ipcMain.on('move-window', (event, { dx, dy }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + dx, y + dy);
  // Persist new position
  for (const [id, entry] of companions) {
    if (entry.window === win) {
      CompanionStore.updateCompanion(id, { x: x + dx, y: y + dy });
      break;
    }
  }
});

ipcMain.handle('request-recap', () => ActivityLogger.getRecapData());

ipcMain.on('pet-companion', () => {
  const settings = CompanionStore.getSettings();
  CompanionStore.updateSettings({ totalPets: (settings.totalPets || 0) + 1 });
});

ipcMain.on('open-minigame', () => openMinigame());

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  spawnAllCompanions();
  createTray();
  setupActivityMonitoring();
  setupWalkingLoop();
  setupDialogueLoop();
  setupInteractionLoop();
});

app.on('window-all-closed', (e) => {
  // Stay alive in the tray
  e.preventDefault();
});

app.on('before-quit', () => {
  if (monitorInterval)   clearInterval(monitorInterval);
  if (walkingInterval)   clearInterval(walkingInterval);
  if (dialogueInterval)  clearTimeout(dialogueInterval);
  if (interactionInterval) clearInterval(interactionInterval);

  // Save final positions
  for (const [id, { window: win }] of companions) {
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition();
      CompanionStore.updateCompanion(id, { x, y });
    }
  }

  ActivityLogger.flush();
  CompanionStore.save();
});
