/**
 * Overlay.tsx
 *
 * React component for the 80×160 transparent overlay window.
 * Renders the pixel-art companion character on a <canvas>, handles
 * animation, dialogue bubbles, drag-to-move, click-through, petting,
 * and all Tauri event subscriptions.
 *
 * All mutable animation state lives in a single ref to avoid React
 * re-renders inside the 60fps requestAnimationFrame loop.
 */

import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow, Window as TauriWindow } from '@tauri-apps/api/window';
import { drawGridToCanvas } from '../animation/engine';
import {
  SPRITES,
  IDLE_SUB_ANIMS,
  FRAME_MS,
  buildPalette,
} from '../sprites/sprites';
import type { ActivityState, StateChangePayload, WalkingUpdatePayload, DialoguePayload, CompanionColors } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCALE    = 4;
const CHAR_W   = 10;
const CHAR_H   = 16;
const CANVAS_W = 80;
const CANVAS_H = 160;
const CHAR_X   = Math.floor((CANVAS_W - CHAR_W * SCALE) / 2); // 20
const CHAR_Y   = CANVAS_H - CHAR_H * SCALE;                   // 96

const DIALOGUE_DURATION              = 240; // animation frames
const GREETING_DURATION              = 80;
const HEART_DURATION                 = 50;
const BASE_IDLE_LOOPS_BEFORE_SUBANIM = 8;

// ─── Animation state ──────────────────────────────────────────────────────────

interface AnimState {
  currentState:  ActivityState;
  currentFrame:  number;
  lastFrameTime: number;

  // Idle sub-animation cycling
  idleSubIndex:  number; // -1 = base idle, ≥0 = sub-anim index
  idleSubFrame:  number;
  idleSubTick:   number;
  idleSubCycle:  number;

  // Sleeping Zzz
  zzzOffset: number;
  zzzTick:   number;

  // Dialogue bubble
  dialogueText: string;
  dialogueTick: number;

  // Greeting/buddy-nearby
  greetingTick: number;

  // Walking
  isWalking: boolean;
  walkDir:   number; // 1=right, -1=left

  // Companion label
  companionName: string;

  // Pet heart
  heartTick: number;

  // Color palette (10 entries)
  palette: Array<string | null>;
}

