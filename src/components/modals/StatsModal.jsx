import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlarmClock,
  Archive,
  CalendarDays,
  CopyPlus,
  ExternalLink,
  Flame,
  Hash,
  Pencil,
  Percent,
  PenLine,
  RotateCcw,
  SkipForward,
  StickyNote,
  Trash2,
  Trophy,
} from 'lucide-react';
import Sheet from '../ui/Sheet';
import GameIcon from '../GameIcon';
import { Button, ConfirmButton, Segmented, cx } from '../ui/primitives';
import { formatDayKey, shiftDay } from '../../lib/dates';
import { hostnameOf } from '../../lib/favicon';
import { describeReset, describeSchedule, formatDuration, isDueOn, weekdayOf } from '../../lib/schedule';
import { formatResultSummary } from '../../lib/metrics';
import MetricStats from '../MetricStats';

const WEEKS = 6;

export default function StatsModal({ open, onClose, game, restDays, ...handlers }) {
  return (
    <Sheet open={open && Boolean(game)} onClose={onClose} title="Stats">
      {game && <StatsBody key={game.id} game={game} restDays={restDays} onClose={onClose} {...handlers} />}
    </Sheet>
  );
}

function StatsBody({ game, restDays, onClose, onEdit, onLogResult, onDelete, onArchive, onDuplicate, onOpenGame, onToggleDone, onSkip, actions }) {
  const c = game.computed;
  const scored = game.metrics.length > 0;
  const [selected, setSelected] = useState(null);

  const status = c.playedToday
    ? { label: 'Played today', tone: 'text-emerald-300 bg-emerald-400/12' }
    : c.restToday
      ? { label: 'Rest day', tone: 'text-sky-300 bg-sky-400/12' }
      : c.skippedToday
        ? { label: 'Skipped today', tone: 'text-amber-200 bg-amber-400/12' }
        : !c.dueToday
          ? { label: 'Day off', tone: 'text-white/60 bg-white/8' }
          : { label: c.atRisk ? 'Streak at risk' : 'Not played yet', tone: c.atRisk ? 'text-orange-300 bg-orange-400/15' : 'text-white/70 bg-white/8' };

  const tiles = [
    { icon: Flame, label: 'Current streak', value: c.currentStreak, unit: c.currentStreak === 1 ? 'day' : 'days', tone: 'text-orange-300' },
    { icon: Trophy, label: 'Best streak', value: c.maxStreak, unit: c.maxStreak === 1 ? 'day' : 'days', tone: 'text-amber-200' },
    { icon: Hash, label: 'Total plays', value: c.totalPlays, tone: 'text-cyan-200' },
    { icon: Percent, label: 'Completion', value: c.completionRate == null ? '—' : Math.round(c.completionRate * 100), unit: c.completionRate == null ? '' : '%', tone: 'text-violet-200' },
  ];

  return (
    <div className="space-y-5 pt-1">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <GameIcon name={game.name} url={game.url} iconUrl={game.iconUrl} color={game.color} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-white">{game.name}</p>
          <p className="truncate text-sm text-white/40">{hostnameOf(game.url)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className={cx('rounded-full px-2.5 py-1', status.tone)}>{status.label}</span>
        <span className="flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 text-white/55">
          <AlarmClock size={12} /> {describeReset(game.reset)} · in {formatDuration(c.msUntilReset)}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 text-white/55">
          <CalendarDays size={12} /> {describeSchedule(game.schedule)}
        </span>
      </div>

      {/* Streak tiles */}
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map(({ icon: Icon, label, value, unit, tone }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-white/8 bg-white/4 p-3.5"
          >
            <Icon size={17} className={tone} />
            <p className={cx('mt-1.5 text-2xl font-bold tabular-nums', tone)}>
              {value}
              {unit && <span className="ml-1 text-sm font-semibold opacity-70">{unit}</span>}
            </p>
            <p className="text-xs font-medium text-white/45">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Results */}
      {scored && <MetricStats game={game} onLogResult={onLogResult} />}

      {/* Calendar */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">History</p>
          <p className="text-xs text-white/35">Tap a day to fix it</p>
        </div>
        <Calendar game={game} restDays={restDays} selected={selected} onSelect={setSelected} />
        {selected && (
          <DayEditor
            key={selected}
            game={game}
            day={selected}
            onChange={(status) => actions.setDayStatus(game.id, selected, status)}
            onLogResult={() => onLogResult(game.id, selected)}
          />
        )}
        <Legend />
      </div>

      {game.notes && (
        <div className="rounded-2xl border border-white/8 bg-white/4 p-3.5">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/45">
            <StickyNote size={13} /> Notes
          </p>
          <p className="whitespace-pre-wrap text-sm text-white/75 select-text">{game.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button className="col-span-2" onClick={() => onOpenGame(game)}>
          <ExternalLink size={17} /> Open game
        </Button>
        {scored && (
          <Button variant="secondary" onClick={() => onLogResult(game.id)}>
            <PenLine size={16} /> {c.todayResult ? 'Edit result' : 'Log result'}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => onToggleDone(game.id)}
          className={cx(!scored && 'col-span-1', !c.playedToday && 'border-emerald-400/30 text-emerald-200')}
        >
          {c.playedToday ? 'Unmark today' : 'Mark done'}
        </Button>
        <Button variant="secondary" onClick={() => onSkip(game.id)} disabled={c.playedToday}>
          <SkipForward size={16} /> {c.skippedToday ? 'Unskip today' : 'Skip today'}
        </Button>
        <Button variant="secondary" onClick={() => onEdit(game.id)}>
          <Pencil size={16} /> Edit
        </Button>
        <Button variant="secondary" onClick={() => onDuplicate(game.id)}>
          <CopyPlus size={16} /> Duplicate
        </Button>
        <Button variant="secondary" onClick={() => onArchive(game.id)}>
          <Archive size={16} /> Archive
        </Button>
        <ConfirmButton onConfirm={() => actions.resetStats(game.id)} confirmLabel="Confirm reset">
          <RotateCcw size={16} /> Reset stats
        </ConfirmButton>
        <Button
          variant="danger"
          onClick={() => {
            onDelete(game.id);
            onClose();
          }}
        >
          <Trash2 size={16} /> Delete
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */

function dayState(game, day, restDays) {
  if (game.stats.playedDays.includes(day)) return 'played';
  if (game.stats.skippedDays.includes(day)) return 'skipped';
  if (restDays.includes(day)) return 'rest';
  if (!isDueOn(game, day)) return 'off';
  return 'missed';
}

function Calendar({ game, restDays, selected, onSelect }) {
  const today = game.computed.today;
  // Align columns Mon → Sun, ending with the current week
  const offsetToSunday = (7 - weekdayOf(today)) % 7;
  const end = shiftDay(today, offsetToSunday);
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => shiftDay(end, i - (WEEKS * 7 - 1)));
  const firstTracked = (game.createdAt || '').slice(0, 10);

  return (
    <div className="mx-auto max-w-[320px]">
      <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold text-white/30">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const future = d > today;
          const st = dayState(game, d, restDays);
          const before = d < firstTracked && st === 'missed';
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => onSelect(selected === d ? null : d)}
              title={formatDayKey(d)}
              aria-label={`${formatDayKey(d)}: ${st}`}
              className={cx(
                'relative aspect-square rounded-md transition',
                future && 'opacity-20',
                st === 'played' && 'bg-gradient-to-br from-emerald-300 to-emerald-500',
                st === 'skipped' && 'bg-amber-300/35',
                st === 'rest' && 'bg-sky-400/30',
                st === 'off' && 'bg-white/3 outline outline-1 -outline-offset-1 outline-white/8',
                st === 'missed' && (before ? 'bg-white/3' : 'bg-white/8'),
                d === today && 'ring-2 ring-white/70 ring-offset-2 ring-offset-[#12121e]',
                selected === d && 'scale-110 ring-2 ring-violet-300',
              )}
            >
              {game.stats.results[d] && <span className="absolute inset-x-0 bottom-0.5 mx-auto h-1 w-1 rounded-full bg-white/80" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayEditor({ game, day, onChange, onLogResult }) {
  const current = game.stats.playedDays.includes(day) ? 'played' : game.stats.skippedDays.includes(day) ? 'skipped' : 'none';
  const result = game.stats.results[day];
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-2 rounded-2xl bg-white/5 p-3">
      <p className="text-sm font-semibold text-white">
        {formatDayKey(day)}
        {result && <span className="ml-2 text-emerald-300">{formatResultSummary(game.metrics, result, { limit: 5 })}</span>}
      </p>
      <Segmented
        size="sm"
        value={current}
        onChange={onChange}
        options={[
          { id: 'played', label: 'Played' },
          { id: 'skipped', label: 'Skipped' },
          { id: 'none', label: 'Missed' },
        ]}
      />
      {game.metrics.length > 0 && (
        <button onClick={onLogResult} className="text-xs font-semibold text-violet-300">
          {result ? 'Edit result for this day' : 'Log a result for this day'}
        </button>
      )}
    </motion.div>
  );
}

function Legend() {
  const items = [
    ['bg-emerald-400', 'Played'],
    ['bg-amber-300/50', 'Skipped'],
    ['bg-sky-400/40', 'Rest day'],
    ['bg-white/10', 'Missed'],
  ];
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-white/40">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1">
          <span className={cx('h-2.5 w-2.5 rounded-sm', c)} />
          {l}
        </span>
      ))}
    </div>
  );
}
