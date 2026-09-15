// performanceApi.test.js — Performance Engine Phase 4: the API layer and
// its visibility rules.
//
// The scoring arithmetic is already proven purely (scoringEngine.test.js)
// and the storage contract is proven against a database (rollup.test.js).
// What is under test HERE is who may read what, and — above all — the rule
// that an employee never receives the supervisor's internal scoring.
//
// The leak assertions are deliberately made against the serialized JSON
// STRING rather than against individual fields, so a value nested somewhere
// unexpected (inside metrics, inside inputs, inside a category detail)
// still fails the test.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";
import { weekRangeOffset, monthRangeOffset } from "../../src/utils/period.js";
import { snapshotPeriod } from "../../src/services/performance/performanceService.js";
import { MANAGEMENT_ONLY_FIELDS } from "../../src/services/performance/performanceView.js";

let server, baseUrl;
let zoneA, zoneB, marketA, marketB;
let admin, tokenAdmin;
let supervisorA, tokenSupervisorA;
let supervisorB, tokenSupervisorB;
let rmA, tokenRmA;
let rmB, tokenRmB;
let workerA, tokenWorkerA;
let workerB, tokenWorkerB;
let lastWeek;

const NOW = new Date();

async function addReview({ employeeId, marketId, outcome, severity, points, max = 8, workDate }) {
  return prisma.workReview.create({
    data: {
      targetType: "TASK",
      targetId: `api-${Math.random().toString(36).slice(2)}`,
      outcome, severity,
      qualityPoints: points, qualityMax: max,
      profileKey: "DEFAULT", profileVersion: 1,
      employeeId, marketId,
      workCategory: "FACING",
      workDate,
      reason: "reviewer note",
    },
  });
}

async function addAttendance({ employeeId, marketId, date, punishmentHours = 0 }) {
  const checkIn = new Date(date);
  checkIn.setHours(8, 0, 0, 0);
  const checkOut = new Date(date);
  checkOut.setHours(16, 0, 0, 0);
  return prisma.attendanceRecord.create({
    data: {
      employeeId, marketId, date, status: "PRESENT", requiredHours: 8,
      punishmentHours, punishmentReason: punishmentHours > 0 ? "api test" : null,
      checkIn, checkOut, source: "MANUAL",
    },
  });
}

// A closed week containing a correction and a rejection, so every hidden
// field actually has a value that COULD leak.
async function seedClosedWeek(employee) {
  const { start, end } = weekRangeOffset(NOW, 1);
  const mid = new Date(start);
  mid.setDate(mid.getDate() + 2);
  mid.setHours(12, 0, 0, 0);

  await addReview({ employeeId: employee.id, marketId: employee.marketId, outcome: "APPROVED", severity: null, points: 8, workDate: mid });
  await addReview({ employeeId: employee.id, marketId: employee.marketId, outcome: "APPROVED", severity: null, points: 8, workDate: mid });
  await addReview({ employeeId: employee.id, marketId: employee.marketId, outcome: "APPROVED_WITH_CORRECTION", severity: "MODERATE", points: 4, workDate: mid });
  await addReview({ employeeId: employee.id, marketId: employee.marketId, outcome: "REJECTED", severity: "MAJOR", points: 0, workDate: mid });
  await addReview({ employeeId: employee.id, marketId: employee.marketId, outcome: "APPROVED", severity: null, points: 8, workDate: mid });

  for (let d = 0; d < 5; d += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + d);
    day.setHours(12, 0, 0, 0);
    await addAttendance({ employeeId: employee.id, marketId: employee.marketId, date: day, punishmentHours: d === 0 ? 3 : 0 });
  }

  await snapshotPeriod({ employeeId: employee.id, periodType: "WEEK", periodStart: start, periodEnd: end, now: NOW });
  return { start, end };
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Asserts that no management-only value appears anywhere in a response.
function assertNoInternalScoring(body, label) {
  const json = JSON.stringify(body);
  for (const field of MANAGEMENT_ONLY_FIELDS) {
    assert.ok(!json.includes(`"${field}"`), `${label}: leaked field "${field}"`);
  }
  for (const word of ["MINOR", "MODERATE", "MAJOR"]) {
    assert.ok(!json.includes(word), `${label}: leaked severity level "${word}"`);
  }
}

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90841);
  zoneB = await makeZone(90842);
  admin = await makeStaffUser({ role: "ADMIN" });
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });

  await prisma.zone.update({ where: { id: zoneA.id }, data: { managerId: rmA.id } });
  await prisma.zone.update({ where: { id: zoneB.id }, data: { managerId: rmB.id } });

  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id, name: "PerfApi Market A" });
  marketB = await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorB.id, name: "PerfApi Market B" });

  workerA = await makeEmployee({ marketId: marketA.id, name: "PerfApi Worker A", role: "WORKER" });
  workerB = await makeEmployee({ marketId: marketB.id, name: "PerfApi Worker B", role: "WORKER" });

  tokenAdmin = tokenForStaff(admin);
  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenSupervisorB = tokenForStaff(supervisorB, { managedMarket: marketB });
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenRmB = tokenForStaff(rmB, { managedZones: [zoneB] });
  tokenWorkerA = tokenForEmployee(workerA);
  tokenWorkerB = tokenForEmployee(workerB);

  lastWeek = await seedClosedWeek(workerA);
});

