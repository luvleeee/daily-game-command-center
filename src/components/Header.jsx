import { motion } from 'framer-motion';
import { ArrowUpDown, Check, FolderPlus, Hourglass, Moon, PartyPopper, Plus, Settings, Trophy } from 'lucide-react';
import { formatLongDate } from '../lib/dates';
import { formatDuration } from '../lib/schedule';
import { IconButton, cx } from './ui/primitives';

export default function Header({
  now,
  progress,
  restToday,
  organizing,
  onToggleOrganize,
  onOpenSettings,
  onOpenOverview,
  onToggleRestDay,
  onShowAtRisk,
  onAddGame,
  onAddCategory,
}) {
  const { done, total, ratio, skipped, resting, atRisk } = progress;
  const allDone = total > 0 && done === total;
  const soonest = atRisk.length ? Math.min(...atRisk.map((g) => g.computed.msUntilReset)) : 0;

  return (
    <header className="pt-safe px-safe">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{formatLongDate(new Date(now))}</p>
          <div className="flex gap-2">
            <IconButton label="Overview" onClick={onOpenOverview}>
              <Trophy size={18} />
            </IconButton>
            <IconButton label={organizing ? 'Done organizing' : 'Organize'} active={organizing} onClick={onToggleOrganize}>
              {organizing ? <Check size={18} /> : <ArrowUpDown size={18} />}
            </IconButton>
            <IconButton label="Settings" onClick={onOpenSettings}>
              <Settings size={18} />
            </IconButton>
          </div>
        </div>

        <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight sm:text-[32px]">
          <span className="text-gradient">Game Command</span>
          <span className="text-white"> Center</span>
        </h1>

        {/* Progress card */}
        <section className="glass mt-4 rounded-3xl p-4" aria-label="Daily progress">
          {restToday ? (
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-400/15 text-sky-300">
                <Moon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">Rest day</p>
                <p className="text-xs text-white/50">Streaks are protected today. Playing still counts.</p>
              </div>
              <button onClick={onToggleRestDay} className="h-9 rounded-xl bg-white/8 px-3 text-xs font-semibold text-white/80">
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-medium text-white/50">Today’s progress</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">
                    {done}
                    <span className="text-white/35">/{total}</span>
                    <span className="ml-2 text-sm font-medium text-white/50">games completed</span>
                  </p>
                </div>
                {allDone ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                    className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"
                  >
                    <PartyPopper size={22} />
                  </motion.div>
                ) : (
                  <span className="text-sm font-semibold tabular-nums text-white/60">{Math.round(ratio * 100)}%</span>
                )}
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                <motion.div
                  className={cx(
                    'h-full rounded-full',
                    allDone ? 'bg-gradient-to-r from-emerald-400 to-teal-300' : 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400',
                  )}
                  initial={false}
                  animate={{ width: `${ratio * 100}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                {allDone && <span className="font-medium text-emerald-300/90">All done for today!</span>}
                {atRisk.length > 0 && (
                  <button onClick={onShowAtRisk} className="flex items-center gap-1 font-semibold text-orange-300">
                    <Hourglass size={12} /> {atRisk.length} streak{atRisk.length > 1 ? 's' : ''} end in {formatDuration(soonest)}
                  </button>
                )}
                {skipped > 0 && <span className="text-white/40">{skipped} skipped</span>}
                {resting > 0 && <span className="text-white/40">{resting} day{resting > 1 ? 's' : ''} off</span>}
                <button onClick={onToggleRestDay} className="ml-auto flex items-center gap-1 font-medium text-white/40 hover:text-white/70">
                  <Moon size={12} /> Rest day
                </button>
              </div>
            </>
          )}
        </section>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onAddGame} className="glass flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white/90 transition active:scale-[0.97]">
            <Plus size={17} /> Add game
          </button>
          <button onClick={onAddCategory} className="glass flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white/90 transition active:scale-[0.97]">
            <FolderPlus size={17} /> New category
          </button>
        </div>
      </div>
    </header>
  );
}
