'use strict';

/**
 * renderer.js
 *
 * Runs inside the transparent overlay BrowserWindow.
 * Responsibilities:
 *   • Render the pixel-art character on a <canvas> at 4× scale.
 *   • Cycle through multiple idle sub-animations automatically.
 *   • Support walking mode (stepping animation, direction flipping).
 *   • Show random speech-bubble dialogue above the character.
 *   • React to activity-state, companion-config, walking, dialogue,
 *     and buddy-nearby IPC messages from the main process.
 *   • Allow the user to drag the overlay by mouse.
 *   • Enable click-through for transparent pixels.
 *   • Handle left-click for petting and right-click to open minigame.
 */

// ─── Sprite data (embedded to avoid nodeIntegration) ─────────────────────────

const _ = 0, H = 1, S = 2, E = 3, M = 4, T = 5, P = 6, B = 7;

/* Default color palette — overridden per companion type via IPC */
let SPRITE_COLORS = [
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

// Body variants
const BODY_NORMAL = [
  [_,T,T,T,T,T,T,T,T,_],[S,T,T,T,T,T,T,T,T,S],[S,T,T,T,T,T,T,T,T,S],[_,T,T,T,T,T,T,T,T,_],
  [_,_,P,P,_,P,P,_,_,_],[_,_,P,P,_,P,P,_,_,_],[_,_,P,P,_,P,P,_,_,_],[_,_,P,P,_,P,P,_,_,_],
  [_,_,B,B,_,B,B,_,_,_],[_,_,B,B,_,B,B,_,_,_],
];
const BODY_TYPING_L = [
  [_,T,T,T,T,T,T,T,T,_],[_,T,T,T,T,T,T,T,T,S],[S,T,T,T,T,T,T,T,T,_],[_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];
const BODY_TYPING_R = [
  [_,T,T,T,T,T,T,T,T,_],[S,T,T,T,T,T,T,T,T,_],[_,T,T,T,T,T,T,T,T,S],[_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];
const BODY_RELAXED = [
  [_,T,T,T,T,T,T,T,T,_],[_,T,T,T,T,T,T,T,T,_],[_,T,T,T,T,T,T,T,T,_],[_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];
const BODY_WAVE_UP = [
  [_,T,T,T,T,T,T,T,T,_],[S,T,T,T,T,T,T,T,S,_],[_,T,T,T,T,T,T,S,_,_],[_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];
const BODY_WAVE_OPEN = [
  [_,T,T,T,T,T,T,T,T,S],[S,T,T,T,T,T,T,T,S,_],[_,T,T,T,T,T,T,_,_,_],[_,T,T,T,T,T,T,T,T,_],
  ...BODY_NORMAL.slice(4),
];
const BODY_STRETCH = [
  [_,T,T,T,T,T,T,T,T,_],[S,T,T,T,T,T,T,T,T,S],[S,T,T,T,T,T,T,T,T,S],[S,T,T,T,T,T,T,T,T,S],
  ...BODY_NORMAL.slice(4),
];
const BODY_WALK_L = [
  [_,T,T,T,T,T,T,T,T,_],[S,T,T,T,T,T,T,T,T,_],[_,T,T,T,T,T,T,T,T,S],[_,T,T,T,T,T,T,T,T,_],
  [_,_,P,P,_,P,P,_,_,_],[_,_,P,P,_,P,P,_,_,_],[_,P,P,_,_,P,P,_,_,_],[_,P,P,_,_,_,P,P,_,_],
  [_,B,B,_,_,_,B,B,_,_],[B,B,_,_,_,_,B,B,_,_],
];
const BODY_WALK_R = [
  [_,T,T,T,T,T,T,T,T,_],[S,T,T,T,T,T,T,T,T,_],[_,T,T,T,T,T,T,T,T,S],[_,T,T,T,T,T,T,T,T,_],
  [_,_,P,P,_,P,P,_,_,_],[_,_,P,P,_,P,P,_,_,_],[_,_,P,P,_,_,P,P,_,_],[_,_,P,P,_,P,P,_,_,_],
  [_,_,B,B,_,_,B,B,_,_],[_,_,B,B,_,B,B,B,_,_],
];

// Head helpers
const HEAD_TOP  = [[_,_,H,H,H,H,H,_,_,_],[_,H,H,H,H,H,H,H,_,_],[_,H,S,S,S,S,S,H,_,_]];
const NOSE_GAP  = [_,H,S,S,S,S,S,H,_,_];
const EYES_OPEN   = [_,H,S,E,S,E,S,H,_,_];
const EYES_CLOSED = [_,H,S,H,S,H,S,H,_,_];
const EYES_WIDE   = [_,H,E,E,S,E,E,H,_,_];
const EYES_LOOK_L = [_,H,S,E,E,S,S,H,_,_];
const EYES_LOOK_R = [_,H,S,S,S,E,E,H,_,_];
const MOUTH_SMILE = [_,H,S,M,M,M,S,H,_,_];
const MOUTH_BIG   = [_,H,M,M,M,M,M,H,_,_];
const MOUTH_FOCUS = [_,H,S,S,M,S,S,H,_,_];
const MOUTH_NONE  = [_,H,S,S,S,S,S,H,_,_];
const MOUTH_OH    = [_,H,S,M,S,M,S,H,_,_];
const MOUTH_GRIN  = [_,H,M,S,M,S,M,H,_,_];

function makeFrame(eyes, mouth, body) {
  return [...HEAD_TOP, eyes, NOSE_GAP, mouth, ...body];
}

const SPRITES = {
  idle:         [makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_NORMAL), makeFrame(EYES_CLOSED,MOUTH_SMILE,BODY_NORMAL)],
  idle_wave:    [makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_WAVE_UP), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_WAVE_OPEN), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_WAVE_UP), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_NORMAL)],
  idle_stretch: [makeFrame(EYES_CLOSED,MOUTH_OH,BODY_NORMAL), makeFrame(EYES_CLOSED,MOUTH_OH,BODY_STRETCH), makeFrame(EYES_CLOSED,MOUTH_OH,BODY_STRETCH), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_NORMAL)],
  idle_look:    [makeFrame(EYES_LOOK_L,MOUTH_FOCUS,BODY_NORMAL), makeFrame(EYES_LOOK_L,MOUTH_FOCUS,BODY_NORMAL), makeFrame(EYES_LOOK_R,MOUTH_FOCUS,BODY_NORMAL), makeFrame(EYES_LOOK_R,MOUTH_FOCUS,BODY_NORMAL), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_NORMAL)],
  idle_excited: [makeFrame(EYES_WIDE,MOUTH_GRIN,BODY_NORMAL), makeFrame(EYES_WIDE,MOUTH_GRIN,BODY_NORMAL), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_NORMAL), makeFrame(EYES_CLOSED,MOUTH_SMILE,BODY_NORMAL)],
  active:       [makeFrame(EYES_LOOK_L,MOUTH_FOCUS,BODY_NORMAL), makeFrame(EYES_LOOK_R,MOUTH_FOCUS,BODY_NORMAL)],
  typing:       [makeFrame(EYES_OPEN,MOUTH_FOCUS,BODY_TYPING_L), makeFrame(EYES_OPEN,MOUTH_FOCUS,BODY_TYPING_R)],
  coding:       [makeFrame(EYES_WIDE,MOUTH_BIG,BODY_TYPING_L), makeFrame(EYES_WIDE,MOUTH_BIG,BODY_TYPING_R)],
  sleeping:     [makeFrame(EYES_CLOSED,MOUTH_NONE,BODY_RELAXED), makeFrame(EYES_CLOSED,MOUTH_NONE,BODY_RELAXED)],
  walking:      [makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_WALK_L), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_NORMAL), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_WALK_R), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_NORMAL)],
  greeting:     [makeFrame(EYES_WIDE,MOUTH_BIG,BODY_WAVE_UP), makeFrame(EYES_WIDE,MOUTH_BIG,BODY_WAVE_OPEN), makeFrame(EYES_WIDE,MOUTH_BIG,BODY_WAVE_UP), makeFrame(EYES_OPEN,MOUTH_SMILE,BODY_NORMAL)],
};

