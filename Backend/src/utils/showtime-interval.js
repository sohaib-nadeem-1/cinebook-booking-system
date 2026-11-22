// Showtime times are cinema-local date + wall-clock values. UTC is used only
// for neutral calendar arithmetic so the server timezone cannot affect checks.
export const TURNAROUND_MINUTES = 15;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const dateToDayNumber = (dateStr) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const stamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(stamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return Math.floor(stamp / DAY_MS);
};

const timeToMilliseconds = (time) => {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(time));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
};

export const isValidSchedule = (date, start, end) => {
  const startMs = timeToMilliseconds(start);
  const endMs = timeToMilliseconds(end);
  return dateToDayNumber(date) !== null && startMs !== null && endMs !== null && startMs !== endMs;
};

// An end time less than the start time rolls into the next calendar day.
export const toInterval = (dateStr, start, end) => {
  const day = dateToDayNumber(dateStr);
  const startMs = timeToMilliseconds(start);
  let endMs = timeToMilliseconds(end);
  if (day === null || startMs === null || endMs === null) return null;
  if (endMs <= startMs) endMs += DAY_MS;
  const base = day * DAY_MS;
  return { start: base + startMs, end: base + endMs };
};

export const intervalsConflict = (a, b, turnaroundMinutes = TURNAROUND_MINUTES) => {
  const bufferMs = turnaroundMinutes * MINUTE_MS;
  return a.start < b.end + bufferMs && b.start < a.end + bufferMs;
};
