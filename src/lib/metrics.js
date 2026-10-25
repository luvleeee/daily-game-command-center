/**
 * Multi-stat engine.
 *
 * Each game has an ordered list of custom stats ("metrics"). The FIRST one is the headline.
 *
 * Metric {
 *   id, name, emoji,                       // e.g. 'Attempts', '🎯'
 *   type: 'number' | 'time' | 'guesses' | 'winloss',
 *   unit: 'pts',                            // number only
 *   better: 'higher' | 'lower',             // number only (time & guesses: lower is better)
 *   max: 6,                                 // guesses: attempts allowed
 *   optional: false,                        // missing from the share text is OK
 *   reader: {
 *     mode: 'auto' | 'label' | 'count' | 'connections' | 'regex' | 'manual',
 *     label: '🎯',                          // 'label': text/emoji next to the value · 'count': emoji to count
 *     labelPos: 'before' | 'after',         // '🎯 4' → before · '4 guesses' → after
 *     regex: '',                            // 'regex': first (group) = value
 *     win: '✅, 🏆, solved',                // winloss tokens
 *     loss: '❌, 💀, failed',
 *   }
 * }
 *
 * Result (one per game-day) = { values: { [metricId]: number }, failed: boolean, raw?: string, at }
 *   guesses "X" is stored as max + 1 and makes the result failed; a winloss 0 makes it failed.
 */

export const uidShort = () => Math.random().toString(36).slice(2, 9);

export const METRIC_TYPES = [
  { id: 'number', label: 'Number', hint: 'Points, attempts, swaps…' },
  { id: 'time', label: 'Time', hint: 'm:ss — faster is better' },
  { id: 'guesses', label: 'X / N', hint: '4/6 style, X = fail' },
  { id: 'winloss', label: 'Win / Loss', hint: 'Solved or not' },
];

export const DEFAULT_WIN = '✅, 🏆, 🎉, solved, won';
export const DEFAULT_LOSS = '❌, 💀, failed, lost';

export function newMetric(partial = {}) {
  return {
    id: uidShort(),
    name: 'Score',
    emoji: '',
    type: 'number',
    unit: '',
    better: 'higher',
    max: 6,
    optional: false,
    ...partial,
    reader: { mode: 'auto', label: '', labelPos: 'before', regex: '', win: DEFAULT_WIN, loss: DEFAULT_LOSS, ...(partial.reader || {}) },
  };
}

export const lowerIsBetter = (m) => m.type === 'time' || m.type === 'guesses' || (m.type === 'number' && m.better === 'lower');

/* ------------------------------------------------------------------ */
/* Formatting                                                           */
/* ------------------------------------------------------------------ */

