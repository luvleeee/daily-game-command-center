import { shiftDay, toDayKey } from './dates';

/**
 * Per-game "game day" logic.
 *
 * game.reset    = { mode: 'local' | 'zone', time: 'HH:MM', timeZone: 'UTC' | IANA }
 * game.schedule = { type: 'daily' | 'weekdays', days: [0..6] }   (0 = Sunday)
 *
 * A game's "day" starts at its reset time. Before the reset time we're still on the
 * previous game day. Every stat is keyed by game-day ('YYYY-MM-DD'), so streak maths
 * stays identical whatever the reset rule is.
 */

export const DEFAULT_RESET = { mode: 'local', time: '00:00', timeZone: 'UTC' };
export const DEFAULT_SCHEDULE = { type: 'daily', days: [0, 1, 2, 3, 4, 5, 6] };

const fmtCache = new Map();
function formatterFor(timeZone) {
  if (!fmtCache.has(timeZone)) {
    fmtCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }
  return fmtCache.get(timeZone);
}

export function isValidTimeZone(tz) {
  try {
    formatterFor(tz);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of `date` in the game's reset zone (or the device's local zone). */
function wallClock(date, reset) {
  if (reset?.mode !== 'zone' || !isValidTimeZone(reset.timeZone)) {
    return {
      key: toDayKey(date),
      minutes: date.getHours() * 60 + date.getMinutes(),
      seconds: date.getSeconds(),
    };
  }
  const parts = Object.fromEntries(formatterFor(reset.timeZone).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    key: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    seconds: Number(parts.second),
  };
}

export function resetMinutes(reset) {
  const [h, m] = (reset?.time || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** The game-day key "now" for this game. */
export function gameDayKey(game, now = new Date()) {
  const wc = wallClock(now, game.reset);
  return wc.minutes < resetMinutes(game.reset) ? shiftDay(wc.key, -1) : wc.key;
}

/** Milliseconds until this game's next reset. */
export function msUntilReset(game, now = new Date()) {
  const wc = wallClock(now, game.reset);
  const diffMin = (resetMinutes(game.reset) - wc.minutes + 1440) % 1440 || 1440;
  return diffMin * 60_000 - wc.seconds * 1000;
}

export function weekdayOf(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isDueOn(game, dayKey) {
  if (game.schedule?.type !== 'weekdays') return true;
  return game.schedule.days.includes(weekdayOf(dayKey));
}

/** "3h 12m", "45m", "<1m" */
export function formatDuration(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

export function describeReset(reset) {
  if (reset?.mode === 'zone') {
    const tz = reset.timeZone === 'UTC' ? 'UTC' : reset.timeZone.split('/').pop().replace(/_/g, ' ');
    return `${reset.time} ${tz}`;
  }
  return reset?.time && reset.time !== '00:00' ? `${reset.time} local` : 'Local midnight';
}

export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function describeSchedule(schedule) {
  if (schedule?.type !== 'weekdays') return 'Every day';
  const d = [...schedule.days].sort();
  if (d.length === 7) return 'Every day';
  if (d.join() === '1,2,3,4,5') return 'Weekdays';
  if (d.join() === '0,6') return 'Weekends';
  return d.map((i) => WEEKDAY_NAMES[i]).join(', ');
}

export function listTimeZones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'];
  }
}

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