after(async () => {
  await stopServer(server);
  for (const id of [workerA.id, workerB.id]) {
    await prisma.performanceSnapshot.deleteMany({ where: { employeeId: id } }).catch(() => {});
    await prisma.performanceStreak.deleteMany({ where: { employeeId: id } }).catch(() => {});
    await prisma.workReview.deleteMany({ where: { employeeId: id } }).catch(() => {});
  }
  await cleanup();
});

// ======================================================================
// EMPLOYEE SELF-ACCESS
// ======================================================================

test("SELF: an employee can read their own current performance", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/performance/me", { token: tokenWorkerA });
  assert.equal(status, 200);
  assert.equal(body.employeeId, workerA.id);
  assert.ok(body.current, "the current period should be returned");
  assert.equal(body.current.provisional, true, "the in-progress period is always provisional");
  assert.ok(body.streaks, "streaks are employee-visible");
});

test("SELF: the summary defaults to the MONTH, not the week (spec §13)", async () => {
  const { body } = await apiFetch(baseUrl, "/api/performance/me", { token: tokenWorkerA });
  assert.equal(body.current.periodType, "MONTH", "the homepage figure is the monthly score");
});

test("SELF: an employee can read their weekly and monthly history", async () => {
  const weekly = await apiFetch(baseUrl, "/api/performance/me/history?periodType=WEEK&limit=4", { token: tokenWorkerA });
  assert.equal(weekly.status, 200);
  assert.equal(weekly.body.periodType, "WEEK");
  assert.ok(Array.isArray(weekly.body.periods));
  assert.ok(weekly.body.periods.length > 0, "the seeded closed week should appear");

  const monthly = await apiFetch(baseUrl, "/api/performance/me/history?periodType=MONTH&limit=6", { token: tokenWorkerA });
  assert.equal(monthly.status, 200);
  assert.equal(monthly.body.periodType, "MONTH");
});

test("SELF: an employee can read the 6-month and 1-year aggregates with coverage", async () => {
  const six = await apiFetch(baseUrl, "/api/performance/me/aggregate?months=6", { token: tokenWorkerA });
  assert.equal(six.status, 200);
  assert.equal(six.body.months, 6);
  assert.ok(six.body.coverage.endsWith("/6"), "coverage must say how partial the figure is");

  const year = await apiFetch(baseUrl, "/api/performance/me/aggregate?months=12", { token: tokenWorkerA });
  assert.equal(year.status, 200);
  assert.ok(year.body.coverage.endsWith("/12"));
});

test("SELF: an employee can drill into one closed period and see its category breakdown", async () => {
  const { status, body } = await apiFetch(
    baseUrl, `/api/performance/me/periods/WEEK/${isoDate(lastWeek.start)}`, { token: tokenWorkerA }
  );
  assert.equal(status, 200);
  assert.ok(body.period, "the period must be returned");
  assert.ok(body.period.categories, "the breakdown is the whole point of the drill-down");
  assert.ok(Array.isArray(body.reviews), "and the reviews behind the Quality score");
  assert.ok(body.reviews.length > 0);
});

