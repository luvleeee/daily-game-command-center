import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  STORAGE_KEY,
  createInitialState,
  loadState,
  makeGame,
  requestPersistentStorage,
  sanitizeState,
  saveState,
  uid,
} from '../lib/storage';
import { emptyStats, getGameStats, toggleInList } from '../lib/stats';
import { gameDayKey } from '../lib/schedule';
import { setFeedbackPrefs } from '../lib/feedback';
import { useNow } from './useNow';

/* ------------------------------------------------------------------ */
/* Reducer — pure & serialisable                                        */
/* ------------------------------------------------------------------ */

const byOrder = (a, b) => a.order - b.order;
const nextOrder = (items) => (items.length ? Math.max(...items.map((i) => i.order)) + 1 : 0);

const mapGame = (state, id, fn) => ({ ...state, games: state.games.map((g) => (g.id === id ? fn(g) : g)) });

/** Set a day to played / skipped / none, keeping the three lists consistent. */
function withDayStatus(stats, day, status) {
  const results = { ...stats.results };
  if (status !== 'played') delete results[day];
  return {
    ...stats,
    playedDays: toggleInList(stats.playedDays, day, status === 'played'),
    skippedDays: toggleInList(stats.skippedDays, day, status === 'skipped'),
    results,
  };
}

