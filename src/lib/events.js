import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/* Toasts — callable from anywhere: toast({ message, action, onAction }) */
/* ------------------------------------------------------------------ */

let toasts = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function toast({ message, action, onAction, icon, duration = 4500 }) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts.slice(-2), { id, message, action, onAction, icon, duration }];
  emit();
  return id;
}

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
}

/* ------------------------------------------------------------------ */
/* Confetti trigger                                                     */
/* ------------------------------------------------------------------ */

const confettiListeners = new Set();
export const onConfetti = (fn) => {
  confettiListeners.add(fn);
  return () => confettiListeners.delete(fn);
};
export const fireConfetti = (opts) => confettiListeners.forEach((fn) => fn(opts));