test("SELF: a period that was never closed is a clean 404, not an invented empty score", async () => {
  const { status } = await apiFetch(
    baseUrl, "/api/performance/me/periods/WEEK/1999-01-02", { token: tokenWorkerA }
  );
  assert.equal(status, 404);
});

// ======================================================================
// HIDDEN INTERNAL SCORING — the core §4 requirement
// ======================================================================

test("HIDDEN: no employee-facing endpoint leaks severity or point values", async () => {
  const endpoints = [
    "/api/performance/me",
    "/api/performance/me/history?periodType=WEEK&limit=4",
    "/api/performance/me/history?periodType=MONTH&limit=6",
    "/api/performance/me/aggregate?months=6",
    "/api/performance/me/reviews",
    `/api/performance/me/periods/WEEK/${isoDate(lastWeek.start)}`,
    `/api/performance/employees/${workerA.id}`,
    `/api/performance/employees/${workerA.id}/history?periodType=WEEK`,
    `/api/performance/employees/${workerA.id}/reviews`,
    `/api/performance/employees/${workerA.id}/periods/WEEK/${isoDate(lastWeek.start)}`,
  ];

  for (const path of endpoints) {
    const { status, body } = await apiFetch(baseUrl, path, { token: tokenWorkerA });
    assert.equal(status, 200, `${path} should succeed for the employee themselves`);
    assertNoInternalScoring(body, path);
  }
});

test("HIDDEN: the employee sees the OUTCOME and the reviewer's reason, just not the grading", async () => {
  const { body } = await apiFetch(baseUrl, "/api/performance/me/reviews", { token: tokenWorkerA });
  const corrected = body.reviews.find((r) => r.outcome === "APPROVED_WITH_CORRECTION");

  assert.ok(corrected, "the employee must still learn a correction happened");
  assert.equal(corrected.reason, "reviewer note", "and must see the supervisor's own explanation");
  assert.equal(corrected.severity, undefined, "but never how severely it was graded");
  assert.equal(corrected.qualityPoints, undefined);
  assert.equal(corrected.qualityMax, undefined);
});

test("HIDDEN: the employee sees penalties counted against them — a deduction they cannot see is one they cannot dispute", async () => {
  const { body } = await apiFetch(
    baseUrl, `/api/performance/me/periods/WEEK/${isoDate(lastWeek.start)}`, { token: tokenWorkerA }
  );
  const reliability = body.period.categories.reliability;
  assert.equal(reliability.detail.punishmentHours, 3, "the 3-hour penalty is the employee's own record");
  assert.ok(reliability.points < 15, "and it visibly costs them");
});

test("HIDDEN: the employee never receives the pre-curve score or the profile internals", async () => {
  const { body } = await apiFetch(baseUrl, "/api/performance/me", { token: tokenWorkerA });
  assert.equal(body.current.rawScore, undefined, "the raw pre-curve score is management-only");
  assert.equal(body.current.baseScore, undefined);
  assert.equal(body.current.profileKey, undefined);
  assert.equal(body.current.inputs, undefined, "frozen facts are management-only");
});

// ======================================================================
// MANAGEMENT VISIBILITY
// ======================================================================

test("MANAGEMENT: a Supervisor DOES receive the internal scoring for their own market", async () => {
  const { status, body } = await apiFetch(
    baseUrl, `/api/performance/employees/${workerA.id}/periods/WEEK/${isoDate(lastWeek.start)}`, { token: tokenSupervisorA }
  );
  assert.equal(status, 200);

  const json = JSON.stringify(body);
  assert.ok(json.includes("rawScore"), "management needs the pre-curve score to explain a result");
  assert.ok(json.includes("MODERATE"), "and the correction severity behind it");

  const corrected = body.reviews.find((r) => r.outcome === "APPROVED_WITH_CORRECTION");
  assert.equal(corrected.severity, "MODERATE");
  assert.equal(corrected.qualityPoints, 4, "the internal 4-of-8 is visible to management");
  assert.equal(corrected.qualityMax, 8);
});

