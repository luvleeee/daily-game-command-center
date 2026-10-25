import { useEffect, useState } from 'react';

/**
 * A clock that ticks at the top of every minute (enough for countdowns and
 * per-game resets) and re-syncs instantly when the app returns to the foreground —
 * phones freeze timers while an app is in the background.
 */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, 60_000 - (Date.now() % 60_000) + 50);
    };
    const wake = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
        schedule();
      }
    };
    schedule();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
    };
  }, []);

  return now;
}
