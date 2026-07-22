// Africa/Nairobi (EAT) is a fixed UTC+3 offset with no daylight saving,
// so slot math can be done with plain arithmetic instead of a timezone lib.
export const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

// Signals are generated at these EAT hours, every day.
export const SLOT_HOURS_EAT = [2, 6, 10, 14, 18, 22];

/**
 * Returns the next scheduled slot time (as a real UTC Date) strictly after `now`.
 */
export function getNextSlotUTC(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + EAT_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const curH = shifted.getUTCHours();

  let nextHour = SLOT_HOURS_EAT.find((h) => h > curH);
  let dayOffset = 0;
  if (nextHour === undefined) {
    nextHour = SLOT_HOURS_EAT[0];
    dayOffset = 1;
  }

  const targetShifted = new Date(Date.UTC(y, m, d + dayOffset, nextHour, 0, 0, 0));
  return new Date(targetShifted.getTime() - EAT_OFFSET_MS);
}

/** Start of the current EAT calendar day, returned as a real UTC Date. */
export function startOfEatDay(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + EAT_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const startShifted = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  return new Date(startShifted.getTime() - EAT_OFFSET_MS);
}

/** Start of the current EAT week (Monday), returned as a real UTC Date. */
export function startOfEatWeek(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + EAT_OFFSET_MS);
  const day = shifted.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day + 6) % 7;
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const startShifted = new Date(Date.UTC(y, m, d - diffToMonday, 0, 0, 0, 0));
  return new Date(startShifted.getTime() - EAT_OFFSET_MS);
}

/** Formats a UTC Date as its EAT wall-clock time, e.g. "06:00 EAT". */
export function formatEatHHMM(date: Date): string {
  const shifted = new Date(date.getTime() + EAT_OFFSET_MS);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} EAT`;
}