const IDLE_SUB_ANIMS = ['idle_wave','idle_look','idle_stretch','idle_excited'];

// ─── Canvas setup ─────────────────────────────────────────────────────────────

const SCALE    = 4;
const CHAR_W   = 10;
const CHAR_H   = 16;
const CANVAS_W = 80;
const CANVAS_H = 160;                                          // extra height above char for dialogue + name
const CHAR_X   = Math.floor((CANVAS_W - CHAR_W * SCALE) / 2); // 20
const CHAR_Y   = CANVAS_H - CHAR_H * SCALE;                   // 160 - 64 = 96

const canvas = document.getElementById('character');
const ctx    = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ─── State ────────────────────────────────────────────────────────────────────

const FRAME_MS = {
  idle:800, idle_wave:300, idle_stretch:500, idle_look:500, idle_excited:350,
  active:600, typing:220, coding:260, sleeping:1800, walking:280, greeting:350,
};

let currentState  = 'idle';
let currentFrame  = 0;
let lastFrameTime = 0;
let animRAF       = null;

// Idle sub-animation cycling
let idleSubIndex  = -1;   // -1 = base 'idle'
let idleSubFrame  = 0;
let idleSubTick   = 0;
let idleSubCycle  = 0;
const BASE_IDLE_LOOPS_BEFORE_SUBANIM = 8;

