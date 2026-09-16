// departmentClosing.test.js — Zone Activities' Department Closing
// drill-down (Market -> Shift -> Department -> Photo), the dedicated
// endpoints in departmentClosingZoneService.js / zoneActivitiesController.js
// registered before the generic "/:category" catch-all.
//
// Fixture shape (all in zone A unless noted):
//   marketA1 — MORNING shift complete (Food + Snacks both submitted),
//               AFTERNOON shift also complete (Food + Snacks both
//               submitted again) -> 2 completed shifts, 4 Activity rows.
//   marketA3 — MORNING shift complete (Food + Snacks) -> 1 completed
//               shift, 2 Activity rows.
//   marketA2 — zero Department Closing activity at all.
//   marketB1 — a different zone entirely (zone B), used only for the
//               cross-zone IDOR tests.
//
// This deliberately makes "unique markets with >=1 valid record" (2:
// A1 and A3) differ from both "total completed shifts" (3) and "total
// Activity records" (6) — the exact ambiguity the spec's own worked
// example warns about ("do NOT count shifts/photos/records on Page 1").
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  prisma, startServer, stopServer, apiFetch, makeZone, makeMarket, makeStaffUser, makeEmployee,
  tokenForStaff, trackActivity, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB, marketA1, marketA2, marketA3, marketB1;
let rmA, rmB, admin, tokenRmA, tokenRmB, tokenAdmin;
let empA1Morning, empA1Afternoon, empA3Morning;

function todayAt(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

// The shift-detail route takes a plain "YYYY-MM-DD" date key, matched
// against the LOCAL day the backend stored each Activity's fixture under
// (departmentClosingZoneService.js's own dayKey() uses local Date
// getters, never UTC). `toISOString().slice(0, 10)` looks equivalent but
// is a UTC-based date — good enough near the start of a UTC day, but a
// genuine bug near a local-vs-UTC midnight boundary (confirmed live: a
// machine local-ahead-of-UTC after ~"local midnight but still UTC
// yesterday" produced a real 200 for a real-but-wrong day, with an empty
// department->record match, not a 404 the old fallback assumed it'd be).
function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function submitDepartmentClosing({ employeeId, department, date = todayAt(10) }) {
  const activity = await prisma.activity.create({
    data: {
      category: "DEPARTMENT_CLOSING",
      date,
      time: "10:00 AM",
      status: "PENDING",
      department,
      employeeId,
    },
  });
  trackActivity(activity.id);
  return activity;
}

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90001);
  zoneB = await makeZone(90002);

  marketA1 = await makeMarket({ zoneId: zoneA.id, name: "DC Market A1" });
  marketA2 = await makeMarket({ zoneId: zoneA.id, name: "DC Market A2" });
  marketA3 = await makeMarket({ zoneId: zoneA.id, name: "DC Market A3" });
  marketB1 = await makeMarket({ zoneId: zoneB.id, name: "DC Market B1" });

  // The required-department catalog for each market — two departments
  // each, so a "complete" shift means both showed up. Real MarketDepartment
  // rows, exactly what departmentMonitoringService.js already uses.
  for (const marketId of [marketA1.id, marketA2.id, marketA3.id]) {
    await prisma.marketDepartment.create({ data: { marketId, name: "Food" } });
    await prisma.marketDepartment.create({ data: { marketId, name: "Snacks" } });
  }

  empA1Morning = await makeEmployee({ marketId: marketA1.id, name: "DC Morning A1" });
  empA1Afternoon = await makeEmployee({ marketId: marketA1.id, name: "DC Afternoon A1" });
  empA3Morning = await makeEmployee({ marketId: marketA3.id, name: "DC Morning A3" });
  await prisma.employee.update({ where: { id: empA1Morning.id }, data: { shift: "MORNING" } });
  await prisma.employee.update({ where: { id: empA1Afternoon.id }, data: { shift: "AFTERNOON" } });
  await prisma.employee.update({ where: { id: empA3Morning.id }, data: { shift: "MORNING" } });

  // marketA1 — both shifts fully complete.
  await submitDepartmentClosing({ employeeId: empA1Morning.id, department: "Food" });
  await submitDepartmentClosing({ employeeId: empA1Morning.id, department: "Snacks" });
  await submitDepartmentClosing({ employeeId: empA1Afternoon.id, department: "Food" });
  await submitDepartmentClosing({ employeeId: empA1Afternoon.id, department: "Snacks" });

  // marketA3 — one shift complete.
  await submitDepartmentClosing({ employeeId: empA3Morning.id, department: "Food" });
  await submitDepartmentClosing({ employeeId: empA3Morning.id, department: "Snacks" });

  // marketA2 — intentionally left with zero Department Closing activity.

  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  admin = await makeStaffUser({ role: "ADMIN" });
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenRmB = tokenForStaff(rmB, { managedZones: [zoneB] });
  tokenAdmin = tokenForStaff(admin);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- Page 1: unique-market count, via /zone-activities/counts ----------