test("MANAGEMENT: the same endpoint returns two different shapes for two different viewers", async () => {
  const path = `/api/performance/employees/${workerA.id}`;
  const asEmployee = await apiFetch(baseUrl, path, { token: tokenWorkerA });
  const asSupervisor = await apiFetch(baseUrl, path, { token: tokenSupervisorA });

  assert.equal(asEmployee.status, 200);
  assert.equal(asSupervisor.status, 200);
  assertNoInternalScoring(asEmployee.body, "employee view");
  assert.ok(JSON.stringify(asSupervisor.body).includes("rawScore"), "staff view keeps the internals");
});

test("MANAGEMENT: Admin and the owning RM can both read an employee's performance", async () => {
  for (const [label, token] of [["admin", tokenAdmin], ["owning RM", tokenRmA]]) {
    const { status, body } = await apiFetch(baseUrl, `/api/performance/employees/${workerA.id}`, { token });
    assert.equal(status, 200, `${label} should have access`);
    assert.equal(body.employeeId, workerA.id);
  }
});

test("MANAGEMENT: the market ranking lists scored employees for a closed period", async () => {
  const { status, body } = await apiFetch(
    baseUrl, `/api/performance/market?marketId=${marketA.id}&periodType=WEEK&offset=1`, { token: tokenSupervisorA }
  );
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.employees));
  assert.ok(body.employees.some((e) => e.employee.id === workerA.id), "the seeded worker should be listed");
});

test("MANAGEMENT: the zone rollup works for the owning RM and for Admin", async () => {
  for (const [label, token] of [["owning RM", tokenRmA], ["admin", tokenAdmin]]) {
    const { status, body } = await apiFetch(
      baseUrl, `/api/performance/zone?zoneId=${zoneA.id}&periodType=WEEK&offset=1`, { token }
    );
    assert.equal(status, 200, `${label} should be able to roll up zone A`);
    assert.ok(Array.isArray(body.employees));
  }
});

// ======================================================================
// AUTHORIZATION BOUNDARIES
// ======================================================================

test("IDOR: employee A cannot read employee B's performance", async () => {
  const paths = [
    `/api/performance/employees/${workerB.id}`,
    `/api/performance/employees/${workerB.id}/history`,
    `/api/performance/employees/${workerB.id}/aggregate`,
    `/api/performance/employees/${workerB.id}/reviews`,
    `/api/performance/employees/${workerB.id}/periods/WEEK/${isoDate(lastWeek.start)}`,
  ];
  for (const path of paths) {
    const { status } = await apiFetch(baseUrl, path, { token: tokenWorkerA });
    assert.equal(status, 403, `${path} must be refused`);
  }
});

test("IDOR: a Supervisor cannot read an employee in another market", async () => {
  const { status } = await apiFetch(baseUrl, `/api/performance/employees/${workerA.id}`, { token: tokenSupervisorB });
  assert.equal(status, 403);
});

test("IDOR: a Supervisor cannot read another market's ranking", async () => {
  const { status } = await apiFetch(
    baseUrl, `/api/performance/market?marketId=${marketA.id}&periodType=WEEK`, { token: tokenSupervisorB }
  );
  assert.equal(status, 403);
});

test("IDOR: an RM cannot read an employee or a rollup outside their own zones", async () => {
  const employee = await apiFetch(baseUrl, `/api/performance/employees/${workerA.id}`, { token: tokenRmB });
  assert.equal(employee.status, 403, "worker A is in zone A, not RM B's zone");

  const zone = await apiFetch(baseUrl, `/api/performance/zone?zoneId=${zoneA.id}`, { token: tokenRmB });
  assert.equal(zone.status, 403);
});

test("IDOR: a Supervisor cannot use the zone rollup at all", async () => {
  const { status } = await apiFetch(baseUrl, `/api/performance/zone?zoneId=${zoneA.id}`, { token: tokenSupervisorA });
  assert.equal(status, 403, "a Supervisor never manages a zone");
});

test("AUTH: unauthenticated requests are rejected before any authorization check", async () => {
  const { status } = await apiFetch(baseUrl, "/api/performance/me");
  assert.equal(status, 401);
});

// ======================================================================
// EMPLOYEES CANNOT WRITE PERFORMANCE (spec §20)
// ======================================================================

test("SECURITY: an employee cannot trigger a recompute", async () => {
  const { status } = await apiFetch(baseUrl, "/api/performance/recompute", {
    method: "POST", token: tokenWorkerA,
    body: { employeeId: workerA.id, from: "2020-01-01", to: "2030-01-01" },
  });
  assert.equal(status, 403);
});

