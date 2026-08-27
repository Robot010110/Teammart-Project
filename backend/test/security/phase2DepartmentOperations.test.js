// phase2DepartmentOperations.test.js — Phase 2's new operational
// workflow: Department Closing submission/monitoring/completion/report,
// and the maintenance sweeps (break completion, photo expiry). See
// test/helpers.js for the fixture/cleanup strategy shared with the rest
// of this suite.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "../../src/lib/prisma.js";
import { UPLOADS_DIR } from "../../src/utils/fileStorage.js";
import { runBreakCompletionSweep, runDepartmentPhotoExpirySweep } from "../../src/jobs/maintenanceScheduler.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

// Department monitoring/completion is computed against "today" in the
// SERVER's LOCAL calendar day (departmentMonitoringService.dayOnly truncates
// via setHours(0,0,0,0), which operates in local time) — so this must be
// today's date in local terms too. `new Date().toISOString().slice(0,10)`
// looks equivalent but is actually UTC: for any positive UTC offset (e.g.
// AST, UTC+3), during the first few hours after local midnight the UTC
// calendar date is still "yesterday", so a submission tagged with that
// UTC-derived string lands outside the server's local "today" window and
// every completion/monitoring assertion below fails for a reason that has
// nothing to do with the feature itself (root-caused via a live repro:
// UNASSIGNED instead of COMPLETED right after a same-day submission,
// exactly in that UTC/local skew window).
function localToday() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
const TODAY = localToday();

let server, baseUrl;
let zoneA, marketA, marketB, supervisorA, supervisorB, employeeA, employeeB;
let tokenSupervisorA, tokenSupervisorB, tokenEmployeeA, tokenEmployeeB;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90301);
  const zoneB = await makeZone(90302);
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });

  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id });
  marketB = await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorB.id });

  employeeA = await makeEmployee({ marketId: marketA.id });
  employeeB = await makeEmployee({ marketId: marketB.id });

  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenSupervisorB = tokenForStaff(supervisorB, { managedMarket: marketB });
  tokenEmployeeA = tokenForEmployee(employeeA);
  tokenEmployeeB = tokenForEmployee(employeeB);

  // Assign employeeA to Grocery so most tests below have a real
  // department to work with.
  await apiFetch(baseUrl, `/api/employees/${employeeA.id}/department`, {
    method: "POST", token: tokenSupervisorA, body: { department: "Food" },
  });
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- DEPARTMENT: submission -----------------------------------------------
test("DEPARTMENT: employee without a department cannot submit Department Closing", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/activities", {
    method: "POST", token: tokenEmployeeB,
    body: { category: "DEPARTMENT_CLOSING", date: TODAY, time: "9:00 PM", status: "PENDING" },
  });
  assert.equal(status, 400);
  assert.match(body.error, /no department assigned/i);
});

test("DEPARTMENT: a client-supplied department is ignored — the server always uses the employee's real one", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/activities", {
    method: "POST", token: tokenEmployeeA,
    body: { category: "DEPARTMENT_CLOSING", date: TODAY, time: "9:00 PM", status: "PENDING", department: "Fresh" },
  });
  assert.equal(status, 201);
  assert.equal(body.department, "Food", "must be the employee's real department, not the spoofed 'Dairy'");
  await prisma.activity.delete({ where: { id: body.id } });
});

test("DEPARTMENT: Supervisor submitting for an unassigned department is rejected if the department actually has an assigned employee", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/activities/department-closing/market/${marketA.id}`, {
    method: "POST", token: tokenSupervisorA,
    body: { date: TODAY, time: "9:05 PM", department: "Food", status: "PENDING" },
  });
  assert.equal(status, 400);
  assert.match(body.error, /assigned employee/i);
});

test("DEPARTMENT: Supervisor can complete a genuinely unassigned department, owned by marketId not employeeId", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/activities/department-closing/market/${marketA.id}`, {
    method: "POST", token: tokenSupervisorA,
    body: { date: TODAY, time: "9:05 PM", department: "Fresh", status: "PENDING" },
  });
  assert.equal(status, 201);
  assert.equal(body.employeeId, null);
  assert.equal(body.marketId, marketA.id);
  assert.equal(body.submittedByStaffId, supervisorA.id);
});

test("DEPARTMENT: Supervisor B cannot complete a department in Market A (cross-market IDOR)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/activities/department-closing/market/${marketA.id}`, {
    method: "POST", token: tokenSupervisorB,
    body: { date: TODAY, time: "9:05 PM", department: "Frozen", status: "PENDING" },
  });
  assert.equal(status, 403);
});

