// adminActionsVerification.test.js — Admin Actions & Role Management
// Backend Verification: market-transfer atomicity/history-safety, the two
// fixed retroactive-query bugs (AttendanceAdjustmentRequest,
// CountingAssignment), tokenVersion session-invalidation for every
// "Change Assignment" sub-case (Employee, Supervisor, Overlooking
// Supervisor, Regional Manager zones), the widened MARKET_ASSIGNMENT_CHANGED
// audit scope, and the redesigned DELETE /api/employees/:id history guard.
// See test/helpers.js for the shared fixture/cleanup strategy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, trackEmployee, trackUser, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB;
let marketA, marketB;
let admin, tokenAdmin;
let supervisorA, tokenSupervisorA;
let rmA, tokenRmA;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90801);
  zoneB = await makeZone(90802);

  admin = await makeStaffUser({ role: "ADMIN" });
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  await prisma.zone.update({ where: { id: zoneA.id }, data: { managerId: rmA.id } });
  await prisma.zone.update({ where: { id: zoneB.id }, data: { managerId: rmA.id } });

  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id, name: "AdminAV Market A" });
  marketB = await makeMarket({ zoneId: zoneB.id, name: "AdminAV Market B" });

  tokenAdmin = tokenForStaff(admin);
  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA, zoneB] });
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- MARKET TRANSFER: current state, history integrity, atomicity -------

