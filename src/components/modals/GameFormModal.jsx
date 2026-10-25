import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlarmClock, CalendarDays, Check, Dices, Palette, Plus, Sparkles, StickyNote, Trophy, TriangleAlert } from 'lucide-react';
import Sheet from '../ui/Sheet';
import GameIcon from '../GameIcon';
import { Button, Chip, Field, Section, Segmented, Toggle, cx, inputClass } from '../ui/primitives';
import { hostnameOf, normalizeUrl } from '../../lib/favicon';
import { ACCENTS, PRESETS } from '../../lib/presets';
import {
  DEFAULT_RESET,
  DEFAULT_SCHEDULE,
  WEEKDAYS,
  describeReset,
  describeSchedule,
  deviceTimeZone,
  formatDuration,
  gameDayKey,
  listTimeZones,
  msUntilReset,
} from '../../lib/schedule';
import MetricsEditor from '../MetricsEditor';
import { formatDayKey } from '../../lib/dates';

const NEW = '__new__';
const TIME_ZONES = listTimeZones();

const blank = (categoryId) => ({
  name: '',
  url: '',
  iconUrl: '',
  color: '',
  notes: '',
  inRoulette: true,
  categoryId,
  reset: { ...DEFAULT_RESET },
  schedule: { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] },
  metrics: [],
  askResult: true,
});