// Sleeping Zzz
let zzzOffset = 0;
let zzzTick   = 0;

// Dialogue bubble
let dialogueText = '';
let dialogueTick = 0;
const DIALOGUE_DURATION = 240;

// Greeting / buddy nearby
let greetingTick = 0;
const GREETING_DURATION = 80;

// Walking direction
let walkDir = 1;  // 1=right, -1=left

// Companion name
let companionName = '';

// Pet heart
let heartTick = 0;
const HEART_DURATION = 50;

// Walking state from main
let isWalking = false;

// ─── Color palette ────────────────────────────────────────────────────────────

function applyCompanionColors(colors) {
  if (!colors) return;
  const map = { hair:1, skin:2, shirt:5, pants:6, shoes:7 };
  for (const [key, idx] of Object.entries(map)) {
    if (colors[key]) SPRITE_COLORS[idx] = colors[key];
  }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

function drawSprite(frame) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (companionName) drawName();
  if (dialogueTick > 0) drawDialogue();
  if (currentState === 'sleeping') drawZzz();
  if (currentState === 'coding') {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#7CFC00';
    ctx.fillRect(CHAR_X - 4, CHAR_Y, CHAR_W * SCALE + 8, CHAR_H * SCALE);
    ctx.restore();
  }
  if (heartTick > 0) drawHeart();

  ctx.save();
  // Mirror sprite horizontally when walking left
  if (walkDir === -1 && isWalking) {
    ctx.scale(-1, 1);
    ctx.translate(-CANVAS_W, 0);
  }
  for (let row = 0; row < CHAR_H; row++) {
    const pixelRow = frame[row];
    if (!pixelRow) continue;
    for (let col = 0; col < CHAR_W; col++) {
      const ci = pixelRow[col];
      if (!ci) continue;
      ctx.fillStyle = SPRITE_COLORS[ci];
      ctx.fillRect(CHAR_X + col * SCALE, CHAR_Y + row * SCALE, SCALE, SCALE);
    }
  }
  ctx.restore();
}

