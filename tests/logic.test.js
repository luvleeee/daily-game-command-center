// Run: npm test   (bundles with esbuild, runs in Node under two time zones)
import assert from 'node:assert/strict';
import { currentStreak, maxStreak, getGameStats } from '../src/lib/stats';
import { gameDayKey, msUntilReset, isDueOn } from '../src/lib/schedule';
import { detectMetrics, formatMetricValue, formatResultSummary, newBests, newMetric, readAll, readMetric, summarizeMetric } from '../src/lib/metrics';
import { makeGame, sanitizeState } from '../src/lib/storage';
import { buildCsv } from '../src/lib/csv';
import { PRESETS } from '../src/lib/presets';

const g = (stats = {}, extra = {}) => makeGame({ name: 't', stats: { playedDays: [], skippedDays: [], results: {}, ...stats }, ...extra });
const T = '2026-10-24'; // a Saturday

/* ---------------- streaks ---------------- */
assert.equal(currentStreak(g(), T), 0);
assert.equal(currentStreak(g({ playedDays: ['2026-10-22', '2026-10-23'] }), T), 2, 'alive from yesterday');
assert.equal(currentStreak(g({ playedDays: ['2026-10-22', '2026-10-23', T] }), T), 3);
assert.equal(currentStreak(g({ playedDays: ['2026-10-21', '2026-10-22'] }), T), 0, 'broken');
assert.equal(currentStreak(g({ playedDays: ['2026-10-21', '2026-10-23'], skippedDays: ['2026-10-22'] }), T), 2, 'skip is neutral');
assert.equal(currentStreak(g({ playedDays: ['2026-10-21', '2026-10-23'] }), T, ['2026-10-22']), 2, 'rest day is neutral');
const wk = g({ playedDays: ['2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'] }, { schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] } });
assert.equal(currentStreak(wk, '2026-10-26'), 6, 'weekend skipped for weekday game');
assert.equal(isDueOn(wk, T), false);
assert.equal(maxStreak(g({ playedDays: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-11'] }), T), 3);
assert.equal(maxStreak(g({ playedDays: ['2025-12-31', '2026-01-01'] }), '2026-01-01'), 2, 'year boundary');
assert.equal(currentStreak(g({ playedDays: ['2026-03-28', '2026-03-29', '2026-03-30'] }), '2026-03-30'), 3, 'DST');

/* ---------------- reset times ---------------- */
const utc = makeGame({ reset: { mode: 'zone', time: '00:00', timeZone: 'UTC' } });
assert.equal(gameDayKey(utc, new Date('2026-10-24T23:30:00Z')), '2026-10-24');
assert.equal(gameDayKey(utc, new Date('2026-10-25T00:10:00Z')), '2026-10-25');
const ny6 = makeGame({ reset: { mode: 'zone', time: '06:00', timeZone: 'America/New_York' } });
assert.equal(gameDayKey(ny6, new Date('2026-10-24T09:59:00Z')), '2026-10-23', '5:59 NY is still yesterday');
assert.equal(gameDayKey(ny6, new Date('2026-10-24T10:01:00Z')), '2026-10-24');
assert.equal(Math.round(msUntilReset(utc, new Date('2026-10-24T22:00:00Z')) / 60000), 120);
const risk = getGameStats(g({ playedDays: ['2026-10-23'] }, { reset: { mode: 'zone', time: '00:00', timeZone: 'UTC' } }), new Date('2026-10-24T22:30:00Z'));
assert.equal(risk.atRisk, true, 'streak at risk 1.5h before reset');

/* ---------------- Pyragrams: multi-stat detection + reading ---------------- */
const PYRA = `Pyragrams: Sun, 10/25/2026 ✅
🎯 4 🔀 41 🕓 4:49
⠀⠀⠀⠀⠀⠀⠀▪️
⠀⠀⠀🟪⠀⠀⠀⠀⠀⠀🟪
⠀🟩⠀⠀🟪⠀⠀🟪⠀⠀🟪
🟩🟩🟪🟩🟪🟩🟪🟪
<https://www.pyralinks.com/puzzle/pyragrams>`;
const det = detectMetrics(PYRA);
assert.deepEqual(det.map((m) => [m.name, m.type]), [['Attempts', 'number'], ['Swaps', 'number'], ['Time', 'time'], ['Solved', 'winloss']]);
assert.equal(det.find((m) => m.name === 'Attempts').better, 'lower');
const byName = (ms, r) => Object.fromEntries(ms.map((m) => [m.name, r.values[m.id]]));
assert.deepEqual(byName(det, readAll(PYRA, det)), { Solved: 1, Attempts: 4, Swaps: 41, Time: 289 });
// Next day: different numbers, a fail, and a different clock emoji (they follow the hour)
const PYRA2 = PYRA.replace('✅', '❌').replace('🎯 4', '🎯 7').replace('🔀 41', '🔀 12').replace('🕓 4:49', '🕙 10:02');
const r2 = readAll(PYRA2, det);
assert.deepEqual(byName(det, r2), { Solved: 0, Attempts: 7, Swaps: 12, Time: 602 });
assert.equal(r2.failed, true);
// Optional stat missing → not reported as missing
const preset = PRESETS.find((p) => p.name === 'Pyragrams').metrics();
const r3 = readAll(PYRA.replace(' 🔀 41', ''), preset);
assert.equal(r3.missing.length, 0, 'swaps is optional');
assert.equal(formatResultSummary(preset, { values: readAll(PYRA, preset).values }), '✓ 🎯4 🕓4:49 🔀41');

/* ---------------- other readers ---------------- */
const M = (p) => newMetric(p);
assert.deepEqual(readMetric('Wordle 1,589 4/6*\n\n⬛🟨⬛⬛⬛', M({ type: 'guesses', max: 6 })), { value: 4 });
assert.deepEqual(readMetric('Wordle 1,589 X/6', M({ type: 'guesses', max: 6 })), { value: 7, failed: true });
assert.deepEqual(readMetric('#Worldle #900 (10/24/2026) 3/6 (100%)', M({ type: 'guesses', max: 6 })), { value: 3 });
const conn = 'Connections\nPuzzle #500\n🟨🟨🟦🟨\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪';
assert.deepEqual(readMetric(conn, M({ reader: { mode: 'connections' } })), { value: 1, failed: false });
assert.deepEqual(readMetric('I solved the 10/24/2026 New York Times Mini Crossword in 0:47!', M({ type: 'time' })), { value: 47 });
assert.deepEqual(readMetric('Krillion #212 — I dove 4,350 m!', M({ type: 'number' })), { value: 4350 });
assert.deepEqual(readMetric('Strands #200\n🔵🔵💡🔵\n🟡🔵💡', M({ reader: { mode: 'count', label: '💡' } })), { value: 2 });
assert.deepEqual(readMetric('Score: 1,234 pts in 12 moves', M({ reader: { mode: 'label', label: 'moves', labelPos: 'after' } })), { value: 12 });
assert.deepEqual(readMetric('Score: 1,234 pts', M({ reader: { mode: 'label', label: 'Score' } })), { value: 1234 });
assert.deepEqual(readMetric('#waffle1234 4/5', M({ reader: { mode: 'regex', regex: '(\\d)\\s?/\\s?5' } })), { value: 4 });
assert.equal(readMetric('anything', M({ reader: { mode: 'regex', regex: '(' } })), null, 'bad regex never throws');

/* ---------------- formatting ---------------- */
assert.equal(formatMetricValue(M({ unit: 'mistakes' }), 1), '1 mistake');
assert.equal(formatMetricValue(M({ unit: 'mistakes' }), 2), '2 mistakes');
assert.equal(formatMetricValue(M({ type: 'time' }), 47), '0:47');
assert.equal(formatMetricValue(M({ type: 'guesses', max: 6 }), 7), 'X/6');

/* ---------------- aggregates ---------------- */
const time = M({ type: 'time' });
const wl = M({ type: 'winloss' });
const res = {
  '2026-10-19': { values: { [time.id]: 300, [wl.id]: 1 } }, // Mon
  '2026-10-20': { values: { [time.id]: 200, [wl.id]: 1 } },
  '2026-10-21': { values: { [time.id]: 900, [wl.id]: 0 }, failed: true },
  '2026-10-22': { values: { [time.id]: 250, [wl.id]: 1 } },
};
const st = summarizeMetric(time, res, [time, wl]);
assert.equal(st.best, 200, 'failed run excluded from best');
assert.equal(st.worst, 300);
assert.equal(st.median, 250);
assert.equal(st.average, 250);
assert.equal(st.byWeekday[0].avg, 300, 'Monday average');
const sw = summarizeMetric(wl, res, [time, wl]);
assert.equal(Math.round(sw.winRate * 100), 75);
assert.equal(sw.winStreak, 1);
assert.equal(sw.bestWinStreak, 2);
assert.deepEqual(newBests([time, wl], res, '2026-10-23', { values: { [time.id]: 150, [wl.id]: 1 } }).map((m) => m.id), [time.id]);

/* ---------------- migrations ---------------- */
const v1 = { version: 1, categories: [{ id: 'c', name: 'Daily', order: 0 }], games: [{ id: 'k', name: 'Krillion', url: 'https://krillion.io/', categoryId: 'c', order: 0, stats: { playedDays: ['2026-10-23'] } }] };
const fromV1 = sanitizeState(v1);
assert.equal(fromV1.version, 3);
assert.deepEqual(fromV1.games[0].metrics, []);
assert.deepEqual(fromV1.games[0].stats.playedDays, ['2026-10-23']);
const v2 = {
  version: 2,
  categories: [{ id: 'c', name: 'Word', order: 0 }],
  games: [{ id: 'w', name: 'Wordle', url: 'x', categoryId: 'c', scoring: { type: 'guesses', max: 6, parser: 'auto', askOnDone: false }, stats: { playedDays: ['2026-10-23'], results: { '2026-10-23': { value: 4, raw: 'Wordle 4/6' } } } }],
};
const fromV2 = sanitizeState(v2).games[0];
assert.equal(fromV2.metrics.length, 1);
assert.equal(fromV2.metrics[0].type, 'guesses');
assert.equal(fromV2.askResult, false);
assert.equal(fromV2.stats.results['2026-10-23'].values[fromV2.metrics[0].id], 4, 'v2 result value moved into values{}');

/* ---------------- CSV ---------------- */
const csvState = sanitizeState({ ...v2, games: [{ ...v2.games[0], stats: { playedDays: ['2026-10-23'], results: { '2026-10-23': { value: 4, raw: 'Wordle 1,589 4/6' } } } }] });
const csv = buildCsv(csvState);
assert.match(csv, /2026-10-23,Wordle,Word,played,Guesses,4,4\/6,no,"Wordle 1,589 4\/6"/);

console.log(`✓ logic tests passed (TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
