import { useRef } from 'react';
import { haptic } from '../lib/feedback';

/**
 * Long-press (touch) / right-click (desktop) without breaking taps or scrolling.
 * Returns handlers to spread on an element and `consumeClick()` which returns true
 * (once) when the click that follows a long-press should be ignored.
 */
export function useLongPress(onLongPress, { ms = 450, disabled = false } = {}) {
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);

  const clear = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  const handlers = disabled
    ? {}
    : {
        onPointerDown: (e) => {
          if (e.button !== 0) return;
          fired.current = false;
          start.current = { x: e.clientX, y: e.clientY };
          clear();
          timer.current = setTimeout(() => {
            fired.current = true;
            haptic(15);
            onLongPress();
          }, ms);
        },
        onPointerMove: (e) => {
          if (!start.current || !timer.current) return;
          if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear();
        },
        onPointerUp: clear,
        onPointerCancel: clear,
        onPointerLeave: clear,
        onContextMenu: (e) => {
          e.preventDefault();
          clear();
          if (!fired.current) onLongPress();
          fired.current = true;
        },
      };

  const consumeClick = () => {
    if (fired.current) {
      fired.current = false;
      return true;
    }
    return false;
  };

  return { handlers, consumeClick };
}
