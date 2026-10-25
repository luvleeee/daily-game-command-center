import { useEffect, useState } from 'react';
import { Check, FolderPlus } from 'lucide-react';
import Sheet from '../ui/Sheet';
import { Button, ConfirmButton, Field, inputClass } from '../ui/primitives';

/** Create a category, or rename / delete an existing one (pass `category`). */
export default function CategoryModal({ open, onClose, category, categories, gameCount, actions }) {
  const editing = Boolean(category);
  const [name, setName] = useState('');
  const others = categories.filter((c) => c.id !== category?.id);
  const [moveTo, setMoveTo] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setMoveTo(others[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing) actions.renameCategory(category.id, name);
    else actions.addCategory(name);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit category' : 'New category'}
      footer={
        <Button type="submit" form="category-form" className="w-full" disabled={!name.trim()}>
          {editing ? <Check size={18} /> : <FolderPlus size={18} />}
          {editing ? 'Save' : 'Create category'}
        </Button>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-5 pt-2">
        <Field label="Name" hint={!editing ? 'e.g. Word Games, Geography, Math' : undefined}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            maxLength={30}
            autoFocus
          />
        </Field>

        {editing && (
          <div className="space-y-3 rounded-2xl border border-rose-400/15 bg-rose-500/5 p-4">
            <p className="text-sm font-semibold text-rose-200">Delete category</p>
            {others.length === 0 ? (
              <p className="text-xs text-white/50">You need at least one category. Create another one first.</p>
            ) : (
              <>
                {gameCount > 0 && (
                  <Field label={`Move its ${gameCount} game${gameCount > 1 ? 's' : ''} to`}>
                    <select className={inputClass} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                      {others.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <ConfirmButton
                  type="button"
                  className="w-full"
                  onConfirm={() => {
                    actions.deleteCategory(category.id, moveTo || undefined);
                    onClose();
                  }}
                >
                  Delete “{category.name}”
                </ConfirmButton>
              </>
            )}
          </div>
        )}
      </form>
    </Sheet>
  );
}
