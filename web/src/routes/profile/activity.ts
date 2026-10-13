/**
 * The activity strip's numbers: which of the last weeks' days had something done in them. Pure and
 * calendar-correct (dates are local `YYYY-MM-DD` keys, as the learner store writes them).
 */

export interface DayCell {
  /** `YYYY-MM-DD`, local. */
  date: string;
  active: boolean;
  today: boolean;
  /** After today (the rest of the current week): drawn as an empty place, never counted. */
  future: boolean;
  /** 0 is Monday, 6 is Sunday. */
  weekday: number;
  /** 0 is the oldest week shown. */
  week: number;
}

export interface Activity {
  weeks: number;
  /** Week by week, Monday first: `weeks * 7` cells. */
  cells: DayCell[];
  /** Active days inside the window, up to today. */
  activeCount: number;
  /** Days in the window up to and including today. */
  windowDays: number;
  /** Consecutive active days ending today, or yesterday when today has nothing yet. */
  currentStreak: number;
  /** The longest run of consecutive active days in all the data. */
  longestStreak: number;
  /** The most recent active day in the data, or null. */
  lastActive: string | null;
  /** Active dates inside the window, oldest first. */
  activeDates: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` for a date in the local time zone. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A local date from a key, or null when the key is not a real calendar day. */
export function parseKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(y, mo - 1, da);
  return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === da ? d : null;
}

/** `d` moved by `n` calendar days (DST safe: built from components). */
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** 0 for Monday through 6 for Sunday. */
function weekdayOf(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** "Mon 6 Oct" (and the year when it is not this one). */
export function formatDay(key: string, now: Date = new Date()): string {
  const d = parseKey(key);
  if (!d) return key;
  const base = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    d,
  );
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Consecutive-day runs in a set of day keys: the one ending at `endKey` (or the day before) and the longest. */
function streaks(days: ReadonlySet<string>, today: Date): { current: number; longest: number } {
  let current = 0;
  let cursor = today;
  if (!days.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  while (days.has(dateKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  for (const key of days) {
    const d = parseKey(key);
    if (!d) continue;
    // Only count from the first day of a run.
    if (days.has(dateKey(addDays(d, -1)))) continue;
    let run = 0;
    let c = d;
    while (days.has(dateKey(c))) {
      run += 1;
      c = addDays(c, 1);
    }
    longest = Math.max(longest, run);
  }
  return { current, longest };
}

/**
 * The window is `weeks` calendar weeks, Monday to Sunday, ending with the week that contains `today`. Days
 * after today are in the grid (so the columns are whole) but marked `future` and never counted.
 */
export function buildActivity(activeDays: readonly string[], today: Date, weeks = 12): Activity {
  const valid = new Set<string>();
  for (const k of activeDays) if (parseKey(k)) valid.add(k);

  const todayKey = dateKey(today);
  const monday = addDays(today, -weekdayOf(today));
  const first = addDays(monday, -7 * (weeks - 1));

  const cells: DayCell[] = [];
  let activeCount = 0;
  let windowDays = 0;
  const activeDates: string[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(first, w * 7 + d);
      const key = dateKey(date);
      const future = key > todayKey;
      const active = !future && valid.has(key);
      if (!future) windowDays += 1;
      if (active) {
        activeCount += 1;
        activeDates.push(key);
      }
      cells.push({ date: key, active, today: key === todayKey, future, weekday: d, week: w });
    }
  }

  const sorted = [...valid].filter((k) => k <= todayKey).sort();
  const { current, longest } = streaks(new Set(sorted), today);
  return {
    weeks,
    cells,
    activeCount,
    windowDays,
    currentStreak: current,
    longestStreak: longest,
    lastActive: sorted[sorted.length - 1] ?? null,
    activeDates,
  };
}

function days(n: number): string {
  return n === 1 ? '1 day' : `${n} days`;
}

/** One sentence for the numbers, used as the strip's accessible description and its caption. */
export function describeActivity(a: Activity, now: Date = new Date()): string {
  if (a.activeCount === 0) {
    return `No active days in the last ${a.weeks} weeks yet. A day counts when you do any step of a lesson.`;
  }
  const parts = [`Active on ${a.activeCount} of the last ${a.windowDays} days`];
  if (a.currentStreak > 0) parts.push(`current streak ${days(a.currentStreak)}`);
  if (a.longestStreak > 1) parts.push(`longest streak ${days(a.longestStreak)}`);
  if (a.lastActive) parts.push(`last active ${formatDay(a.lastActive, now)}`);
  return `${parts.join(', ')}.`;
}
