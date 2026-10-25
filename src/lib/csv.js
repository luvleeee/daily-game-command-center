import { formatMetricValue, resultFailed } from './metrics';

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * One row per (day, game, stat) — "long" format that pivots nicely in Excel/Sheets/Numbers.
 * Days played without a logged result get a single row with an empty stat.
 */
export function buildCsv(state) {
  const catName = new Map(state.categories.map((c) => [c.id, c.name]));
  const header = ['date', 'game', 'category', 'status', 'stat', 'value', 'display', 'failed', 'share_text'];
  const rows = [];
  for (const g of state.games) {
    const days = new Set([...g.stats.playedDays, ...g.stats.skippedDays, ...Object.keys(g.stats.results)]);
    for (const day of [...days].sort()) {
      const status = g.stats.playedDays.includes(day) ? 'played' : g.stats.skippedDays.includes(day) ? 'skipped' : 'result';
      const r = g.stats.results[day];
      const base = [day, g.name, catName.get(g.categoryId) ?? '', status];
      const vals = r ? g.metrics.filter((m) => Number.isFinite(r.values?.[m.id])) : [];
      if (!vals.length) {
        rows.push([...base, '', '', '', '', r?.raw ?? '']);
        continue;
      }
      const failed = resultFailed(g.metrics, r);
      vals.forEach((m, i) => {
        const v = r.values[m.id];
        rows.push([...base, m.name, v, formatMetricValue(m, v), failed ? 'yes' : 'no', i === 0 ? (r.raw ?? '') : '']);
      });
    }
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1].localeCompare(b[1])));
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
