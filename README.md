# littleGuy

> A tiny always-on-top pixel-art companion that watches what you're doing and reacts in real time.

![Character states](https://github.com/user-attachments/assets/3ab5dfb9-0ce9-48e7-b54c-31849f283cc4)

## Features

| Feature | Details |
|---------|---------|
| 🎮 Pixel-art overlay | 10 × 16 px character rendered at 4× scale on a transparent, always-on-top window |
| 🔍 Activity detection | Monitors the **focused** window every 2 s with proper Win32 API (`GetForegroundWindow`) — no more wrong-process detection |
| 🎭 Activity states | **idle**, **active**, **typing**, **coding** (IDE/code site detected), **sleeping** (system idle > 2 min) |
| 🎪 Idle animations | Multiple idle sub-animations cycle automatically: wave, look around, stretch, excited — plus base idle blink |
| 🚶 Walking mode | Toggle from tray — companion drifts and bounces across your screen with a stepping animation |
| 💬 Dialogue bubbles | Random state-aware speech bubbles appear above the companion's head |
| 👫 Multiple companions | Spawn as many companions as you like; each can have its own name, color theme, and position |
| 🤝 Buddy interactions | Two companions within 200 px of each other automatically wave at each other |
| ✏️ Rename companions | Name each companion via the tray menu — name is shown above the character and saved across restarts |
| 🎨 Companion types | Choose from 5 built-in color themes: Classic Blue, Purple Pal, Orange Buddy, Red Ranger, Forest Friend |
| 🎮 Minigame | Right-click the companion (or use tray) to play **Whack-a-Guy** — 30-second click game |
| ❤️ Petting | Left-click the companion to pet it — a floating heart appears |
| 📊 Daily recap | End-of-day summary with time per app and time per category |
| 🖱️ Draggable | Click-drag anywhere; transparent pixels stay click-through |
| 🔔 System tray | Full tray menu with companion management, settings, and quick actions |
| 🚀 Launch at startup | Toggle "Launch at startup" in the tray menu |
| 🔧 Fully customizable | See [CUSTOMIZATION.md](CUSTOMIZATION.md) for a complete guide to creating your own companion |

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

The companion overlay appears in the bottom-right corner of your primary display.  
Right-click the system-tray icon (blue circle) for the full menu.

### Build a distributable (Windows)

```bash
npm run build
```

This uses **electron-builder** to produce an NSIS installer in `dist/`.

## Tray menu guide

```
littleGuy
  Status: <current state>
  ──────────────────────────────
  🐾 littleGuy       ► Rename…
                     ► Companion Type (radio: Classic, Purple, Orange…)
                     ► Show / Hide
                     ► Remove companion
  Add New Companion
  ──────────────────────────────
  Walking Mode        [checkbox]
  Dialogue Bubbles    [checkbox]
  ──────────────────────────────
  Daily Recap
  Play Minigame
  Open log folder
  ──────────────────────────────
  Launch at startup   [checkbox]
  ──────────────────────────────
  Quit
```

## Activity states

| State | Trigger | Animation |
|-------|---------|-----------|
| `idle` | No recognised process | Blink + rotating sub-animations (wave, look, stretch, excited) |
| `active` | Any foreground app | Eyes look left ↔ right |
| `typing` | Word processor, email, messaging, docs | Hands alternate typing motion |
| `coding` | IDE / code editor / coding website | Wide excited eyes, big smile, green glow |
| `sleeping` | System idle ≥ 2 minutes | Eyes closed, floating Zzz letters |
| `walking` | Walking mode enabled | Stepping animation, flips horizontally on direction change |
| `greeting` | Another companion is nearby | Waving animation |

### Detected coding tools

VS Code · Cursor · Zed · Windsurf · Helix · Fleet · Vim/Neovim · Emacs · Sublime Text · all JetBrains IDEs · Eclipse · NetBeans · Xcode · Android Studio · and more.

GitHub, GitLab, CodePen, LeetCode, Replit, StackBlitz, and other coding sites in the browser are also recognized.

### Detected typing apps

Word · Pages · Notion · Obsidian · Logseq · Typora · Bear · Craft · Slack · Discord · Teams · Outlook · Thunderbird · LibreOffice · and more.

## Activity log

Logs are stored in JSON format at:

- **Windows**: `%APPDATA%\little-guy\activity-log.json`
- **macOS**: `~/Library/Application Support/little-guy/activity-log.json`
- **Linux**: `~/.config/little-guy/activity-log.json`

Companion configuration is stored at `companion-config.json` in the same folder.

The last **30 days** of activity data are retained.

## Customizing sprites

See **[CUSTOMIZATION.md](CUSTOMIZATION.md)** for a complete step-by-step guide covering:
- How the pixel-art sprite grid works
- Creating new animation frames and body variants
- Adding idle sub-animations
- Creating custom companion color themes
- Writing your own dialogue lines
- Adding new activity states
- Using real PNG image assets

## Project layout

```
littleGuy/
├── main.js                    # Electron main process
│                              #   multi-companion management, tray, activity loop,
│                              #   walking, dialogue, buddy interactions, IPC
├── preload.js                 # contextBridge IPC surface
├── CUSTOMIZATION.md           # Full customization guide
└── src/
    ├── activity-monitor.js    # OS window polling + state classifier
    ├── activity-logger.js     # Session tracking → JSON log
    ├── companion-store.js     # Companion config + type palette persistence
    ├── sprites.js             # All pixel-art frame data
    ├── renderer.js            # Canvas animation engine + drag + interactions
    ├── index.html             # Overlay window (transparent, frameless)
    ├── styles.css             # Overlay window CSS
    ├── recap.html             # Daily recap window
    ├── recap-renderer.js      # Recap charts and table
    ├── minigame.html          # Whack-a-Guy minigame window
    └── minigame-renderer.js   # Minigame logic
```
