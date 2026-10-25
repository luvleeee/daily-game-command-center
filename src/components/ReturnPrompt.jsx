import { AnimatePresence, motion } from 'framer-motion';
import { Check, PenLine, X } from 'lucide-react';
import GameIcon from './GameIcon';

/** "Back from Wordle? Mark done / Log score" — shown when you return to the app after launching a game. */
export default function ReturnPrompt({ game, onDone, onLog, onDismiss }) {
  return (
    <AnimatePresence>
      {game && (
        <motion.div
          key={game.id}
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 z-[45] mx-auto max-w-md px-4"
          style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 16px) + 72px)' }}
          role="dialog"
          aria-label={`Done with ${game.name}?`}
        >
          <div className="glass-strong flex items-center gap-3 rounded-3xl p-3 shadow-2xl shadow-black/60">
            <GameIcon name={game.name} url={game.url} iconUrl={game.iconUrl} color={game.color} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">Back from {game.name}?</p>
              <p className="text-xs text-white/45">Tap to record it</p>
            </div>
            {game.metrics.length ? (
              <>
                <button onClick={onDone} aria-label={`Mark ${game.name} done without a score`} className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/20 text-emerald-300">
                  <Check size={17} strokeWidth={3} />
                </button>
                <button onClick={onLog} className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-3 text-sm font-semibold text-white">
                  <PenLine size={15} /> Score
                </button>
              </>
            ) : (
              <button onClick={onDone} className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-400 px-3 text-sm font-semibold text-ink-950">
                <Check size={16} strokeWidth={3} /> Done
              </button>
            )}
            <button onClick={onDismiss} aria-label="Dismiss" className="grid h-10 w-8 place-items-center text-white/40">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
