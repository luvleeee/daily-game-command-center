import { useEffect, useState } from 'react';

const cx = (...c) => c.filter(Boolean).join(' ');

export function Button({ variant = 'primary', className, children, ...props }) {
  const styles = {
    primary:
      'bg-gradient-to-r from-violet-500 to-cyan-400 text-white shadow-lg shadow-violet-500/25 hover:brightness-110',
    secondary: 'bg-white/8 text-white hover:bg-white/14 border border-white/10',
    ghost: 'text-white/70 hover:text-white hover:bg-white/8',
    danger: 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-400/20',
  };
  return (
    <button
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ className, label, children, active, ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'grid h-10 w-10 place-items-center rounded-full border transition active:scale-90',
        active
          ? 'border-violet-400/50 bg-violet-500/25 text-violet-200'
          : 'border-white/10 bg-white/6 text-white/75 hover:bg-white/12 hover:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/45">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-rose-300">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-white/35">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  'h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-[16px] text-white placeholder-white/25 outline-none transition focus:border-violet-400/60 focus:bg-black/40 focus:ring-4 focus:ring-violet-500/15';

/** Two-tap destructive button: first tap arms, second tap (within 3s) confirms. */
export function ConfirmButton({ onConfirm, children, confirmLabel = 'Tap again to confirm', className, ...props }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant="danger"
      className={cx(armed && 'bg-rose-500/35 text-rose-100', className)}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      {...props}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}

export { cx };

/** iOS-style switch row */
export function Toggle({ checked, onChange, label, hint, icon: Icon }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left"
    >
      {Icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/6 text-white/70">
          <Icon size={17} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-white/90">{label}</span>
        {hint && <span className="block text-xs text-white/40">{hint}</span>}
      </span>
      <span
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-emerald-400' : 'bg-white/15',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

/** Segmented control: options = [{ id, label, icon? }] */
export function Segmented({ value, onChange, options, className, size = 'md' }) {
  return (
    <div className={cx('flex rounded-2xl border border-white/8 bg-black/25 p-1', className)} role="tablist">
      {options.map((o) => {
        const active = value === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl font-semibold transition',
              size === 'sm' ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm',
              active ? 'bg-white/14 text-white shadow-sm' : 'text-white/50 hover:text-white/80',
            )}
          >
            {Icon && <Icon size={size === 'sm' ? 13 : 15} />}
            {o.label}
            {o.badge != null && (
              <span className={cx('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-white/20' : 'bg-white/8')}>{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Collapsible settings group with a summary on the right */
export function Section({ title, summary, icon: Icon, open, onToggle, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left" aria-expanded={open}>
        {Icon && <Icon size={17} className="shrink-0 text-violet-300" />}
        <span className="flex-1 text-[15px] font-semibold text-white/90">{title}</span>
        <span className="truncate text-xs text-white/40">{summary}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" className={cx('shrink-0 text-white/40 transition-transform', open && 'rotate-180')}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="space-y-4 border-t border-white/6 px-4 pt-3 pb-4">{children}</div>}
    </div>
  );
}

export function Chip({ active, children, className, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95',
        active ? 'border-violet-400/60 bg-violet-500/25 text-white' : 'border-white/10 bg-white/5 text-white/60 hover:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
