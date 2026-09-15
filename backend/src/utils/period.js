// period.js — Performance Engine §H: the ONE definition of a "week" and a
// "month" for the whole app, so no two screens can disagree about which
// period you are currently in.
//
// The week runs SATURDAY -> FRIDAY. This is the real working week here, and
// it deliberately replaces the Monday-start `startOfWeek` that used to live
// in activitiesController.js — that one's own comment said Monday "matches
// how most of this app's date logic treats a week elsewhere", which was true
// of the attendance CALENDAR's rendering but was never the business week.
// Rendering a calendar Monday-first is a display choice and stays where it
// is; bucketing work into a week is a business rule and lives here.
//
// Every function is pure and local-time based. Periods are half-open
// [start, end) so a record is counted by exactly one period, never two —
// the same convention the existing month queries already use
// (`monthStart <= date < monthEnd`).

// 6 = Saturday in JS's getDay() (0 = Sunday).
const WEEK_START_DAY = 6;

// Midnight, local time, stripping any time component.
function atMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// The Saturday on or before `date`.
export function startOfWeek(date) {
  const d = atMidnight(date);
  // How many days we are past the most recent Saturday. (getDay() - 6 + 7) % 7
  // maps Sat->0, Sun->1, Mon->2 ... Fri->6.
  const daysSinceWeekStart = (d.getDay() - WEEK_START_DAY + 7) % 7;
  d.setDate(d.getDate() - daysSinceWeekStart);
  return d;
}

// Exclusive end — the NEXT Saturday, i.e. startOfWeek + 7 days.
export function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 7);
  return d;
}

// UTC counterpart of startOfWeek, for the one caller whose dates are stored
// as UTC midnight rather than local midnight: leaveRequestsController's
// WEEKLY_OFF quota (see its own comment on why that table is UTC-based).
// Deliberately a separate function rather than a flag — mixing local and
// UTC date math in one function is how off-by-one-day bugs get written —
// but it reads WEEK_START_DAY from the same constant, so the working week
// is still defined in exactly one place.
export function startOfWeekUtc(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceWeekStart = (d.getUTCDay() - WEEK_START_DAY + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceWeekStart);
  return d;
}

export function weekRange(date) {
  return { start: startOfWeek(date), end: endOfWeek(date) };
}

// `offset` counts backwards: 0 = the week containing `date`, 1 = the week
// before it. Used for "This Week / Last Week / 2 Weeks Ago".
export function weekRangeOffset(date, offset) {
  const start = startOfWeek(date);
  start.setDate(start.getDate() - offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function monthRange(date) {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

// `offset` counts backwards in months, same convention as weekRangeOffset.
// Constructing via (year, month - offset, 1) lets the Date constructor handle
// year rollover, so December -> January needs no special case.
export function monthRangeOffset(date, offset) {
  const start = new Date(date.getFullYear(), date.getMonth() - offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end };
}

export const PERIOD_TYPES = { WEEK: "WEEK", MONTH: "MONTH" };

export function periodRange(periodType, date, offset = 0) {
  return periodType === PERIOD_TYPES.WEEK
    ? weekRangeOffset(date, offset)
    : monthRangeOffset(date, offset);
}

// Every period of `periodType` that has fully ENDED as of `now`, most recent
// first, walking back `limit` periods. The snapshot sweep is driven by this:
// it asks "which of these has no snapshot row yet" rather than tracking
// whether it already ran today, so a missed tick or a multi-day outage
// self-heals on the next run (same self-healing property as
// nightShiftService's createMany({ skipDuplicates: true })).
export function closedPeriods(periodType, now, limit) {
  const out = [];
  // offset 0 is the period containing `now`, which is still in progress —
  // start at 1.
  for (let offset = 1; offset <= limit; offset += 1) {
    const { start, end } = periodRange(periodType, now, offset);
    if (end <= now) out.push({ periodType, periodStart: start, periodEnd: end });
  }
  return out;
}

// Stable string key for a period, for Map lookups and log lines.
// Uses local date parts rather than toISOString() on purpose: toISOString()
// converts to UTC, which shifts the date backwards for any timezone east of
// UTC and would label a Saturday-start week with the previous Friday.
export function periodKey(periodType, periodStart) {
  const y = periodStart.getFullYear();
  const m = String(periodStart.getMonth() + 1).padStart(2, "0");
  const d = String(periodStart.getDate()).padStart(2, "0");
  return `${periodType}:${y}-${m}-${d}`;
}
