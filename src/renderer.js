'use strict';

/**
 * renderer.js
 *
 * Runs inside the transparent overlay BrowserWindow.
 * Responsibilities:
 *   • Render the pixel-art character onto a <canvas> at a 4× scale.
 *   • Animate frames at a fixed tick rate, varying speed per state.
 *   • React to state-change IPC messages from the main process.
 *   • Allow the user to drag the overlay by mouse.
 *   • Enable click-through for transparent pixels.
 */

// ─── Sprite data (loaded via CommonJS require-like pattern via script tag) ────
// sprites.js is in the same folder; in Electron's renderer (file: context)
// we can use require if nodeIntegration is on, but here we embed the data
// inline to stay compatible with contextIsolation=true / nodeIntegration=false.
// The data is duplicated here intentionally to avoid needing nodeIntegration.

const _ = 0, H = 1, S = 2, E = 3, M = 4, T = 5, P = 6, B = 7; // Z=8 unused in pixel grid

const SPRITE_COLORS = [
  null,       // 0 transparent
  '#3D2314',  // 1 H hair
  '#FFCD94',  // 2 S skin
  '#111111',  // 3 E eye
  '#EE8080',  // 4 M mouth
  '#4169E1',  // 5 T shirt
  '#2D5016',  // 6 P pants
  '#222222',  // 7 B shoe
  '#AAAAEE',  // 8 Z zzz
  '#7CFC00',  // 9 G glow
];

