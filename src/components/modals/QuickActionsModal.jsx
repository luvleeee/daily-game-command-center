import { Archive, BarChart3, CopyPlus, ExternalLink, Pencil, PenLine, SkipForward, Trash2, Check } from 'lucide-react';
import Sheet from '../ui/Sheet';
import GameIcon from '../GameIcon';
import { formatResultSummary } from '../../lib/metrics';
import { cx } from '../ui/primitives';

/** Long-press / right-click menu for a game card. */
export default function QuickActionsModal({ open, onClose, game, handlers }) {
  return (
    <Sheet open={open && Boolean(game)} onClose={onClose} title={game?.name ?? ''}>
      {game && <Body game={game} onClose={onClose} {...handlers} />}
    </Sheet>
  );
}

function Body({ game, onClose, onOpenGame, onToggleDone, onLogResult, onSkip, onOpenStats, onEdit, onDuplicate, onArchive, onDelete }) {
  const c = game.computed;
  const scored = game.metrics.length > 0;
  const items = [
    { icon: ExternalLink, label: 'Open game', run: () => onOpenGame(game) },
    { icon: Check, label: c.playedToday ? 'Unmark today' : 'Mark done', run: () => onToggleDone(game.id), tone: !c.playedToday && 'text-emerald-300' },
    scored && { icon: PenLine, label: c.todayResult ? `Edit result (${formatResultSummary(game.metrics, c.todayResult)})` : 'Log result', run: () => onLogResult(game.id) },
    !c.playedToday && { icon: SkipForward, label: c.skippedToday ? 'Unskip today' : 'Skip today (keeps streak)', run: () => onSkip(game.id) },
    { icon: BarChart3, label: 'Stats & history', run: () => onOpenStats(game.id) },
    { icon: Pencil, label: 'Edit', run: () => onEdit(game.id) },
    { icon: CopyPlus, label: 'Duplicate', run: () => onDuplicate(game.id) },
    { icon: Archive, label: 'Archive', run: () => onArchive(game.id) },
    { icon: Trash2, label: 'Delete', run: () => onDelete(game.id), tone: 'text-rose-300' },
  ].filter(Boolean);

  return (
    <div className="pt-1">
      <div className="mb-3 flex items-center gap-3">
        <GameIcon name={game.name} url={game.url} iconUrl={game.iconUrl} color={game.color} size={40} />
        <p className="text-sm text-white/50">
          {c.currentStreak > 0 ? `${c.currentStreak}-day streak` : 'No active streak'} · {c.totalPlays} plays
        </p>
      </div>
      <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/8 bg-white/4">
        {items.map(({ icon: Icon, label, run, tone }) => (
          <button
            key={label}
            onClick={() => {
              onClose();
              // let the sheet close before opening another one
              setTimeout(run, 120);
            }}
            className={cx('flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-white/85 active:bg-white/8', tone)}
          >
            <Icon size={18} className="shrink-0 opacity-80" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