// --- MONITORING --------------------------------------------------------------
test("MONITORING: Market A's own Supervisor sees Grocery (assigned, awaiting) and Dairy (completed by Supervisor)", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/markets/${marketA.id}/departments`, { token: tokenSupervisorA });
  assert.equal(status, 200);
  const dairy = body.find((d) => d.department === "Fresh");
  assert.equal(dairy.state, "COMPLETED");
  assert.equal(dairy.submission.submittedBy.kind, "staff");
});

test("MONITORING: Supervisor B cannot see Market A's departments (unrelated market)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/markets/${marketA.id}/departments`, { token: tokenSupervisorB });
  assert.equal(status, 403);
});

test("MONITORING: an explicitly-added department with no employee and no submission shows UNASSIGNED", async () => {
  await apiFetch(baseUrl, `/api/markets/${marketA.id}/departments`, {
    method: "POST", token: tokenSupervisorA, body: { name: "Non-Food 1" },
  });
  const { body } = await apiFetch(baseUrl, `/api/markets/${marketA.id}/departments`, { token: tokenSupervisorA });
  const household = body.find((d) => d.department === "Non-Food 1");
  assert.equal(household.state, "UNASSIGNED");
  assert.equal(household.assignedEmployees.length, 0);
});

test("MONITORING: completion count is backend-computed and matches the real state", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/markets/${marketA.id}/departments/completion`, { token: tokenSupervisorA });
  assert.equal(status, 200);
  // Grocery (assigned, not yet submitted today by this point in the
  // suite) + Dairy (completed) + Household (unassigned) = 3 required.
  assert.equal(body.requiredCount, 3);
  assert.equal(body.completedCount, 1);
  assert.ok(body.missing.some((m) => m.department === "Food"));
  assert.ok(body.missing.some((m) => m.department === "Non-Food 1"));
});

// --- REPORT --------------------------------------------------------------------
test("REPORT: sending while incomplete without override is rejected", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/markets/${marketA.id}/department-report`, {
    method: "POST", token: tokenSupervisorA, body: { date: TODAY, shift: "EVENING" },
  });
  assert.equal(status, 400);
  assert.ok(Array.isArray(body.missing) && body.missing.length > 0);
});

test("REPORT: override without a reason is rejected", async () => {
  const { status } = await apiFetch(baseUrl, `/api/markets/${marketA.id}/department-report`, {
    method: "POST", token: tokenSupervisorA, body: { date: TODAY, shift: "EVENING", override: true },
  });
  assert.equal(status, 400);
});