function makeInitialState(): AnimState {
  return {
    currentState:  'idle',
    currentFrame:  0,
    lastFrameTime: 0,
    idleSubIndex:  -1,
    idleSubFrame:  0,
    idleSubTick:   0,
    idleSubCycle:  0,
    zzzOffset:     0,
    zzzTick:       0,
    dialogueText:  '',
    dialogueTick:  0,
    greetingTick:  0,
    isWalking:     false,
    walkDir:       1,
    companionName: '',
    heartTick:     0,
    palette:       buildPalette('default'),
  };
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawZzz(ctx: CanvasRenderingContext2D, st: AnimState): void {
  const t = st.zzzTick;
  const letters = [
    { text: 'z', x: CHAR_X + 38, y: CHAR_Y - 4  + st.zzzOffset, alpha: 0.5, size: 8  },
    { text: 'z', x: CHAR_X + 44, y: CHAR_Y - 14 + st.zzzOffset, alpha: 0.7, size: 10 },
    { text: 'Z', x: CHAR_X + 50, y: CHAR_Y - 26 + st.zzzOffset, alpha: 0.9, size: 13 },
  ];
  for (const ltr of letters) {
    ctx.save();
    ctx.globalAlpha = ltr.alpha * Math.max(0.3, Math.sin(t * 0.05 + ltr.size));
    ctx.font = `bold ${ltr.size}px monospace`;
    ctx.fillStyle = '#AAAAEE';
    ctx.fillText(ltr.text, ltr.x, ltr.y);
    ctx.restore();
  }
  st.zzzTick++;
  st.zzzOffset = -(st.zzzTick % 60) * 0.3;
}

function drawDialogue(ctx: CanvasRenderingContext2D, st: AnimState): void {
  st.dialogueTick--;
  const fadeIn  = Math.min(1, (DIALOGUE_DURATION - st.dialogueTick) / 15);
  const fadeOut = Math.min(1, st.dialogueTick / 20);
  const alpha   = Math.min(fadeIn, fadeOut);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const pad = 4;
  const fs  = 7;
  ctx.font = `bold ${fs}px monospace`;
  const tw = ctx.measureText(st.dialogueText).width;
  const bw = Math.min(tw + pad * 2, CANVAS_W - 4);
  const bh = fs + pad * 2;
  const bx = Math.max(
    2,
    Math.min(CANVAS_W - bw - 2, CHAR_X + (CHAR_W * SCALE) / 2 - bw / 2),
  );
  const by = CHAR_Y - bh - 10;

  // Bubble background
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

  // Text
  ctx.fillStyle = '#333';
  // Clip text to bubble width
  const maxTextW = bw - pad * 2;
  let text = st.dialogueText;
  while (ctx.measureText(text).width > maxTextW && text.length > 1) {
    text = text.slice(0, -1);
  }
  ctx.fillText(text, bx + pad, by + pad + fs);

  ctx.restore();
}

function drawName(ctx: CanvasRenderingContext2D, st: AnimState): void {
  const fs = 7;
  ctx.save();
  ctx.font = `bold ${fs}px monospace`;
  const tw = ctx.measureText(st.companionName).width;
  const nx = Math.max(0, (CANVAS_W - tw) / 2);
  const ny = CHAR_Y - 2;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#222';
  ctx.fillText(st.companionName, nx, ny);
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, st: AnimState): void {
  st.heartTick--;
  const progress = st.heartTick / HEART_DURATION;
  const floatY   = CHAR_Y - 20 - (HEART_DURATION - st.heartTick) * 0.4;
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.font = '12px serif';
  ctx.fillText('\u2764', CHAR_X + (CHAR_W * SCALE) / 2 - 6, floatY);
  ctx.restore();
}

// ─── Idle sub-animation helpers ───────────────────────────────────────────────

function getActiveIdleAnim(st: AnimState): string {
  if (st.idleSubIndex === -1) return 'idle';
  return IDLE_SUB_ANIMS[st.idleSubIndex % IDLE_SUB_ANIMS.length];
}

function advanceIdleSubAnim(st: AnimState): void {
  const animKey = getActiveIdleAnim(st);
  const frames  = SPRITES[animKey as keyof typeof SPRITES];
  st.idleSubFrame++;
  if (st.idleSubFrame >= frames.length) {
    if (st.idleSubIndex === -1) {
      st.idleSubTick++;
      if (st.idleSubTick >= BASE_IDLE_LOOPS_BEFORE_SUBANIM) {
        st.idleSubTick  = 0;
        st.idleSubIndex = st.idleSubCycle % IDLE_SUB_ANIMS.length;
        st.idleSubCycle++;
        st.idleSubFrame = 0;
      } else {
        st.idleSubFrame = 0;
      }
    } else {
      st.idleSubIndex = -1;
      st.idleSubFrame = 0;
    }
  }
}

// ─── Full frame draw ──────────────────────────────────────────────────────────

function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: number[][],
  st: AnimState,
): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (st.companionName) drawName(ctx, st);
  if (st.dialogueTick > 0) drawDialogue(ctx, st);
  if (st.currentState === 'sleeping') drawZzz(ctx, st);

  // Coding green glow
  if (st.currentState === 'coding') {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#7CFC00';
    ctx.fillRect(CHAR_X - 4, CHAR_Y, CHAR_W * SCALE + 8, CHAR_H * SCALE);
    ctx.restore();
  }

  if (st.heartTick > 0) drawHeart(ctx, st);

  ctx.save();
  // Mirror horizontally when walking left
  if (st.walkDir === -1 && st.isWalking) {
    ctx.scale(-1, 1);
    ctx.translate(-CANVAS_W, 0);
  }
  drawGridToCanvas(ctx, frame, st.palette, CHAR_X, CHAR_Y, SCALE);
  ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Overlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef    = useRef<CanvasRenderingContext2D | null>(null);
  const stRef     = useRef<AnimState>(makeInitialState());

  // ── Canvas init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctxRef.current = ctx;

    // Draw the first idle frame immediately
    const frame = SPRITES.idle[0];
    drawFrame(ctx, frame, stRef.current);
  }, []);

  // ── Animation loop ───────────────────────────────────────────────────────
  useEffect(() => {
    let rafId: number;

    function getAnimState(st: AnimState): string {
      if (st.greetingTick > 0) return 'greeting';
      if (st.isWalking) return 'walking';
      if (st.currentState === 'idle') return getActiveIdleAnim(st);
      return st.currentState;
    }

    function animate(timestamp: number) {
      rafId = requestAnimationFrame(animate);
      const ctx = ctxRef.current;
      if (!ctx) return;

      const st       = stRef.current;
      const animState = getAnimState(st);
      const interval  = FRAME_MS[animState] ?? 600;

      if (timestamp - st.lastFrameTime < interval) return;
      st.lastFrameTime = timestamp;

      if (st.greetingTick > 0) st.greetingTick--;

      let frame: number[][];

      if (animState === 'greeting') {
        const frames = SPRITES.greeting;
        st.currentFrame = (st.currentFrame + 1) % frames.length;
        frame = frames[st.currentFrame];
      } else if (animState === 'walking') {
        const frames = SPRITES.walking;
        st.currentFrame = (st.currentFrame + 1) % frames.length;
        frame = frames[st.currentFrame];
      } else if (st.currentState === 'idle') {
        advanceIdleSubAnim(st);
        const key = getActiveIdleAnim(st) as keyof typeof SPRITES;
        frame = SPRITES[key][st.idleSubFrame] ?? SPRITES.idle[0];
      } else {
        const key    = (animState as keyof typeof SPRITES) in SPRITES ? (animState as keyof typeof SPRITES) : 'idle';
        const frames = SPRITES[key];
        st.currentFrame = (st.currentFrame + 1) % frames.length;
        frame = frames[st.currentFrame];
      }

      drawFrame(ctx, frame, st);
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ── Tauri event subscriptions ────────────────────────────────────────────
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    listen<StateChangePayload>('state-change', (event) => {
      const st = stRef.current;
      const newState = event.payload.state;
      if (newState !== st.currentState) {
        st.currentState = newState;
        st.currentFrame = 0;
        st.zzzTick      = 0;
        st.zzzOffset    = 0;
        if (newState === 'idle') {
          st.idleSubIndex = -1;
          st.idleSubFrame = 0;
          st.idleSubTick  = 0;
        }
      }
    }).then((fn) => unlisteners.push(fn)).catch(console.error);

    listen<{ name: string; colors: CompanionColors }>('companion-config', (event) => {
      const st = stRef.current;
      st.companionName = event.payload.name ?? '';
      const c = event.payload.colors;
      if (c) {
        st.palette = [
          null,
          c.hair,    // H
          c.skin,    // S
          '#111111', // E
          '#EE8080', // M
          c.shirt,   // T
          c.pants,   // P
          c.shoes,   // B
          '#AAAAEE', // zzz
          '#7CFC00', // glow
        ];
      }
    }).then((fn) => unlisteners.push(fn)).catch(console.error);

    listen<WalkingUpdatePayload>('walking-update', (event) => {
      const st = stRef.current;
      st.isWalking = !!event.payload.walking;
      st.walkDir   = event.payload.direction >= 0 ? 1 : -1;
      if (!st.isWalking) st.currentFrame = 0;
    }).then((fn) => unlisteners.push(fn)).catch(console.error);

    listen<DialoguePayload>('dialogue', (event) => {
      const st = stRef.current;
      st.dialogueText = event.payload.text;
      st.dialogueTick = DIALOGUE_DURATION;
    }).then((fn) => unlisteners.push(fn)).catch(console.error);

    listen('buddy-nearby', () => {
      const st = stRef.current;
      st.greetingTick = GREETING_DURATION;
      st.currentFrame = 0;
    }).then((fn) => unlisteners.push(fn)).catch(console.error);

    return () => unlisteners.forEach((fn) => fn());
  }, []);

  // ── Click-through on transparent pixels ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = async (e: MouseEvent) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const cx   = Math.floor(e.clientX - rect.left);
      const cy   = Math.floor(e.clientY - rect.top);
      if (cx >= 0 && cy >= 0 && cx < CANVAS_W && cy < CANVAS_H) {
        const pixel    = ctx.getImageData(cx, cy, 1, 1).data;
        const isOpaque = pixel[3] > 10;
        try {
          await getCurrentWindow().setIgnoreCursorEvents(!isOpaque);
        } catch {
          // API may not be available in dev browser preview
        }
      }
    };

    canvas.addEventListener('mousemove', onMouseMove);
    return () => canvas.removeEventListener('mousemove', onMouseMove);
  }, []);

  // ── Drag-to-move & pet click ──────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;

    const clickX = e.screenX;
    const clickY = e.screenY;
    let dragging = false;

    const onMove = (me: MouseEvent) => {
      if (dragging) return;
      const dist = Math.abs(me.screenX - clickX) + Math.abs(me.screenY - clickY);
      if (dist > 4) {
        dragging = true;
        window.removeEventListener('mousemove', onMove);
        getCurrentWindow().startDragging().catch(console.error);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!dragging) {
        // Treat as pet click
        stRef.current.heartTick = HEART_DURATION;
        emit('pet', {}).catch(console.error);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
  }, []);

  // ── Right-click → open minigame ──────────────────────────────────────────
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    TauriWindow.getByLabel('minigame').then((win) => {
      win?.show().catch(console.error);
      win?.setFocus().catch(console.error);
    }).catch(console.error);
  }, []);

  return (
    <canvas
      id="character"
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    />
  );
}