test("SECURITY: a Supervisor cannot trigger a recompute — it is ADMIN-only", async () => {
  const { status } = await apiFetch(baseUrl, "/api/performance/recompute", {
    method: "POST", token: tokenSupervisorA,
    body: { employeeId: workerA.id, from: "2020-01-01", to: "2030-01-01" },
  });
  assert.equal(status, 403);
});

test("SECURITY: even the Admin recompute accepts no score — only a target and a date range", async () => {
  const { status } = await apiFetch(baseUrl, "/api/performance/recompute", {
    method: "POST", token: tokenAdmin,
    body: { employeeId: workerA.id, from: "2020-01-01", to: "2030-01-01", score: 100, rawScore: 100 },
  });
  assert.equal(status, 400, "the schema is .strict() — a smuggled score is refused outright");
});

test("SECURITY: the Admin recompute re-derives from source data rather than accepting a value", async () => {
  const { start } = lastWeek;
  const before = await prisma.performanceSnapshot.findUnique({
    where: { employeeId_periodType_periodStart: { employeeId: workerA.id, periodType: "WEEK", periodStart: start } },
  });

  const { status, body } = await apiFetch(baseUrl, "/api/performance/recompute", {
    method: "POST", token: tokenAdmin,
    body: { employeeId: workerA.id, from: isoDate(start), to: "2030-01-01" },
  });
  assert.equal(status, 200);
  assert.ok(body.recomputed >= 1);

  const after = await prisma.performanceSnapshot.findUnique({ where: { id: before.id } });
  assert.equal(after.score, before.score, "re-deriving unchanged source data must produce the same score");
});

test("SECURITY: there is no endpoint that writes a performance score", async () => {
  // Any of these existing as a write path would defeat the whole
  // "AION calculates the performance" principle.
  const attempts = [
    ["POST", "/api/performance/me", { score: 100 }],
    ["POST", `/api/performance/employees/${workerA.id}`, { score: 100 }],
    ["PATCH", `/api/performance/employees/${workerA.id}`, { score: 100 }],
    ["PUT", `/api/performance/employees/${workerA.id}`, { score: 100 }],
  ];
  for (const [method, path, body] of attempts) {
    const { status } = await apiFetch(baseUrl, path, { method, token: tokenAdmin, body });
    assert.ok(status === 404 || status === 405, `${method} ${path} must not exist (got ${status})`);
  }
});

// ======================================================================
// WORK REVIEW API (Phase 1 surface, re-checked under Phase 4 rules)
// ======================================================================

test("REVIEW API: a review request cannot supply qualityPoints or qualityMax", async () => {
  const task = await prisma.task.create({
    data: { employeeId: workerA.id, marketId: marketA.id, type: "FACING", label: "api guard", department: "Food", status: "PENDING" },
  });

  const { status } = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA,
    body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED", qualityPoints: 999, qualityMax: 999 },
  });
  assert.equal(status, 400);

  const review = await prisma.workReview.findUnique({
    where: { targetType_targetId: { targetType: "TASK", targetId: task.id } },
  });
  assert.equal(review, null, "a refused request must record nothing");
  await prisma.task.delete({ where: { id: task.id } });
});

test("REVIEW API: a supervisor-set severity produces server-derived points, not client ones", async () => {
  const task = await prisma.task.create({
    data: { employeeId: workerA.id, marketId: marketA.id, type: "FACING", label: "api derive", department: "Food", status: "PENDING" },
  });

  const { status, body } = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA,
    body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED_WITH_CORRECTION", severity: "MINOR", reason: "tidy up" },
  });
  assert.equal(status, 201);
  assert.equal(body.review.qualityPoints, 6, "MINOR on a weight-8 item is 6/8, derived by the profile");
  assert.equal(body.review.qualityMax, 8);

  await prisma.workReview.deleteMany({ where: { targetType: "TASK", targetId: task.id } });
  await prisma.task.delete({ where: { id: task.id } });
});

