'use strict';

/**
 * minigame-renderer.js
 *
 * Simple "Whack-a-Guy" minigame.
 * The companion character appears at a random position in the arena.
 * Click it before it hides to score a point.
 * Miss a shown target (it hides on its own) → −1 point.
 * Game runs for 30 seconds.
 */

// ─── Mini sprite (pixel art, 10×16, drawn on a 40×64 canvas at 4× scale) ────

const _ = 0, H = 1, S = 2, E = 3, M = 4, T = 5, P = 6, B = 7;

const COLORS = [null, '#3D2314','#FFCD94','#111111','#EE8080','#4169E1','#2D5016','#222222'];

const FRAME_HAPPY = [
  [_,_,H,H,H,H,H,_,_,_],
  [_,H,H,H,H,H,H,H,_,_],
  [_,H,S,S,S,S,S,H,_,_],
  [_,H,S,E,S,E,S,H,_,_],
  [_,H,S,S,S,S,S,H,_,_],
  [_,H,S,M,M,M,S,H,_,_],
  [_,T,T,T,T,T,T,T,T,_],
  [S,T,T,T,T,T,T,T,T,S],
  [S,T,T,T,T,T,T,T,T,S],
  [_,T,T,T,T,T,T,T,T,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,B,B,_,B,B,_,_,_],
  [_,_,B,B,_,B,B,_,_,_],
];

const FRAME_SURPRISED = [
  [_,_,H,H,H,H,H,_,_,_],
  [_,H,H,H,H,H,H,H,_,_],
  [_,H,S,S,S,S,S,H,_,_],
  [_,H,E,E,S,E,E,H,_,_],
  [_,H,S,S,S,S,S,H,_,_],
  [_,H,M,M,M,M,M,H,_,_],
  [_,T,T,T,T,T,T,T,T,_],
  [S,T,T,T,T,T,T,T,T,_],
  [_,T,T,T,T,T,T,T,T,S],
  [_,T,T,T,T,T,T,T,T,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,P,P,_,P,P,_,_,_],
  [_,_,B,B,_,B,B,_,_,_],
  [_,_,B,B,_,B,B,_,_,_],
];

function drawCharacterCanvas(frame) {
  const cv  = document.createElement('canvas');
  cv.width  = 40;
  cv.height = 64;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  for (let r = 0; r < 16; r++) {
    for (let col = 0; col < 10; col++) {
      const ci = frame[r][col];
      if (!ci) continue;
      c.fillStyle = COLORS[ci];
      c.fillRect(col * 4, r * 4, 4, 4);
    }
  }
  return cv;
}

// ─── Game state ───────────────────────────────────────────────────────────────

const GAME_DURATION_MS  = 30_000;
const TARGET_SHOW_MS    = 1200;   // how long target is visible before auto-hide
const SPAWN_INTERVAL_MS = 900;    // how often a new target spawns

const arena   = document.getElementById('arena');
const timerBar = document.getElementById('timer-bar');
const scoreEl = document.getElementById('score');
const bestEl  = document.getElementById('best');
const resultEl = document.getElementById('result');
const btnStart = document.getElementById('btn-start');

let score     = 0;
let bestScore = parseInt(localStorage.getItem('minigame-best') || '0', 10);
let gameActive = false;
let spawnTimer, gameTimer, timerAnimFrame;
let currentTarget = null;
let hideTimeout   = null;
let startTime     = 0;

bestEl.textContent = bestScore;

const happyCanvas    = drawCharacterCanvas(FRAME_HAPPY);
const surprisedCanvas = drawCharacterCanvas(FRAME_SURPRISED);

function spawnTarget() {
  if (currentTarget) return; // only one at a time

  const ARENA_W = 360 - 40;
  const ARENA_H = 260 - 64;
  const x = Math.floor(Math.random() * ARENA_W);
  const y = Math.floor(Math.random() * ARENA_H);

  const el = document.createElement('canvas');
  el.width  = 40;
  el.height = 64;
  el.style.position = 'absolute';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.cursor = 'pointer';
  el.style.imageRendering = 'pixelated';

  const ctx = el.getContext('2d');
  ctx.drawImage(happyCanvas, 0, 0);
  arena.appendChild(el);
  currentTarget = el;

  // Auto-hide = miss
  hideTimeout = setTimeout(() => {
    if (currentTarget === el) {
      removeTarget(false);
    }
  }, TARGET_SHOW_MS);

  // Click = hit
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!gameActive) return;
    clearTimeout(hideTimeout);

    // Flash surprised face briefly
    const hCtx = el.getContext('2d');
    hCtx.clearRect(0, 0, 40, 64);
    hCtx.drawImage(surprisedCanvas, 0, 0);
    setTimeout(() => removeTarget(true), 180);
  }, { once: true });
}

function removeTarget(wasHit) {
  if (!currentTarget) return;
  if (wasHit) {
    score++;
  } else {
    score = Math.max(0, score - 1);
  }
  scoreEl.textContent = score;

  arena.removeChild(currentTarget);
  currentTarget = null;
}

// Arena miss — clicked empty space
arena.addEventListener('click', () => {
  if (!gameActive || !currentTarget) return;
  // Missed (clicked arena but not the target)
  score = Math.max(0, score - 1);
  scoreEl.textContent = score;
});

function updateTimerBar(elapsed) {
  const fraction = Math.max(0, 1 - elapsed / GAME_DURATION_MS);
  timerBar.style.width = (fraction * 100) + '%';

  if (gameActive) {
    timerAnimFrame = requestAnimationFrame(() => updateTimerBar(Date.now() - startTime));
  }
}

function startGame() {
  if (gameActive) return;
  score      = 0;
  gameActive = true;
  scoreEl.textContent = '0';
  resultEl.textContent = '';
  btnStart.disabled = true;

  // Remove any stale target
  if (currentTarget) {
    arena.removeChild(currentTarget);
    currentTarget = null;
  }

  startTime = Date.now();
  updateTimerBar(0);

  spawnTimer = setInterval(spawnTarget, SPAWN_INTERVAL_MS);
  spawnTarget(); // Spawn immediately

  gameTimer = setTimeout(endGame, GAME_DURATION_MS);
}

function endGame() {
  gameActive = false;
  clearInterval(spawnTimer);
  clearTimeout(gameTimer);
  cancelAnimationFrame(timerAnimFrame);
  clearTimeout(hideTimeout);

  if (currentTarget) {
    arena.removeChild(currentTarget);
    currentTarget = null;
  }

  timerBar.style.width = '0%';

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('minigame-best', bestScore);
    bestEl.textContent = bestScore;
    resultEl.textContent = `🏆 New best! Score: ${score}`;
  } else {
    resultEl.textContent = `Game over! Score: ${score}  Best: ${bestScore}`;
  }

  btnStart.disabled = false;
}

btnStart.addEventListener('click', startGame);
