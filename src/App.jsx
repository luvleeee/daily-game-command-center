import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, CopyPlus, Moon, PartyPopper, SkipForward, Trash2, Trophy } from 'lucide-react';
import { useGameState } from './hooks/useGameState';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import RouletteButton from './components/RouletteButton';
import ReturnPrompt from './components/ReturnPrompt';
import Toasts from './components/ui/Toasts';
import Confetti from './components/ui/Confetti';
import GameFormModal from './components/modals/GameFormModal';
import CategoryModal from './components/modals/CategoryModal';
import StatsModal from './components/modals/StatsModal';
import RouletteModal from './components/modals/RouletteModal';
import SettingsModal from './components/modals/SettingsModal';
import ResultModal from './components/modals/ResultModal';
import OverviewModal from './components/modals/OverviewModal';
import QuickActionsModal from './components/modals/QuickActionsModal';
import { fireConfetti, toast } from './lib/events';
import { haptic, sound } from './lib/feedback';
import { toDayKey } from './lib/dates';

const LAUNCH_KEY = 'gcc:lastLaunch';

/**
 * App = layout + which sheet is open + cross-cutting UX (undo toasts, return prompt,
 * celebrations, shortcuts). All data logic lives in useGameState.
 */
export default function App() {
  const gs = useGameState();
  const { state, now, settings, restDays, categories, games, activeGames, archivedGames, gamesByCategory, progress, unplayedToday, actions } = gs;

  const [modal, setModal] = useState(null); // { type, id?, categoryId?, day? }
  const [organizing, setOrganizing] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [search, setSearch] = useState('');
  const [returnId, setReturnId] = useState(null);
  const searchRef = useRef(null);

  const open = useCallback((type, extra = {}) => setModal({ type, ...extra }), []);
  const close = useCallback(() => setModal(null), []);
  const findGame = (id) => games.find((g) => g.id === id);
  const todayLocal = toDayKey(new Date(now));
  const restToday = restDays.includes(todayLocal);

  /* ---------- launching + "back from the game?" prompt ---------- */
  const recordLaunch = useCallback((game) => {
    try {
      sessionStorage.setItem(LAUNCH_KEY, JSON.stringify({ id: game.id, at: Date.now() }));
    } catch {
      /* ignore */
    }
  }, []);

  const launchGame = useCallback(
    (game) => {
      recordLaunch(game);
      window.open(game.url, '_blank', 'noopener');
    },
    [recordLaunch],
  );

  const gamesRef = useRef(games);
  gamesRef.current = games;
  useEffect(() => {
    if (!settings.returnPrompt) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const launch = JSON.parse(sessionStorage.getItem(LAUNCH_KEY) || 'null');
        if (!launch || Date.now() - launch.at < 5000) return;
        sessionStorage.removeItem(LAUNCH_KEY);
        const g = gamesRef.current.find((x) => x.id === launch.id);
        if (g && !g.computed.playedToday) setReturnId(g.id);
      } catch {
        /* ignore */
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [settings.returnPrompt]);

  /* ---------- done / results ---------- */
  const toggleDone = useCallback(
    (id) => {
      const nowPlayed = actions.toggleDone(id);
      setReturnId((r) => (r === id ? null : r));
      if (!nowPlayed) return;
      haptic(12);
      sound.done();
      const g = gamesRef.current.find((x) => x.id === id);
      if (g && g.metrics.length && g.askResult) setTimeout(() => open('result', { id }), 260);
    },
    [actions, open],
  );

  const onResultClosed = (reason) => {
    close();
    if (reason?.pb) toast({ message: `New personal best: ${reason.pb.join(', ')}!`, icon: Trophy });
  };

  // Celebrate the moment the last game of the day is ticked
  const prevDone = useRef(progress.done);
  useEffect(() => {
    const was = prevDone.current;
    prevDone.current = progress.done;
    if (progress.total > 0 && progress.done === progress.total && was < progress.total && was === progress.done - 1) {
      sound.win();
      haptic([30, 50, 30, 50, 60]);
      fireConfetti();
      toast({ message: 'Every game done today — streaks secured!', icon: PartyPopper });
    }
  }, [progress.done, progress.total]);

  /* ---------- destructive actions with Undo ---------- */
  const withUndo = useCallback(
    (message, icon, fn) => {
      const snapshot = actions.snapshot();
      fn();
      toast({ message, icon, action: 'Undo', onAction: () => (actions.restore(snapshot), sound.undo()) });
    },
    [actions],
  );

  const handlers = {
    onOpenGame: launchGame,
    onToggleDone: toggleDone,
    onLogResult: (id, day) => open('result', { id, day }),
    onSkip: (id) => {
      const g = findGame(id);
      withUndo(g?.computed.skippedToday ? `${g.name} unskipped` : `${g?.name} skipped — streak kept`, SkipForward, () => actions.toggleSkipToday(id));
    },
    onOpenStats: (id) => open('stats', { id }),
    onEdit: (id) => open('game', { id }),
    onDuplicate: (id) => {
      const newId = actions.duplicateGame(id);
      toast({ message: 'Game duplicated', icon: CopyPlus });
      setTimeout(() => open('game', { id: newId }), 150);
    },
    onArchive: (id) => {
      const g = findGame(id);
      close();
      withUndo(`${g?.name} archived`, Archive, () => actions.setArchived(id, true));
    },
    onDelete: (id) => {
      const g = findGame(id);
      withUndo(`${g?.name} deleted`, Trash2, () => actions.deleteGame(id));
    },
  };

  const toggleRestDay = () => {
    actions.toggleRestDay(todayLocal);
    if (!restToday) toast({ message: 'Rest day on — streaks are safe today', icon: Moon, action: 'Undo', onAction: () => actions.toggleRestDay(todayLocal) });
  };

  /* ---------- roulette ---------- */
  const playFromRoulette = (game) => {
    launchGame(game);
    close();
    const category = categories.find((c) => c.id === game.categoryId);
    if (category?.collapsed) actions.toggleCategoryCollapse(category.id, false);
    if (settings.filter === 'done') actions.updateSettings({ filter: 'all' });
    setHighlightId(game.id);
    setTimeout(() => document.getElementById(`game-${game.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
  };

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 3500);
    return () => clearTimeout(t);
  }, [highlightId]);

  /* ---------- keyboard shortcuts (desktop) ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || modal) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'n') open('game');
      else if (k === 'r') open('roulette');
      else if (k === 'o') setOrganizing((o) => !o);
      else if (k === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, open]);

  const editingCategory = modal?.type === 'category' && modal.id ? categories.find((c) => c.id === modal.id) : null;
  const returnGame = returnId ? findGame(returnId) : null;

  const cardProps = {
    compact: settings.density === 'compact',
    showResult: settings.showResultsOnCards,
    onToggleDone: toggleDone,
    onOpenStats: handlers.onOpenStats,
    onLaunch: recordLaunch,
    onLongPress: (id) => open('quick', { id }),
  };

  return (
    <div className="app-bg min-h-dvh">
      <Header
        now={now}
        progress={progress}
        restToday={restToday}
        organizing={organizing}
        onToggleOrganize={() => {
          setOrganizing((o) => !o);
          setSearch('');
        }}
        onOpenSettings={() => open('settings')}
        onOpenOverview={() => open('overview')}
        onToggleRestDay={toggleRestDay}
        onShowAtRisk={() => open('overview')}
        onAddGame={() => open('game')}
        onAddCategory={() => open('category')}
      />

      <main className="px-safe mx-auto max-w-2xl pt-5 pb-40">
        <Dashboard
          categories={categories}
          gamesByCategory={gamesByCategory}
          organizing={organizing}
          highlightId={highlightId}
          settings={settings}
          search={search}
          onSearch={setSearch}
          searchRef={searchRef}
          actions={actions}
          cardProps={cardProps}
          onEditCategory={(id) => open('category', { id })}
          onAddGame={(categoryId) => open('game', { categoryId })}
        />
      </main>

      {!organizing && <RouletteButton remaining={unplayedToday.length} onClick={() => open('roulette')} />}

      <ReturnPrompt
        game={!modal && returnGame && !returnGame.computed.playedToday ? returnGame : null}
        onDone={() => {
          toggleDone(returnId);
          setReturnId(null);
        }}
        onLog={() => {
          open('result', { id: returnId });
          setReturnId(null);
        }}
        onDismiss={() => setReturnId(null)}
      />

      {/* ---------- sheets ---------- */}
      <GameFormModal
        open={modal?.type === 'game'}
        onClose={close}
        game={modal?.type === 'game' && modal.id ? findGame(modal.id) : null}
        defaultCategoryId={modal?.categoryId}
        categories={categories}
        allGames={games}
        actions={actions}
      />
      <CategoryModal
        open={modal?.type === 'category'}
        onClose={close}
        category={editingCategory}
        categories={categories}
        gameCount={editingCategory ? (gamesByCategory.get(editingCategory.id)?.length ?? 0) : 0}
        actions={actions}
      />
      <StatsModal
        open={modal?.type === 'stats'}
        onClose={close}
        game={modal?.type === 'stats' ? findGame(modal.id) : null}
        restDays={restDays}
        actions={actions}
        {...handlers}
        onToggleDone={toggleDone}
      />
      <ResultModal
        open={modal?.type === 'result'}
        onClose={(reason) => onResultClosed(reason && (typeof reason === 'string' || reason.pb) ? reason : undefined)}
        game={modal?.type === 'result' ? findGame(modal.id) : null}
        day={modal?.day}
        actions={actions}
      />
      <QuickActionsModal open={modal?.type === 'quick'} onClose={close} game={modal?.type === 'quick' ? findGame(modal.id) : null} handlers={handlers} />
      <RouletteModal
        open={modal?.type === 'roulette'}
        onClose={close}
        candidates={unplayedToday}
        categories={categories}
        totalGames={activeGames.length}
        mode={settings.rouletteMode}
        onModeChange={(rouletteMode) => actions.updateSettings({ rouletteMode })}
        onPlay={playFromRoulette}
      />
      <OverviewModal open={modal?.type === 'overview'} onClose={close} games={activeGames} restDays={restDays} now={now} onOpenStats={(id) => open('stats', { id })} />
      <SettingsModal
        open={modal?.type === 'settings'}
        onClose={close}
        state={state}
        archivedGames={archivedGames}
        restToday={restToday}
        onToggleRestDay={toggleRestDay}
        actions={actions}
        onDeleteGame={handlers.onDelete}
      />

      <Toasts />
      {settings.confetti && <Confetti />}
    </div>
  );
}