/** Add OR edit a game. Pass `game` to edit, `defaultCategoryId` to preselect a category. */
export default function GameFormModal({ open, onClose, game, defaultCategoryId, categories, allGames, actions }) {
  const editing = Boolean(game);
  const [form, setForm] = useState(() => blank(''));
  const [newCategory, setNewCategory] = useState('');
  const [openSection, setOpenSection] = useState(null);
  const [touched, setTouched] = useState(false);
  const [sample, setSample] = useState('');

  useEffect(() => {
    if (!open) return;
    const base = game
      ? structuredClone({
          name: game.name,
          url: game.url,
          iconUrl: game.iconUrl,
          color: game.color,
          notes: game.notes,
          inRoulette: game.inRoulette,
          categoryId: game.categoryId,
          reset: game.reset,
          schedule: game.schedule,
          metrics: game.metrics,
          askResult: game.askResult,
        })
      : blank(defaultCategoryId ?? categories[0]?.id ?? NEW);
    setForm(base);
    setNewCategory('');
    setOpenSection(null);
    setTouched(false);
    setSample('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, game?.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setNested = (key, patch) => setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const normalized = normalizeUrl(form.url);
  const suggested = suggestNameFromUrl(normalized);
  const finalName = form.name.trim() || suggested;

  const duplicate = useMemo(() => {
    if (!normalized) return null;
    const key = urlKey(normalized);
    return allGames.find((g) => g.id !== game?.id && g.url && urlKey(g.url) === key);
  }, [normalized, allGames, game?.id]);

  const errors = {
    name: !finalName ? 'Give your game a name' : null,
    url: !normalized ? 'Enter a valid link, e.g. krillion.io' : null,
    category: form.categoryId === NEW && !newCategory.trim() ? 'Name your new category' : null,
    schedule: form.schedule.type === 'weekdays' && !form.schedule.days.length ? 'Pick at least one day' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const applyPreset = (p) => {
    const existing = categories.find((c) => c.name.toLowerCase() === p.category.toLowerCase());
    setForm((f) => ({
      ...f,
      name: p.name,
      url: p.url,
      metrics: p.metrics(),
      categoryId: existing ? existing.id : NEW,
    }));
    if (!existing) setNewCategory(p.category);
  };

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) {
      if (errors.schedule) setOpenSection('schedule');
      return;
    }
    const categoryId = form.categoryId === NEW ? actions.addCategory(newCategory) : form.categoryId;
    const payload = {
      ...form,
      name: finalName,
      url: normalized,
      iconUrl: normalizeUrl(form.iconUrl) ?? '',
      notes: form.notes.trim(),
      categoryId,
      metrics: form.metrics.map((m) => ({ ...m, name: m.name.trim() || 'Score' })),
    };
    if (editing) actions.updateGame(game.id, payload);
    else actions.addGame(payload);
    onClose();
  };

  // Live preview of the reset rule
  const previewGame = { reset: form.reset };
  const untilReset = formatDuration(msUntilReset(previewGame));
  const currentDay = formatDayKey(gameDayKey(previewGame));
  const toggleSection = (id) => setOpenSection((s) => (s === id ? null : id));
  const statsSummary = form.metrics.length ? form.metrics.map((m) => m.emoji || m.name).join(' · ') : 'Just played';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit game' : 'Add a game'}
      footer={
        <Button type="submit" form="game-form" className="w-full">
          {editing ? <Check size={18} /> : <Plus size={18} />}
          {editing ? 'Save changes' : 'Add game'}
        </Button>
      }
    >
      <form id="game-form" onSubmit={submit} className="space-y-5 pt-1" noValidate>
        {/* Quick add */}
        {!editing && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/45">
              <Sparkles size={13} /> Quick add
            </p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cx(
                    'flex shrink-0 items-center gap-2 rounded-2xl border py-1.5 pl-1.5 pr-3 text-sm font-medium transition active:scale-95',
                    form.url === p.url ? 'border-violet-400/60 bg-violet-500/20 text-white' : 'border-white/10 bg-white/5 text-white/70',
                  )}
                >
                  <GameIcon name={p.name} url={p.url} size={26} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live preview */}
        <div className="flex items-center gap-3 rounded-2xl bg-white/4 p-3">
          <GameIcon name={finalName || '?'} url={normalized ?? ''} iconUrl={normalizeUrl(form.iconUrl) ?? ''} color={form.color} size={52} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{finalName || 'Game name'}</p>
            <p className="truncate text-xs text-white/40">
              {normalized ? hostnameOf(normalized) : 'website.com'} · {describeReset(form.reset)} · {statsSummary}
            </p>
          </div>
        </div>

        <Field label="Link" error={touched && errors.url} hint="The icon is fetched automatically from the site.">
          <input
            className={inputClass}
            value={form.url}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="https://…"
            aria-label="Game link"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
        {duplicate && (
          <p className="-mt-3 flex items-center gap-1.5 text-xs text-amber-300/90">
            <TriangleAlert size={13} /> “{duplicate.name}” already uses this link.
          </p>
        )}

        <Field label="Name" error={touched && errors.name}>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={suggested || 'e.g. Wordle'}
            aria-label="Game name"
            maxLength={40}
          />
        </Field>

        <Field label="Category" error={touched && errors.category}>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c.id} active={form.categoryId === c.id} onClick={() => set({ categoryId: c.id })}>
                {c.name}
              </Chip>
            ))}
            <Chip active={form.categoryId === NEW} onClick={() => set({ categoryId: NEW })}>
              <Plus size={14} /> New
            </Chip>
          </div>
          {form.categoryId === NEW && (
            <motion.input
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cx(inputClass, 'mt-2')}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Word Games"
              aria-label="New category name"
              maxLength={30}
            />
          )}
        </Field>

        {/* ---------- Advanced sections ---------- */}
        <div className="space-y-2">
          <Section
            title="Reset time"
            icon={AlarmClock}
            summary={describeReset(form.reset)}
            open={openSection === 'reset'}
            onToggle={() => toggleSection('reset')}
          >
            <p className="text-xs leading-relaxed text-white/45">
              When does this game’s new puzzle appear? Most daily games switch at your local midnight; some switch at a fixed
              time worldwide (often midnight UTC). Check the game’s help/FAQ if you’re unsure.
            </p>
            <Segmented
              value={form.reset.mode}
              onChange={(mode) => setNested('reset', { mode, timeZone: form.reset.timeZone || 'UTC' })}
              options={[
                { id: 'local', label: 'My time zone' },
                { id: 'zone', label: 'Fixed time zone' },
              ]}
            />
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <input
                type="time"
                className={cx(inputClass, 'w-32')}
                value={form.reset.time}
                onChange={(e) => setNested('reset', { time: e.target.value || '00:00' })}
                aria-label="Reset time"
              />
              {form.reset.mode === 'zone' ? (
                <select
                  className={inputClass}
                  value={form.reset.timeZone}
                  onChange={(e) => setNested('reset', { timeZone: e.target.value })}
                  aria-label="Reset time zone"
                >
                  {['UTC', ...TIME_ZONES.filter((t) => t !== 'UTC')].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={cx(inputClass, 'flex items-center truncate text-white/50')}>{deviceTimeZone().replace(/_/g, ' ')}</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip onClick={() => set({ reset: { mode: 'local', time: '00:00', timeZone: 'UTC' } })}>Local midnight</Chip>
              <Chip onClick={() => set({ reset: { mode: 'zone', time: '00:00', timeZone: 'UTC' } })}>Midnight UTC</Chip>
              <Chip onClick={() => set({ reset: { mode: 'zone', time: '00:00', timeZone: 'America/New_York' } })}>Midnight New York</Chip>
            </div>
            <p className="rounded-xl bg-violet-500/10 px-3 py-2 text-xs text-violet-200/90">
              Current game day: <b>{currentDay}</b> · next reset in <b>{untilReset}</b>
            </p>
          </Section>

          <Section
            title="Schedule"
            icon={CalendarDays}
            summary={describeSchedule(form.schedule)}
            open={openSection === 'schedule'}
            onToggle={() => toggleSection('schedule')}
          >
            <Segmented
              value={form.schedule.type}
              onChange={(type) => setNested('schedule', { type })}
              options={[
                { id: 'daily', label: 'Every day' },
                { id: 'weekdays', label: 'Specific days' },
              ]}
            />
            {form.schedule.type === 'weekdays' && (
              <div className="flex justify-between gap-1.5">
                {WEEKDAYS.map((label, i) => {
                  const on = form.schedule.days.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setNested('schedule', {
                          days: on ? form.schedule.days.filter((d) => d !== i) : [...form.schedule.days, i].sort(),
                        })
                      }
                      className={cx(
                        'grid h-10 flex-1 place-items-center rounded-xl text-sm font-bold transition',
                        on ? 'bg-violet-500/35 text-white' : 'bg-white/5 text-white/40',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {touched && errors.schedule && <p className="text-xs text-rose-300">{errors.schedule}</p>}
            <p className="text-xs text-white/40">Days off don’t count toward progress and never break a streak.</p>
          </Section>

          <Section
            title="Stats"
            icon={Trophy}
            summary={statsSummary}
            open={openSection === 'scoring'}
            onToggle={() => toggleSection('scoring')}
          >
            <MetricsEditor
              metrics={form.metrics}
              onChange={(metrics) => set({ metrics })}
              askResult={form.askResult}
              onAskResult={(askResult) => set({ askResult })}
              sample={sample}
              onSample={setSample}
            />
          </Section>

          <Section
            title="Appearance"
            icon={Palette}
            summary={form.color ? 'Custom colour' : 'Automatic'}
            open={openSection === 'look'}
            onToggle={() => toggleSection('look')}
          >
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c || 'auto'}
                  type="button"
                  aria-label={c ? `Colour ${c}` : 'Automatic colour'}
                  onClick={() => set({ color: c })}
                  className={cx(
                    'grid h-9 w-9 place-items-center rounded-full border-2 transition active:scale-90',
                    form.color === c ? 'border-white' : 'border-transparent',
                  )}
                  style={{ background: c || 'conic-gradient(#a78bfa, #22d3ee, #34d399, #facc15, #f472b6, #a78bfa)' }}
                />
              ))}
            </div>
            <Field label="Custom icon URL (optional)" hint="Overrides the automatic favicon.">
              <input
                className={inputClass}
                value={form.iconUrl}
                onChange={(e) => set({ iconUrl: e.target.value })}
                placeholder="https://…/icon.png"
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
                aria-label="Custom icon URL"
              />
            </Field>
          </Section>

          <Section
            title="Notes & roulette"
            icon={StickyNote}
            summary={form.notes ? 'Has notes' : form.inRoulette ? '' : 'Not in roulette'}
            open={openSection === 'more'}
            onToggle={() => toggleSection('more')}
          >
            <textarea
              className={cx(inputClass, 'h-24 resize-none py-3 text-sm')}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Strategy, login reminders, starting words…"
              maxLength={2000}
              aria-label="Notes"
            />
            <Toggle
              checked={form.inRoulette}
              onChange={(inRoulette) => set({ inRoulette })}
              icon={Dices}
              label="Include in roulette"
              hint="Let “Feeling lucky” pick this game"
            />
          </Section>
        </div>
      </form>
    </Sheet>
  );
}

/** "nytimes.com/games/wordle" → "Wordle", "krillion.io" → "Krillion" */
function suggestNameFromUrl(url) {
  if (!url) return '';
  const { pathname } = new URL(url);
  const segments = pathname.split('/').filter(Boolean).filter((s) => !/\.(html?|php)$/i.test(s));
  const segment = segments.pop() || '';
  const fromPath = /^[a-z][a-z-]{2,30}$/i.test(segment) && !/^(index|home|play|games?|game|puzzles?|en)$/i.test(segment) ? segment : '';
  const base = (fromPath || hostnameOf(url).split('.')[0]).replace(/-/g, ' ');
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function urlKey(u) {
  try {
    const url = new URL(u);
    return hostnameOf(u) + url.pathname.replace(/\/(index\.html?)?$/, '');
  } catch {
    return u;
  }
}