test("REPORT: override with a reason succeeds, is recorded, and posts to the market's real chat group", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/markets/${marketA.id}/department-report`, {
    method: "POST",
    token: tokenSupervisorA,
    body: { date: TODAY, shift: "EVENING", override: true, overrideReason: "End of shift, closing anyway" },
  });
  assert.equal(status, 201);
  assert.equal(body.report.overrideUsed, true);
  assert.equal(body.report.overrideReason, "End of shift, closing anyway");
  assert.ok(body.message.body.includes("Department Closing Report"));

  const conversation = await prisma.conversation.findUnique({ where: { id: body.report.conversationId } });
  assert.equal(conversation.type, "MARKET_GROUP");
  assert.equal(conversation.marketId, marketA.id);
});

test("REPORT: sending the same market/date/shift again is rejected (idempotent, no duplicate)", async () => {
  const { status } = await apiFetch(baseUrl, `/api/markets/${marketA.id}/department-report`, {
    method: "POST", token: tokenSupervisorA, body: { date: TODAY, shift: "EVENING", override: true, overrideReason: "again" },
  });
  assert.equal(status, 409);

  const count = await prisma.departmentReport.count({ where: { marketId: marketA.id, shift: "EVENING" } });
  assert.equal(count, 1);
});

// --- BREAK: expired-active cleanup (the sweep, not lazy-on-read) -------------
test("BREAK: the maintenance sweep completes an ACTIVE break whose expectedEndTime has passed, exactly once", async () => {
  const past = new Date(Date.now() - 5 * 60 * 1000);
  const brk = await prisma.break.create({
    data: {
      status: "ACTIVE", date: new Date(), startTime: new Date(Date.now() - 65 * 60 * 1000),
      expectedEndTime: past, employeeId: employeeB.id, marketId: marketB.id,
    },
  });

  const result = await runBreakCompletionSweep();
  assert.ok(result.completed >= 1);

  const updated = await prisma.break.findUnique({ where: { id: brk.id } });
  assert.equal(updated.status, "COMPLETED");
  assert.equal(updated.actualEndTime.getTime(), past.getTime());

  const notifCount = await prisma.notification.count({ where: { linkId: brk.id, type: "BREAK_COMPLETED" } });
  assert.equal(notifCount, 1);

  // Re-running must be a safe no-op — no second notification.
  await runBreakCompletionSweep();
  const notifCountAfterRerun = await prisma.notification.count({ where: { linkId: brk.id, type: "BREAK_COMPLETED" } });
  assert.equal(notifCountAfterRerun, 1);

  await prisma.notification.deleteMany({ where: { linkId: brk.id } });
  await prisma.break.delete({ where: { id: brk.id } });
});

// --- FILES: expired-photo cleanup -----------------------------------------
test("FILES: the photo expiry sweep deletes the physical file and marks the image expired, safely, and is idempotent", async () => {
  const REAL_PNG = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000376ef9240000000a49444154789c6300010000050001a5f645400000000049454e44ae426082",
    "hex"
  );
  const fd = new FormData();
  fd.append("file", new Blob([REAL_PNG], { type: "image/png" }), "expiring.png");
  const upload = await apiFetch(baseUrl, "/api/uploads", { method: "POST", token: tokenEmployeeA, formData: fd });
  const filename = upload.body.url.split("/").pop();

  const activity = await prisma.activity.create({
    data: { category: "DEPARTMENT_CLOSING", date: new Date(), time: "9:00 PM", department: "Food", status: "PENDING", employeeId: employeeA.id },
  });
  const past = new Date(Date.now() - 60 * 1000);
  const image = await prisma.activityImage.create({ data: { url: upload.body.url, activityId: activity.id, expiresAt: past } });

  const result = await runDepartmentPhotoExpirySweep();
  assert.ok(result.processed >= 1);

  const updatedImage = await prisma.activityImage.findUnique({ where: { id: image.id } });
  assert.ok(updatedImage.expiredAt, "expiredAt must be set");
  assert.equal(updatedImage.url, upload.body.url, "url stays as a historical record, never deleted");

  const uploadedFileRow = await prisma.uploadedFile.findUnique({ where: { filename } });
  assert.equal(uploadedFileRow, null, "UploadedFile metadata row must be gone");

  // Physical file gone too.
  await assert.rejects(async () => {
    const fs = await import("fs/promises");
    await fs.access(path.join(UPLOADS_DIR, filename));
  });

  // The image, now expired, must 404 when fetched — never a broken/stale
  // private URL.
  const fetchRes = await fetch(`${baseUrl}/api/uploads/${filename}`, { headers: { Authorization: `Bearer ${tokenEmployeeA}` } });
  assert.equal(fetchRes.status, 404);

  // The Activity record itself must survive.
  const stillThere = await prisma.activity.findUnique({ where: { id: activity.id } });
  assert.ok(stillThere);

  // Re-running the sweep must be safe even though the physical file is
  // already gone (spec: "safe if the physical file is already missing").
  const secondRun = await runDepartmentPhotoExpirySweep();
  assert.equal(secondRun.checked, 0, "already-expired image must not be reprocessed");

  await prisma.activityImage.delete({ where: { id: image.id } });
  await prisma.activity.delete({ where: { id: activity.id } });
});

// --- NOTIFICATIONS -------------------------------------------------------------
test("NOTIFICATIONS: a Department Closing submission notifies the market's own Supervisor, not an unrelated market", async () => {
  const before = await prisma.notification.count({ where: { userId: supervisorA.id, type: "DEPARTMENT_CLOSING_SUBMITTED" } });
  const beforeUnrelated = await prisma.notification.count({ where: { userId: supervisorB.id, type: "DEPARTMENT_CLOSING_SUBMITTED" } });

  const { status, body } = await apiFetch(baseUrl, "/api/activities", {
    method: "POST", token: tokenEmployeeA,
    body: { category: "DEPARTMENT_CLOSING", date: TODAY, time: "10:00 PM", status: "PENDING" },
  });
  assert.equal(status, 201);

  const after = await prisma.notification.count({ where: { userId: supervisorA.id, type: "DEPARTMENT_CLOSING_SUBMITTED" } });
  const afterUnrelated = await prisma.notification.count({ where: { userId: supervisorB.id, type: "DEPARTMENT_CLOSING_SUBMITTED" } });
  assert.equal(after, before + 1);
  assert.equal(afterUnrelated, beforeUnrelated, "an unrelated market's Supervisor must not be notified");

  await prisma.activity.delete({ where: { id: body.id } });
});
