// phase1Foundation.test.js — the security-critical boundaries Phase 1
// (cross-role attendance, breaks, department assignment/closing) adds.
// See test/helpers.js for the fixture/cleanup strategy shared with the
// rest of this suite.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, trackBreak, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB, marketA, marketB, supervisorA, supervisorB, rmA, admin;
let employeeA, employeeB, employeeA2;
let tokenSupervisorA, tokenSupervisorB, tokenRmA, tokenAdmin, tokenEmployeeA, tokenEmployeeB, tokenEmployeeA2;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90201);
  zoneB = await makeZone(90202);
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  admin = await makeStaffUser({ role: "ADMIN" });

  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id });
  marketB = await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorB.id });

  employeeA = await makeEmployee({ marketId: marketA.id });
  employeeA2 = await makeEmployee({ marketId: marketA.id });
  employeeB = await makeEmployee({ marketId: marketB.id });

  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenSupervisorB = tokenForStaff(supervisorB, { managedMarket: marketB });
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenAdmin = tokenForStaff(admin);
  tokenEmployeeA = tokenForEmployee(employeeA);
  tokenEmployeeA2 = tokenForEmployee(employeeA2);
  tokenEmployeeB = tokenForEmployee(employeeB);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- ATTENDANCE ----------------------------------------------------------
test("ATTENDANCE: employee can check in and view their own attendance", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token: tokenEmployeeA });
  assert.equal(status, 201);
  assert.equal(body.employeeId, employeeA.id);
  assert.equal(body.staffUserId, null);

  const month = await apiFetch(baseUrl, "/api/attendance/month", { token: tokenEmployeeA });
  assert.equal(month.status, 200);
});

test("ATTENDANCE: supervisor can check in through the SAME endpoint/table and view their own attendance", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token: tokenSupervisorA });
  assert.equal(status, 201);
  assert.equal(body.staffUserId, supervisorA.id);
  assert.equal(body.employeeId, null);

  const month = await apiFetch(baseUrl, "/api/attendance/me/month", { token: tokenSupervisorA });
  assert.equal(month.status, 200);
  assert.ok(month.body.records.some((r) => r.id === body.id));
});

// Cleanup Phase §5 — superseded: a Regional Manager now gets Check-in ->
// Check-out (no Break) through this same endpoint/table, same as
// Supervisor above, just with no marketId (a Regional Manager isn't tied
// to one single market — see attendanceController.attendanceOwnerFromUser's
// own comment). Previously excluded entirely; this is the deliberate,
// explicit product change, not a regression.
test("ATTENDANCE: Regional Manager (Zone Manager) can check in through the same endpoint, with no marketId", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token: tokenRmA });
  assert.equal(status, 201);
  assert.equal(body.staffUserId, rmA.id);
  assert.equal(body.employeeId, null);
  assert.equal(body.marketId, null);

  // Repair Pass §1 — check-out is only available 8h after check-in;
  // backdate the record rather than actually waiting.
  await prisma.attendanceRecord.update({ where: { id: body.id }, data: { checkIn: new Date(Date.now() - 8.5 * 3600_000) } });

  const checkOut = await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token: tokenRmA });
  assert.equal(checkOut.status, 200);
  assert.ok(checkOut.body.checkOut);

  await prisma.attendanceRecord.deleteMany({ where: { staffUserId: rmA.id } });
});

test("ATTENDANCE: employee cannot reach another employee's attendance (staff-only endpoint denies employee kind entirely)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/attendance/employee/${employeeA2.id}/month`, { token: tokenEmployeeA });
  assert.equal(status, 403);
});

test("ATTENDANCE: supervisor cannot access another market's employee attendance (IDOR)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/attendance/employee/${employeeB.id}/month`, { token: tokenSupervisorA });
  assert.equal(status, 403);
});

// --- BREAK -----------------------------------------------------------------
let breakId;

test("BREAK: a valid break can be created (Admin, controlled test entrypoint)", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/breaks", {
    method: "POST",
    token: tokenAdmin,
    body: { employeeId: employeeA2.id },
  });
  assert.equal(status, 201);
  assert.equal(body.status, "PENDING_CONFIRMATION");
  breakId = body.id;
  trackBreak(breakId);
});

