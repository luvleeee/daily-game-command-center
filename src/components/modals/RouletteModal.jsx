import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { Dices, ExternalLink, PartyPopper, RefreshCw, Shuffle, Hourglass } from 'lucide-react';
import Sheet from '../ui/Sheet';
import GameIcon from '../GameIcon';
import { Button, Chip, Segmented } from '../ui/primitives';
import { hostnameOf } from '../../lib/favicon';
import { fireConfetti } from '../../lib/events';
import { haptic, sound } from '../../lib/feedback';

const ITEM_H = 68; // px — height of one reel row
const VISIBLE = 3; // rows visible in the window (winner lands in the middle one)
const MIN_REEL = 36; // minimum rows the reel scrolls past → long enough to feel like a spin

/**
 * Slot-machine reel: we pick the winner FIRST (uniform random), then build a long
 * strip of repeated candidates and ease the strip so the winner stops in the centre.
 */
export default function RouletteModal({ open, onClose, candidates, categories, totalGames, mode, onModeChange, onPlay }) {
  return (
    <Sheet open={open} onClose={onClose} title="Feeling lucky?">
      {open && (
        <Roulette candidates={candidates} categories={categories} totalGames={totalGames} mode={mode} onModeChange={onModeChange} onPlay={onPlay} />
      )}
    </Sheet>
  );
}

/** 'neglected' mode: games you haven't touched for a while are more likely to come up. */
function pickWinner(pool, mode) {
  if (mode !== 'neglected') return Math.floor(Math.random() * pool.length);
  const weights = pool.map((g) => 1 + Math.min(g.computed.daysSinceLastPlay ?? 10, 14));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return pool.length - 1;
}

