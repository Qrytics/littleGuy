/**
 * Minigame.tsx
 *
 * "Whack-a-Guy" minigame component.
 * The companion appears at a random position in the arena for a short
 * window. Click it to score a point; let it disappear for −1 point.
 * Game runs for 30 seconds. Best score is persisted in localStorage.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { drawGridToCanvas } from '../animation/engine';
import { FRAME_HAPPY, FRAME_SURPRISED, buildPalette } from '../sprites/sprites';

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_DURATION_MS  = 30_000;
const TARGET_SHOW_MS    = 1_200;
const SPAWN_INTERVAL_MS = 900;
const ARENA_W           = 360;
const ARENA_H           = 260;
const CHAR_SCALE        = 4;
const CHAR_PX_W         = 10 * CHAR_SCALE; // 40
const CHAR_PX_H         = 16 * CHAR_SCALE; // 64
const BEST_KEY          = 'minigame-best';

const PALETTE = buildPalette('default');

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function drawCharacter(canvas: HTMLCanvasElement, surprised: boolean): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CHAR_PX_W, CHAR_PX_H);
  drawGridToCanvas(ctx, surprised ? FRAME_SURPRISED : FRAME_HAPPY, PALETTE, 0, 0, CHAR_SCALE);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Target {
  id:   number;
  x:    number;
  y:    number;
  hit:  boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Minigame() {
  const [score,      setScore]      = useState(0);
  const [bestScore,  setBestScore]  = useState(() =>
    parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10),
  );
  const [gameActive, setGameActive] = useState(false);
  const [timerPct,   setTimerPct]   = useState(100);
  const [target,     setTarget]     = useState<Target | null>(null);
  const [result,     setResult]     = useState('');

  // Mutable refs for intervals/timeouts — avoids stale closures in effects
  const scoreRef      = useRef(0);
  const activeRef     = useRef(false);
  const targetRef     = useRef<Target | null>(null);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef        = useRef<number | null>(null);
  const startTimeRef  = useRef(0);
  const idCounterRef  = useRef(0);

  // Canvas refs for rendering character sprites
  const targetCanvasRef = useRef<HTMLCanvasElement>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current)  clearTimeout(hideTimerRef.current);
    if (spawnRef.current)      clearInterval(spawnRef.current);
    if (gameTimerRef.current)  clearTimeout(gameTimerRef.current);
    if (rafRef.current)        cancelAnimationFrame(rafRef.current);
  }, []);

  const removeTarget = useCallback((wasHit: boolean) => {
    if (!targetRef.current) return;
    const delta = wasHit ? 1 : -1;
    scoreRef.current = Math.max(0, scoreRef.current + delta);
    setScore(scoreRef.current);
    targetRef.current = null;
    setTarget(null);
  }, []);

  const spawnTarget = useCallback(() => {
    if (!activeRef.current || targetRef.current) return;

    const x  = Math.floor(Math.random() * (ARENA_W - CHAR_PX_W));
    const y  = Math.floor(Math.random() * (ARENA_H - CHAR_PX_H));
    const id = ++idCounterRef.current;
    const t: Target = { id, x, y, hit: false };

    targetRef.current = t;
    setTarget(t);

    // Draw happy face onto the canvas after React renders it
    requestAnimationFrame(() => {
      if (targetCanvasRef.current) drawCharacter(targetCanvasRef.current, false);
    });

    hideTimerRef.current = setTimeout(() => {
      if (targetRef.current?.id === id) removeTarget(false);
    }, TARGET_SHOW_MS);
  }, [removeTarget]);

  const endGame = useCallback(() => {
    activeRef.current = false;
    setGameActive(false);
    clearTimers();

    if (targetRef.current) removeTarget(false);

    const finalScore = scoreRef.current;
    setBestScore((prev) => {
      if (finalScore > prev) {
        localStorage.setItem(BEST_KEY, String(finalScore));
        setResult(`🏆 New best! Score: ${finalScore}`);
        return finalScore;
      }
      setResult(`Game over! Score: ${finalScore}  Best: ${prev}`);
      return prev;
    });

    setTimerPct(0);
  }, [clearTimers, removeTarget]);

  const startGame = useCallback(() => {
    if (activeRef.current) return;

    clearTimers();
    scoreRef.current   = 0;
    activeRef.current  = true;
    targetRef.current  = null;
    idCounterRef.current = 0;

    setScore(0);
    setGameActive(true);
    setResult('');
    setTarget(null);
    setTimerPct(100);

    startTimeRef.current = Date.now();

    // Animated timer bar
    const tickTimer = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct     = Math.max(0, (1 - elapsed / GAME_DURATION_MS) * 100);
      setTimerPct(pct);
      if (activeRef.current) rafRef.current = requestAnimationFrame(tickTimer);
    };
    rafRef.current = requestAnimationFrame(tickTimer);

    spawnRef.current     = setInterval(spawnTarget, SPAWN_INTERVAL_MS);
    gameTimerRef.current = setTimeout(endGame, GAME_DURATION_MS);
    spawnTarget();
  }, [clearTimers, endGame, spawnTarget]);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  const onArenaClick = useCallback(() => {
    if (!activeRef.current || !targetRef.current) return;
    // Clicked empty arena — miss
    scoreRef.current = Math.max(0, scoreRef.current - 1);
    setScore(scoreRef.current);
  }, []);

  const onTargetClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeRef.current || !targetRef.current) return;

    const t = targetRef.current;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    // Flash surprised face briefly, then remove
    if (targetCanvasRef.current) drawCharacter(targetCanvasRef.current, true);
    setTimeout(() => {
      if (targetRef.current?.id === t.id) removeTarget(true);
    }, 180);
  }, [removeTarget]);

  // ── Render ───────────────────────────────────────────────────────────────

  const timerBarColor = timerPct > 50 ? '#4CAF50' : timerPct > 25 ? '#FF9800' : '#f44336';

  return (
    <div
      style={{
        background: '#1a1a2e',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        gap: 10,
      }}
    >
      <h1 style={{ fontSize: '1.1rem', margin: 0, color: '#c0c0ff' }}>Whack-a-Guy!</h1>

      {/* Scoreboard */}
      <div style={{ display: 'flex', gap: 24, fontSize: '0.9rem' }}>
        <span>Score: <strong style={{ color: '#FFD700' }}>{score}</strong></span>
        <span>Best: <strong style={{ color: '#aaa' }}>{bestScore}</strong></span>
      </div>

      {/* Timer bar */}
      <div
        style={{
          width: ARENA_W,
          height: 8,
          background: '#2a2a4a',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${timerPct}%`,
            height: '100%',
            background: timerBarColor,
            borderRadius: 4,
            transition: 'background 0.3s',
          }}
        />
      </div>

      {/* Arena */}
      <div
        onClick={onArenaClick}
        style={{
          position: 'relative',
          width: ARENA_W,
          height: ARENA_H,
          background: '#16213e',
          border: '2px solid #2a2a6a',
          borderRadius: 8,
          overflow: 'hidden',
          cursor: gameActive ? 'crosshair' : 'default',
        }}
      >
        {target && (
          <canvas
            ref={targetCanvasRef}
            width={CHAR_PX_W}
            height={CHAR_PX_H}
            onClick={onTargetClick}
            style={{
              position: 'absolute',
              left: target.x,
              top:  target.y,
              cursor: 'pointer',
              imageRendering: 'pixelated',
            }}
          />
        )}

        {!gameActive && !result && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#555',
              fontSize: '0.85rem',
            }}
          >
            Press Start to play!
          </div>
        )}
      </div>

      {/* Result message */}
      {result && (
        <div style={{ fontSize: '0.88rem', color: '#FFD700', textAlign: 'center' }}>
          {result}
        </div>
      )}

      {/* Start button */}
      <button
        onClick={startGame}
        disabled={gameActive}
        style={{
          padding: '8px 28px',
          fontSize: '0.9rem',
          fontFamily: 'monospace',
          background: gameActive ? '#2a2a4a' : '#4169E1',
          color: gameActive ? '#666' : '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: gameActive ? 'not-allowed' : 'pointer',
          fontWeight: 700,
        }}
      >
        {gameActive ? 'Playing…' : result ? 'Play Again' : 'Start'}
      </button>
    </div>
  );
}