function reducer(state, action) {
  switch (action.type) {
    /* ---------- categories ---------- */
    case 'category/add':
      return {
        ...state,
        categories: [...state.categories, { id: action.id, name: action.name, order: nextOrder(state.categories), collapsed: false }],
      };
    case 'category/rename':
      return { ...state, categories: state.categories.map((c) => (c.id === action.id ? { ...c, name: action.name } : c)) };
    case 'category/toggleCollapse':
      return {
        ...state,
        categories: state.categories.map((c) => (c.id === action.id ? { ...c, collapsed: action.force ?? !c.collapsed } : c)),
      };
    case 'category/setAllCollapsed':
      return { ...state, categories: state.categories.map((c) => ({ ...c, collapsed: action.collapsed })) };
    case 'category/delete': {
      if (state.categories.length <= 1) return state;
      const target = action.moveTo ?? state.categories.filter((c) => c.id !== action.id).sort(byOrder)[0].id;
      const base = nextOrder(state.games.filter((g) => g.categoryId === target));
      let i = 0;
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        games: state.games.map((g) => (g.categoryId === action.id ? { ...g, categoryId: target, order: base + i++ } : g)),
      };
    }
    case 'category/reorder': {
      const rank = new Map(action.orderedIds.map((id, i) => [id, i]));
      return { ...state, categories: state.categories.map((c) => ({ ...c, order: rank.get(c.id) ?? c.order })) };
    }

    /* ---------- games ---------- */
    case 'game/add': {
      const siblings = state.games.filter((g) => g.categoryId === action.game.categoryId);
      return { ...state, games: [...state.games, makeGame({ ...action.game, order: nextOrder(siblings) })] };
    }
    case 'game/update':
      return mapGame(state, action.id, (g) => {
        const moved = action.patch.categoryId && action.patch.categoryId !== g.categoryId;
        const order = moved ? nextOrder(state.games.filter((x) => x.categoryId === action.patch.categoryId)) : g.order;
        return { ...g, ...action.patch, order };
      });
    case 'game/duplicate': {
      const src = state.games.find((g) => g.id === action.id);
      if (!src) return state;
      const copy = { ...structuredClone(src), id: action.newId, name: `${src.name} (copy)`, stats: emptyStats(), createdAt: new Date().toISOString() };
      return { ...state, games: [...state.games, { ...copy, order: src.order + 0.5 }] };
    }
    case 'game/delete':
      return { ...state, games: state.games.filter((g) => g.id !== action.id) };
    case 'game/reorder': {
      const rank = new Map(action.orderedIds.map((id, i) => [id, i]));
      return { ...state, games: state.games.map((g) => (rank.has(g.id) ? { ...g, order: rank.get(g.id) } : g)) };
    }
    case 'game/setDay':
      return mapGame(state, action.id, (g) => ({ ...g, stats: withDayStatus(g.stats, action.day, action.status) }));
    case 'game/setResult':
      return mapGame(state, action.id, (g) => {
        const stats = withDayStatus(g.stats, action.day, 'played');
        if (action.result) stats.results = { ...stats.results, [action.day]: { ...action.result, at: new Date().toISOString() } };
        else delete stats.results[action.day];
        return { ...g, stats };
      });
    case 'game/resetStats':
      return mapGame(state, action.id, (g) => ({ ...g, stats: emptyStats() }));

    /* ---------- global ---------- */
    case 'restDay/toggle':
      return { ...state, restDays: toggleInList(state.restDays, action.day) };
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'state/replace':
      return action.state;
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Hook                                                                 */
/* ------------------------------------------------------------------ */

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const now = useNow();
  const fromOtherTab = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist every change.
  useEffect(() => {
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    saveState(state);
  }, [state]);

  // Persistent storage + cross-tab sync.
  useEffect(() => {
    requestPersistentStorage();
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = sanitizeState(JSON.parse(e.newValue));
        if (next) {
          fromOtherTab.current = true;
          dispatch({ type: 'state/replace', state: next });
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => setFeedbackPrefs({ haptics: state.settings.haptics, sounds: state.settings.sounds }), [state.settings.haptics, state.settings.sounds]);

  /* ---------- derived ---------- */
  const categories = useMemo(() => [...state.categories].sort(byOrder), [state.categories]);

  const games = useMemo(() => {
    const date = new Date(now);
    return state.games.map((g) => ({ ...g, computed: getGameStats(g, date, state.restDays) }));
  }, [state.games, state.restDays, now]);

  const activeGames = useMemo(() => games.filter((g) => !g.archived), [games]);
  const archivedGames = useMemo(() => games.filter((g) => g.archived), [games]);

  const gamesByCategory = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, []]));
    for (const g of activeGames) map.get(g.categoryId)?.push(g);
    for (const list of map.values()) list.sort(byOrder);
    return map;
  }, [categories, activeGames]);

  const progress = useMemo(() => {
    const counted = activeGames.filter((g) => g.computed.active);
    const done = counted.filter((g) => g.computed.playedToday).length;
    const skipped = activeGames.filter((g) => g.computed.skippedToday).length;
    const resting = activeGames.filter((g) => !g.computed.dueToday).length;
    const atRisk = counted.filter((g) => g.computed.atRisk);
    return { done, total: counted.length, ratio: counted.length ? done / counted.length : 0, skipped, resting, atRisk };
  }, [activeGames]);

  const unplayedToday = useMemo(() => activeGames.filter((g) => g.computed.todo && g.url && g.inRoulette), [activeGames]);

  // Home-screen icon badge (installed PWAs on iOS 16.4+, Android, desktop)
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const left = progress.total - progress.done;
    if (state.settings.appBadge && left > 0) navigator.setAppBadge(left).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  }, [state.settings.appBadge, progress.total, progress.done]);

  /* ---------- actions ---------- */
  const actions = useMemo(() => {
    const dayFor = (id) => {
      const g = stateRef.current.games.find((x) => x.id === id);
      return g ? gameDayKey(g, new Date()) : null;
    };
    return {
      addCategory: (name) => {
        const id = uid();
        dispatch({ type: 'category/add', id, name: name.trim() });
        return id;
      },
      renameCategory: (id, name) => dispatch({ type: 'category/rename', id, name: name.trim() }),
      deleteCategory: (id, moveTo) => dispatch({ type: 'category/delete', id, moveTo }),
      toggleCategoryCollapse: (id, force) => dispatch({ type: 'category/toggleCollapse', id, force }),
      setAllCollapsed: (collapsed) => dispatch({ type: 'category/setAllCollapsed', collapsed }),
      reorderCategories: (orderedIds) => dispatch({ type: 'category/reorder', orderedIds }),

      addGame: (game) => {
        const id = uid();
        dispatch({ type: 'game/add', game: { ...game, id } });
        return id;
      },
      updateGame: (id, patch) => dispatch({ type: 'game/update', id, patch }),
      duplicateGame: (id) => {
        const newId = uid();
        dispatch({ type: 'game/duplicate', id, newId });
        return newId;
      },
      deleteGame: (id) => dispatch({ type: 'game/delete', id }),
      setArchived: (id, archived) => dispatch({ type: 'game/update', id, patch: { archived } }),
      reorderGames: (orderedIds) => dispatch({ type: 'game/reorder', orderedIds }),

      /** Toggle played for the game's CURRENT game-day. Returns the new played state. */
      toggleDone: (id) => {
        const day = dayFor(id);
        const g = stateRef.current.games.find((x) => x.id === id);
        if (!day || !g) return false;
        const played = g.stats.playedDays.includes(day);
        dispatch({ type: 'game/setDay', id, day, status: played ? 'none' : 'played' });
        return !played;
      },
      toggleSkipToday: (id) => {
        const day = dayFor(id);
        const g = stateRef.current.games.find((x) => x.id === id);
        if (!day || !g) return;
        dispatch({ type: 'game/setDay', id, day, status: g.stats.skippedDays.includes(day) ? 'none' : 'skipped' });
      },
      /** Backfill / fix any day: 'played' | 'skipped' | 'none' */
      setDayStatus: (id, day, status) => dispatch({ type: 'game/setDay', id, day, status }),
      /** Save a result (also marks the day played). `day` defaults to the current game-day. */
      setResult: (id, result, day) => dispatch({ type: 'game/setResult', id, day: day ?? dayFor(id), result }),
      resetStats: (id) => dispatch({ type: 'game/resetStats', id }),

      toggleRestDay: (day) => dispatch({ type: 'restDay/toggle', day }),
      updateSettings: (patch) => dispatch({ type: 'settings/update', patch }),

      snapshot: () => stateRef.current,
      restore: (snap) => dispatch({ type: 'state/replace', state: snap }),
      importState: (raw) => {
        const next = sanitizeState(raw);
        if (!next) return false;
        dispatch({ type: 'state/replace', state: next });
        return true;
      },
      resetAll: () => dispatch({ type: 'state/replace', state: createInitialState() }),
    };
  }, []);

  return {
    state,
    now,
    settings: state.settings,
    restDays: state.restDays,
    categories,
    games,
    activeGames,
    archivedGames,
    gamesByCategory,
    progress,
    unplayedToday,
    actions,
  };
}