export function formatSeconds(total) {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

/** One value of one metric → display string. `short` drops long units. */
export function formatMetricValue(metric, value, { failed = false, short = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  switch (metric.type) {
    case 'guesses':
      return failed || value > metric.max ? `X/${metric.max}` : `${short && !Number.isInteger(value) ? nf.format(value) : value}/${metric.max}`;
    case 'time':
      return formatSeconds(value);
    case 'winloss':
      return value >= 1 ? 'Win' : 'Loss';
    default: {
      const v = nf.format(value);
      if (!metric.unit) return v;
      const unit = value === 1 && /[a-z]s$/i.test(metric.unit) ? metric.unit.slice(0, -1) : metric.unit; // 1 mistake
      if (unit.length <= 2) return `${v}${unit}`;
      return short ? v : `${v} ${unit}`;
    }
  }
}

/** Compact multi-stat summary for cards: "✓ 🎯4 🕓4:49" (win/loss marks don't count toward the limit) */
export function formatResultSummary(metrics, result, { limit = 3 } = {}) {
  if (!result?.values) return '';
  const marks = [];
  const parts = [];
  for (const m of metrics) {
    const v = result.values[m.id];
    if (v == null) continue;
    if (m.type === 'winloss') marks.push(v >= 1 ? '✓' : '✗');
    else if (parts.length < limit) parts.push(`${m.emoji || ''}${formatMetricValue(m, v, { short: true, failed: m.type === 'guesses' && v > m.max })}`);
  }
  return [...marks, ...parts].join(' ');
}

/** "±1.2", "±0:41" — spread (standard deviation) in the metric's own terms */
export function formatSpread(metric, sd) {
  if (sd == null) return '—';
  if (metric.type === 'time') return `±${formatSeconds(sd)}`;
  return `±${nf.format(sd)}${metric.type === 'number' && metric.unit && metric.unit.length <= 2 ? metric.unit : ''}`;
}

/** First stat that isn't win/loss — used as the "headline" for averages and comparisons */
export const headlineMetric = (metrics) => metrics.find((m) => m.type !== 'winloss') ?? null;

export const metricLabel = (m) => `${m.emoji ? `${m.emoji} ` : ''}${m.name}`;

/* ------------------------------------------------------------------ */
/* Reading share text                                                   */
/* ------------------------------------------------------------------ */

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Clock-face emojis change with the hour (🕐…🕧) — treat them all as one label
const CLOCKS = '\u{1F550}-\u{1F567}⏰⏱⏲⌚';
const CLOCK_RE = new RegExp(`^[${CLOCKS}]️?$`, 'u');

const VALUE_RE = {
  time: '(\\d{1,2}:\\d{2}(?::\\d{2})?)',
  guesses: '([0-9]{1,2}|[Xx])\\s?\\/\\s?([0-9]{1,2})',
  number: '(-?\\d[\\d,\\u00A0\\u202F]*(?:\\.\\d+)?)',
};

function labelPattern(label) {
  const l = label.trim();
  if (CLOCK_RE.test(l)) return `[${CLOCKS}]\\uFE0F?`;
  return `${esc(l.replace(/️/g, ''))}\\uFE0F?`;
}

/** Remove things that look like numbers but aren't scores. */
export function stripNoise(text) {
  return text
    .replace(/<?https?:\/\/\S+>?/g, ' ')
    .replace(/#\s?[\d,.]+/g, ' ')
    .replace(/\b\d{1,4}[./-]\d{1,2}[./-]\d{1,4}\b/g, ' ')
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(,\s*\d{4})?/gi, ' ')
    .replace(/\b(puzzle|game|day|no\.?)\s*\d+/gi, ' ');
}

function toNumber(raw) {
  const n = Number(String(raw).replace(/[,\s\u00A0\u202F]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function timeToSeconds(raw) {
  const p = raw.split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}

function convert(metric, m) {
  if (!m) return null;
  if (metric.type === 'time') return { value: timeToSeconds(m[1]) };
  if (metric.type === 'guesses') {
    if (/x/i.test(m[1])) return { value: (metric.max || Number(m[2])) + 1, failed: true };
    const n = Number(m[1]);
    return n >= 1 && n <= (metric.max || Number(m[2])) ? { value: n } : null;
  }
  const n = toNumber(m[1]);
  return n == null ? null : { value: n };
}

function tokenList(s) {
  return (s || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
function hasToken(text, token) {
  if (/^[a-z ]+$/i.test(token)) return new RegExp(`\\b${esc(token)}\\b`, 'i').test(text);
  return text.includes(token.replace(/️/g, '')) || text.includes(token);
}

function readWinLoss(text, metric) {
  const r = metric.reader;
  if (r.mode === 'label' && r.label) {
    // e.g. "Result: Win" → look right after the label
    const m = text.match(new RegExp(`${labelPattern(r.label)}[\\s:=]*([^\\n]{0,12})`, 'iu'));
    if (m) text = m[1];
  }
  if (tokenList(r.loss).some((t) => hasToken(text, t))) return { value: 0, failed: true };
  if (tokenList(r.win).some((t) => hasToken(text, t))) return { value: 1 };
  return null;
}

/** Connections-style grid: each row of 4 coloured squares is one guess. */
const SQUARES = new Set(['🟨', '🟩', '🟦', '🟪']);
function readConnections(text) {
  const rows = text
    .split('\n')
    .map((l) => Array.from(l.trim()).filter((ch) => SQUARES.has(ch)))
    .filter((r) => r.length === 4);
  if (!rows.length) return null;
  const solved = rows.filter((r) => r.every((c) => c === r[0])).length;
  return { value: rows.length - solved, failed: solved < 4 };
}

/** Read ONE metric from a share text. Returns { value, failed? } or null. */
export function readMetric(text, metric) {
  if (!text?.trim()) return null;
  const r = metric.reader || {};
  try {
    switch (r.mode) {
      case 'manual':
        return null;
      case 'connections':
        return readConnections(text);
      case 'count': {
        if (!r.label) return null;
        const n = (text.match(new RegExp(labelPattern(r.label), 'gu')) || []).length;
        return { value: n };
      }
      case 'regex': {
        if (!r.regex) return null;
        const m = text.match(new RegExp(r.regex, 'iu'));
        if (!m) return null;
        if (metric.type === 'winloss') return readWinLoss(m[1] ?? m[0], metric);
        const raw = (m[1] ?? m[0]).trim();
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) return { value: timeToSeconds(raw) };
        if (metric.type === 'guesses') return convert(metric, raw.match(new RegExp(VALUE_RE.guesses)));
        const n = toNumber(raw);
        return n == null ? null : { value: n };
      }
      case 'label': {
        if (metric.type === 'winloss') return readWinLoss(text, metric);
        if (!r.label) return null;
        const L = labelPattern(r.label);
        const V = VALUE_RE[metric.type] || VALUE_RE.number;
        const re =
          r.labelPos === 'after'
            ? new RegExp(`${V}\\s*${L}`, 'iu')
            : new RegExp(`${L}[\\s:=\\-–]*${V}`, 'iu');
        return convert(metric, text.match(re));
      }
      default: {
        // auto: by type, on text without dates / puzzle numbers / links
        if (metric.type === 'winloss') return readWinLoss(text, metric);
        const clean = stripNoise(text);
        if (metric.type === 'guesses') {
          for (const m of clean.matchAll(new RegExp(`(?:^|[\\s:(])${VALUE_RE.guesses}(?![\\d/])`, 'gi'))) {
            const res = convert(metric, m);
            if (res) return res;
          }
          return null;
        }
        if (metric.type === 'time') return convert(metric, clean.match(new RegExp(`(?<![\\d/])${VALUE_RE.time}(?![\\d/])`)));
        return convert(metric, clean.match(new RegExp(VALUE_RE.number)));
      }
    }
  } catch {
    return null; // bad custom regex etc.
  }
}

/** Read every metric. Returns { values, failed, found: Set, missing: [metric] } */
export function readAll(text, metrics) {
  const values = {};
  const found = new Set();
  let failed = false;
  for (const m of metrics) {
    const res = readMetric(text, m);
    if (res && Number.isFinite(res.value)) {
      values[m.id] = res.value;
      found.add(m.id);
      if (res.failed) failed = true;
    }
  }
  const missing = metrics.filter((m) => !found.has(m.id) && !m.optional && m.reader.mode !== 'manual');
  return { values, failed, found, missing };
}

/** Is a stored result failed? (guesses X or a winloss loss) */
export function resultFailed(metrics, result) {
  if (!result) return false;
  if (result.failed) return true;
  return metrics.some((m) => {
    const v = result.values?.[m.id];
    return v != null && ((m.type === 'winloss' && v < 1) || (m.type === 'guesses' && v > m.max));
  });
}

/* ------------------------------------------------------------------ */
/* Auto-detect stats from a sample share text                           */
/* ------------------------------------------------------------------ */

const EMOJI_NAMES = {
  '🎯': ['Attempts', 'lower'],
  '🔀': ['Swaps', 'lower'],
  '🔁': ['Moves', 'lower'],
  '🔄': ['Moves', 'lower'],
  '💡': ['Hints', 'lower'],
  '❤️': ['Lives', 'higher'],
  '❤': ['Lives', 'higher'],
  '⭐': ['Stars', 'higher'],
  '🌟': ['Stars', 'higher'],
  '🏆': ['Score', 'higher'],
  '🔥': ['Streak', 'higher'],
  '❌': ['Mistakes', 'lower'],
  '👣': ['Steps', 'lower'],
  '📏': ['Distance', 'lower'],
  '🎲': ['Rolls', 'lower'],
  '🧩': ['Pieces', 'higher'],
  '📍': ['Distance', 'lower'],
};
const LOWER_WORDS = /^(attempts?|tries|guesses|mistakes?|errors?|hints?|swaps?|moves?|steps?|misses|clicks|turns|km|mi|miles?)$/i;

const PICTO = /\p{Extended_Pictographic}/u;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Scan a sample share text and propose one metric per value found, each with a
 * label-based reader so it keeps working when the numbers change.
 */
export function detectMetrics(sample) {
  if (!sample?.trim()) return [];
  const out = [];
  const usedNames = new Set();
  const uniqueName = (n) => {
    let name = n;
    let i = 2;
    while (usedNames.has(name.toLowerCase())) name = `${n} ${i++}`;
    usedNames.add(name.toLowerCase());
    return name;
  };

  // 1) Values with their neighbouring label, line by line
  const lines = stripNoise(sample).split('\n');
  const token = /(\d{1,2}:\d{2}(?::\d{2})?)|((?:\d{1,2}|[Xx])\s?\/\s?\d{1,2})(?![\d/])|(-?\d[\d,]*(?:\.\d+)?)(\s?%)?/gu;
  for (const line of lines) {
    for (const m of line.matchAll(token)) {
      const before = line.slice(0, m.index).trimEnd().replace(/[:=\-–]$/, '').trimEnd();
      const after = line.slice(m.index + m[0].length);
      const prevTok = before.split(/\s+/).pop() || '';
      const nextWord = (after.match(/^\s?([\p{L}%][\p{L}.]{0,11})/u) || [])[1] || '';
      const prevIsEmoji = PICTO.test(prevTok) && prevTok.length <= 4;
      const prevIsWord = /^\p{L}[\p{L}'’]{1,15}$/u.test(prevTok);

      let type = m[1] ? 'time' : m[2] ? 'guesses' : 'number';
      let name = '';
      let better = type === 'number' ? 'higher' : 'lower';
      let unit = '';
      let reader;
      let emoji = '';

      if (prevIsEmoji) {
        const key = prevTok.replace(/️/g, '');
        const known = EMOJI_NAMES[key] || EMOJI_NAMES[prevTok];
        emoji = prevTok;
        if (CLOCK_RE.test(prevTok)) name = 'Time';
        else if (known) [name, better] = known;
        reader = { mode: 'label', label: prevTok, labelPos: 'before' };
      } else if (nextWord && type === 'number') {
        unit = nextWord === '%' ? '%' : nextWord.toLowerCase();
        name = unit === '%' ? 'Percent' : cap(nextWord.replace(/s$/i, '') + (/s$/i.test(nextWord) ? 's' : ''));
        if (LOWER_WORDS.test(nextWord)) better = 'lower';
        reader = { mode: 'label', label: nextWord, labelPos: 'after' };
      } else if (prevIsWord) {
        name = cap(prevTok);
        if (LOWER_WORDS.test(prevTok)) better = 'lower';
        reader = { mode: 'label', label: prevTok, labelPos: 'before' };
      } else {
        reader = { mode: 'auto' };
      }
      if (m[4]) unit = '%';
      if (!name) name = type === 'time' ? 'Time' : type === 'guesses' ? 'Guesses' : 'Score';

      const metric = newMetric({ name: uniqueName(name), emoji, type, unit, better, reader });
      if (type === 'guesses') metric.max = Number(m[2].split('/')[1]) || 6;
      metric.detected = m[0].trim();
      out.push(metric);
    }
  }

  // 2) Win / loss markers (listed last so a number stays the headline)
  const winHit = tokenList(DEFAULT_WIN).find((t) => hasToken(sample, t));
  const lossHit = tokenList(DEFAULT_LOSS).find((t) => hasToken(sample, t));
  if (winHit || lossHit) {
    out.push(newMetric({ name: uniqueName('Solved'), type: 'winloss', reader: { mode: 'auto' }, detected: winHit || lossHit }));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Aggregates for one metric                                            */
/* ------------------------------------------------------------------ */

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function stdev(a) {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((acc, v) => acc + (v - m) ** 2, 0) / (a.length - 1));
}
const weekdayOfKey = (k) => {
  const [y, mo, d] = k.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
};

/**
 * Everything the stats screen shows for one metric.
 * Best/average/median/etc. use successful results only; win rate & distribution use all.
 */
export function summarizeMetric(metric, results = {}, allMetrics = [metric]) {
  const entries = Object.keys(results)
    .sort()
    .filter((d) => Number.isFinite(results[d]?.values?.[metric.id]))
    .map((d) => ({ day: d, value: results[d].values[metric.id], failed: resultFailed(allMetrics, results[d]), raw: results[d].raw }));

  const lower = lowerIsBetter(metric);
  const isWL = metric.type === 'winloss';
  const ok = isWL ? entries : entries.filter((e) => !e.failed && !(metric.type === 'guesses' && e.value > metric.max));
  const vals = ok.map((e) => e.value);
  const pick = (a, b) => (lower ? a <= b : a >= b);
  const bestEntry = !isWL && ok.length ? ok.reduce((b, e) => (pick(e.value, b.value) ? e : b)) : null;
  const worstEntry = !isWL && ok.length ? ok.reduce((w, e) => (pick(w.value, e.value) ? e : w)) : null;

  const last = (n) => mean(vals.slice(-n));
  // Trend: recent window vs the window before it (needs a bit of history)
  let trend = null;
  if (vals.length >= 6) {
    const half = Math.min(7, Math.floor(vals.length / 2));
    const recent = mean(vals.slice(-half));
    const prior = mean(vals.slice(-2 * half, -half));
    if (recent != null && prior != null && prior !== 0) {
      const delta = recent - prior;
      trend = { delta, pct: delta / Math.abs(prior), improving: lower ? delta < 0 : delta > 0 };
    }
  }

  // Win / loss streaks
  let winRate = null;
  let winStreak = 0;
  let bestWinStreak = 0;
  if (isWL || entries.some((e) => e.failed)) {
    const wins = entries.map((e) => (isWL ? e.value >= 1 : !e.failed));
    winRate = wins.length ? wins.filter(Boolean).length / wins.length : null;
    let run = 0;
    for (const w of wins) {
      run = w ? run + 1 : 0;
      bestWinStreak = Math.max(bestWinStreak, run);
    }
    winStreak = run;
  }

  // Distribution: guesses (1..max + X) or small-range integers
  let distribution = null;
  if (metric.type === 'guesses') {
    distribution = Array.from({ length: metric.max }, (_, i) => ({ label: String(i + 1), value: i + 1, count: entries.filter((e) => e.value === i + 1).length }));
    distribution.push({ label: 'X', count: entries.filter((e) => e.value > metric.max).length, failed: true });
  } else if (metric.type === 'number' && vals.length >= 3 && vals.every(Number.isInteger)) {
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    if (hi - lo <= 11) {
      distribution = [];
      for (let v = lo; v <= hi; v++) distribution.push({ label: String(v), value: v, count: vals.filter((x) => x === v).length });
    }
  }

  // By weekday (Mon..Sun) and by month (last 6 months)
  const wkSource = isWL ? entries : ok;
  const byWeekday = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const v = wkSource.filter((e) => weekdayOfKey(e.day) === wd).map((e) => e.value);
    return { wd, avg: mean(v), count: v.length };
  });
  const months = new Map();
  for (const e of wkSource) {
    const k = e.day.slice(0, 7);
    if (!months.has(k)) months.set(k, []);
    months.get(k).push(e.value);
  }
  const byMonth = [...months.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-6)
    .map(([month, v]) => ({ month, avg: mean(v), count: v.length }));

  return {
    metric,
    count: entries.length,
    entries,
    series: ok.slice(-30),
    best: bestEntry?.value ?? null,
    bestDay: bestEntry?.day ?? null,
    worst: worstEntry?.value ?? null,
    worstDay: worstEntry?.day ?? null,
    average: mean(vals),
    median: median(vals),
    last7: last(7),
    last30: last(30),
    consistency: stdev(vals),
    trend,
    winRate,
    winStreak,
    bestWinStreak,
    distribution,
    byWeekday,
    byMonth,
    lowerIsBetter: lower,
  };
}

/** Which metrics did this new result beat the previous best on? */
export function newBests(metrics, results, day, result) {
  if (!result || resultFailed(metrics, result)) return [];
  const others = { ...results };
  delete others[day];
  return metrics.filter((m) => {
    if (m.type === 'winloss') return false;
    const v = result.values?.[m.id];
    if (!Number.isFinite(v)) return false;
    const s = summarizeMetric(m, others, metrics);
    if (s.best == null) return false;
    return lowerIsBetter(m) ? v < s.best : v > s.best;
  });
}

/* ------------------------------------------------------------------ */
/* Migration from v2 single-score `scoring`                             */
/* ------------------------------------------------------------------ */

export function metricsFromLegacyScoring(scoring) {
  if (!scoring || scoring.type === 'none' || !scoring.type) return [];
  const reader =
    scoring.parser === 'connections'
      ? { mode: 'connections' }
      : scoring.parser === 'strands'
        ? { mode: 'count', label: '💡' }
        : scoring.parser === 'regex' && scoring.regex
          ? { mode: 'regex', regex: scoring.regex }
          : { mode: 'auto' };
  const names = { guesses: 'Guesses', time: 'Time', winloss: 'Solved', number: scoring.unit ? cap(scoring.unit) : 'Score' };
  return [
    newMetric({
      id: 'm0',
      name: names[scoring.type] || 'Score',
      type: scoring.type,
      unit: scoring.unit || '',
      better: scoring.better || 'higher',
      max: Number(scoring.max) || 6,
      reader,
    }),
  ];
}