test("BREAK: employee cannot confirm another employee's break", async () => {
  const { status } = await apiFetch(baseUrl, `/api/breaks/${breakId}/confirm`, { method: "PATCH", token: tokenEmployeeB });
  assert.equal(status, 403);
});

test("BREAK: employee cannot manually skip the state machine (a fake status in the body is ignored)", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/breaks/${breakId}/confirm`, {
    method: "PATCH",
    token: tokenEmployeeA2,
    body: { status: "COMPLETED" },
  });
  assert.equal(status, 200);
  assert.equal(body.status, "ACTIVE", "the break must become ACTIVE, not jump straight to whatever the client sent");
});

test("BREAK: timestamps are persisted and expectedEndTime is exactly 60 minutes after startTime", async () => {
  const brk = await prisma.break.findUnique({ where: { id: breakId } });
  assert.ok(brk.startTime, "startTime must be persisted");
  assert.ok(brk.expectedEndTime, "expectedEndTime must be persisted");
  const diffMinutes = (brk.expectedEndTime.getTime() - brk.startTime.getTime()) / 60000;
  assert.equal(diffMinutes, 60);
});

test("BREAK: a second active/pending break for the same employee is prevented (race-safe unique index)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/breaks", {
    method: "POST",
    token: tokenAdmin,
    body: { employeeId: employeeA2.id },
  });
  assert.equal(status, 409);
});

test("BREAK: employee can confirm their OWN pending break", async () => {
  const create = await apiFetch(baseUrl, "/api/breaks", { method: "POST", token: tokenAdmin, body: { employeeId: employeeB.id } });
  assert.equal(create.status, 201);
  trackBreak(create.body.id);

  const confirm = await apiFetch(baseUrl, `/api/breaks/${create.body.id}/confirm`, { method: "PATCH", token: tokenEmployeeB });
  assert.equal(confirm.status, 200);
  assert.equal(confirm.body.status, "ACTIVE");
});

// --- ROLE SEPARATION (Phase 1's new endpoints) ------------------------------
test("ROLE SEPARATION: employee cannot create a break (Admin-only)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/breaks", { method: "POST", token: tokenEmployeeA, body: { employeeId: employeeA.id } });
  assert.equal(status, 403);
});

test("ROLE SEPARATION: Supervisor cannot create a break (Admin-only)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/breaks", { method: "POST", token: tokenSupervisorA, body: { employeeId: employeeA.id } });
  assert.equal(status, 403);
});

test("ROLE SEPARATION: Regional Manager cannot submit a fingerprint event (Admin-only)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/fingerprint-events", {
    method: "POST",
    token: tokenRmA,
    body: { externalEventId: "x", employeeCode: employeeA.employeeCode, eventType: "BREAK_START", eventTimestamp: new Date().toISOString() },
  });
  assert.equal(status, 403);
});

// --- DEPARTMENT --------------------------------------------------------------
test("DEPARTMENT: employee can view their own department", async () => {
  const { status } = await apiFetch(baseUrl, `/api/employees/${employeeA.id}`, { token: tokenEmployeeA });
  assert.equal(status, 200);
});

test("DEPARTMENT: employee cannot view another employee's record (IDOR)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/employees/${employeeA2.id}`, { token: tokenEmployeeA });
  assert.equal(status, 403);
});

test("DEPARTMENT: authorized Supervisor can view/assign a department within their own market", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/employees/${employeeA.id}/department`, {
    method: "POST",
    token: tokenSupervisorA,
    body: { department: "Food" },
  });
  assert.equal(status, 201);
  assert.equal(body.department, "Food");
  assert.equal(body.employeeId, employeeA.id);

  const employee = await prisma.employee.findUnique({ where: { id: employeeA.id } });
  assert.equal(employee.department, "Food", "the denormalized cache must be updated in the same transaction");
});

test("DEPARTMENT: Supervisor cannot assign a department to an employee outside their market (cross-market IDOR)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/employees/${employeeB.id}/department`, {
    method: "POST",
    token: tokenSupervisorA,
    body: { department: "Fresh" },
  });
  assert.equal(status, 403);
});