// Shared body rows
const BODY_NORMAL = [
  [_, T, T, T, T, T, T, T, T, _],
  [S, T, T, T, T, T, T, T, T, S],
  [S, T, T, T, T, T, T, T, T, S],
  [_, T, T, T, T, T, T, T, T, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
];

const BODY_TYPING_L = [
  [_, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, S],
  [S, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
];

const BODY_TYPING_R = [
  [_, T, T, T, T, T, T, T, T, _],
  [S, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, S],
  [_, T, T, T, T, T, T, T, T, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
];

const BODY_RELAXED = [
  [_, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, _],
  [_, T, T, T, T, T, T, T, T, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, P, P, _, P, P, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
  [_, _, B, B, _, B, B, _, _, _],
];

const EYES_OPEN   = [_, H, S, E, S, E, S, H, _, _];
const EYES_CLOSED = [_, H, S, H, S, H, S, H, _, _];
const EYES_WIDE   = [_, H, E, E, S, E, E, H, _, _];
const EYES_LOOK_L = [_, H, S, E, E, S, S, H, _, _];
const EYES_LOOK_R = [_, H, S, S, S, E, E, H, _, _];

const MOUTH_SMILE  = [_, H, S, M, M, M, S, H, _, _];
const MOUTH_BIG    = [_, H, M, M, M, M, M, H, _, _];
const MOUTH_FOCUS  = [_, H, S, S, M, S, S, H, _, _];
const MOUTH_NONE   = [_, H, S, S, S, S, S, H, _, _];

const HEAD_TOP = [
  [_, _, H, H, H, H, H, _, _, _],
  [_, H, H, H, H, H, H, H, _, _],
  [_, H, S, S, S, S, S, H, _, _],
];
const NOSE_GAP = [_, H, S, S, S, S, S, H, _, _];

function makeFrame(eyes, mouth, body) {
  return [
    ...HEAD_TOP,
    eyes,
    NOSE_GAP,
    mouth,
    ...body,
  ];
}

const SPRITES = {
  idle: [
    makeFrame(EYES_OPEN,   MOUTH_SMILE,  BODY_NORMAL),
    makeFrame(EYES_CLOSED, MOUTH_SMILE,  BODY_NORMAL),
  ],
  active: [
    makeFrame(EYES_LOOK_L, MOUTH_FOCUS,  BODY_NORMAL),
    makeFrame(EYES_LOOK_R, MOUTH_FOCUS,  BODY_NORMAL),
  ],
  typing: [
    makeFrame(EYES_OPEN,   MOUTH_FOCUS,  BODY_TYPING_L),
    makeFrame(EYES_OPEN,   MOUTH_FOCUS,  BODY_TYPING_R),
  ],
  coding: [
    makeFrame(EYES_WIDE,   MOUTH_BIG,    BODY_TYPING_L),
    makeFrame(EYES_WIDE,   MOUTH_BIG,    BODY_TYPING_R),
  ],
  sleeping: [
    makeFrame(EYES_CLOSED, MOUTH_NONE,   BODY_RELAXED),
    makeFrame(EYES_CLOSED, MOUTH_NONE,   BODY_RELAXED),
  ],
};

// ─── Canvas setup ─────────────────────────────────────────────────────────────

const SCALE = 4;          // pixels per sprite pixel
const CHAR_W = 10;        // sprite columns
const CHAR_H = 16;        // sprite rows
const CANVAS_W = 80;      // canvas width  (must match HTML attr)
const CANVAS_H = 100;     // canvas height
const CHAR_X = Math.floor((CANVAS_W - CHAR_W * SCALE) / 2);  // 20
const CHAR_Y = CANVAS_H - CHAR_H * SCALE;                    // 100 - 64 = 36

const canvas = document.getElementById('character');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ─── Animation state ──────────────────────────────────────────────────────────

const FRAME_MS = {
  idle:     800,
  active:   600,
  typing:   220,
  coding:   260,
  sleeping: 1800,
};

let currentState = 'idle';
let currentFrame = 0;
let lastFrameTime = 0;
let animRAF = null;

// Sleeping Zzz animation
let zzzOffset = 0;
let zzzTick = 0;

// ─── Drawing ──────────────────────────────────────────────────────────────────

function drawSprite(frame) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw sleeping Zzz effect above the character's head
  if (currentState === 'sleeping') {
    drawZzz();
  }

  // Draw coding glow beneath the character
  if (currentState === 'coding') {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#7CFC00';
    ctx.fillRect(CHAR_X - 4, CHAR_Y, CHAR_W * SCALE + 8, CHAR_H * SCALE);
    ctx.restore();
  }

  // Draw the sprite pixel by pixel
  for (let row = 0; row < CHAR_H; row++) {
    const pixelRow = frame[row];
    if (!pixelRow) continue;
    for (let col = 0; col < CHAR_W; col++) {
      const colorIdx = pixelRow[col];
      if (!colorIdx) continue; // transparent
      ctx.fillStyle = SPRITE_COLORS[colorIdx];
      ctx.fillRect(
        CHAR_X + col * SCALE,
        CHAR_Y + row * SCALE,
        SCALE,
        SCALE
      );
    }
  }
}

function drawZzz() {
  const t = zzzTick;
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#AAAAEE';

  // Three Zzz letters at different positions / opacities
  const letters = [
    { text: 'z', x: CHAR_X + 38, y: CHAR_Y - 4  + zzzOffset, alpha: 0.5, size: 8 },
    { text: 'z', x: CHAR_X + 44, y: CHAR_Y - 14 + zzzOffset, alpha: 0.7, size: 10 },
    { text: 'Z', x: CHAR_X + 50, y: CHAR_Y - 26 + zzzOffset, alpha: 0.9, size: 13 },
  ];

  for (const ltr of letters) {
    ctx.save();
    ctx.globalAlpha = ltr.alpha * Math.max(0.3, Math.sin(t * 0.05 + ltr.size));
    ctx.font = `bold ${ltr.size}px monospace`;
    ctx.fillStyle = '#AAAAEE';
    ctx.fillText(ltr.text, ltr.x, ltr.y);
    ctx.restore();
  }

  zzzTick++;
  // Float upward then reset
  zzzOffset = -(zzzTick % 60) * 0.3;
}

// ─── Animation loop ───────────────────────────────────────────────────────────

function animate(timestamp) {
  animRAF = requestAnimationFrame(animate);

  const interval = FRAME_MS[currentState] || 600;
  if (timestamp - lastFrameTime < interval) return;
  lastFrameTime = timestamp;

  const frames = SPRITES[currentState] || SPRITES.idle;
  currentFrame = (currentFrame + 1) % frames.length;
  drawSprite(frames[currentFrame]);
}

// Kick off
drawSprite(SPRITES.idle[0]);
animRAF = requestAnimationFrame(animate);

// ─── State changes ────────────────────────────────────────────────────────────

if (window.electronAPI) {
  window.electronAPI.onStateChange(({ state }) => {
    if (state !== currentState) {
      currentState = state;
      currentFrame = 0;
      zzzTick = 0;
      zzzOffset = 0;
    }
  });
}

// ─── Drag to reposition ───────────────────────────────────────────────────────

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) {
    // Determine click-through based on whether the pixel is opaque
    const rect = canvas.getBoundingClientRect();
    const cx = Math.floor(e.clientX - rect.left);
    const cy = Math.floor(e.clientY - rect.top);
    if (cx >= 0 && cy >= 0 && cx < CANVAS_W && cy < CANVAS_H) {
      const pixel = ctx.getImageData(cx, cy, 1, 1).data;
      const isOpaque = pixel[3] > 10;
      if (window.electronAPI) window.electronAPI.setClickThrough(!isOpaque);
    }
    return;
  }

  const dx = e.screenX - dragStartX;
  const dy = e.screenY - dragStartY;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  if (window.electronAPI) window.electronAPI.moveWindow(dx, dy);
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});
