import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Check, Flame, GripVertical, Hourglass, Moon, SkipForward, StickyNote } from 'lucide-react';
import GameIcon from './GameIcon';
import { hostnameOf } from '../lib/favicon';
import { formatDuration } from '../lib/schedule';
import { formatResultSummary } from '../lib/metrics';
import { useLongPress } from '../hooks/useLongPress';
import { cx } from './ui/primitives';

export function SortableGameCard(props) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: props.game.id,
    disabled: !props.organizing,
  });
  return (
    <GameCard
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragging={isDragging}
      handleProps={{ ref: setActivatorNodeRef, ...attributes, ...listeners }}
      {...props}
    />
  );
}

const GameCard = forwardRef(function GameCard(
  { game, organizing, highlighted, compact, showResult, onToggleDone, onOpenStats, onLaunch, onLongPress, dragging, handleProps, style },
  ref,
) {
  const c = game.computed;
  const { handlers, consumeClick } = useLongPress(() => onLongPress(game.id), { disabled: organizing });
  const inactive = !c.playedToday && (!c.dueToday || c.skippedToday || c.restToday);
  const customReset = game.reset.mode === 'zone' || game.reset.time !== '00:00';
  const result = c.todayResult;
  const iconSize = compact ? 36 : 44;

  return (
    <div ref={ref} id={`game-${game.id}`} style={style} className={cx('relative', dragging && 'z-20 scale-[1.02] opacity-95')}>
      <div
        {...handlers}
        className={cx(
          'glass relative flex items-center gap-3 overflow-hidden rounded-2xl pr-2 transition-[background,box-shadow,opacity] duration-300',
          compact ? 'p-2' : 'p-2.5',
          (c.playedToday || inactive) && 'opacity-60',
          dragging && 'shadow-2xl shadow-violet-900/50 ring-1 ring-violet-400/40',
          c.atRisk && !dragging && 'ring-1 ring-orange-400/50',
          highlighted && 'ring-2 ring-fuchsia-400 shadow-[0_0_40px_-6px_rgba(232,121,249,0.7)]',
        )}
        style={game.color ? { boxShadow: `inset 3px 0 0 ${game.color}` } : undefined}
      >
        {organizing && (
          <button
            {...handleProps}
            aria-label={`Reorder ${game.name}`}
            className="drag-handle -mr-1 grid h-10 w-7 shrink-0 cursor-grab place-items-center rounded-lg text-white/40 active:cursor-grabbing active:text-white"
          >
            <GripVertical size={18} />
          </button>
        )}

        {/* Tap = launch · long-press = quick actions */}
        <a
          href={game.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl active:opacity-70"
          onClick={(e) => {
            if (organizing || consumeClick()) {
              e.preventDefault();
              return;
            }
            onLaunch(game);
          }}
        >
          <GameIcon name={game.name} url={game.url} iconUrl={game.iconUrl} color={game.color} size={iconSize} />
          <div className="min-w-0 flex-1">
            <p className={cx('flex items-center gap-1.5 truncate font-semibold text-white', compact ? 'text-sm' : 'text-[15px]')}>
              <span className={cx('truncate', c.playedToday && 'line-through decoration-white/30')}>{game.name}</span>
              {game.notes && <StickyNote size={12} className="shrink-0 text-white/30" aria-label="Has notes" />}
            </p>
            <div className="mt-0.5 flex items-center gap-2 overflow-hidden text-xs text-white/40">
              <StatusLine c={c} game={game} customReset={customReset} compact={compact} result={showResult ? result : null} />
            </div>
          </div>
        </a>

        <button
          onClick={() => onOpenStats(game.id)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Stats for ${game.name}`}
          className={cx(
            'grid shrink-0 place-items-center rounded-full text-white/45 transition hover:bg-white/8 hover:text-white active:scale-90',
            compact ? 'h-9 w-9' : 'h-10 w-10',
          )}
        >
          <BarChart3 size={18} />
        </button>

        <DoneToggle done={c.playedToday} skipped={c.skippedToday && !c.playedToday} compact={compact} onToggle={() => onToggleDone(game.id)} name={game.name} />
      </div>
    </div>
  );
});

function StatusLine({ c, game, customReset, compact, result }) {
  const bits = [];
  if (result)
    bits.push(
      <span
        key="result"
        className={cx(
          'shrink-0 rounded-md px-1.5 font-bold tabular-nums',
          c.todayFailed ? 'bg-rose-400/12 text-rose-300' : 'bg-emerald-400/12 text-emerald-300',
        )}
      >
        {formatResultSummary(game.metrics, result)}
      </span>,
    );
  if (c.restToday && !c.playedToday)
    bits.push(<Badge key="rest" icon={Moon} className="text-sky-300">Rest day</Badge>);
  else if (!c.dueToday && !c.playedToday)
    bits.push(<Badge key="off" icon={Moon} className="text-white/45">Day off</Badge>);
  else if (c.skippedToday && !c.playedToday)
    bits.push(<Badge key="skip" icon={SkipForward} className="text-amber-200/80">Skipped</Badge>);

  if (c.currentStreak > 0)
    bits.push(
      <span key="streak" className={cx('flex shrink-0 items-center gap-0.5 font-semibold', c.atRisk ? 'text-orange-400' : 'text-orange-300')}>
        <Flame size={12} className="fill-orange-400/60" />
        {c.currentStreak}
      </span>,
    );

  if (c.atRisk)
    bits.push(<Badge key="risk" icon={Hourglass} className="font-semibold text-orange-300">{formatDuration(c.msUntilReset)} left</Badge>);
  else if (customReset && c.todo)
    bits.push(<Badge key="ends" icon={Hourglass}>{formatDuration(c.msUntilReset)}</Badge>);
  else if (customReset && c.playedToday)
    bits.push(<Badge key="next" icon={Hourglass}>new in {formatDuration(c.msUntilReset)}</Badge>);

  if (!compact && !result && bits.length < 3) bits.unshift(<span key="host" className="min-w-0 truncate">{hostnameOf(game.url)}</span>);
  return bits;
}

function Badge({ icon: Icon, className, children }) {
  return (
    <span className={cx('flex shrink-0 items-center gap-1', className)}>
      <Icon size={11} />
      {children}
    </span>
  );
}

function DoneToggle({ done, skipped, compact, onToggle, name }) {
  return (
    <motion.button
      onClick={onToggle}
      onPointerDown={(e) => e.stopPropagation()}
      whileTap={{ scale: 0.82 }}
      role="switch"
      aria-checked={done}
      aria-label={done ? `Unmark ${name}` : `Mark ${name} as done for today`}
      className={cx(
        'relative grid shrink-0 place-items-center rounded-full border-2 transition-colors duration-200',
        compact ? 'h-9 w-9' : 'h-11 w-11',
        done
          ? 'border-emerald-400 bg-emerald-400 text-ink-950 shadow-[0_0_24px_-4px_rgba(52,211,153,0.8)]'
          : skipped
            ? 'border-amber-300/40 bg-amber-300/10 text-amber-200/70'
            : 'border-white/20 bg-white/5 text-transparent hover:border-white/40',
      )}
    >
      <AnimatePresence initial={false}>
        {done && (
          <motion.span key="check" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}>
            <Check size={compact ? 18 : 22} strokeWidth={3.2} />
          </motion.span>
        )}
      </AnimatePresence>
      {skipped && <SkipForward size={16} />}
      <AnimatePresence initial={false}>
        {done && (
          <motion.span
            key="ring"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-300"
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 1.9, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default GameCard;
