# littleGuy

> A tiny always-on-top pixel-art companion that watches what you're doing and reacts in real time.

![Character states](https://github.com/user-attachments/assets/3ab5dfb9-0ce9-48e7-b54c-31849f283cc4)

## Features

| Feature | Details |
|---------|---------|
| 🎮 Pixel-art overlay | 10 × 16 px character rendered at 4× scale on a transparent, always-on-top window |
| 🔍 Activity detection | Monitors the active window / process every 2 s (PowerShell on Windows, xdotool on Linux, AppleScript on macOS) |
| 🎭 5 animated states | **idle**, **active**, **typing**, **coding** (IDE detected), **sleeping** (system idle > 2 min) |
| 📊 Daily recap | End-of-day summary with time per app and time per category — accessible from the tray icon |
| 🖱️ Draggable | Click-drag the character anywhere on screen; transparent pixels remain fully click-through |
| 🔔 System tray | Right-click the tray icon to toggle visibility, open the recap, or quit |
| 🚀 Launch at startup | Toggle "Launch at startup" in the tray menu (uses `app.setLoginItemSettings`) |

![Daily recap window](https://github.com/user-attachments/assets/34efb18d-c105-466f-85d3-f1bd541b2c6b)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- Windows 10/11 (primary target), macOS, or Linux (with `xdotool` installed)

### Install & run

```bash
git clone https://github.com/Qrytics/littleGuy.git
cd littleGuy
npm install
npm start
```

The character overlay appears in the bottom-right corner of your primary display.  
Right-click the system-tray icon (blue circle) for the full menu.

### Build a distributable (Windows)

```bash
npm run build
```

This uses **electron-builder** to produce an NSIS installer in `dist/`.

## Project layout

```
littleGuy/
├── main.js                 # Electron main process — window creation, tray, IPC, monitoring loop
├── preload.js              # contextBridge IPC surface exposed to renderer
└── src/
    ├── activity-monitor.js # OS window polling + activity state classifier
    ├── activity-logger.js  # In-memory accumulator → JSON log (userData folder)
    ├── sprites.js          # Pixel-art frame data for all 5 states
    ├── index.html          # Overlay window (transparent, frameless)
    ├── styles.css          # Pixelated canvas styles
    ├── renderer.js         # Canvas animation engine + drag + click-through logic
    ├── recap.html          # End-of-day recap window
    └── recap-renderer.js   # Recap data renderer (bar charts + table)
```

## Activity states

| State | Trigger | Animation |
|-------|---------|-----------|
| `idle` | No recognised process | Character stands, blinks occasionally |
| `active` | Any foreground app | Eyes look left ↔ right |
| `typing` | Word processor, email client, messaging app | Hands alternate typing motion |
| `coding` | IDE / code editor detected | Wide excited eyes, big smile, green glow |
| `sleeping` | System idle ≥ 2 minutes | Eyes closed, floating Zzz letters |

## Activity log

Logs are stored in JSON format at:

- **Windows**: `%APPDATA%\little-guy\activity-log.json`
- **macOS**: `~/Library/Application Support/little-guy/activity-log.json`
- **Linux**: `~/.config/little-guy/activity-log.json`

The last **30 days** of data are retained. Each day stores per-app durations and category totals.

## Customising sprites

Sprite pixel data lives in `src/sprites.js`. Each state is an array of frames; each frame is a `16 × 10` array of colour indices (`0` = transparent). To use real image assets, replace the `drawSprite()` function in `src/renderer.js` with canvas `drawImage()` calls pointing to your sprite sheet.
