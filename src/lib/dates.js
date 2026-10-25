// All "days" are LOCAL calendar days, stored as 'YYYY-MM-DD' keys.
// Keys are DST-safe and timezone-stable for the user's device.

const pad = (n) => String(n).padStart(2, '0');

/** Local day key for a Date (defaults to now). */
export function toDayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Integer day index for a key — difference between two indices = days apart. */
export function dayIndex(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Key `offset` days from `key` (negative = past). */
export function shiftDay(key, offset) {
  const [y, m, d] = key.split('-').map(Number);
  return toDayKey(new Date(y, m - 1, d + offset));
}

/** Milliseconds until the next local midnight. */
export function msUntilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
  return next.getTime() - now.getTime();
}

export function formatLongDate(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function weekdayShort(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
}
