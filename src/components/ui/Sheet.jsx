import { useEffect } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Bottom sheet on phones, centred dialog on wider screens.
 * Swipe the grabber down to dismiss (native iOS/Android feel).
 */
export default function Sheet({ open, onClose, title, children, footer }) {
  const controls = useDragControls();

  // Lock background scroll + close on Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="glass-strong relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] shadow-2xl shadow-black/60 sm:max-w-md sm:rounded-[28px]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            {/* Grabber + header (drag area) */}
            <div
              className="drag-handle shrink-0 cursor-grab px-5 pt-2.5 active:cursor-grabbing"
              onPointerDown={(e) => controls.start(e)}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
                <button
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-white/70 transition hover:bg-white/15 active:scale-90"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>

            {footer && <div className="pb-safe shrink-0 border-t border-white/5 px-5 pt-3">{footer}</div>}
            {!footer && <div className="pb-safe shrink-0" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