test("MARKET TRANSFER: Employee reassignment updates current market, clears stale department, end-dates the open DepartmentAssignment, invalidates the old session, and writes an audited previousMarketId", async () => {
  const worker = await makeEmployee({ marketId: marketA.id, name: "AdminAV Transfer Worker", role: "WORKER" });
  trackEmployee(worker.id);
  const tokenWorker = tokenForEmployee(worker);

  const deptAssign = await apiFetch(baseUrl, `/api/employees/${worker.id}/department`, {
    method: "POST", token: tokenSupervisorA, body: { department: "Food" },
  });
  assert.equal(deptAssign.status, 201);

  const beforeEmp = await prisma.employee.findUnique({ where: { id: worker.id } });
  assert.equal(beforeEmp.department, "Food");

  const { status, body } = await apiFetch(baseUrl, `/api/employees/${worker.id}`, {
    method: "PATCH", token: tokenAdmin, body: { marketId: marketB.id },
  });
  assert.equal(status, 200);
  assert.equal(body.marketId, marketB.id);
  assert.equal(body.department, null);

  const afterEmp = await prisma.employee.findUnique({ where: { id: worker.id } });
  assert.equal(afterEmp.marketId, marketB.id);
  assert.equal(afterEmp.department, null);

  // The open MAIN DepartmentAssignment row must be end-dated, not left
  // reading as "still ongoing" against a department in the old market —
  // and no new row is fabricated for a department nobody picked yet.
  const stillOpen = await prisma.departmentAssignment.findFirst({
    where: { employeeId: worker.id, role: "MAIN", endDate: null },
  });
  assert.equal(stillOpen, null);
  const closed = await prisma.departmentAssignment.findFirst({
    where: { employeeId: worker.id, role: "MAIN" },
    orderBy: { startDate: "desc" },
  });
  assert.ok(closed);
  assert.ok(closed.endDate);
  assert.equal(closed.department, "Food");

  // The employee's pre-transfer JWT must be rejected immediately
  // (tokenVersion bump), even though it hasn't expired.
  const staleAttempt = await apiFetch(baseUrl, "/api/profile", { token: tokenWorker });
  assert.equal(staleAttempt.status, 401);

  const audit = await prisma.auditLog.findFirst({
    where: { targetType: "Employee", targetId: worker.id, action: "MARKET_ASSIGNMENT_CHANGED" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit);
  assert.equal(audit.previousMarketId, marketA.id);
  assert.equal(audit.marketId, marketB.id);
});

test("MARKET TRANSFER: an unchanged reassignment (same marketId) does not bump tokenVersion or write a MARKET_ASSIGNMENT_CHANGED audit row", async () => {
  const worker = await makeEmployee({ marketId: marketA.id, name: "AdminAV NoOp Worker", role: "WORKER" });
  trackEmployee(worker.id);
  const tokenWorker = tokenForEmployee(worker);

  const before = await prisma.employee.findUnique({ where: { id: worker.id } });

  const { status } = await apiFetch(baseUrl, `/api/employees/${worker.id}`, {
    method: "PATCH", token: tokenAdmin, body: { marketId: marketA.id, position: "Still Worker" },
  });
  assert.equal(status, 200);

  const after = await prisma.employee.findUnique({ where: { id: worker.id } });
  assert.equal(after.tokenVersion, before.tokenVersion);

  const stillValid = await apiFetch(baseUrl, "/api/profile", { token: tokenWorker });
  assert.equal(stillValid.status, 200);

  const audit = await prisma.auditLog.findFirst({
    where: { targetType: "Employee", targetId: worker.id, action: "MARKET_ASSIGNMENT_CHANGED" },
  });
  assert.equal(audit, null);
});

test("MARKET TRANSFER: reassigning one employee does not affect an unrelated employee, and does not invalidate the Admin's own session", async () => {
  const stationary = await makeEmployee({ marketId: marketA.id, name: "AdminAV Stationary Worker", role: "WORKER" });
  trackEmployee(stationary.id);
  const moving = await makeEmployee({ marketId: marketA.id, name: "AdminAV Moving Worker", role: "WORKER" });
  trackEmployee(moving.id);
  const stationaryBefore = await prisma.employee.findUnique({ where: { id: stationary.id } });

  const { status } = await apiFetch(baseUrl, `/api/employees/${moving.id}`, {
    method: "PATCH", token: tokenAdmin, body: { marketId: marketB.id },
  });
  assert.equal(status, 200);

  const stationaryAfter = await prisma.employee.findUnique({ where: { id: stationary.id } });
  assert.equal(stationaryAfter.marketId, marketA.id);
  assert.equal(stationaryAfter.tokenVersion, stationaryBefore.tokenVersion);

  const adminStillValid = await apiFetch(baseUrl, "/api/profile", { token: tokenAdmin });
  assert.equal(adminStillValid.status, 200);
});

test("MARKET TRANSFER: a Supervisor-initiated market change now DOES write a MARKET_ASSIGNMENT_CHANGED audit row (widened scope), while a Supervisor-initiated shift edit still skips the audit (unchanged scope)", async () => {
  const worker = await makeEmployee({ marketId: marketA.id, name: "AdminAV Supervisor-Edited Worker", role: "WORKER" });
  trackEmployee(worker.id);

  // Supervisor must have access to BOTH markets to move this worker —
  // grant supervisorA access to marketB too via a second token scope
  // is not how assertMarketAccess works (it's the market's own
  // supervisorId/zone that grants access), so use RM instead, whose
  // zone covers both markets.
  const { status: moveStatus } = await apiFetch(baseUrl, `/api/employees/${worker.id}`, {
    method: "PATCH", token: tokenRmA, body: { marketId: marketB.id },
  });
  assert.equal(moveStatus, 200);

  const marketAudit = await prisma.auditLog.findFirst({
    where: { targetType: "Employee", targetId: worker.id, action: "MARKET_ASSIGNMENT_CHANGED" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(marketAudit, "RM-initiated market change must still be audited");
  assert.equal(marketAudit.actorUserId, rmA.id);

  const { status: shiftStatus } = await apiFetch(baseUrl, `/api/employees/${worker.id}`, {
    method: "PATCH", token: tokenRmA, body: { shift: "EVENING" },
  });
  assert.equal(shiftStatus, 200);

  const shiftAudit = await prisma.auditLog.findFirst({
    where: { targetType: "Employee", targetId: worker.id, action: "SHIFT_CHANGED" },
  });
  assert.equal(shiftAudit, null, "non-ADMIN shift edits must still skip the audit, unchanged from before");
});

// --- FIXED RETROACTIVE-QUERY BUGS ---------------------------------------

test("REGRESSION: AttendanceAdjustmentRequest stays attributed to the ORIGINAL market after the submitting employee is reassigned", async () => {
  const worker = await makeEmployee({ marketId: marketA.id, name: "AdminAV ExtraHours Worker", role: "WORKER" });
  trackEmployee(worker.id);
  const tokenWorker = tokenForEmployee(worker);

  const submit = await apiFetch(baseUrl, "/api/attendance/extra-hours", {
    method: "POST", token: tokenWorker, body: { date: "2026-01-05", hours: 2, reason: "AdminAV test" },
  });
  assert.equal(submit.status, 201);

  await apiFetch(baseUrl, `/api/employees/${worker.id}`, { method: "PATCH", token: tokenAdmin, body: { marketId: marketB.id } });

  const marketAList = await apiFetch(baseUrl, `/api/attendance/extra-hours/market?marketId=${marketA.id}`, { token: tokenAdmin });
  assert.equal(marketAList.status, 200);
  assert.ok(marketAList.body.some((r) => r.id === submit.body.id), "must still appear under the ORIGINAL market");

  const marketBList = await apiFetch(baseUrl, `/api/attendance/extra-hours/market?marketId=${marketB.id}`, { token: tokenAdmin });
  assert.equal(marketBList.status, 200);
  assert.ok(!marketBList.body.some((r) => r.id === submit.body.id), "must NOT retroactively appear under the new market");
});

test("REGRESSION: CountingAssignment stays attributed to the ORIGINAL market after the assigned employee is reassigned", async () => {
  const worker = await makeEmployee({ marketId: marketA.id, name: "AdminAV Counting Worker", role: "WORKER" });
  trackEmployee(worker.id);

  const create = await apiFetch(baseUrl, "/api/counting-assignments", {
    method: "POST", token: tokenSupervisorA, body: { employeeId: worker.id, assignedDepartment: "Food", countingArea: "Aisle 3" },
  });
  assert.equal(create.status, 201);

  await apiFetch(baseUrl, `/api/employees/${worker.id}`, { method: "PATCH", token: tokenAdmin, body: { marketId: marketB.id } });

  const marketAList = await apiFetch(baseUrl, `/api/counting-assignments/market?marketId=${marketA.id}`, { token: tokenAdmin });
  assert.equal(marketAList.status, 200);
  assert.ok(marketAList.body.some((a) => a.id === create.body.id), "must still appear under the ORIGINAL market");

  const marketBList = await apiFetch(baseUrl, `/api/counting-assignments/market?marketId=${marketB.id}`, { token: tokenAdmin });
  assert.equal(marketBList.status, 200);
  assert.ok(!marketBList.body.some((a) => a.id === create.body.id), "must NOT retroactively appear under the new market");
});

// --- SESSION INVALIDATION: Supervisor / Overlooking Supervisor / RM -----

test("MARKET TRANSFER: reassigning a Market's Supervisor invalidates the outgoing Supervisor's session and (once logged in) grants the incoming one", async () => {
  const outgoing = await makeStaffUser({ role: "SUPERVISOR" });
  const incoming = await makeStaffUser({ role: "SUPERVISOR" });
  const market = await makeMarket({ zoneId: zoneA.id, supervisorId: outgoing.id, name: "AdminAV Supervisor-Swap Market" });
  const tokenOutgoing = tokenForStaff(outgoing, { managedMarket: market });

  const { status } = await apiFetch(baseUrl, `/api/markets/${market.id}/supervisor`, {
    method: "PATCH", token: tokenAdmin, body: { supervisorId: incoming.id },
  });
  assert.equal(status, 200);

  const staleAttempt = await apiFetch(baseUrl, "/api/profile", { token: tokenOutgoing });
  assert.equal(staleAttempt.status, 401);

  const marketAfter = await prisma.market.findUnique({ where: { id: market.id } });
  assert.equal(marketAfter.supervisorId, incoming.id);

  const audit = await prisma.auditLog.findFirst({
    where: { targetType: "Market", targetId: market.id, action: "MARKET_ASSIGNMENT_CHANGED" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit);
});

test("MARKET TRANSFER: reassigning a Market's Overlooking Supervisor invalidates the outgoing account's session", async () => {
  const outgoing = await makeStaffUser({ role: "OVERLOOKING_SUPERVISOR" });
  const market = await makeMarket({ zoneId: zoneA.id, overlookingSupervisorId: outgoing.id, name: "AdminAV OverlookSwap Market" });
  const tokenOutgoing = tokenForStaff(outgoing, { managedOverlookingMarket: market });

  const { status } = await apiFetch(baseUrl, `/api/markets/${market.id}/overlooking-supervisor`, {
    method: "PATCH", token: tokenAdmin, body: { overlookingSupervisorId: null },
  });
  assert.equal(status, 200);

  const staleAttempt = await apiFetch(baseUrl, "/api/profile", { token: tokenOutgoing });
  assert.equal(staleAttempt.status, 401);
});

test("MARKET TRANSFER: re-saving a Market Supervisor with the SAME id does not bump tokenVersion or write an audit row", async () => {
  const sup = await makeStaffUser({ role: "SUPERVISOR" });
  const market = await makeMarket({ zoneId: zoneA.id, supervisorId: sup.id, name: "AdminAV Supervisor-NoOp Market" });
  const tokenSup = tokenForStaff(sup, { managedMarket: market });
  const before = await prisma.user.findUnique({ where: { id: sup.id } });

  const { status } = await apiFetch(baseUrl, `/api/markets/${market.id}/supervisor`, {
    method: "PATCH", token: tokenAdmin, body: { supervisorId: sup.id },
  });
  assert.equal(status, 200);

  const after = await prisma.user.findUnique({ where: { id: sup.id } });
  assert.equal(after.tokenVersion, before.tokenVersion);

  const stillValid = await apiFetch(baseUrl, "/api/profile", { token: tokenSup });
  assert.equal(stillValid.status, 200);
});

test("ZONE ASSIGNMENT: changing a Regional Manager's zones invalidates their existing session", async () => {
  const rm = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  const zoneX = await makeZone(90803);
  await prisma.zone.update({ where: { id: zoneX.id }, data: { managerId: rm.id } });
  const tokenRm = tokenForStaff(rm, { managedZones: [zoneX] });

  const zoneY = await makeZone(90804);
  const { status } = await apiFetch(baseUrl, `/api/admin/staff/${rm.id}/zones`, {
    method: "POST", token: tokenAdmin, body: { zoneIds: [zoneY.id] },
  });
  assert.equal(status, 200);

  const staleAttempt = await apiFetch(baseUrl, "/api/profile", { token: tokenRm });
  assert.equal(staleAttempt.status, 401);
});

test("ZONE ASSIGNMENT: re-saving a Regional Manager with the SAME zone set does not bump tokenVersion", async () => {
  const rm = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  const zoneX = await makeZone(90805);
  await prisma.zone.update({ where: { id: zoneX.id }, data: { managerId: rm.id } });
  const tokenRm = tokenForStaff(rm, { managedZones: [zoneX] });
  const before = await prisma.user.findUnique({ where: { id: rm.id } });

  const { status } = await apiFetch(baseUrl, `/api/admin/staff/${rm.id}/zones`, {
    method: "POST", token: tokenAdmin, body: { zoneIds: [zoneX.id] },
  });
  assert.equal(status, 200);

  const after = await prisma.user.findUnique({ where: { id: rm.id } });
  assert.equal(after.tokenVersion, before.tokenVersion);

  const stillValid = await apiFetch(baseUrl, "/api/profile", { token: tokenRm });
  assert.equal(stillValid.status, 200);
});

// --- DELETE /api/employees/:id — redesigned history guard ---------------

test("DELETE: an employee with a Restrict-type history row (Task) is rejected with a clean 409, never a 500, and is not deleted", async () => {
  const worker = await makeEmployee({ marketId: marketA.id, name: "AdminAV Delete-Task Worker", role: "WORKER" });
  trackEmployee(worker.id);
  const task = await prisma.task.create({
    data: { type: "FACING", label: "AdminAV test task", department: "Food", employeeId: worker.id, marketId: marketA.id },
  });

  const { status, body } = await apiFetch(baseUrl, `/api/employees/${worker.id}`, { method: "DELETE", token: tokenAdmin });
  assert.equal(status, 409);
  assert.ok(body.error);

  const stillThere = await prisma.employee.findUnique({ where: { id: worker.id } });
  assert.ok(stillThere);

  await prisma.task.delete({ where: { id: task.id } });
});

test("DELETE: an employee with only a SetNull-type history row (FingerprintEvent) is rejected with a clean 409, and employeeId is never silently orphaned to null", async () => {
  const worker = await makeEmployee({ marketId: marketA.id, name: "AdminAV Delete-FP Worker", role: "WORKER" });
  trackEmployee(worker.id);
  const fp = await prisma.fingerprintEvent.create({
    data: {
      externalEventId: `adminav-${worker.id}`,
      eventType: "BREAK_START",
      eventTimestamp: new Date(),
      employeeId: worker.id,
    },
  });

  const { status, body } = await apiFetch(baseUrl, `/api/employees/${worker.id}`, { method: "DELETE", token: tokenAdmin });
  assert.equal(status, 409);
  assert.ok(body.error);

  const fpAfter = await prisma.fingerprintEvent.findUnique({ where: { id: fp.id } });
  assert.equal(fpAfter.employeeId, worker.id, "must NOT be silently orphaned to null by the delete attempt");

  const stillThere = await prisma.employee.findUnique({ where: { id: worker.id } });
  assert.ok(stillThere);

  await prisma.fingerprintEvent.delete({ where: { id: fp.id } });
});

test("DELETE: an employee with genuinely zero historical records can still be hard-deleted", async () => {
  const worker = await makeEmployee({ marketId: marketA.id, name: "AdminAV Delete-Clean Worker", role: "WORKER" });

  const { status } = await apiFetch(baseUrl, `/api/employees/${worker.id}`, { method: "DELETE", token: tokenAdmin });
  assert.equal(status, 204);

  const gone = await prisma.employee.findUnique({ where: { id: worker.id } });
  assert.equal(gone, null);
  // Not tracked via trackEmployee since it's already deleted; nothing left for cleanup() to remove.
});
