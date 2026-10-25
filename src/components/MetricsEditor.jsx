import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, ChevronDown, Plus, ScanText, Trash2, Wand2 } from 'lucide-react';
import { Chip, Field, Segmented, Toggle, cx, inputClass } from './ui/primitives';
import { METRIC_TYPES, detectMetrics, formatMetricValue, metricLabel, newMetric, readAll, readMetric } from '../lib/metrics';

const READER_MODES = [
  { id: 'auto', label: 'Automatic', hint: 'First value of this type in the text' },
  { id: 'label', label: 'Next to a label', hint: 'e.g. the number after 🎯, or before “guesses”' },
  { id: 'count', label: 'Count an emoji', hint: 'e.g. how many 💡 appear' },
  { id: 'connections', label: 'Connections grid', hint: 'Counts wrong rows; fails at 4 mistakes' },
  { id: 'regex', label: 'Custom pattern', hint: 'Regular expression; first (group) = value' },
  { id: 'manual', label: 'Manual only', hint: 'Never read from text — you type it' },
];

/**
 * Custom stats for one game: auto-detect from a sample share text, then fine-tune.
 * `metrics` / `onChange` are controlled by the game form.
 */
export default function MetricsEditor({ metrics, onChange, askResult, onAskResult, sample, onSample }) {
  const [openId, setOpenId] = useState(null);
  const [detected, setDetected] = useState(null); // proposals from the sample
  const [picked, setPicked] = useState(new Set());

  const preview = useMemo(() => (sample ? readAll(sample, metrics) : null), [sample, metrics]);

  const update = (id, patch) => onChange(metrics.map((m) => (m.id === id ? { ...m, ...patch, reader: { ...m.reader, ...(patch.reader || {}) } } : m)));
  const remove = (id) => onChange(metrics.filter((m) => m.id !== id));
  const move = (i, dir) => {
    const next = [...metrics];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (type) => {
    const names = { number: 'Score', time: 'Time', guesses: 'Guesses', winloss: 'Solved' };
    const m = newMetric({ name: names[type], type, better: type === 'number' ? 'higher' : 'lower' });
    onChange([...metrics, m]);
    setOpenId(m.id);
  };

  const runDetect = () => {
    const found = detectMetrics(sample);
    setDetected(found);
    setPicked(new Set(found.map((m) => m.id)));
  };
  const applyDetected = (mode) => {
    const chosen = detected.filter((m) => picked.has(m.id)).map(({ detected: _d, ...m }) => m);
    onChange(mode === 'replace' ? chosen : [...metrics, ...chosen]);
    setDetected(null);
  };

  return (
    <div className="space-y-4">
      {/* 1. Teach by example */}
      <div className="space-y-2 rounded-2xl border border-violet-400/20 bg-violet-500/8 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-100">
          <Wand2 size={15} /> Set up from a share text
        </p>
        <p className="text-xs text-white/50">
          Paste the game’s “Share” result once. Every value is detected with the emoji or word next to it, so it keeps working with
          tomorrow’s numbers.
        </p>
        <textarea
          className={cx(inputClass, 'h-28 resize-none py-3 font-mono text-[13px] leading-snug')}
          value={sample}
          onChange={(e) => {
            onSample(e.target.value);
            setDetected(null);
          }}
          placeholder={'Pyragrams: Sun ✅\n🎯 4 🔀 41 🕓 4:49'}
          aria-label="Sample share text"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!sample.trim()}
            onClick={runDetect}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-500/30 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            <ScanText size={16} /> Detect stats
          </button>
          {sample && (
            <button type="button" onClick={() => onSample('')} className="h-10 rounded-xl bg-white/6 px-3 text-sm text-white/60">
              Clear
            </button>
          )}
        </div>

        <AnimatePresence>
          {detected && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2 pt-1">
              {detected.length === 0 ? (
                <p className="text-xs text-amber-300">No values found — add stats manually below.</p>
              ) : (
                <>
                  <p className="text-xs font-semibold text-white/60">Found {detected.length} — untick what you don’t want:</p>
                  {detected.map((m) => {
                    const on = picked.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          const n = new Set(picked);
                          on ? n.delete(m.id) : n.add(m.id);
                          setPicked(n);
                        }}
                        className={cx(
                          'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition',
                          on ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/8 bg-white/3 opacity-60',
                        )}
                      >
                        <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-md', on ? 'bg-emerald-400 text-ink-950' : 'bg-white/10')}>
                          {on && <Check size={13} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-white">{metricLabel(m)}</span>
                          <span className="block text-[11px] text-white/45">
                            {METRIC_TYPES.find((t) => t.id === m.type)?.label}
                            {m.type === 'number' && ` · ${m.better} is better`} · found “{m.detected}”
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => applyDetected('replace')} disabled={!picked.size} className="h-10 rounded-xl bg-emerald-400 text-sm font-semibold text-ink-950 disabled:opacity-40">
                      Use these
                    </button>
                    <button type="button" onClick={() => applyDetected('append')} disabled={!picked.size || !metrics.length} className="h-10 rounded-xl bg-white/8 text-sm font-semibold text-white/80 disabled:opacity-40">
                      Add to current
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. The stats */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Stats ({metrics.length})</p>
          {metrics.length > 1 && <p className="text-[11px] text-white/35">First = headline on the card</p>}
        </div>

        {metrics.length === 0 && (
          <p className="rounded-xl bg-white/4 px-3 py-3 text-xs text-white/45">
            No stats — this game only tracks that you played (streaks still work). Add stats to log scores.
          </p>
        )}

        {metrics.map((m, i) => {
          const res = preview ? (preview.found.has(m.id) ? { value: preview.values[m.id] } : null) : undefined;
          const failedHere = res && readMetric(sample, m)?.failed;
          return (
            <MetricRow
              key={m.id}
              metric={m}
              index={i}
              count={metrics.length}
              open={openId === m.id}
              onToggle={() => setOpenId(openId === m.id ? null : m.id)}
              onChange={(patch) => update(m.id, patch)}
              onRemove={() => remove(m.id)}
              onMove={(dir) => move(i, dir)}
              preview={res === undefined ? undefined : res ? formatMetricValue(m, res.value, { failed: failedHere }) : null}
            />
          );
        })}

        <div className="flex flex-wrap gap-2 pt-1">
          {METRIC_TYPES.map((t) => (
            <Chip key={t.id} onClick={() => add(t.id)} className="h-8 text-xs">
              <Plus size={13} /> {t.label}
            </Chip>
          ))}
        </div>
      </div>

      {metrics.length > 0 && (
        <Toggle checked={askResult} onChange={onAskResult} label="Ask for my result when I tick it" hint="Opens the result sheet after marking done" />
      )}
    </div>
  );
}

function MetricRow({ metric: m, index, count, open, onToggle, onChange, onRemove, onMove, preview }) {
  const r = m.reader;
  const typeLabel = METRIC_TYPES.find((t) => t.id === m.type)?.label;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/4">
      <div className="flex items-center gap-1 pr-1">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left" aria-expanded={open}>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
              {metricLabel(m)}
              {index === 0 && count > 1 && <span className="rounded bg-violet-500/30 px-1 text-[9px] font-bold uppercase text-violet-100">Headline</span>}
              {m.optional && <span className="rounded bg-white/10 px-1 text-[9px] font-bold uppercase text-white/50">Optional</span>}
            </span>
            <span className="block truncate text-[11px] text-white/40">
              {typeLabel}
              {m.type === 'number' && ` · ${m.better} better`}
              {m.type === 'guesses' && ` · max ${m.max}`} · {readerSummary(r, m)}
            </span>
          </span>
          {preview !== undefined && (
            <span className={cx('shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold', preview ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300')}>
              {preview ?? (m.optional ? '—' : 'not found')}
            </span>
          )}
          <ChevronDown size={15} className={cx('shrink-0 text-white/35 transition-transform', open && 'rotate-180')} />
        </button>
        <div className="flex shrink-0 flex-col">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="grid h-5 w-7 place-items-center text-white/40 disabled:opacity-20" aria-label={`Move ${m.name} up`}>
            <ArrowUp size={13} />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} className="grid h-5 w-7 place-items-center text-white/40 disabled:opacity-20" aria-label={`Move ${m.name} down`}>
            <ArrowDown size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-white/6 px-3 pt-3 pb-3">
          <div className="grid grid-cols-[1fr_72px] gap-2">
            <Field label="Name">
              <input className={inputClass} value={m.name} maxLength={30} onChange={(e) => onChange({ name: e.target.value })} aria-label="Stat name" />
            </Field>
            <Field label="Emoji">
              <input className={cx(inputClass, 'text-center')} value={m.emoji} maxLength={8} placeholder="🎯" onChange={(e) => onChange({ emoji: e.target.value.trim() })} aria-label="Stat emoji" />
            </Field>
          </div>

          <Field label="Type">
            <div className="grid grid-cols-4 gap-1.5">
              {METRIC_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange({ type: t.id, better: t.id === 'number' ? m.better : 'lower' })}
                  className={cx('h-10 rounded-xl text-xs font-semibold', m.type === t.id ? 'bg-violet-500/35 text-white' : 'bg-white/6 text-white/55')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          {m.type === 'number' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Unit">
                <input className={inputClass} value={m.unit} maxLength={12} placeholder="pts, m…" onChange={(e) => onChange({ unit: e.target.value })} aria-label="Unit" />
              </Field>
              <Field label="Better is">
                <Segmented value={m.better} onChange={(better) => onChange({ better })} options={[{ id: 'higher', label: 'Higher' }, { id: 'lower', label: 'Lower' }]} />
              </Field>
            </div>
          )}
          {m.type === 'guesses' && (
            <Field label="Max attempts">
              <input className={cx(inputClass, 'w-24')} inputMode="numeric" value={m.max} onChange={(e) => onChange({ max: Math.max(1, Math.min(30, Number(e.target.value.replace(/\D/g, '')) || 1)) })} aria-label="Max attempts" />
            </Field>
          )}

          <Field label="How to read it" hint={READER_MODES.find((x) => x.id === r.mode)?.hint}>
            <select className={inputClass} value={r.mode} onChange={(e) => onChange({ reader: { mode: e.target.value } })} aria-label="Reader">
              {READER_MODES.filter((x) => m.type !== 'winloss' || ['auto', 'label', 'regex', 'manual'].includes(x.id)).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </Field>

          {(r.mode === 'label' || r.mode === 'count') && m.type !== 'winloss' && (
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <Field label={r.mode === 'count' ? 'Emoji to count' : 'Label'} hint={r.mode === 'label' ? 'Clock emojis (🕐…🕧) all match each other.' : undefined}>
                <input className={inputClass} value={r.label} maxLength={30} placeholder="🎯" onChange={(e) => onChange({ reader: { label: e.target.value } })} aria-label="Reader label" />
              </Field>
              {r.mode === 'label' && (
                <Segmented
                  size="sm"
                  className="mb-[22px]"
                  value={r.labelPos}
                  onChange={(labelPos) => onChange({ reader: { labelPos } })}
                  options={[
                    { id: 'before', label: '🎯 4' },
                    { id: 'after', label: '4 pts' },
                  ]}
                />
              )}
            </div>
          )}

          {m.type === 'winloss' && r.mode !== 'manual' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Win if it contains">
                <input className={inputClass} value={r.win} onChange={(e) => onChange({ reader: { win: e.target.value } })} aria-label="Win markers" />
              </Field>
              <Field label="Loss if it contains">
                <input className={inputClass} value={r.loss} onChange={(e) => onChange({ reader: { loss: e.target.value } })} aria-label="Loss markers" />
              </Field>
            </div>
          )}
          {m.type === 'winloss' && r.mode === 'label' && (
            <Field label="Only look after" hint="e.g. “Result:” — leave empty to search the whole text">
              <input className={inputClass} value={r.label} onChange={(e) => onChange({ reader: { label: e.target.value } })} aria-label="Win/loss label" />
            </Field>
          )}

          {r.mode === 'regex' && (
            <Field label="Pattern">
              <input className={cx(inputClass, 'font-mono text-sm')} value={r.regex} autoCapitalize="off" spellCheck={false} placeholder="depth:\s*(\d+)" onChange={(e) => onChange({ reader: { regex: e.target.value } })} aria-label="Custom pattern" />
            </Field>
          )}

          <Toggle checked={m.optional} onChange={(optional) => onChange({ optional })} label="Optional" hint="Don’t warn when it’s missing from the share text" />

          <button type="button" onClick={onRemove} className="flex items-center gap-1.5 text-xs font-semibold text-rose-300/80">
            <Trash2 size={13} /> Remove this stat
          </button>
        </div>
      )}
    </div>
  );
}

function readerSummary(r, m) {
  switch (r.mode) {
    case 'label':
      return m.type === 'winloss' ? `after “${r.label || '…'}”` : r.labelPos === 'after' ? `before “${r.label}”` : `after “${r.label}”`;
    case 'count':
      return `counts ${r.label || '…'}`;
    case 'connections':
      return 'Connections grid';
    case 'regex':
      return 'custom pattern';
    case 'manual':
      return 'manual';
    default:
      return m.type === 'winloss' ? `${r.win.split(',')[0]} / ${r.loss.split(',')[0]}` : 'automatic';
  }
}

