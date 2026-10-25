import { useMemo } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { ChevronsDownUp, ChevronsUpDown, Gamepad2, PartyPopper, Plus, Search, X } from 'lucide-react';
import CategorySection from './CategorySection';
import { useDndSensors } from '../hooks/useDndSensors';
import { Segmented } from './ui/primitives';

const rank = (g) => (g.computed.todo ? (g.computed.atRisk ? 0 : 1) : g.computed.playedToday ? 3 : 2);

/** Outer DndContext: reorders categories. Each category hosts its own game DndContext. */
export default function Dashboard({
  categories,
  gamesByCategory,
  organizing,
  highlightId,
  settings,
  search,
  onSearch,
  searchRef,
  actions,
  cardProps,
  onEditCategory,
  onAddGame,
}) {
  const sensors = useDndSensors();
  const ids = categories.map((c) => c.id);
  const filter = organizing ? 'all' : settings.filter;
  const query = organizing ? '' : search.trim().toLowerCase();
  const filtering = filter !== 'all' || Boolean(query);

  const all = useMemo(() => categories.flatMap((c) => gamesByCategory.get(c.id) ?? []), [categories, gamesByCategory]);
  const counts = {
    all: all.length,
    todo: all.filter((g) => g.computed.todo).length,
    done: all.filter((g) => g.computed.playedToday).length,
  };

  const visibleByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      let list = gamesByCategory.get(c.id) ?? [];
      if (filter === 'todo') list = list.filter((g) => g.computed.todo);
      if (filter === 'done') list = list.filter((g) => g.computed.playedToday);
      if (query) list = list.filter((g) => `${g.name} ${g.url} ${g.notes}`.toLowerCase().includes(query) || c.name.toLowerCase().includes(query));
      if (settings.sortTodoFirst && !organizing) list = [...list].sort((a, b) => rank(a) - rank(b));
      map.set(c.id, list);
    }
    return map;
  }, [categories, gamesByCategory, filter, query, settings.sortTodoFirst, organizing]);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    actions.reorderCategories(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
  };

  if (all.length === 0 && categories.length <= 1) {
    return (
      <div className="glass mt-2 flex flex-col items-center rounded-3xl px-6 py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/20 text-violet-200">
          <Gamepad2 size={28} />
        </div>
        <p className="mt-4 text-lg font-semibold text-white">No games yet</p>
        <p className="mt-1 text-sm text-white/50">Add the daily games you play to start tracking streaks.</p>
        <button
          onClick={() => onAddGame()}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-400 px-5 text-sm font-semibold text-white"
        >
          <Plus size={16} /> Add your first game
        </button>
      </div>
    );
  }

  const shownCategories = filtering ? categories.filter((c) => (visibleByCategory.get(c.id) ?? []).length) : categories;
  const allCollapsed = categories.every((c) => c.collapsed);

  return (
    <>
      {/* Toolbar */}
      {!organizing ? (
        <div className="mb-4 space-y-2">
          <Segmented
            value={settings.filter}
            onChange={(f) => actions.updateSettings({ filter: f })}
            options={[
              { id: 'all', label: 'All', badge: counts.all },
              { id: 'todo', label: 'To play', badge: counts.todo },
              { id: 'done', label: 'Done', badge: counts.done },
            ]}
          />
          {all.length >= 5 && (
            <label className="glass flex h-11 items-center gap-2 rounded-2xl px-3.5">
              <Search size={16} className="shrink-0 text-white/40" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search games"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-white placeholder-white/30 outline-none"
                aria-label="Search games"
                enterKeyHint="search"
              />
              {search && (
                <button onClick={() => onSearch('')} aria-label="Clear search" className="text-white/40">
                  <X size={16} />
                </button>
              )}
            </label>
          )}
        </div>
      ) : (
        <div className="mb-4 space-y-2">
          <p className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-xs text-violet-200/90">
            Drag the <span className="font-semibold">grip handles</span> to reorder. Collapse categories to move them more easily. Tap the
            pencil to rename or delete a category.
          </p>
          <button
            onClick={() => actions.setAllCollapsed(!allCollapsed)}
            className="flex items-center gap-1.5 px-1 text-xs font-semibold text-violet-300"
          >
            {allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      )}

      {filtering && shownCategories.length === 0 && (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-8 text-center">
          {filter === 'todo' && !query ? (
            <>
              <PartyPopper size={28} className="text-emerald-300" />
              <p className="mt-3 font-semibold text-white">All caught up for today</p>
              <p className="mt-1 text-sm text-white/45">Nothing left to play. Nice work.</p>
            </>
          ) : (
            <p className="text-sm text-white/50">No games match.</p>
          )}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-5">
            {shownCategories.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                games={visibleByCategory.get(category.id) ?? []}
                allGames={gamesByCategory.get(category.id) ?? []}
                organizing={organizing}
                filtering={filtering}
                highlightId={highlightId}
                cardProps={cardProps}
                onToggleCollapse={actions.toggleCategoryCollapse}
                onEdit={onEditCategory}
                onAddGame={onAddGame}
                onReorderGames={actions.reorderGames}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}