test("DEPARTMENT: a Department Closing submission belongs to the correct employee/market/department", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/activities", {
    method: "POST",
    token: tokenEmployeeA,
    body: { category: "DEPARTMENT_CLOSING", date: "2026-08-24", time: "9:00 PM", department: "Food", status: "PENDING" },
  });
  assert.equal(status, 201);
  assert.equal(body.employeeId, employeeA.id);
  assert.equal(body.department, "Food");
  assert.equal(body.submittedByStaffId, null, "self-submitted, so no staff submitter");

  await prisma.activity.delete({ where: { id: body.id } });
});

test("DEPARTMENT: an authorized Supervisor can submit Department Closing on behalf of an employee in their market", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/activities/department-closing/${employeeA.id}`, {
    method: "POST",
    token: tokenSupervisorA,
    body: { date: "2026-08-24", time: "9:05 PM", department: "Frozen", status: "PENDING" },
  });
  assert.equal(status, 201);
  assert.equal(body.employeeId, employeeA.id);
  assert.equal(body.submittedByStaffId, supervisorA.id);

  await prisma.activity.delete({ where: { id: body.id } });
});

test("DEPARTMENT: a Supervisor cannot submit Department Closing for an employee outside their market (cross-market IDOR)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/activities/department-closing/${employeeB.id}`, {
    method: "POST",
    token: tokenSupervisorA,
    body: { date: "2026-08-24", time: "9:05 PM", department: "Frozen", status: "PENDING" },
  });
  assert.equal(status, 403);
});

// --- FILES (Department Closing photos specifically) --------------------------
// The general protected-file matrix (owner/non-owner/cross-market/RM/
// Admin/unauthenticated) already has its own dedicated suite
// (fileAuthorization.test.js) — this confirms Department Closing photos
// specifically go through that exact same authorization, with real
// 16-hour expiresAt metadata, rather than a separate path.
test("FILES: a Department Closing photo has 16h expiresAt and is protected the same way as any other Activity image", async () => {
  const REAL_PNG = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000376ef9240000000a49444154789c6300010000050001a5f645400000000049454e44ae426082",
    "hex"
  );
  const fd = new FormData();
  fd.append("file", new Blob([REAL_PNG], { type: "image/png" }), "dept.png");

  const upload = await apiFetch(baseUrl, "/api/uploads", { method: "POST", token: tokenEmployeeA, formData: fd });
  assert.equal(upload.status, 201);
  const filename = upload.body.url.split("/").pop();

  const create = await apiFetch(baseUrl, "/api/activities", {
    method: "POST",
    token: tokenEmployeeA,
    body: {
      category: "DEPARTMENT_CLOSING", date: "2026-08-24", time: "9:10 PM", department: "Food", status: "PENDING",
      imageUrls: [upload.body.url],
    },
  });
  assert.equal(create.status, 201);
  const image = create.body.images[0];
  assert.ok(image.expiresAt, "must have an expiration timestamp");
  const hoursUntilExpiry = (new Date(image.expiresAt).getTime() - Date.now()) / (60 * 60 * 1000);
  assert.ok(hoursUntilExpiry > 15.9 && hoursUntilExpiry < 16.1, `expected ~16h retention, got ${hoursUntilExpiry}h`);

  const path = `/api/uploads/${filename}`;

  // Owner (employee) — allowed.
  const ownerRes = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${tokenEmployeeA}` } });
  assert.equal(ownerRes.status, 200);

  // Same-market Supervisor — allowed.
  const supRes = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${tokenSupervisorA}` } });
  assert.equal(supRes.status, 200);

  // Different-market Supervisor — denied (ID cannot be reused to bypass ownership).
  const otherSupRes = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${tokenSupervisorB}` } });
  assert.equal(otherSupRes.status, 403);

  // Another employee entirely — denied.
  const otherEmpRes = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${tokenEmployeeB}` } });
  assert.equal(otherEmpRes.status, 403);

  // Unauthenticated — denied.
  const anonRes = await fetch(`${baseUrl}${path}`);
  assert.equal(anonRes.status, 401);

  await prisma.activityImage.deleteMany({ where: { activityId: create.body.id } });
  await prisma.activity.delete({ where: { id: create.body.id } });
  await prisma.uploadedFile.delete({ where: { filename } }).catch(() => {});
});
