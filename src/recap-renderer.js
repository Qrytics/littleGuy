'use strict';

/**
 * recap-renderer.js
 *
 * Populates the Daily Recap window with data sent from the main process.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms) {
  if (!ms || ms < 1000) return '< 1s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderRecap(data) {
  if (!data) return;

  // Header date
  document.getElementById('recap-date').textContent = data.date || 'Today';

  // Summary cards
  document.getElementById('total-time').textContent = fmtMs(data.totalMs);
  document.getElementById('app-count').textContent = (data.byApp || []).length;

  const cats = Object.entries(data.byCategory || {}).sort((a, b) => b[1] - a[1]);
  document.getElementById('top-activity').textContent =
    cats.length ? capitalize(cats[0][0]) : '—';

  // Category bar chart
  const catBars = document.getElementById('cat-bars');
  if (!cats.length) {
    catBars.innerHTML = '<div class="no-data">No activity recorded yet.</div>';
  } else {
    const maxMs = cats[0][1];
    catBars.innerHTML = cats.map(([cat, ms]) => {
      const pct = maxMs > 0 ? Math.round((ms / maxMs) * 100) : 0;
      return `
        <div class="cat-row">
          <span class="cat-name">
            <span class="badge badge-${cat}">${capitalize(cat)}</span>
          </span>
          <div class="bar-bg">
            <div class="bar-fill bar-fill-${cat}" style="width:${pct}%"></div>
          </div>
          <span class="cat-time">${fmtMs(ms)}</span>
        </div>`;
    }).join('');
  }

  // App table
  const tbody = document.getElementById('app-table-body');
  const apps = data.byApp || [];
  if (!apps.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="no-data">No apps recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = apps.map((entry) => {
    const name = entry.processName || '—';
    const title = entry.windowTitle
      ? `<br><span style="color:#555577;font-size:0.72rem">${escHtml(entry.windowTitle.slice(0, 60))}</span>`
      : '';
    return `
      <tr>
        <td>${escHtml(name)}${title}</td>
        <td><span class="badge badge-${entry.state || 'other'}">${capitalize(entry.state || 'other')}</span></td>
        <td style="text-align:right">${fmtMs(entry.totalMs)}</td>
      </tr>`;
  }).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Wire up IPC ──────────────────────────────────────────────────────────────

if (window.electronAPI) {
  window.electronAPI.onRecapData((data) => renderRecap(data));

  // Request fresh data immediately (in case the window was already open)
  window.electronAPI.requestRecap().then(renderRecap).catch(console.error);
}
