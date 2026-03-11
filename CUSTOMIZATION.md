# Customizing Your littleGuy

> This guide explains everything you need to create your own companion character, add new animations, customize colors, write dialogue, and extend the app however you like.

---

## Table of Contents

1. [How sprites work](#1-how-sprites-work)
2. [Color palette](#2-color-palette)
3. [Creating a new animation frame](#3-creating-a-new-animation-frame)
4. [Adding a new idle animation](#4-adding-a-new-idle-animation)
5. [Creating a new companion type (color theme)](#5-creating-a-new-companion-type-color-theme)
6. [Changing the companion's dialogue](#6-changing-the-companions-dialogue)
7. [Adding a new activity state](#7-adding-a-new-activity-state)
8. [Using real image assets instead of pixel art](#8-using-real-image-assets-instead-of-pixel-art)
9. [Project layout reference](#9-project-layout-reference)

---

## 1. How sprites work

Every animation frame is a **16-row × 10-column** 2-D array of color indices.

```
Row 0  →  top of the character's head
Row 15 →  bottom of the feet
Col 0  →  left edge
Col 9  →  right edge
```

Each cell contains a number:

| Index | Constant | Default color | Meaning          |
|-------|----------|---------------|------------------|
| 0     | `_`      | transparent   | empty pixel      |
| 1     | `H`      | `#3D2314`     | hair             |
| 2     | `S`      | `#FFCD94`     | skin             |
| 3     | `E`      | `#111111`     | eyes / outline   |
| 4     | `M`      | `#EE8080`     | mouth            |
| 5     | `T`      | `#4169E1`     | shirt            |
| 6     | `P`      | `#2D5016`     | pants            |
| 7     | `B`      | `#222222`     | shoes            |
| 8     | `Z`      | `#AAAAEE`     | Zzz glyph        |
| 9     | `G`      | `#7CFC00`     | coding glow      |

Each pixel is rendered at **4× scale** on the canvas, so the final character occupies 40 × 64 pixels on screen.

---

## 2. Color palette

Colors are defined in `src/sprites.js` inside `SPRITE_COLORS`:

```js
const SPRITE_COLORS = [
  null,       // 0 – transparent
  '#3D2314',  // 1 – hair
  '#FFCD94',  // 2 – skin
  '#111111',  // 3 – eyes
  '#EE8080',  // 4 – mouth
  '#4169E1',  // 5 – shirt
  '#2D5016',  // 6 – pants
  '#222222',  // 7 – shoes
  '#AAAAEE',  // 8 – Zzz
  '#7CFC00',  // 9 – glow
];
```

You can edit any of these hex values and the change will immediately affect every frame that uses that index.

---

## 3. Creating a new animation frame

Here is a minimal example — a character standing with arms raised:

```js
// src/sprites.js

const BODY_ARMS_UP = [
  [_, T, T, T, T, T, T, T, T, _],
  [S, S, T, T, T, T, T, S, S, _],   // both arms raised high
  [_, _, T, T, T, T, T, _, _, _],
  [_, T, T, T, T, T, T, T, T, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
];
```

Then build a complete frame by combining a head + body:

```js
const MY_FRAME = [
  ...head(EYES_WIDE),   // 6 rows of head
  MOUTH_BIG,            // 1 row (row 5)
  ...BODY_ARMS_UP,      // 10 rows of body (rows 6–15)
];
```

**Row count must always be exactly 16.**

---

## 4. Adding a new idle animation

Idle sub-animations play automatically every ~8 base-idle loops.  
They are defined in `src/sprites.js` under the `SPRITES` object and **must start with `idle_`**.

### Step 1 — Add frames to `SPRITES`:

```js
// src/sprites.js  →  inside SPRITES object:

idle_dance: [
  // frame 0 – lean left
  mf(EYES_OPEN, MOUTH_SMILE, BODY_WALK_L),
  // frame 1 – center
  mf(EYES_OPEN, MOUTH_SMILE, BODY_NORMAL),
  // frame 2 – lean right
  mf(EYES_OPEN, MOUTH_SMILE, BODY_WALK_R),
  // frame 3 – center + blink
  mf(EYES_CLOSED, MOUTH_SMILE, BODY_NORMAL),
],
```

### Step 2 — Register in the renderer cycle:

Open `src/renderer.js` and find `IDLE_SUB_ANIMS`:

```js
// src/renderer.js
const IDLE_SUB_ANIMS = ['idle_wave','idle_look','idle_stretch','idle_excited'];
```

Add your new key:

```js
const IDLE_SUB_ANIMS = ['idle_wave','idle_look','idle_stretch','idle_excited','idle_dance'];
```

### Step 3 — Set timing (optional):

In `src/renderer.js`, add an entry to `FRAME_MS`:

```js
const FRAME_MS = {
  // ...existing entries...
  idle_dance: 250,   // milliseconds per frame
};
```

That's it! The animation will appear automatically during idle state.

---

## 5. Creating a new companion type (color theme)

Companion types are color palettes defined in `src/companion-store.js`:

```js
// src/companion-store.js  →  inside COMPANION_TYPES:

cyberpunk: {
  label: 'Cyberpunk',
  hair:  '#FF00FF',
  skin:  '#FFCD94',
  shirt: '#00FFFF',
  pants: '#1A1A3E',
  shoes: '#FF6600',
},
```

After adding your type here, it will automatically appear in the tray menu under each companion's **"Companion Type"** submenu.

---

## 6. Changing the companion's dialogue

Dialogue lines are stored in `main.js` inside `DIALOGUE_LINES`:

```js
const DIALOGUE_LINES = {
  idle:    ['...', 'Hmm.', '*yawns*', "What's up?"],
  active:  ['Interesting!', 'You got this!'],
  typing:  ['Click clack!', 'Type type type!'],
  coding:  ['Nice code!', "You're on fire!"],
  sleeping:['Zzz…', 'Nap time…'],
  walking: ['La la la~', 'Just walking 🐾'],
};
```

Add, remove, or edit any lines. Emoji are fully supported. Lines are chosen at random.

To change **how often** dialogue appears, edit the interval in `setupDialogueLoop()`:

```js
// Random 45–120 second intervals
const ms = 45_000 + Math.random() * 75_000;
```

---

## 7. Adding a new activity state

1. **Define the detection logic** in `src/activity-monitor.js`:
   ```js
   // Example: detect a game engine
   const GAME_ENGINE_PROCESSES = new Set(['unity', 'godot', 'unrealengine']);
   
   // In classifyActivity():
   if (GAME_ENGINE_PROCESSES.has(proc)) return 'gaming';
   ```

2. **Add sprite frames** in `src/sprites.js`:
   ```js
   SPRITES.gaming = [
     mf(EYES_WIDE, MOUTH_BIG, BODY_WAVE_UP),
     mf(EYES_WIDE, MOUTH_BIG, BODY_WAVE_OPEN),
   ];
   ```

3. **Add frame timing** in `src/renderer.js`:
   ```js
   const FRAME_MS = { ..., gaming: 200 };
   ```

4. **Add dialogue lines** in `main.js`:
   ```js
   const DIALOGUE_LINES = { ..., gaming: ['Game on! 🎮', 'Git gud!'] };
   ```

5. **Add activity logger category** (optional) in `src/activity-logger.js` if you want it tracked in the recap.

---

## 8. Using real image assets instead of pixel art

If you want to use PNG sprite sheets instead of the pixel grid:

1. Place your sprite sheet at e.g. `src/assets/my-companion.png`
2. Update the `Content-Security-Policy` in `src/index.html` to allow the image:
   ```html
   content="default-src 'self'; img-src 'self' file:;"
   ```
3. Replace the `drawSprite()` function in `src/renderer.js`:

```js
// Load your sprite sheet
const spriteSheet = new Image();
spriteSheet.src = './assets/my-companion.png';

// Each animation frame is a region of the sheet
const FRAME_RECTS = {
  idle:   [{ x:0, y:0, w:40, h:64 }, { x:40, y:0, w:40, h:64 }],
  coding: [{ x:0, y:64, w:40, h:64 }],
  // ... etc.
};

function drawSprite(state, frameIndex) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const rect = FRAME_RECTS[state][frameIndex];
  if (!rect) return;
  ctx.drawImage(spriteSheet, rect.x, rect.y, rect.w, rect.h,
                CHAR_X, CHAR_Y, rect.w, rect.h);
}
```

---

## 9. Project layout reference

```
littleGuy/
├── main.js                    # Electron main process
│                              #   — companion windows, tray, IPC, activity loop,
│                              #     walking, dialogue, buddy interactions
│
├── preload.js                 # IPC bridge (contextBridge) — keep in sync with main.js
│
├── src/
│   ├── activity-monitor.js    # OS window polling + activity state classifier
│   │                          #   → Edit IDE_PROCESSES / TYPING_PROCESSES to add apps
│   │
│   ├── activity-logger.js     # Session tracking → JSON persistence in userData
│   │
│   ├── companion-store.js     # Companion config persistence (name, type, position)
│   │                          #   → COMPANION_TYPES: add new color themes here
│   │
│   ├── sprites.js             # All pixel-art frame data
│   │                          #   → SPRITES object: add/modify animation frames here
│   │
│   ├── renderer.js            # Canvas animation engine (runs in overlay window)
│   │                          #   → IDLE_SUB_ANIMS: register new idle animations
│   │                          #   → FRAME_MS: set per-state animation speed
│   │
│   ├── index.html             # Overlay window HTML (transparent, frameless)
│   ├── styles.css             # Overlay window CSS
│   │
│   ├── recap.html             # Daily recap window
│   ├── recap-renderer.js      # Recap charts and table
│   │
│   ├── minigame.html          # Whack-a-Guy minigame window
│   └── minigame-renderer.js   # Minigame logic
│
└── .github/workflows/ci.yml   # GitHub Actions CI (lint, test, build)
```

---

## Quick-start checklist for a brand-new companion

- [ ] Add a new entry to `COMPANION_TYPES` in `src/companion-store.js`
- [ ] Add body / head variants to `src/sprites.js` if you want unique shapes
- [ ] Add your frames to the `SPRITES` object in `src/sprites.js`
- [ ] Register new idle sub-animations in `IDLE_SUB_ANIMS` in `src/renderer.js`
- [ ] Add dialogue lines to `DIALOGUE_LINES` in `main.js`
- [ ] Select your new type from the tray menu: **🐾 [name] → Companion Type**

Happy customizing! 🐾
