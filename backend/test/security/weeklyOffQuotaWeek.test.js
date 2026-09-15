// weeklyOffQuotaWeek.test.js — locks in the company working week
// (SATURDAY -> FRIDAY, utils/period.js) as the window the WEEKLY_OFF quota
// is enforced over.
//
// This rule was previously a hand-rolled Monday-start week inside
// leaveRequestsController and had NO test coverage at all, so the change to
// Saturday-start could have silently altered who may book a day off with
// nothing failing. The Friday->Saturday case below is the exact behaviour
// that flipped: under the old Monday week those two adjacent days were the
// SAME week (so the second booking was refused); under the company working
// week the Saturday opens a NEW week and the booking is allowed.
//
// Dates are chosen relative to "today" rather than hardcoded, because
// createCalendarOffDay refuses past dates outright — a fixed calendar date
// would start failing the moment it drifted into the past.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market;

// The next Saturday strictly AFTER today, as a UTC-midnight date-only
// marker — matching how LeaveRequest.date is stored (see
// leaveRequestsController's own UTC comment). Everything below is offset
// from this, so every date under test is comfortably in the future.
function upcomingSaturdayUtc() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() !== 6);
  return d;
}

function isoPlusDays(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function bookWeeklyOff(token, date) {
  return apiFetch(baseUrl, "/api/leave-requests", {
    method: "POST", token, body: { date, type: "WEEKLY_OFF" },
  });
}

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(90811);
  const supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id, name: "WeekQuota Market" });
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

test("WEEKLY OFF QUOTA: a second weekly off inside the SAME Sat->Fri week is refused", async () => {
  const employee = await makeEmployee({ marketId: market.id, name: "WeekQuota Same-Week Worker", role: "WORKER" });
  const token = tokenForEmployee(employee);
  const saturday = upcomingSaturdayUtc();

  // Sunday and Monday of that same Saturday-start week.
  const first = await bookWeeklyOff(token, isoPlusDays(saturday, 1));
  assert.equal(first.status, 201);

  const second = await bookWeeklyOff(token, isoPlusDays(saturday, 2));
  assert.equal(second.status, 400);
  assert.match(second.body.error, /weekly off/i);
});

test("WEEKLY OFF QUOTA: Friday and the NEXT DAY (Saturday) are different weeks, so both are allowed", async () => {
  const employee = await makeEmployee({ marketId: market.id, name: "WeekQuota Friday Worker", role: "WORKER" });
  const token = tokenForEmployee(employee);
  const saturday = upcomingSaturdayUtc();

  // +6 is the Friday that CLOSES this working week; +7 is the Saturday
  // that OPENS the next one. Under the old Monday-start week these two
  // adjacent days fell in the same week and the second booking was refused.
  const friday = await bookWeeklyOff(token, isoPlusDays(saturday, 6));
  assert.equal(friday.status, 201);

  const nextSaturday = await bookWeeklyOff(token, isoPlusDays(saturday, 7));
  assert.equal(
    nextSaturday.status, 201,
    "Saturday opens a new working week — this is the behaviour change from Monday-start weeks"
  );
});

test("WEEKLY OFF QUOTA: the quota endpoint reports usage against the same Sat->Fri week", async () => {
  const employee = await makeEmployee({ marketId: market.id, name: "WeekQuota Endpoint Worker", role: "WORKER" });
  const token = tokenForEmployee(employee);
  const saturday = upcomingSaturdayUtc();

  const booked = isoPlusDays(saturday, 3); // Tuesday of that week
  assert.equal((await bookWeeklyOff(token, booked)).status, 201);

  // Same week -> shows as used and unavailable.
  const sameWeek = await apiFetch(baseUrl, `/api/leave-requests/quota?date=${isoPlusDays(saturday, 4)}`, { token });
  assert.equal(sameWeek.status, 200);
  assert.equal(sameWeek.body.weekly.used, 1);
  assert.equal(sameWeek.body.weekly.available, false);

  // Next week -> a fresh allowance, proving the window moved with the week
  // rather than being a rolling 7 days from the booking.
  const nextWeek = await apiFetch(baseUrl, `/api/leave-requests/quota?date=${isoPlusDays(saturday, 8)}`, { token });
  assert.equal(nextWeek.status, 200);
  assert.equal(nextWeek.body.weekly.used, 0);
  assert.equal(nextWeek.body.weekly.available, true);
});