function drawZzz() {
  const t = zzzTick;
  const letters = [
    { text:'z', x:CHAR_X+38, y:CHAR_Y-4+zzzOffset,  alpha:0.5, size:8  },
    { text:'z', x:CHAR_X+44, y:CHAR_Y-14+zzzOffset, alpha:0.7, size:10 },
    { text:'Z', x:CHAR_X+50, y:CHAR_Y-26+zzzOffset, alpha:0.9, size:13 },
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
  zzzOffset = -(zzzTick % 60) * 0.3;
}

function drawDialogue() {
  dialogueTick--;
  const fadeIn  = Math.min(1, (DIALOGUE_DURATION - dialogueTick) / 15);
  const fadeOut = Math.min(1, dialogueTick / 20);
  const alpha   = Math.min(fadeIn, fadeOut);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const pad = 4, fs = 7;
  ctx.font = `bold ${fs}px monospace`;
  const tw = ctx.measureText(dialogueText).width;
  const bw = Math.min(tw + pad * 2, CANVAS_W - 4);
  const bh = fs + pad * 2;
  const bx = Math.max(2, Math.min(CANVAS_W - bw - 2, CHAR_X + (CHAR_W * SCALE) / 2 - bw / 2));
  const by = CHAR_Y - bh - 10;

  ctx.fillStyle = '#FFFDE7';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);

  // Bubble tail
  const tx = bx + bw / 2;
  ctx.beginPath();
  ctx.moveTo(tx - 3, by + bh);
  ctx.lineTo(tx + 3, by + bh);
  ctx.lineTo(tx, by + bh + 5);
  ctx.closePath();
  ctx.fillStyle = '#FFFDE7';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.beginPath();
  ctx.moveTo(tx - 3, by + bh);
  ctx.lineTo(tx, by + bh + 5);
  ctx.lineTo(tx + 3, by + bh);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#333';
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx + 1, by + 1, bw - 2, bh - 2);
  ctx.clip();
  ctx.fillText(dialogueText, bx + pad, by + pad + fs - 1);
  ctx.restore();
  ctx.restore();
}

function drawName() {
  const fs = 7;
  ctx.save();
  ctx.font = `bold ${fs}px monospace`;
  const tw = ctx.measureText(companionName).width;
  const nx = Math.max(0, (CANVAS_W - tw) / 2);
  const ny = CHAR_Y - 2;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#222';
  ctx.fillText(companionName, nx, ny);
  ctx.restore();
}

function drawHeart() {
  heartTick--;
  const progress = heartTick / HEART_DURATION;
  const floatY   = CHAR_Y - 20 - (HEART_DURATION - heartTick) * 0.4;
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.font = '12px serif';
  ctx.fillText('\u2764', CHAR_X + CHAR_W * SCALE / 2 - 6, floatY);
  ctx.restore();
}

// ─── Idle sub-animation cycling ───────────────────────────────────────────────

function getActiveIdleAnim() {
  if (idleSubIndex === -1) return 'idle';
  return IDLE_SUB_ANIMS[idleSubIndex % IDLE_SUB_ANIMS.length];
}

function advanceIdleSubAnim() {
  const animKey = getActiveIdleAnim();
  const frames  = SPRITES[animKey];
  idleSubFrame++;
  if (idleSubFrame >= frames.length) {
    if (idleSubIndex === -1) {
      idleSubTick++;
      if (idleSubTick >= BASE_IDLE_LOOPS_BEFORE_SUBANIM) {
        idleSubTick  = 0;
        idleSubIndex = idleSubCycle % IDLE_SUB_ANIMS.length;
        idleSubCycle++;
        idleSubFrame = 0;
      } else {
        idleSubFrame = 0;
      }
    } else {
      idleSubIndex = -1;
      idleSubFrame = 0;
    }
  }
}

// ─── Animation loop ───────────────────────────────────────────────────────────

function getAnimState() {
  if (greetingTick > 0) return 'greeting';
  if (isWalking) return 'walking';
  if (currentState === 'idle') return getActiveIdleAnim();
  return currentState;
}

