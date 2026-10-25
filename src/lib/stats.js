import { dayIndex, shiftDay } from './dates';
import { gameDayKey, isDueOn, msUntilReset } from './schedule';
import { resultFailed } from './metrics';

/**
 * Single source of truth per game:
 *   stats = {
 *     playedDays:  ['2026-10-23', ...],   // game-day keys
 *     skippedDays: ['2026-10-20', ...],   // "skip today" — neutral, never breaks a streak
 *     results:     { '2026-10-23': { values: { [metricId]: n }, failed, raw?, at } }
 *   }
 * Plus global restDays (vacation / rest days) which are neutral for every game.
 *
 * Neutral day = not scheduled for this game, skipped, or a global rest day.
 * Streaks count consecutive PLAYED days, stepping over neutral days.
 */

export const emptyStats = () => ({ playedDays: [], skippedDays: [], results: {} });

const AT_RISK_MS = 3 * 60 * 60 * 1000; // warn during the last 3h before a reset

export function toggleInList(list, key, force) {
  const set = new Set(list);
  const on = force ?? !set.has(key);
  if (on) set.add(key);
  else set.delete(key);
  return [...set].sort();
}

function makeNeutral(game, restDays) {
  const skipped = new Set(game.stats.skippedDays);
  const rest = new Set(restDays);
  return (day) => !isDueOn(game, day) || skipped.has(day) || rest.has(day);
}

export function currentStreak(game, today, restDays = []) {
  const played = new Set(game.stats.playedDays);
  if (!played.size) return 0;
  const neutral = makeNeutral(game, restDays);
  const first = game.stats.playedDays[0];
  // Today not done yet (and not neutral) → the streak is still alive from yesterday.
  let cursor = played.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (cursor >= first) {
    if (played.has(cursor)) streak += 1;
    else if (!neutral(cursor)) break;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

export function maxStreak(game, today, restDays = []) {
  const days = game.stats.playedDays;
  if (!days.length) return 0;
  const played = new Set(days);
  const neutral = makeNeutral(game, restDays);
  const end = days[days.length - 1] > today ? days[days.length - 1] : today;
  let best = 0;
  let run = 0;
  for (let d = days[0]; d <= end; d = shiftDay(d, 1)) {
    if (played.has(d)) {
      run += 1;
      best = Math.max(best, run);
    } else if (!neutral(d) && d !== today) {
      run = 0;
    }
  }
  return best;
}

/** Share of scheduled (non-neutral) days actually played since the first play. */
function completionRate(game, today, restDays) {
  const days = game.stats.playedDays;
  if (!days.length) return null;
  const played = new Set(days);
  const neutral = makeNeutral(game, restDays);
  let due = 0;
  let hit = 0;
  for (let d = days[0]; d <= today; d = shiftDay(d, 1)) {
    if (played.has(d)) {
      due += 1;
      hit += 1;
    } else if (!neutral(d) && d !== today) due += 1;
  }
  return due ? hit / due : null;
}

/** Everything the UI needs about one game, right now. */
export function getGameStats(game, now = new Date(), restDays = []) {
  const today = gameDayKey(game, now);
  const playedToday = game.stats.playedDays.includes(today);
  const skippedToday = game.stats.skippedDays.includes(today);
  const restToday = restDays.includes(today);
  const dueToday = isDueOn(game, today);
  const streak = currentStreak(game, today, restDays);
  const untilReset = msUntilReset(game, now);
  const active = dueToday && !skippedToday && !restToday && !game.archived; // counts toward today's progress

  const days = game.stats.playedDays;
  const resultDays = Object.keys(game.stats.results).sort();
  const lastResultDay = resultDays[resultDays.length - 1];
  const todayResult = game.stats.results[today] ?? null;

  return {
    today,
    playedToday,
    skippedToday,
    restToday,
    dueToday,
    active,
    todo: active && !playedToday,
    currentStreak: streak,
    maxStreak: maxStreak(game, today, restDays),
    totalPlays: days.length,
    lastPlayed: days.length ? days[days.length - 1] : null,
    daysSinceLastPlay: days.length ? dayIndex(today) - dayIndex(days[days.length - 1]) : null,
    completionRate: completionRate(game, today, restDays),
    msUntilReset: untilReset,
    atRisk: active && !playedToday && streak > 0 && untilReset <= AT_RISK_MS,
    todayResult,
    todayFailed: resultFailed(game.metrics, todayResult),
    lastResult: lastResultDay ? { day: lastResultDay, ...game.stats.results[lastResultDay] } : null,
    resultCount: resultDays.length,
  };
}