function Roulette({ candidates, categories, totalGames, mode, onModeChange, onPlay }) {
  // Freeze the candidates when the sheet opens so ticking a game mid-spin can't reshuffle them
  const [frozen] = useState(candidates);
  const [categoryId, setCategoryId] = useState('all');
  const pool = useMemo(() => (categoryId === 'all' ? frozen : frozen.filter((g) => g.categoryId === categoryId)), [frozen, categoryId]);
  const usedCategories = categories.filter((c) => frozen.some((g) => g.categoryId === c.id));
  const [phase, setPhase] = useState('idle'); // idle | spinning | done
  const [winner, setWinner] = useState(null);
  const [reel, setReel] = useState([]);
  const y = useMotionValue(0);
  const anim = useRef(null);

  const spin = useCallback(() => {
    if (!pool.length) return;
    anim.current?.stop();
    const winnerIdx = pickWinner(pool, mode);
    const loops = Math.max(3, Math.ceil(MIN_REEL / pool.length));
    // Shuffle each loop a bit so a short list doesn't look like a fixed pattern
    const strip = [];
    for (let l = 0; l < loops; l++) strip.push(...shuffle(pool));
    strip.push(pool[winnerIdx]); // landing row
    strip.push(...[...shuffle(pool), ...shuffle(pool)].slice(0, 2)); // 2 rows of padding under the winner
    const landing = strip.length - 3;

    setReel(strip);
    setWinner(null);
    setPhase('spinning');
    y.set(0);

    const target = -(landing * ITEM_H) + ITEM_H; // centre row of the window
    let lastRow = 0;
    anim.current = animate(y, target, {
      duration: 3.4,
      ease: [0.08, 0.82, 0.17, 1], // fast start, long satisfying slow-down
      onUpdate: (v) => {
        const row = Math.floor(-v / ITEM_H);
        if (row !== lastRow) {
          lastRow = row;
          haptic(4); // tiny "tick" on Android
          sound.tick();
        }
      },
      onComplete: () => {
        setWinner(pool[winnerIdx]);
        setPhase('done');
        haptic([20, 40, 30]);
        sound.win();
        fireConfetti({ count: 70, origin: { x: 0.5, y: 0.55 } });
      },
    });
  }, [pool, y, mode]);

  // Auto-spin once on open (and again whenever the category filter changes)
  const spinRef = useRef(spin);
  spinRef.current = spin;
  useEffect(() => {
    const t = setTimeout(() => spinRef.current(), 250);
    return () => {
      clearTimeout(t);
      anim.current?.stop();
    };
  }, [categoryId]);

  const initialStrip = useMemo(() => shuffle(pool).slice(0, VISIBLE), [pool]);
  const rows = reel.length ? reel : initialStrip;

  if (!frozen.length) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12 }}
          className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-400/15 text-emerald-300"
        >
          <PartyPopper size={32} />
        </motion.div>
        <p className="mt-4 text-lg font-semibold text-white">
          {totalGames ? 'Every game is done today!' : 'Add some games first'}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {totalGames ? 'Come back after midnight for a fresh spin.' : 'The roulette picks from games you haven’t played today.'}
        </p>
      </div>
    );
  }

  return (
    <div className="pt-1">
      <div className="mb-3 space-y-2">
        <Segmented
          size="sm"
          value={mode}
          onChange={onModeChange}
          options={[
            { id: 'random', label: 'Pure random', icon: Shuffle },
            { id: 'neglected', label: 'Favour neglected', icon: Hourglass },
          ]}
        />
        {usedCategories.length > 1 && (
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
            <Chip active={categoryId === 'all'} onClick={() => setCategoryId('all')} className="h-8 text-xs">
              All
            </Chip>
            {usedCategories.map((c) => (
              <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} className="h-8 text-xs">
                {c.name}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <p className="mb-3 text-center text-sm text-white/50">
        Picking from <span className="font-semibold text-white/80">{pool.length}</span> game{pool.length > 1 ? 's' : ''} you
        haven’t played today
      </p>

      {/* Reel window */}
      <div
        className="relative mx-auto overflow-hidden rounded-3xl border border-white/10 bg-black/40"
        style={{ height: ITEM_H * VISIBLE }}
      >
        {/* centre highlight band */}
        <motion.div
          className="pointer-events-none absolute inset-x-2 z-10 rounded-2xl border-2"
          style={{ top: ITEM_H, height: ITEM_H }}
          animate={
            phase === 'done'
              ? {
                  borderColor: 'rgba(232,121,249,0.9)',
                  boxShadow: ['0 0 0px rgba(232,121,249,0)', '0 0 36px rgba(232,121,249,0.65)', '0 0 18px rgba(232,121,249,0.4)'],
                }
              : { borderColor: 'rgba(167,139,250,0.45)', boxShadow: '0 0 0px rgba(0,0,0,0)' }
          }
          transition={{ duration: 0.6 }}
        />
        {/* top/bottom fades */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-gradient-to-b from-[#0f0f1a] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t from-[#0f0f1a] to-transparent" />

        <motion.div style={{ y }}>
          {rows.map((g, i) => (
            <div key={i} className="flex items-center gap-3 px-6" style={{ height: ITEM_H }}>
              <GameIcon name={g.name} url={g.url} iconUrl={g.iconUrl} size={40} />
              <span className="truncate text-lg font-semibold text-white">{g.name}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Reveal */}
      <div className="mt-5 min-h-[124px]">
        <AnimatePresence mode="wait">
          {phase === 'done' && winner ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="space-y-3"
            >
              <p className="text-center text-sm text-white/50">
                Today’s pick: <span className="font-bold text-white">{winner.name}</span>
                <span className="text-white/35"> · {hostnameOf(winner.url)}</span>
              </p>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button onClick={() => onPlay(winner)}>
                  <ExternalLink size={18} /> Play {winner.name}
                </Button>
                <Button variant="secondary" onClick={() => spin()} aria-label="Spin again" className="px-4">
                  <RefreshCw size={18} />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="spinning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 pt-6 text-sm font-medium text-white/50"
            >
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
                <Dices size={18} />
              </motion.span>
              Spinning…
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
