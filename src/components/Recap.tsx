/**
 * Recap.tsx
 *
 * Daily activity recap window. Fetches data from the Rust backend via
 * the `get_recap_data` Tauri command and renders summary cards,
 * category bars, and a sortable app table.
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RecapData, RecapEntry } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (!ms || ms < 1000) return '< 1s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function capitalize(str: string): string {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

const MAX_TITLE_LENGTH = 60;

// Category → accent color
const CATEGORY_COLORS: Record<string, string> = {
  coding:   '#4CAF50',
  typing:   '#2196F3',
  active:   '#FF9800',
  sleeping: '#9C27B0',
  idle:     '#607D8B',
};

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? '#78909C';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ category }: { category: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: '0.72rem',
        fontWeight: 700,
        background: categoryColor(category),
        color: '#fff',
        textTransform: 'capitalize',
      }}
    >
      {category || 'other'}
    </span>
  );
}

function CategoryBar({
  label,
  ms,
  maxMs,
}: {
  label: string;
  ms: number;
  maxMs: number;
}) {
  const pct = maxMs > 0 ? Math.round((ms / maxMs) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ width: 72, flexShrink: 0 }}>
        <Badge category={label} />
      </span>
      <div
        style={{
          flex: 1,
          height: 10,
          background: '#2a2a4a',
          borderRadius: 5,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: categoryColor(label),
            borderRadius: 5,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span style={{ width: 56, textAlign: 'right', fontSize: '0.78rem', color: '#aaa' }}>
        {fmtMs(ms)}
      </span>
    </div>
  );
}

function AppRow({ entry }: { entry: RecapEntry }) {
  const title = entry.window_title?.slice(0, MAX_TITLE_LENGTH);
  return (
    <tr>
      <td style={{ padding: '5px 8px', verticalAlign: 'top' }}>
        <span>{entry.process_name || '—'}</span>
        {title && (
          <div style={{ color: '#555577', fontSize: '0.72rem', marginTop: 1 }}>{title}</div>
        )}
      </td>
      <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
        <Badge category={entry.state || 'other'} />
      </td>
      <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {fmtMs(entry.total_ms)}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Recap() {
  const [data, setData] = useState<RecapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<RecapData>('get_recap_data')
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  const containerStyle: React.CSSProperties = {
    background: '#1a1a2e',
    color: '#e0e0e0',
    fontFamily: 'monospace',
    minHeight: '100vh',
    padding: '20px 24px',
    boxSizing: 'border-box',
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#7a7aaa' }}>Loading recap…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <h2 style={{ color: '#ff6b6b' }}>Failed to load recap</h2>
        <pre style={{ color: '#aaa', fontSize: '0.8rem' }}>{error}</pre>
      </div>
    );
  }

  if (!data) return null;

  const cats = Object.entries(data.by_category ?? {})
    .sort((a, b) => b[1] - a[1]);
  const maxMs = cats[0]?.[1] ?? 0;
  const topActivity = cats[0]?.[0] ?? '—';
  const apps: RecapEntry[] = [...(data.by_app ?? [])].sort(
    (a, b) => b.total_ms - a.total_ms,
  );

  const cardStyle: React.CSSProperties = {
    background: '#16213e',
    borderRadius: 8,
    padding: '12px 16px',
    flex: 1,
    minWidth: 110,
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.2rem', margin: 0, color: '#c0c0ff' }}>
          📊 Daily Recap
        </h1>
        <div style={{ color: '#888', fontSize: '0.82rem', marginTop: 2 }}>
          {data.date || 'Today'}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 4 }}>Total time</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{fmtMs(data.total_ms)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 4 }}>Apps</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{apps.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 4 }}>Top activity</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{capitalize(topActivity)}</div>
        </div>
      </div>

      {/* Category bars */}
      <div style={{ background: '#16213e', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
        <h2 style={{ fontSize: '0.85rem', color: '#aab', margin: '0 0 12px' }}>By Category</h2>
        {cats.length === 0 ? (
          <div style={{ color: '#555', fontSize: '0.82rem' }}>No activity recorded yet.</div>
        ) : (
          cats.map(([cat, ms]) => (
            <CategoryBar key={cat} label={cat} ms={ms} maxMs={maxMs} />
          ))
        )}
      </div>

      {/* App table */}
      <div style={{ background: '#16213e', borderRadius: 8, padding: '14px 16px' }}>
        <h2 style={{ fontSize: '0.85rem', color: '#aab', margin: '0 0 10px' }}>App Breakdown</h2>
        {apps.length === 0 ? (
          <div style={{ color: '#555', fontSize: '0.82rem' }}>No apps recorded yet.</div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.82rem',
            }}
          >
            <thead>
              <tr style={{ color: '#7a7aaa', borderBottom: '1px solid #2a2a4a' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>App</th>
                <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>State</th>
                <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((entry, i) => (
                <AppRow key={`${entry.process_name}-${entry.state}-${i}`} entry={entry} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
