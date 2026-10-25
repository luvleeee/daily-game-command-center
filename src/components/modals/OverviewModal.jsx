import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, Crown, Flame, Hourglass, Scale, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import Sheet from '../ui/Sheet';
import GameIcon from '../GameIcon';
import { Segmented, cx } from '../ui/primitives';
import { formatMetricValue, headlineMetric, summarizeMetric } from '../../lib/metrics';
import { computeOverview } from '../../lib/overview';
import { formatDayKey, toDayKey, weekdayShort } from '../../lib/dates';
import { formatDuration } from '../../lib/schedule';

export default function OverviewModal({ open, onClose, games, restDays, now, onOpenStats }) {
  return (
    <Sheet open={open} onClose={onClose} title="Overview">
      {open && <OverviewBody games={games} restDays={restDays} now={now} onOpenStats={onOpenStats} />}
    </Sheet>
  );
}

function OverviewBody({ games, restDays, now, onOpenStats }) {
  const today = toDayKey(new Date(now));
  const o = useMemo(() => computeOverview(games, restDays, today), [games, restDays, today]);
  const trend = o.playsThisWeek - o.playsLastWeek;

  const topStreaks = [...games].filter((g) => g.computed.currentStreak > 0).sort((a, b) => b.computed.currentStreak - a.computed.currentStreak).slice(0, 5);
  const atRisk = games.filter((g) => g.computed.atRisk).sort((a, b) => a.computed.msUntilReset - b.computed.msUntilReset);
  const neglected = games
    .filter((g) => g.computed.dueToday && !g.computed.playedToday && (g.computed.daysSinceLastPlay == null || g.computed.daysSinceLastPlay >= 3))
    .sort((a, b) => (b.computed.daysSinceLastPlay ?? 999) - (a.computed.daysSinceLastPlay ?? 999))
    .slice(0, 5);

  const tiles = [
    { icon: Flame, label: 'Perfect-day streak', value: o.perfectStreak, tone: 'text-orange-300' },
    { icon: Crown, label: 'Best perfect streak', value: o.bestPerfectStreak, tone: 'text-amber-200' },
    { icon: CalendarCheck, label: 'Plays this week', value: o.playsThisWeek, tone: 'text-emerald-300', trend },
    { icon: Sparkles, label: 'All-time plays', value: o.totalPlays, tone: 'text-cyan-200' },
  ];

  return (
    <div className="space-y-5 pt-1">
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map(({ icon: Icon, label, value, tone, trend: t }) => (
          <div key={label} className="rounded-2xl border border-white/8 bg-white/4 p-3.5">
            <div className="flex items-center justify-between">
              <Icon size={17} className={tone} />
              {t != null && t !== 0 && (
                <span className={cx('flex items-center gap-0.5 text-xs font-semibold', t > 0 ? 'text-emerald-300' : 'text-rose-300')}>
                  {t > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {t > 0 ? '+' : ''}
                  {t}
                </span>
              )}
            </div>
            <p className={cx('mt-1.5 text-2xl font-bold tabular-nums', tone)}>{value}</p>
            <p className="text-xs font-medium text-white/45">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Last 12 weeks</p>
          <p className="text-xs text-white/35">{o.perfectDays} perfect days this year</p>
        </div>
        <div className="mx-auto flex max-w-[360px] gap-1">
          {alignWeeks(o.heatmap).map((week, wi) => (
            <div key={wi} className="flex flex-1 flex-col gap-1">
              {week.map((x, di) => (
                <motion.div
                  key={x?.day ?? `${wi}-${di}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: wi * 0.015 }}
                  title={x ? `${formatDayKey(x.day)} · ${x.rest ? 'rest day' : `${x.played}/${x.due}`}` : ''}
                  className={cx('aspect-square rounded-[4px]', !x && 'opacity-0', x?.day === today && 'ring-1 ring-white/70')}
                  style={{ background: x ? heatColor(x) : 'transparent' }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-white/35">
          Less
          {[0, 0.34, 0.67, 1].map((r) => (
            <span key={r} className="h-2.5 w-2.5 rounded-sm" style={{ background: heatColor({ due: 1, played: r }) }} />
          ))}
          More
        </div>
      </div>

      {atRisk.length > 0 && (
        <GameList
          title="Streaks at risk"
          icon={Hourglass}
          tone="text-orange-300"
          items={atRisk.map((g) => ({ g, right: `${formatDuration(g.computed.msUntilReset)} left` }))}
          onOpenStats={onOpenStats}
        />
      )}
      {topStreaks.length > 0 && (
        <GameList
          title="Top streaks"
          icon={Flame}
          tone="text-orange-300"
          items={topStreaks.map((g) => ({ g, right: `${g.computed.currentStreak} day${g.computed.currentStreak === 1 ? '' : 's'}` }))}
          onOpenStats={onOpenStats}
        />
      )}
      {neglected.length > 0 && (
        <GameList
          title="Haven’t played in a while"
          icon={Hourglass}
          tone="text-white/50"
          items={neglected.map((g) => ({
            g,
            right: g.computed.daysSinceLastPlay == null ? 'never' : `${g.computed.daysSinceLastPlay} days`,
          }))}
          onOpenStats={onOpenStats}
        />
      )}
      <CompareGames games={games} onOpenStats={onOpenStats} />
      <p className="text-center text-[11px] text-white/30">
        {o.totalResults} results logged · {weekdayShort(today)} {formatDayKey(today)}
      </p>
    </div>
  );
}

function alignWeeks(heat) {
  // Drop the leading partial week so every column runs Monday → Sunday
  const [y, m, d] = heat[0].day.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = Monday
  const padded = heat.slice(dow ? 7 - dow : 0);
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) {
    const w = padded.slice(i, i + 7);
    while (w.length < 7) w.push(null);
    weeks.push(w);
  }
  return weeks;
}

function heatColor(x) {
  if (x.rest) return 'rgba(56,189,248,0.3)';
  if (!x.due) return 'rgba(255,255,255,0.04)';
  const r = Math.min(1, x.played / x.due);
  if (r === 0) return 'rgba(255,255,255,0.08)';
  if (r >= 1) return 'linear-gradient(135deg, #6ee7b7, #10b981)';
  return `rgba(139, 92, 246, ${0.25 + r * 0.6})`;
}

function GameList({ title, icon: Icon, tone, items, onOpenStats }) {
  return (
    <div>
      <p className={cx('mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider', tone)}>
        <Icon size={13} /> {title}
      </p>
      <div className="divide-y divide-white/5 rounded-2xl border border-white/8 bg-white/4">
        {items.map(({ g, right }) => (
          <button key={g.id} onClick={() => onOpenStats(g.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
            <GameIcon name={g.name} url={g.url} iconUrl={g.iconUrl} color={g.color} size={30} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">{g.name}</span>
            <span className="shrink-0 text-xs font-semibold text-white/50">{right}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const SORTS = [
  { id: 'streak', label: 'Streak' },
  { id: 'best', label: 'Best' },
  { id: 'rate', label: 'Done %' },
  { id: 'plays', label: 'Plays' },
];

/** Side-by-side table of every game, sortable. */
function CompareGames({ games, onOpenStats }) {
  const [sort, setSort] = useState('streak');
  const rows = useMemo(
    () =>
      games.map((g) => {
        const m = headlineMetric(g.metrics);
        const s = m ? summarizeMetric(m, g.stats.results, g.metrics) : null;
        return {
          g,
          streak: g.computed.currentStreak,
          best: g.computed.maxStreak,
          rate: g.computed.completionRate ?? -1,
          plays: g.computed.totalPlays,
          headline: s?.average != null ? `${m.emoji || ''}${formatMetricValue(m, s.average, { short: true })} avg` : '',
        };
      }),
    [games],
  );
  if (games.length < 2) return null;
  const sorted = [...rows].sort((a, b) => b[sort] - a[sort] || a.g.name.localeCompare(b.g.name));
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-300">
        <Scale size={13} /> Compare games
      </p>
      <Segmented size="sm" value={sort} onChange={setSort} options={SORTS} className="mb-2" />
      <div className="divide-y divide-white/5 rounded-2xl border border-white/8 bg-white/4">
        <div className="grid grid-cols-[1fr_repeat(4,44px)] gap-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
          <span>Game</span>
          {SORTS.map((c) => (
            <span key={c.id} className={cx('text-right', sort === c.id && 'text-violet-300')}>
              {c.id === 'rate' ? '%' : c.label}
            </span>
          ))}
        </div>
        {sorted.map((r, i) => (
          <button key={r.g.id} onClick={() => onOpenStats(r.g.id)} className="grid w-full grid-cols-[1fr_repeat(4,44px)] items-center gap-1 px-3 py-2 text-left">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-[10px] font-bold text-white/30">{i + 1}</span>
              <GameIcon name={r.g.name} url={r.g.url} iconUrl={r.g.iconUrl} color={r.g.color} size={24} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-white/85">{r.g.name}</span>
                {r.headline && <span className="block truncate text-[10px] text-white/40">{r.headline}</span>}
              </span>
            </span>
            {['streak', 'best', 'rate', 'plays'].map((k) => (
              <span key={k} className={cx('text-right text-sm tabular-nums', sort === k ? 'font-bold text-white' : 'text-white/55')}>
                {k === 'rate' ? (r.rate < 0 ? '—' : Math.round(r.rate * 100)) : r[k]}
              </span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}
