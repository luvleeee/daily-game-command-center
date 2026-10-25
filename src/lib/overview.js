import { shiftDay } from './dates';
import { isDueOn } from './schedule';

/**
 * Cross-game numbers for the Overview sheet.
 * A "perfect day" = every game scheduled that day (not skipped / rest) was played.
 */
export function computeOverview(games, restDays, today, windowDays = 365) {
  const rest = new Set(restDays);
  const prepared = games.map((g) => {
    const created = (g.createdAt || '').slice(0, 10);
    const first = g.stats.playedDays[0];
    return {
      g,
      since: first && first < created ? first : created,
      played: new Set(g.stats.playedDays),
      skipped: new Set(g.stats.skippedDays),
    };
  });

  const dayInfo = (d) => {
    if (rest.has(d)) return { due: 0, played: 0, rest: true };
    let due = 0;
    let played = 0;
    for (const p of prepared) {
      if (d < p.since) continue;
      const wasPlayed = p.played.has(d);
      if (wasPlayed) played += 1;
      if (wasPlayed || (isDueOn(p.g, d) && !p.skipped.has(d))) due += 1;
    }
    return { due, played };
  };

  const days = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = shiftDay(today, -i);
    days.push({ day: d, ...dayInfo(d) });
  }
  const perfect = (x) => x.due > 0 && x.played >= x.due;
  const neutral = (x) => x.rest || x.due === 0;

  // Current perfect-day streak (today counts only once it's perfect)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const x = days[i];
    if (perfect(x)) streak += 1;
    else if (neutral(x) || x.day === today) continue;
    else break;
  }
  let best = 0;
  let run = 0;
  for (const x of days) {
    if (perfect(x)) best = Math.max(best, ++run);
    else if (!neutral(x) && x.day !== today) run = 0;
  }

  const sumPlays = (from, to) => days.slice(from, to).reduce((n, x) => n + x.played, 0);
  const n = days.length;

  return {
    heatmap: days.slice(-84),
    perfectStreak: streak,
    bestPerfectStreak: best,
    perfectDays: days.filter(perfect).length,
    playsThisWeek: sumPlays(n - 7, n),
    playsLastWeek: sumPlays(n - 14, n - 7),
    totalPlays: games.reduce((acc, g) => acc + g.stats.playedDays.length, 0),
    totalResults: games.reduce((acc, g) => acc + Object.keys(g.stats.results).length, 0),
  };
}
