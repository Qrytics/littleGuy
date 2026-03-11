'use strict';

/**
 * companion-store.js
 *
 * Manages persistent companion configuration stored in the userData folder.
 * Config file: <userData>/companion-config.json
 */

const path = require('path');
const fs   = require('fs');
const { app } = require('electron');

const STORE_FILE = 'companion-config.json';

/** Companion type definitions — color palette overrides keyed by type id. */
const COMPANION_TYPES = {
  default: {
    label: 'Classic (Blue)',
    hair:  '#3D2314',
    skin:  '#FFCD94',
    shirt: '#4169E1',
    pants: '#2D5016',
    shoes: '#222222',
  },
  purple: {
    label: 'Purple Pal',
    hair:  '#1A0033',
    skin:  '#FFCD94',
    shirt: '#7B2FBE',
    pants: '#3D1A78',
    shoes: '#111111',
  },
  orange: {
    label: 'Orange Buddy',
    hair:  '#5C1A00',
    skin:  '#FFCD94',
    shirt: '#E87C00',
    pants: '#7A3D00',
    shoes: '#222222',
  },
  red: {
    label: 'Red Ranger',
    hair:  '#0A0A0A',
    skin:  '#FFCD94',
    shirt: '#CC0000',
    pants: '#1A1A5C',
    shoes: '#111111',
  },
  green: {
    label: 'Forest Friend',
    hair:  '#2D3A00',
    skin:  '#FFCD94',
    shirt: '#2E7D32',
    pants: '#1B5E20',
    shoes: '#4E342E',
  },
};

const DEFAULT_CONFIG = {
  companions: [
    {
      id:   'companion-1',
      name: 'littleGuy',
      type: 'default',
      x:    null,   // null = place at default bottom-right
      y:    null,
    },
  ],
  settings: {
    walkingEnabled:  false,
    dialogueEnabled: true,
    totalPets:       0,
  },
};

let _cache     = null;
let _storePath = null;

function getStorePath() {
  if (!_storePath) {
    _storePath = path.join(app.getPath('userData'), STORE_FILE);
  }
  return _storePath;
}

function load() {
  if (_cache) return _cache;
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf8');
    _cache = JSON.parse(raw);
    // Back-fill any missing fields added in newer versions
    if (!_cache.companions) _cache.companions = [...DEFAULT_CONFIG.companions];
    if (!_cache.settings)   _cache.settings   = { ...DEFAULT_CONFIG.settings };
    _cache.settings.totalPets       = _cache.settings.totalPets       ?? 0;
    _cache.settings.walkingEnabled  = _cache.settings.walkingEnabled  ?? false;
    _cache.settings.dialogueEnabled = _cache.settings.dialogueEnabled ?? true;
  } catch {
    _cache = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  return _cache;
}

function save() {
  if (!_cache) return;
  try {
    const p = getStorePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(_cache, null, 2), 'utf8');
  } catch (err) {
    console.error('[companion-store] save failed:', err.message);
  }
}

function getCompanions() {
  return load().companions;
}

function getSettings() {
  return load().settings;
}

function getCompanionById(id) {
  return load().companions.find((c) => c.id === id) || null;
}

function updateCompanion(id, updates) {
  const cfg = load();
  const c   = cfg.companions.find((x) => x.id === id);
  if (c) { Object.assign(c, updates); save(); }
}

function addCompanion() {
  const cfg  = load();
  const ids  = cfg.companions.map((c) => parseInt(c.id.replace('companion-', ''), 10) || 0);
  const next = Math.max(0, ...ids) + 1;
  const fresh = {
    id:   `companion-${next}`,
    name: `littlePal ${next}`,
    type: 'default',
    x:    null,
    y:    null,
  };
  cfg.companions.push(fresh);
  save();
  return fresh;
}

function removeCompanion(id) {
  const cfg = load();
  cfg.companions = cfg.companions.filter((c) => c.id !== id);
  save();
}

function updateSettings(updates) {
  const cfg = load();
  Object.assign(cfg.settings, updates);
  save();
}

module.exports = {
  COMPANION_TYPES,
  load,
  save,
  getCompanions,
  getSettings,
  getCompanionById,
  updateCompanion,
  addCompanion,
  removeCompanion,
  updateSettings,
};
