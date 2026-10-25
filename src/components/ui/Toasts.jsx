import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { dismissToast, useToasts } from '../../lib/events';

export default function Toasts() {
  const list = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-safe">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ t }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration]);

  const Icon = t.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={(_, info) => info.offset.y < -20 && dismissToast(t.id)}
      role="status"
      className="glass-strong pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl py-2.5 pl-4 pr-2 shadow-2xl shadow-black/50"
    >
      {Icon && <Icon size={18} className="shrink-0 text-violet-300" />}
      <p className="min-w-0 flex-1 text-sm font-medium text-white/90">{t.message}</p>
      {t.action && (
        <button
          onClick={() => {
            t.onAction?.();
            dismissToast(t.id);
          }}
          className="h-9 shrink-0 rounded-xl bg-violet-500/25 px-3.5 text-sm font-semibold text-violet-100 active:scale-95"
        >
          {t.action}
        </button>
      )}
      <button
        onClick={() => dismissToast(t.id)}
        aria-label="Dismiss"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/40 hover:text-white"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
