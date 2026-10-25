import { useSortable, SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, GripVertical, Pencil, Plus } from 'lucide-react';
import { SortableGameCard } from './GameCard';
import { useDndSensors } from '../hooks/useDndSensors';
import { cx } from './ui/primitives';

/**
 * One category = one sortable item in the OUTER (category) DndContext,
 * plus its own INNER DndContext so games can only be reordered within it.
 */
export default function CategorySection({
  category,
  games, // games to display (already filtered/sorted)
  allGames, // every (non-archived) game in the category — for the counter
  organizing,
  filtering,
  highlightId,
  cardProps,
  onToggleCollapse,
  onEdit,
  onAddGame,
  onReorderGames,
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !organizing,
  });
  const sensors = useDndSensors();
  const counted = allGames.filter((g) => g.computed.active);
  const done = counted.filter((g) => g.computed.playedToday).length;
  const ids = games.map((g) => g.id);
  const collapsed = category.collapsed && !filtering;

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onReorderGames(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx('relative', isDragging && 'z-30 opacity-90')}
    >
      <div className={cx('mb-2 flex items-center gap-1.5 rounded-2xl px-1 py-1', isDragging && 'glass-strong shadow-2xl shadow-black/50')}>
        {organizing && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder category ${category.name}`}
            className="drag-handle grid h-9 w-7 cursor-grab place-items-center rounded-lg text-white/40 active:cursor-grabbing active:text-white"
          >
            <GripVertical size={18} />
          </button>
        )}

        <button onClick={() => onToggleCollapse(category.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left" aria-expanded={!collapsed}>
          <motion.span animate={{ rotate: collapsed ? -90 : 0 }} className="text-white/40">
            <ChevronDown size={16} />
          </motion.span>
          <h2 className="truncate text-[13px] font-bold uppercase tracking-[0.14em] text-white/70">{category.name}</h2>
          <span
            className={cx(
              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              counted.length && done === counted.length ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/8 text-white/45',
            )}
          >
            {done}/{counted.length}
          </span>
        </button>

        {organizing ? (
          <button
            onClick={() => onEdit(category.id)}
            aria-label={`Edit category ${category.name}`}
            className="grid h-9 w-9 place-items-center rounded-full text-white/50 hover:bg-white/8 hover:text-white active:scale-90"
          >
            <Pencil size={15} />
          </button>
        ) : (
          <button
            onClick={() => onAddGame(category.id)}
            aria-label={`Add a game to ${category.name}`}
            className="grid h-9 w-9 place-items-center rounded-full text-white/30 hover:bg-white/8 hover:text-white active:scale-90"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            // overflow hidden only while animating so drag shadows / highlight glows aren't clipped
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={handleDragEnd}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <div className={cx('flex flex-col pb-1', cardProps.compact ? 'gap-1.5' : 'gap-2')}>
                  {games.map((game) => (
                    <SortableGameCard key={game.id} game={game} organizing={organizing} highlighted={highlightId === game.id} {...cardProps} />
                  ))}
                  {allGames.length === 0 && !filtering && (
                    <button
                      onClick={() => onAddGame(category.id)}
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 text-sm font-medium text-white/40 transition hover:border-white/25 hover:text-white/70"
                    >
                      <Plus size={16} /> Add a game to {category.name}
                    </button>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
