/**
 * Calendar of the peer review cycles (BR-312). Everything is counted in whole calendar days of the Organization
 * time zone, never in 24-hour blocks, so a cycle always opens and closes at local midnight.
 */

// ponytail: tenant-service does not expose the Organization time zone yet; every Organization defaults to this one
// (tenant-service organizations.timezone default). Pass the real value as `timeZone` once an endpoint exists.
export const DEFAULT_ORG_TIMEZONE = 'Asia/Ho_Chi_Minh';

const DAY_MS = 86_400_000;

interface LocalDate {
  y: number;
  m: number;
  d: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterOf = (timeZone: string) => {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
};

const partsOf = (instant: Date, timeZone: string) => {
  const p: Record<string, number> = {};
  for (const part of formatterOf(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return p;
};

/** How far the local clock of `timeZone` is ahead of UTC at `instant`, in milliseconds. */
const offsetMs = (instant: Date, timeZone: string) => {
  const p = partsOf(instant, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

const localDateOf = (instant: Date, timeZone: string): LocalDate => {
  const p = partsOf(instant, timeZone);
  return { y: p.year, m: p.month, d: p.day };
};

/** The instant at which the local day `date` starts. Two passes so a day with a clock change is still right. */
const midnightOf = ({ y, m, d }: LocalDate, timeZone: string): Date => {
  const naive = Date.UTC(y, m - 1, d);
  let t = naive - offsetMs(new Date(naive), timeZone);
  t = naive - offsetMs(new Date(t), timeZone);
  return new Date(t);
};

/** Start of the local day that contains `instant`. */
export const startOfDay = (instant: Date, timeZone: string): Date =>
  midnightOf(localDateOf(instant, timeZone), timeZone);

/** Start of the local day `days` calendar days after the local day of `instant` (days may be negative). */
export const addCalendarDays = (
  instant: Date,
  days: number,
  timeZone: string,
): Date => {
  const { y, m, d } = localDateOf(instant, timeZone);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return midnightOf(
    {
      y: shifted.getUTCFullYear(),
      m: shifted.getUTCMonth() + 1,
      d: shifted.getUTCDate(),
    },
    timeZone,
  );
};

/** Whole calendar days from the local day of `from` to the local day of `to`. */
export const calendarDaysBetween = (
  from: Date,
  to: Date,
  timeZone: string,
): number => {
  const a = localDateOf(from, timeZone);
  const b = localDateOf(to, timeZone);
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS,
  );
};

export interface CycleWindow {
  opensAt: Date;
  closesAt: Date;
  reviewDueAt: Date;
}

/**
 * The cycle that contains `now` (BR-312).
 *  - cycleDays = L, reviewDays = D, both counted in calendar days.
 *  - First cycle of an Assignment (`anchor` = null): opens at the start of today.
 *  - Otherwise the calendar is a grid that starts at the close of the last existing cycle (`anchor`) and repeats every
 *    L days; days without any submission create no cycle, so `now` simply falls into whichever grid slot holds it.
 *  - Close = end of the L-th day (the open day is day 1); due = end of the D-th day after the closing day.
 */
export function cycleWindowFor(
  now: Date,
  anchor: Date | null,
  cycleDays: number,
  reviewDays: number,
  timeZone: string = DEFAULT_ORG_TIMEZONE,
): CycleWindow {
  let opensAt = startOfDay(now, timeZone);
  if (anchor) {
    const slots = Math.max(
      0,
      Math.floor(calendarDaysBetween(anchor, now, timeZone) / cycleDays),
    );
    opensAt = addCalendarDays(anchor, slots * cycleDays, timeZone);
  }
  const closesAt = addCalendarDays(opensAt, cycleDays, timeZone);
  return {
    opensAt,
    closesAt,
    reviewDueAt: addCalendarDays(closesAt, reviewDays, timeZone),
  };
}