test("REVIEW API: WorkReview.outcome stays distinct from the legacy model status", async () => {
  // A correction is an ACCEPTANCE: the workflow status the rest of the app
  // reads must remain APPROVED, while the judgement is recorded separately.
  const task = await prisma.task.create({
    data: { employeeId: workerA.id, marketId: marketA.id, type: "FACING", label: "api distinct", department: "Food", status: "PENDING" },
  });

  const { body } = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA,
    body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED_WITH_CORRECTION", severity: "MAJOR", reason: "redo shelf" },
  });

  assert.equal(body.work.status, "APPROVED", "legacy status stays a plain APPROVED");
  assert.equal(body.review.outcome, "APPROVED_WITH_CORRECTION", "the judgement is richer than the status");

  const stored = await prisma.task.findUnique({ where: { id: task.id } });
  assert.equal(stored.rejectionReason, null, "a correction note must not masquerade as a rejection");

  await prisma.workReview.deleteMany({ where: { targetType: "TASK", targetId: task.id } });
  await prisma.task.delete({ where: { id: task.id } });
});

test("REVIEW API: an employee cannot submit a review", async () => {
  const task = await prisma.task.create({
    data: { employeeId: workerA.id, marketId: marketA.id, type: "FACING", label: "api employee", department: "Food", status: "PENDING" },
  });
  const { status } = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenWorkerA,
    body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED" },
  });
  assert.equal(status, 403, "an employee must never be able to approve their own work");
  await prisma.task.delete({ where: { id: task.id } });
});

test("COMPAT: the existing per-model review endpoints still work unchanged", async () => {
  const activity = await prisma.activity.create({
    data: { employeeId: workerA.id, marketId: marketA.id, category: "SHELF_CLEANING", date: new Date(), time: "09:00", status: "PENDING" },
  });

  const { status, body } = await apiFetch(baseUrl, `/api/activities/${activity.id}/review`, {
    method: "POST", token: tokenSupervisorA, body: { status: "APPROVED" },
  });
  assert.equal(status, 200, "Phase 1's delegating wrapper must still behave identically");
  assert.equal(body.status, "APPROVED");
  assert.ok(Array.isArray(body.images), "and still return the shape TodayActivityFeed reads");

  await prisma.workReview.deleteMany({ where: { targetType: "ACTIVITY", targetId: activity.id } });
  await prisma.activity.delete({ where: { id: activity.id } });
});

test("COMPAT: the review queue is still reachable and still market-scoped", async () => {
  const mine = await apiFetch(baseUrl, `/api/work-reviews/queue?marketId=${marketA.id}`, { token: tokenSupervisorA });
  assert.equal(mine.status, 200);

  const theirs = await apiFetch(baseUrl, `/api/work-reviews/queue?marketId=${marketA.id}`, { token: tokenSupervisorB });
  assert.equal(theirs.status, 403);
});

// ======================================================================
// IMMUTABILITY OF CLOSED PERIODS
// ======================================================================

test("IMMUTABLE: a sealed period is not recomputed by the admin route", async () => {
  const { start, end } = monthRangeOffset(NOW, 1);
  // An earlier history request may already have closed this month lazily
  // (getHistory persists on read), so clear it before planting the sealed
  // fixture rather than colliding with the unique constraint.
  await prisma.performanceSnapshot.deleteMany({
    where: { employeeId: workerA.id, periodType: "MONTH", periodStart: start },
  });
  const sealed = await prisma.performanceSnapshot.create({
    data: {
      employeeId: workerA.id, marketId: marketA.id, position: "WORKER",
      periodType: "MONTH", periodStart: start, periodEnd: end,
      score: 70, rawScore: 70, baseScore: 70, applicableMax: 100,
      inputs: {}, metrics: {}, profileKey: "DEFAULT", profileVersion: 1,
      sealedAt: new Date(),
    },
  });

  const { status } = await apiFetch(baseUrl, "/api/performance/recompute", {
    method: "POST", token: tokenAdmin,
    body: { employeeId: workerA.id, from: isoDate(start), to: "2030-01-01" },
  });
  assert.equal(status, 200);

  const after = await prisma.performanceSnapshot.findUnique({ where: { id: sealed.id } });
  assert.equal(after.score, 70, "a sealed snapshot is immutable even to an Admin recompute");
  assert.ok(after.sealedAt, "and stays sealed");

  await prisma.performanceSnapshot.delete({ where: { id: sealed.id } });
});
