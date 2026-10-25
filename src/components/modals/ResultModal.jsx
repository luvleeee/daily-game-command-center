import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardPaste, Trash2 } from 'lucide-react';
import Sheet from '../ui/Sheet';
import GameIcon from '../GameIcon';
import { Button, Segmented, cx, inputClass } from '../ui/primitives';
import { formatResultSummary, metricLabel, newBests, readAll } from '../../lib/metrics';
import { formatDayKey } from '../../lib/dates';
import { fireConfetti } from '../../lib/events';
import { haptic, sound } from '../../lib/feedback';

/**
 * Log (or edit) every stat of one game-day.
 * Fastest path: "Paste result" → the share text fills all stats it can read.
 */
export default function ResultModal({ open, onClose, game, day, actions }) {
  return (
    <Sheet open={open && Boolean(game)} onClose={onClose} title="Log result">
      {game && <ResultBody key={`${game.id}-${day}`} game={game} day={day ?? game.computed.today} onClose={onClose} actions={actions} />}
    </Sheet>
  );
}

function ResultBody({ game, day, onClose, actions }) {
  const { metrics } = game;
  const existing = game.stats.results[day];
  const [raw, setRaw] = useState(existing?.raw ?? '');
  const [values, setValues] = useState(() => ({ ...(existing?.values || {}) }));
  const [fromText, setFromText] = useState(new Set());
  const [pasteError, setPasteError] = useState('');

  const parsed = useMemo(() => (raw.trim() ? readAll(raw, metrics) : null), [raw, metrics]);
  useEffect(() => {
    if (!parsed) return;
    setValues((v) => ({ ...v, ...parsed.values }));
    setFromText(new Set(parsed.found));
  }, [parsed]);

  const paste = async () => {
    setPasteError('');
    try {
      const text = await navigator.clipboard.readText();
      if (!text) throw new Error('empty');
      setRaw(text);
    } catch {
      setPasteError('Clipboard not available — long-press the box below and paste.');
    }
  };

  const setValue = (id, v) => {
    setValues((prev) => {
      const next = { ...prev };
      if (v == null || v === '' || !Number.isFinite(Number(v))) delete next[id];
      else next[id] = Number(v);
      return next;
    });
    setFromText((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const cleanValues = Object.fromEntries(Object.entries(values).filter(([id, v]) => metrics.some((m) => m.id === id) && Number.isFinite(v)));
  const failed = metrics.some((m) => {
    const v = cleanValues[m.id];
    return v != null && ((m.type === 'winloss' && v < 1) || (m.type === 'guesses' && v > m.max));
  }) || Boolean(parsed?.failed && Object.keys(cleanValues).length);
  const result = Object.keys(cleanValues).length ? { values: cleanValues, failed } : null;
  const missingRequired = metrics.filter((m) => !m.optional && cleanValues[m.id] == null);

  const save = () => {
    if (!result) return;
    const bests = newBests(metrics, game.stats.results, day, result);
    actions.setResult(game.id, { ...result, ...(raw.trim() ? { raw: raw.trim() } : {}) }, day);
    haptic([10, 30, 10]);
    sound.done();
    if (bests.length) {
      fireConfetti({ count: 90, origin: { x: 0.5, y: 0.6 } });
      sound.win();
    }
    onClose(bests.length ? { pb: bests.map((m) => m.name) } : 'saved');
  };

  const isToday = day === game.computed.today;

  return (
    <div className="space-y-5 pt-1">
      <div className="flex items-center gap-3">
        <GameIcon name={game.name} url={game.url} iconUrl={game.iconUrl} color={game.color} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{game.name}</p>
          <p className="text-xs text-white/45">{isToday ? 'Today' : formatDayKey(day)}</p>
        </div>
        {result && (
          <span className={cx('rounded-full px-3 py-1 text-sm font-bold', failed ? 'bg-rose-400/15 text-rose-300' : 'bg-emerald-400/15 text-emerald-300')}>
            {formatResultSummary(metrics, result, { limit: 4 })}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Button variant="secondary" className="w-full" onClick={paste}>
          <ClipboardPaste size={18} /> Paste result from clipboard
        </Button>
        {pasteError && <p className="text-xs text-amber-300/90">{pasteError}</p>}
        <textarea
          className={cx(inputClass, 'h-24 resize-none py-3 text-sm')}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="…or paste the game’s share text here"
          aria-label="Share text"
        />
        {parsed && (
          <p className={cx('text-xs font-semibold', parsed.found.size ? 'text-emerald-300' : 'text-amber-300')}>
            {parsed.found.size ? `Read ${parsed.found.size} of ${metrics.length} stats from the text` : 'Nothing recognised — enter the stats below.'}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={m.id}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">{metricLabel(m)}</span>
              {fromText.has(m.id) && <span className="rounded bg-emerald-400/15 px-1.5 text-[10px] font-bold text-emerald-300">from text</span>}
              {cleanValues[m.id] == null && !m.optional && raw.trim() && (
                <span className="rounded bg-amber-400/15 px-1.5 text-[10px] font-bold text-amber-300">missing</span>
              )}
              {m.optional && <span className="text-[10px] text-white/30">optional</span>}
            </div>
            <MetricInput metric={m} value={values[m.id]} onChange={(v) => setValue(m.id, v)} />
          </div>
        ))}
      </div>

      {missingRequired.length > 0 && result && (
        <p className="text-xs text-white/40">Missing: {missingRequired.map((m) => m.name).join(', ')}. You can still save.</p>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2 pt-1">
        <Button onClick={save} disabled={!result}>
          <Check size={18} /> Save result
        </Button>
        {existing ? (
          <Button
            variant="danger"
            className="px-4"
            aria-label="Remove result"
            onClick={() => {
              actions.setResult(game.id, null, day);
              onClose('removed');
            }}
          >
            <Trash2 size={17} />
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => onClose('skipped')}>
            Not now
          </Button>
        )}
      </div>
    </div>
  );
}

function MetricInput({ metric: m, value, onChange }) {
  if (m.type === 'guesses') {
    const failed = value != null && value > m.max;
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: m.max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={cx('h-11 min-w-11 flex-1 rounded-xl text-base font-bold transition active:scale-95', value === n ? 'bg-emerald-400 text-ink-950' : 'bg-white/8 text-white/80')}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(failed ? null : m.max + 1)}
          className={cx('h-11 min-w-11 flex-1 rounded-xl text-base font-bold transition active:scale-95', failed ? 'bg-rose-400 text-ink-950' : 'bg-white/8 text-white/80')}
        >
          X
        </button>
      </div>
    );
  }

  if (m.type === 'winloss') {
    return (
      <Segmented
        value={value === 1 ? 'win' : value === 0 ? 'loss' : ''}
        onChange={(v) => onChange(v === 'win' ? 1 : 0)}
        options={[
          { id: 'win', label: 'Win' },
          { id: 'loss', label: 'Loss' },
        ]}
      />
    );
  }

  if (m.type === 'time') {
    const has = value != null;
    const mm = has ? Math.floor(value / 60) : '';
    const ss = has ? value % 60 : '';
    const update = (a, b) => {
      if (a === '' && b === '') return onChange(null);
      onChange((Number(a) || 0) * 60 + (Number(b) || 0));
    };
    return (
      <div className="flex items-center gap-2">
        <input className={cx(inputClass, 'w-24 text-center')} inputMode="numeric" placeholder="min" value={mm} onChange={(e) => update(e.target.value.replace(/\D/g, ''), ss)} aria-label={`${m.name} minutes`} />
        <span className="text-xl font-bold text-white/40">:</span>
        <input
          className={cx(inputClass, 'w-24 text-center')}
          inputMode="numeric"
          placeholder="sec"
          value={ss === '' ? '' : String(ss).padStart(2, '0')}
          onChange={(e) => update(mm, Math.min(59, Number(e.target.value.replace(/\D/g, '').slice(-2)) || 0))}
          aria-label={`${m.name} seconds`}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <NumberInput value={value} onChange={onChange} label={m.name} />
      {m.unit && <span className="text-sm text-white/45">{m.unit}</span>}
    </div>
  );
}

/** Keeps the raw text while typing (so "4." or "-" don't get eaten). */
function NumberInput({ value, onChange, label }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    if (value == null) setText((t) => (t === '' ? t : ''));
    else if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={inputClass}
      inputMode="decimal"
      placeholder="0"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,-]/g, '').replace(',', '.');
        setText(t);
        onChange(t === '' || t === '-' ? null : Number(t));
      }}
      aria-label={label}
    />
  );
}