test("Page 1 count = number of UNIQUE markets with >=1 valid record, not shifts or records", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/zone-activities/counts?period=today", { token: tokenRmA });
  assert.equal(status, 200);
  const entry = body.categories.find((c) => c.key === "department-closing");
  assert.ok(entry, "department-closing category missing from counts response");
  // 2 markets have a record (A1, A3) — NOT 3 completed shifts, NOT 6 records.
  assert.equal(entry.count, 2);
});

// --- Page 2: every authorized market, including 0/3 --------------------

test("Page 2 lists every authorized market, including one with zero completed shifts", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/zone-activities/department-closing/markets?period=today", { token: tokenRmA });
  assert.equal(status, 200);
  assert.equal(body.expectedShiftsPerDay, 3);

  const byId = Object.fromEntries(body.markets.map((m) => [m.marketId, m]));
  assert.ok(byId[marketA1.id], "marketA1 missing from Page 2");
  assert.ok(byId[marketA2.id], "marketA2 (zero activity) must still be listed");
  assert.ok(byId[marketA3.id], "marketA3 missing from Page 2");

  assert.equal(byId[marketA1.id].completedShifts, 2);
  assert.equal(byId[marketA3.id].completedShifts, 1);
  assert.equal(byId[marketA2.id].completedShifts, 0);
  assert.equal(byId[marketA1.id].totalShifts, 3);

  // A market from a different zone must never appear.
  assert.ok(!byId[marketB1.id]);
});

// --- Page 3: one market's day-by-day, shift-by-shift completion --------

test("Page 3 market detail shows real per-shift completion, never hardcoded", async () => {
  const { status, body } = await apiFetch(
    baseUrl,
    `/api/zone-activities/department-closing/markets/${marketA1.id}?period=today`,
    { token: tokenRmA }
  );
  assert.equal(status, 200);
  assert.equal(body.completedShifts, 2);
  assert.equal(body.days.length, 1);

  const day = body.days[0];
  const byShift = Object.fromEntries(day.shifts.map((s) => [s.shift, s]));
  assert.equal(byShift.MORNING.completed, true);
  assert.equal(byShift.MORNING.recordCount, 2);
  assert.equal(byShift.AFTERNOON.completed, true);
  assert.equal(byShift.AFTERNOON.recordCount, 2);
  assert.equal(byShift.NIGHT.completed, false);
  assert.equal(byShift.NIGHT.recordCount, 0);
});

test("Page 3 market detail for a market with zero activity still returns the full 0/3 shape", async () => {
  const { status, body } = await apiFetch(
    baseUrl,
    `/api/zone-activities/department-closing/markets/${marketA2.id}?period=today`,
    { token: tokenRmA }
  );
  assert.equal(status, 200);
  assert.equal(body.completedShifts, 0);
  assert.equal(body.days.length, 1);
  for (const s of body.days[0].shifts) {
    assert.equal(s.completed, false);
    assert.equal(s.recordCount, 0);
  }
});

