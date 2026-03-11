'use strict';

/**
 * activity-logger.js
 *
 * Tracks how long the user spends in each app / state throughout the day,
 * persists the log to a JSON file, and can generate an end-of-day recap.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// ─── Storage path ─────────────────────────────────────────────────────────────

function getLogPath() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'activity-log.json');
}

// ─── In-memory state ──────────────────────────────────────────────────────────

/** @type {Map<string, { processName: string, windowTitle: string, state: string, firstSeen: number, lastSeen: number, totalMs: number }>} */
const sessionEntries = new Map(); // key = processName

let lastProcessName = '';
let lastState = '';
let lastTimestamp = Date.now();

const LOG_RETENTION_DAYS = 30;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called every poll cycle (~2 s) with the current window info.
 */
function record(processName, windowTitle, state) {
  const now = Date.now();
  const elapsed = now - lastTimestamp;
  lastTimestamp = now;

  // Accumulate time for the previous process
  if (lastProcessName) {
    accumulate(lastProcessName, windowTitle, lastState, elapsed);
  }

  lastProcessName = processName;
  lastState = state;
}

function accumulate(processName, windowTitle, state, ms) {
  if (!processName) return;
  const key = processName.toLowerCase();
  if (sessionEntries.has(key)) {
    const entry = sessionEntries.get(key);
    entry.totalMs += ms;
    entry.lastSeen = Date.now();
    entry.windowTitle = windowTitle; // keep most recent title
    entry.state = state;
  } else {
    sessionEntries.set(key, {
      processName,
      windowTitle,
      state,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      totalMs: ms,
    });
  }
}

/**
 * Builds a recap data object suitable for display in the recap window.
 * @returns {{ date: string, totalMs: number, byApp: Array, byCategory: Object }}
 */
function getRecapData() {
  // Flush any pending time for the current process
  const now = Date.now();
  if (lastProcessName) {
    accumulate(lastProcessName, '', lastState, now - lastTimestamp);
  }

  const byApp = Array.from(sessionEntries.values())
    .filter((e) => e.totalMs > 1000) // ignore sub-second blips
    .sort((a, b) => b.totalMs - a.totalMs);

  const byCategory = {};
  for (const entry of byApp) {
    const cat = entry.state || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + entry.totalMs;
  }

  const totalMs = byApp.reduce((s, e) => s + e.totalMs, 0);

  return {
    date: new Date().toLocaleDateString(),
    totalMs,
    byApp,
    byCategory,
  };
}

/**
 * Persists the current session data to disk. Called before quit.
 */
function flush() {
  try {
    const logPath = getLogPath();
    let existing = [];
    if (fs.existsSync(logPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        if (!Array.isArray(existing)) existing = [];
      } catch {
        existing = [];
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const recap = getRecapData();

    // Find or create today's entry
    const todayIdx = existing.findIndex((d) => d.date === todayStr);
    const dayEntry = {
      date: todayStr,
      totalMs: recap.totalMs,
      byApp: recap.byApp.map((e) => ({
        processName: e.processName,
        windowTitle: e.windowTitle,
        state: e.state,
        totalMs: e.totalMs,
      })),
      byCategory: recap.byCategory,
    };

    if (todayIdx >= 0) {
      existing[todayIdx] = dayEntry;
    } else {
      existing.push(dayEntry);
    }

    // Keep only the last 30 days
    if (existing.length > LOG_RETENTION_DAYS) existing = existing.slice(-LOG_RETENTION_DAYS);

    fs.writeFileSync(logPath, JSON.stringify(existing, null, 2), 'utf8');
  } catch (err) {
    console.error('[ActivityLogger] Failed to flush log:', err.message);
  }
}

module.exports = { record, getRecapData, flush };
