# littleGuy

> A tiny always-on-top pixel-art companion that watches what you're doing and reacts in real time.

![Character states](https://github.com/user-attachments/assets/3ab5dfb9-0ce9-48e7-b54c-31849f283cc4)

## Tech Stack

| System Layer | Technology | Justification |
|---|---|---|
| **Systems Core** | Rust (Tokio) | Memory safety without GC; sub-millisecond cold starts |
| **Frontend Shell** | Tauri v2 | 90% reduction in RAM usage vs. Electron; native Webviews |
| **Persistence (Write)** | SQLite (WAL) | High-frequency transactional writes with zero configuration |
| **Persistence (Read)** | DuckDB | 100× faster analytical queries for habit insights |
| **Animation Engine** | Vello / ThorVG | GPU-accelerated vector rendering for the overlay character |
| **UI Framework** | React / TypeScript | Mature ecosystem for complex dashboard development |
| **Telemetry APIs** | Windows UIA / DBus | Sub-millisecond URL extraction without browser extensions |
| **IPC Bridge** | Unix Sockets / Pipes | Low-latency communication between daemon and overlay |

## Features

| Feature | Details |
|---------|---------|
| 🎮 Pixel-art overlay | 10 × 16 px character rendered at 4× scale on a transparent, always-on-top window |
| 🔍 Activity detection | Monitors the **focused** window every 2 s — Windows UIA / DBus APIs, no polling overhead |
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
| 📊 Daily recap | End-of-day summary with time per app and time per category (powered by DuckDB analytics) |
| 🖱️ Draggable | Click-drag anywhere; transparent pixels stay click-through |
| 🔔 System tray | Full tray menu with companion management, settings, and quick actions |
| 🚀 Launch at startup | Toggle "Launch at startup" in the tray menu |
| 🔧 Fully customizable | See [CUSTOMIZATION.md](CUSTOMIZATION.md) for a complete guide to creating your own companion |

![Daily recap window](https://github.com/user-attachments/assets/34efb18d-c105-466f-85d3-f1bd541b2c6b)

## Getting started

### Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) 18 or later
- **Linux only**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `patchelf`
- Windows 10/11 (primary target), macOS, or Linux (with `xdotool` / `xprintidle` for idle detection)

### Install & run (development)

```bash
git clone https://github.com/Qrytics/littleGuy.git
cd littleGuy
npm install
npm run tauri:dev
```

The companion overlay appears in the bottom-right corner of your primary display.  
Right-click the system-tray icon for the full menu.

### Build a distributable

```bash
# Windows (NSIS installer)
npm run tauri:build:win

# Linux (AppImage)
npm run tauri:build:linux
```

Artifacts are placed in `src-tauri/target/<target>/release/bundle/`.

## Tray menu guide

```
littleGuy
  Show / Hide
  Walking Mode
  Daily Recap
  Whack-a-Guy
  Add Companion
  ──────────────
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

Activity data is stored in **SQLite (WAL mode)** for writes and queried with **DuckDB** for analytics:

- **Windows**: `%APPDATA%\little-guy\activity.db`
- **macOS**: `~/Library/Application Support/little-guy/activity.db`
- **Linux**: `~/.config/little-guy/activity.db`

Companion configuration is stored in `companions.db` in the same folder.

## Project layout

```
littleGuy/
├── src-tauri/                    # Rust backend (Tauri v2 + Tokio)
│   ├── src/
│   │   ├── main.rs               # Tauri app entry point
│   │   ├── lib.rs                # App builder, setup, tray, activity loop
│   │   ├── activity_monitor.rs   # Windows UIA / DBus / xdotool telemetry
│   │   ├── activity_logger.rs    # SQLite WAL write path (session recording)
│   │   ├── analytics.rs          # DuckDB read path (recap / habit insights)
│   │   ├── companion_store.rs    # Companion config via SQLite
│   │   ├── animation.rs          # Vello/ThorVG SVG-based animation engine
│   │   ├── ipc_bridge.rs         # Unix socket / named pipe IPC bridge
│   │   └── commands.rs           # Tauri invoke command handlers
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # React / TypeScript frontend
│   ├── main.tsx                  # Overlay window entry
│   ├── recap-main.tsx            # Recap window entry
│   ├── minigame-main.tsx         # Minigame window entry
│   ├── types.ts                  # Shared TypeScript types
│   ├── components/
│   │   ├── Overlay.tsx           # Companion overlay (canvas animation + drag)
│   │   ├── Recap.tsx             # Daily recap dashboard
│   │   └── Minigame.tsx          # Whack-a-Guy minigame
│   ├── animation/
│   │   └── engine.ts             # Client-side animation engine (Vello-inspired)
│   ├── sprites/
│   │   └── sprites.ts            # Pixel-art sprite data (TypeScript)
│   └── hooks/
│       └── useTauri.ts           # Tauri event subscription hooks
├── index.html                    # Overlay window HTML (Vite entry)
├── recap.html                    # Recap window HTML
├── minigame.html                 # Minigame window HTML
├── vite.config.ts                # Vite bundler config
├── tsconfig.json                 # TypeScript config
├── package.json                  # Node dependencies
└── CUSTOMIZATION.md              # Full customization guide
```