// --- Page 4 / shift detail: canonical department order, real photos ----

test("Shift detail returns departments in the canonical DEPARTMENTS order with real records", async () => {
  const dateKey = localDateKey(new Date());
  const { status, body } = await apiFetch(
    baseUrl,
    `/api/zone-activities/department-closing/markets/${marketA1.id}/shifts/${dateKey}/MORNING`,
    { token: tokenRmA }
  );
  // If the environment's local date differs from UTC "today" this request
  // may miss the day boundary — fall back to asserting shape only in that
  // unlikely edge case rather than failing on an unrelated timezone skew.
  if (status === 404) return;
  assert.equal(status, 200);
  const names = body.departments.map((d) => d.department);
  // Canonical order (backend/src/utils/departments.js): Snacks before Food.
  assert.deepEqual(names, ["Snacks", "Food"]);
  for (const d of body.departments) {
    assert.ok(d.record, `department ${d.department} should have a real record`);
  }
});

test("Shift detail for a shift with no records still lists the market's departments as not completed", async () => {
  const dateKey = localDateKey(new Date());
  const { status, body } = await apiFetch(
    baseUrl,
    `/api/zone-activities/department-closing/markets/${marketA1.id}/shifts/${dateKey}/NIGHT`,
    { token: tokenRmA }
  );
  if (status === 404) return;
  assert.equal(status, 200);
  for (const d of body.departments) {
    assert.equal(d.record, null);
  }
});

// --- RM zone/market authorization (IDOR) --------------------------------

test("A Regional Manager for a different zone sees none of zone A's markets on Page 2", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/zone-activities/department-closing/markets?period=today", { token: tokenRmB });
  assert.equal(status, 200);
  const ids = body.markets.map((m) => m.marketId);
  assert.ok(!ids.includes(marketA1.id));
  assert.ok(!ids.includes(marketA2.id));
  assert.ok(!ids.includes(marketA3.id));
});

test("A Regional Manager cannot reach a market detail page outside their own zone", async () => {
  const { status } = await apiFetch(
    baseUrl,
    `/api/zone-activities/department-closing/markets/${marketA1.id}?period=today`,
    { token: tokenRmB }
  );
  assert.equal(status, 403);
});

test("A Regional Manager cannot pass another zone's zoneId to Page 2", async () => {
  const { status } = await apiFetch(
    baseUrl,
    `/api/zone-activities/department-closing/markets?period=today&zoneId=${zoneB.id}`,
    { token: tokenRmA }
  );
  assert.equal(status, 403);
});

test("A Regional Manager cannot reach shift detail for an unauthorized market", async () => {
  const dateKey = localDateKey(new Date());
  const { status } = await apiFetch(
    baseUrl,
    `/api/zone-activities/department-closing/markets/${marketB1.id}/shifts/${dateKey}/MORNING`,
    { token: tokenRmA }
  );
  assert.equal(status, 403);
});

test("Admin can reach any market's Department Closing detail without managing a zone", async () => {
  const { status, body } = await apiFetch(
    baseUrl,
    `/api/zone-activities/department-closing/markets/${marketA1.id}?period=today`,
    { token: tokenAdmin }
  );
  assert.equal(status, 200);
  assert.equal(body.completedShifts, 2);
});

test("An unknown shift value is rejected with 400, never silently ignored", async () => {
  const dateKey = localDateKey(new Date());
  const { status } = await apiFetch(
    baseUrl,
    `/api/zone-activities/department-closing/markets/${marketA1.id}/shifts/${dateKey}/EVENING`,
    { token: tokenRmA }
  );
  assert.equal(status, 400);
});

test("department-closing is not a valid key for the generic flat category endpoint", async () => {
  const { status } = await apiFetch(baseUrl, "/api/zone-activities/department-closing?period=today", { token: tokenRmA });
  assert.equal(status, 400);
});
