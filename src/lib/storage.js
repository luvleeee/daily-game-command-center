import { emptyStats } from './stats';
import { DEFAULT_RESET, DEFAULT_SCHEDULE } from './schedule';
import { metricsFromLegacyScoring, newMetric, DEFAULT_WIN, DEFAULT_LOSS } from './metrics';

export const STORAGE_KEY = 'gcc:state';
export const SCHEMA_VERSION = 3;

export const uid = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Data schema (v3)
 *
 * State    { version, settings, restDays: string[], categories, games }
 * Category { id, name, order, collapsed }
 * Game     { id, name, url, categoryId, order, iconUrl, color, notes, archived, inRoulette, createdAt,
 *            reset, schedule, metrics: Metric[], askResult, stats }
 *            — see lib/schedule.js, lib/metrics.js, lib/stats.js
 * Result   { values: { [metricId]: number }, failed, raw?, at }
 */

export const DEFAULT_SETTINGS = {
  haptics: true,
  sounds: false,
  confetti: true,
  returnPrompt: true, // "Done with X?" banner when you come back to the app
  appBadge: false, // remaining games on the home-screen icon
  density: 'comfortable', // 'comfortable' | 'compact'
  filter: 'all', // 'all' | 'todo' | 'done'
  sortTodoFirst: false,
  showResultsOnCards: true,
  rouletteMode: 'random', // 'random' | 'neglected' (weights games you haven't played in a while)
  lastBackupAt: null,
};

export function makeGame(partial) {
  return {
    id: uid(),
    name: '',
    url: '',
    categoryId: '',
    order: 0,
    iconUrl: '',
    color: '',
    notes: '',
    archived: false,
    inRoulette: true,
    createdAt: new Date().toISOString(),
    reset: { ...DEFAULT_RESET },
    schedule: { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] },
    metrics: [],
    askResult: true,
    stats: emptyStats(),
    ...partial,
  };
}

export function createInitialState() {
  const categoryId = uid();
  return {
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    restDays: [],
    categories: [{ id: categoryId, name: 'Daily Games', order: 0, collapsed: false }],
    games: [
      makeGame({
        name: 'Krillion',
        url: 'https://krillion.io/',
        categoryId,
        metrics: [newMetric({ name: 'Depth', type: 'number', unit: 'm', better: 'higher' })],
      }),
    ],
  };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const days = (v) => (Array.isArray(v) ? [...new Set(v.filter((d) => typeof d === 'string' && DAY_RE.test(d)))].sort() : []);
const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

function sanitizeResults(raw, legacyId) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [day, r] of Object.entries(raw)) {
    if (!DAY_RE.test(day) || !r || typeof r !== 'object') continue;
    const values = {};
    if (r.values && typeof r.values === 'object') {
      for (const [k, v] of Object.entries(r.values)) if (Number.isFinite(v)) values[k] = v;
    } else if (Number.isFinite(r.value) && legacyId) {
      values[legacyId] = r.value; // v2 single-score result
    }
    if (!Object.keys(values).length) continue;
    out[day] = {
      values,
      failed: Boolean(r.failed),
      ...(r.raw ? { raw: String(r.raw).slice(0, 2000) } : {}),
      at: r.at || null,
    };
  }
  return out;
}

const METRIC_TYPES = ['number', 'time', 'guesses', 'winloss'];
const READER_MODES = ['auto', 'label', 'count', 'connections', 'regex', 'manual'];

function sanitizeMetrics(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  return list
    .filter((m) => m && typeof m === 'object' && typeof m.id === 'string' && !seen.has(m.id) && seen.add(m.id))
    .slice(0, 12)
    .map((m) => {
      const r = m.reader || {};
      return newMetric({
        id: m.id,
        name: str(m.name, 'Score').slice(0, 30) || 'Score',
        emoji: str(m.emoji).slice(0, 8),
        type: METRIC_TYPES.includes(m.type) ? m.type : 'number',
        unit: str(m.unit).slice(0, 12),
        better: m.better === 'lower' ? 'lower' : 'higher',
        max: Number(m.max) > 0 ? Math.min(30, Number(m.max)) : 6,
        optional: Boolean(m.optional),
        reader: {
          mode: READER_MODES.includes(r.mode) ? r.mode : 'auto',
          label: str(r.label).slice(0, 30),
          labelPos: r.labelPos === 'after' ? 'after' : 'before',
          regex: str(r.regex).slice(0, 200),
          win: str(r.win, DEFAULT_WIN),
          loss: str(r.loss, DEFAULT_LOSS),
        },
      });
    });
}

/**
 * Defensive parsing + migration. Accepts v1 or v2 blobs (and imported backups),
 * fills every missing field with a default, and never throws.
 */
export function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.games)) return null;

  const categories = raw.categories
    .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
    .map((c, i) => ({ id: c.id, name: c.name, order: Number.isFinite(c.order) ? c.order : i, collapsed: Boolean(c.collapsed) }));
  if (!categories.length) return null;

  const catIds = new Set(categories.map((c) => c.id));
  const fallbackCat = [...categories].sort((a, b) => a.order - b.order)[0].id;

  const games = raw.games
    .filter((g) => g && typeof g.id === 'string' && typeof g.name === 'string')
    .map((g, i) => {
      const reset = { ...DEFAULT_RESET, ...(g.reset || {}) };
      if (!['local', 'zone'].includes(reset.mode) || !/^\d{2}:\d{2}$/.test(reset.time)) Object.assign(reset, DEFAULT_RESET);
      const schedule = g.schedule?.type === 'weekdays' && Array.isArray(g.schedule.days) && g.schedule.days.length
        ? { type: 'weekdays', days: [...new Set(g.schedule.days.filter((d) => d >= 0 && d <= 6))].sort() }
        : { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] };
      // v3: custom metrics; v2 games carried a single `scoring` → convert it
      const metrics = sanitizeMetrics(g.metrics) ?? metricsFromLegacyScoring(g.scoring);
      const legacyId = metrics[0]?.id;

      return {
        id: g.id,
        name: g.name,
        url: str(g.url),
        categoryId: catIds.has(g.categoryId) ? g.categoryId : fallbackCat,
        order: Number.isFinite(g.order) ? g.order : i,
        iconUrl: str(g.iconUrl),
        color: str(g.color),
        notes: str(g.notes).slice(0, 2000),
        archived: Boolean(g.archived),
        inRoulette: g.inRoulette !== false,
        createdAt: g.createdAt || new Date().toISOString(),
        reset,
        schedule,
        metrics,
        askResult: (g.askResult ?? g.scoring?.askOnDone ?? true) !== false,
        stats: {
          playedDays: days(g.stats?.playedDays),
          skippedDays: days(g.stats?.skippedDays),
          results: sanitizeResults(g.stats?.results, legacyId),
        },
      };
    });

  return {
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) },
    restDays: days(raw.restDays),
    categories,
    games,
  };
}

export function loadState() {
  try {
    const blob = localStorage.getItem(STORAGE_KEY);
    if (!blob) return createInitialState();
    return sanitizeState(JSON.parse(blob)) ?? createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode — app keeps working in memory */
  }
}

/** Ask the browser not to evict our data (important for installed PWAs). */
export function requestPersistentStorage() {
  try {
    navigator.storage?.persist?.();
  } catch {
    /* noop */
  }
}
