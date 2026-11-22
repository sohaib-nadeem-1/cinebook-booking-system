// Convert a cinema-local calendar date and wall-clock time to a UTC Date.
// This keeps business comparisons independent of the server's timezone.
export const cinemaLocalDateTimeToUtc = (date, time, timeZone = "UTC") => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(time));
  if (!dateMatch || !timeMatch) return null;

  const [, y, mo, d] = dateMatch;
  const [, h, mi, sec = "0"] = timeMatch;
  const parts = [y, mo, d, h, mi, sec].map(Number);
  const [year, month, day, hour, minute, second] = parts;
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const dateCheck = new Date(localAsUtc);
  if (
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) return null;

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return null;
  }

  let guess = localAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const formatted = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map(({ type, value }) => [type, value])
    );
    const representedAsUtc = Date.UTC(
      Number(formatted.year),
      Number(formatted.month) - 1,
      Number(formatted.day),
      Number(formatted.hour),
      Number(formatted.minute),
      Number(formatted.second)
    );
    const nextGuess = localAsUtc - (representedAsUtc - guess);
    if (nextGuess === guess) break;
    guess = nextGuess;
  }

  // Fail closed on nonexistent local times during a daylight-saving transition.
  const finalParts = Object.fromEntries(
    formatter.formatToParts(new Date(guess)).map(({ type, value }) => [type, value])
  );
  if (
    Number(finalParts.year) !== year || Number(finalParts.month) !== month ||
    Number(finalParts.day) !== day || Number(finalParts.hour) !== hour ||
    Number(finalParts.minute) !== minute || Number(finalParts.second) !== second
  ) return null;

  return new Date(guess);
};
