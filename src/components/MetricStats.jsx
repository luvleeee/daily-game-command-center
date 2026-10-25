import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Pencil, TrendingDown, TrendingUp } from 'lucide-react';
import { Chip, cx } from './ui/primitives';
import { formatDayKey } from '../lib/dates';
import { formatMetricValue, formatResultSummary, formatSpread, metricLabel, resultFailed, summarizeMetric } from '../lib/metrics';
import { toast } from '../lib/events';

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Results section of the stats sheet: pick a stat, see everything about it. */
export default function MetricStats({ game, onLogResult }) {
  const { metrics } = game;
  const [metricId, setMetricId] = useState(metrics[0]?.id);
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const s = useMemo(() => (metric ? summarizeMetric(metric, game.stats.results, metrics) : null), [metric, game.stats.results, metrics]);
  const recent = useMemo(
    () =>
      Object.keys(game.stats.results)
        .sort()
        .reverse()
        .slice(0, 6)
        .map((d) => ({ day: d, ...game.stats.results[d] })),
    [game.stats.results],
  );

  if (!metric) return null;
  if (!game.computed.resultCount) {
    return (
      <button
        onClick={() => onLogResult(game.id)}
        className="w-full rounded-2xl border border-dashed border-white/12 p-4 text-sm text-white/50 transition hover:border-white/25 hover:text-white/80"
      >
        No results yet — tap to log today’s
      </button>
    );
  }

  const fmt = (v) => formatMetricValue(metric, v, { short: true });
  const isWL = metric.type === 'winloss';
  const cells = isWL
    ? [
        { label: 'Win rate', value: pct(s.winRate) },
        { label: 'Win streak', value: s.winStreak },
        { label: 'Best run', value: s.bestWinStreak },
        { label: 'Logged', value: s.count },
      ]
    : [
        { label: 'Best', value: fmt(s.best), sub: s.bestDay && formatDayKey(s.bestDay) },
        { label: 'Average', value: fmt(s.average) },
        { label: 'Median', value: fmt(s.median) },
        { label: 'Last 7', value: fmt(s.last7) },
        { label: 'Last 30', value: fmt(s.last30) },
        { label: 'Worst', value: fmt(s.worst), sub: s.worstDay && formatDayKey(s.worstDay) },
        s.consistency != null && { label: 'Spread', value: formatSpread(metric, s.consistency), hint: 'Standard deviation — lower = more consistent' },
        s.winRate != null && { label: 'Solved', value: pct(s.winRate) },
        { label: 'Logged', value: s.count },
      ].filter(Boolean);

  return (
    <div className="space-y-4 rounded-2xl border border-white/8 bg-white/4 p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Results</p>
        {s.trend && (
          <span className={cx('flex items-center gap-1 text-xs font-semibold', s.trend.improving ? 'text-emerald-300' : 'text-rose-300')}>
            {s.trend.improving ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {s.trend.improving ? 'Improving' : 'Slipping'} {Math.abs(Math.round(s.trend.pct * 100))}%
          </span>
        )}
      </div>

      {metrics.length > 1 && (
        <div className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5">
          {metrics.map((m) => (
            <Chip key={m.id} active={m.id === metric.id} onClick={() => setMetricId(m.id)} className="h-8 text-xs">
              {metricLabel(m)}
            </Chip>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-x-2 gap-y-3">
        {cells.map((cell) => (
          <div key={cell.label} title={cell.hint}>
            <p className="text-lg font-bold tabular-nums text-white">{cell.value}</p>
            <p className="text-[11px] leading-tight text-white/45">
              {cell.label}
              {cell.sub && <span className="block text-white/30">{cell.sub}</span>}
            </p>
          </div>
        ))}
      </div>

      {s.distribution && <Distribution data={s.distribution} highlight={game.computed.todayResult?.values?.[metric.id]} />}
      {!isWL && s.series.length >= 2 && <Sparkline entries={s.series} lower={s.lowerIsBetter} metric={metric} best={s.best} />}
      <Bars title="By weekday" items={s.byWeekday.map((w, i) => ({ label: WD[i], v: w.avg, n: w.count }))} metric={metric} lower={s.lowerIsBetter} />
      {s.byMonth.length > 1 && (
        <Bars
          title="By month"
          items={s.byMonth.map((m) => ({ label: monthLabel(m.month), v: m.avg, n: m.count }))}
          metric={metric}
          lower={s.lowerIsBetter}
        />
      )}

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Recent</p>
        <div className="divide-y divide-white/5">
          {recent.map((e) => {
            const failed = resultFailed(metrics, e);
            return (
              <div key={e.day} className="flex items-center gap-2 py-2 text-sm">
                <span className="w-24 shrink-0 text-white/45">{formatDayKey(e.day)}</span>
                <span className={cx('min-w-0 flex-1 truncate font-semibold', failed ? 'text-rose-300' : 'text-white/85')}>
                  {formatResultSummary(metrics, e, { limit: 5 })}
                </span>
                {e.raw && (
                  <button
                    onClick={() => navigator.clipboard?.writeText(e.raw).then(() => toast({ message: 'Share text copied', icon: Copy }))}
                    aria-label="Copy share text"
                    className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white"
                  >
                    <Copy size={14} />
                  </button>
                )}
                <button
                  onClick={() => onLogResult(game.id, e.day)}
                  aria-label={`Edit result for ${formatDayKey(e.day)}`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white"
                >
                  <Pencil size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const pct = (r) => (r == null ? '—' : `${Math.round(r * 100)}%`);
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

function Distribution({ data, highlight }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1">
      {data.map((d) => {
        const isToday = highlight != null && (d.failed ? false : d.value === highlight);
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-6 text-right text-xs font-bold text-white/55">{d.label}</span>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(8, (d.count / max) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 20 }}
              className={cx(
                'flex h-6 items-center justify-end rounded-md px-2 text-xs font-bold',
                isToday ? 'bg-emerald-400 text-ink-950' : d.failed ? 'bg-rose-400/30 text-rose-100' : 'bg-white/14 text-white',
              )}
            >
              {d.count}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

/** Line chart of recent values; drawn so "up" always means "better". */
function Sparkline({ entries, lower, metric, best }) {
  const W = 300;
  const H = 70;
  const vals = entries.map((e) => e.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const y = (v) => 6 + (lower ? (v - min) / span : 1 - (v - min) / span) * (H - 12);
  const x = (i) => (vals.length === 1 ? W / 2 : 4 + (i / (vals.length - 1)) * (W - 8));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full overflow-visible" preserveAspectRatio="none" aria-label={`${metric.name} trend`}>
        <defs>
          <linearGradient id={`spark-${metric.id}`} x1="0" x2="1">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={y(best)} y2={y(best)} stroke="rgba(250,204,21,.35)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <polyline
          points={vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          fill="none"
          stroke={`url(#spark-${metric.id})`}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {vals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={v === best ? '#facc15' : '#c4b5fd'} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-white/35">
        <span>{formatDayKey(entries[0].day)}</span>
        <span>
          Last {vals.length} · best {formatMetricValue(metric, best, { short: true })} · ↑ better
        </span>
      </div>
    </div>
  );
}

/** Small vertical bars (weekday / month averages). Taller = better. */
function Bars({ title, items, metric, lower }) {
  const vals = items.map((i) => i.v).filter((v) => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const isWL = metric.type === 'winloss';
  const h = (v) => (isWL ? v : 0.25 + 0.75 * (lower ? (max - v) / span : (v - min) / span));
  const bestV = lower ? min : max;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{title}</p>
      <div className="flex h-24 items-end gap-1.5">
        {items.map((it) => (
          <div key={it.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={it.n ? `${it.n} result${it.n > 1 ? 's' : ''}` : 'no data'}>
            <span className="text-[9px] font-semibold tabular-nums text-white/55">
              {it.v == null ? '' : isWL ? pct(it.v) : formatMetricValue(metric, it.v, { short: true })}
            </span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: it.v == null ? 4 : `${Math.max(6, h(it.v) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 20 }}
              className={cx('w-full max-h-[70%] rounded-md', it.v == null ? 'bg-white/5' : it.v === bestV && !isWL ? 'bg-amber-300/80' : 'bg-violet-400/55')}
            />
            <span className="text-[10px] text-white/40">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