function animate(timestamp) {
  animRAF = requestAnimationFrame(animate);

  const animState = getAnimState();
  const interval  = FRAME_MS[animState] || 600;
  if (timestamp - lastFrameTime < interval) return;
  lastFrameTime = timestamp;

  if (greetingTick > 0) greetingTick--;

  let frame;
  if (animState === 'greeting') {
    const frames = SPRITES.greeting;
    currentFrame = (currentFrame + 1) % frames.length;
    frame = frames[currentFrame];
  } else if (animState === 'walking') {
    const frames = SPRITES.walking;
    currentFrame = (currentFrame + 1) % frames.length;
    frame = frames[currentFrame];
  } else if (currentState === 'idle') {
    advanceIdleSubAnim();
    frame = SPRITES[getActiveIdleAnim()][idleSubFrame];
  } else {
    const frames = SPRITES[animState] || SPRITES.idle;
    currentFrame = (currentFrame + 1) % frames.length;
    frame = frames[currentFrame];
  }

  drawSprite(frame);
}

drawSprite(SPRITES.idle[0]);
animRAF = requestAnimationFrame(animate);

// ─── IPC ─────────────────────────────────────────────────────────────────────

if (window.electronAPI) {
  window.electronAPI.onStateChange(({ state }) => {
    if (state !== currentState) {
      currentState = state;
      currentFrame = 0;
      zzzTick = 0;
      zzzOffset = 0;
      if (state === 'idle') {
        idleSubIndex = -1;
        idleSubFrame = 0;
        idleSubTick  = 0;
      }
    }
  });

  window.electronAPI.onCompanionConfig(({ name, colors }) => {
    companionName = name || '';
    applyCompanionColors(colors);
  });

  window.electronAPI.onWalkingUpdate(({ walking, direction }) => {
    isWalking = !!walking;
    walkDir   = (direction >= 0) ? 1 : -1;
    if (!isWalking) currentFrame = 0;
  });

  window.electronAPI.onDialogue(({ text }) => {
    dialogueText = text;
    dialogueTick = DIALOGUE_DURATION;
  });

  window.electronAPI.onBuddyNearby(() => {
    greetingTick = GREETING_DURATION;
    currentFrame = 0;
  });
}

// ─── Mouse interaction ────────────────────────────────────────────────────────

let isDragging  = false;
let isMouseDown = false;
let dragStartX  = 0;
let dragStartY  = 0;
let clickStartX = 0;
let clickStartY = 0;

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isMouseDown = true;
  isDragging  = false;
  dragStartX  = e.screenX;
  dragStartY  = e.screenY;
  clickStartX = e.screenX;
  clickStartY = e.screenY;
});

window.addEventListener('mousemove', (e) => {
  // Only begin tracking a drag after the mouse button has been pressed.
  // Without this guard, the initial 0,0 values of clickStartX/Y would
  // produce a huge movedDist on the very first mousemove, sending the
  // companion window flying off-screen the moment the user moved their mouse.
  if (isMouseDown) {
    const movedDist = Math.abs(e.screenX - clickStartX) + Math.abs(e.screenY - clickStartY);
    if (movedDist > 4) isDragging = true;
  }

  if (!isDragging) {
    const rect = canvas.getBoundingClientRect();
    const cx   = Math.floor(e.clientX - rect.left);
    const cy   = Math.floor(e.clientY - rect.top);
    if (cx >= 0 && cy >= 0 && cx < CANVAS_W && cy < CANVAS_H) {
      const pixel    = ctx.getImageData(cx, cy, 1, 1).data;
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

window.addEventListener('mouseup', (e) => {
  isMouseDown = false;
  if (!isDragging && e.button === 0) {
    heartTick = HEART_DURATION;
    if (window.electronAPI) window.electronAPI.petCompanion();
  }
  isDragging = false;
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (window.electronAPI) window.electronAPI.openMinigame();
});
