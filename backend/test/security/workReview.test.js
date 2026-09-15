// workReview.test.js — Performance Engine Phase 1: the unified review core.
//
// Covers the three things Phase 1 must guarantee:
//   1. WorkReview is the authoritative record of a review, for all five
//      reviewable models, written atomically with the model's own status.
//   2. The three pre-existing review endpoints behave EXACTLY as they did
//      (status codes, response shape) while now flowing through that one
//      write path.
//   3. The scoring inputs cannot be supplied or influenced by the client.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, trackActivity, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB, marketA, marketB;
let admin, tokenAdmin;
let supervisorA, tokenSupervisorA;
let supervisorB, tokenSupervisorB;
let worker, tokenWorker;
let product;

// Rows created directly via prisma (not through a make* helper) so they can
// be swept in after() — none of these models is covered by helpers.cleanup.
const createdWork = { activities: [], tasks: [], itemReports: [], priceReports: [], wastedOverall: [] };

async function makeActivity(status = "PENDING") {
  const row = await prisma.activity.create({
    data: { employeeId: worker.id, marketId: marketA.id, category: "SHELF_CLEANING", date: new Date(), time: "09:00", status },
  });
  createdWork.activities.push(row.id);
  trackActivity(row.id);
  return row;
}
async function makeTask(status = "PENDING") {
  const row = await prisma.task.create({
    data: { employeeId: worker.id, marketId: marketA.id, type: "FACING", label: "WR test task", department: "Food", status },
  });
  createdWork.tasks.push(row.id);
  return row;
}
async function makeItemReport(status = "PENDING") {
  const row = await prisma.itemReport.create({
    data: { employeeId: worker.id, marketId: marketA.id, productId: product.id, condition: "EXPIRED", quantity: 2, status },
  });
  createdWork.itemReports.push(row.id);
  return row;
}
async function makePriceReport(status = "PENDING") {
  const row = await prisma.priceReport.create({
    data: { employeeId: worker.id, marketId: marketA.id, productName: "WR test product", shelfPrice: 5, systemPrice: 4, status },
  });
  createdWork.priceReports.push(row.id);
  return row;
}
async function makeWastedOverall(status = "PENDING") {
  const row = await prisma.wastedOverallReport.create({
    data: { employeeId: worker.id, marketId: marketA.id, item: "TOMATO", quantityKg: 3, status },
  });
  createdWork.wastedOverall.push(row.id);
  return row;
}

function reviewFor(targetType, targetId) {
  return prisma.workReview.findUnique({ where: { targetType_targetId: { targetType, targetId } } });
}

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90821);
  zoneB = await makeZone(90822);
  admin = await makeStaffUser({ role: "ADMIN" });
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id, name: "WorkReview Market A" });
  marketB = await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorB.id, name: "WorkReview Market B" });

  worker = await makeEmployee({ marketId: marketA.id, name: "WorkReview Worker", role: "WORKER" });

  product = await prisma.product.create({
    data: { barcode: `wr-${Date.now()}`, name: "WR Product", marketId: marketA.id, createdById: admin.id, stockQuantity: 100 },
  });

  tokenAdmin = tokenForStaff(admin);
  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenSupervisorB = tokenForStaff(supervisorB, { managedMarket: marketB });
  tokenWorker = tokenForEmployee(worker);
});

after(async () => {
  await stopServer(server);
  await prisma.workReview.deleteMany({ where: { employeeId: worker.id } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { action: { in: ["WORK_REVIEW_RECORDED", "WORK_REVIEW_CHANGED"] }, actorUserId: { in: [admin.id, supervisorA.id, supervisorB.id] } } }).catch(() => {});
  await prisma.itemReport.deleteMany({ where: { id: { in: createdWork.itemReports } } }).catch(() => {});
  await prisma.priceReport.deleteMany({ where: { id: { in: createdWork.priceReports } } }).catch(() => {});
  await prisma.wastedOverallReport.deleteMany({ where: { id: { in: createdWork.wastedOverall } } }).catch(() => {});
  await prisma.task.deleteMany({ where: { id: { in: createdWork.tasks } } }).catch(() => {});
  await prisma.product.deleteMany({ where: { id: product.id } }).catch(() => {});
  await cleanup();
});

// --- OUTCOMES ---------------------------------------------------------

test("REVIEW: a plain approval scores full quality points and sets the model status to APPROVED", async () => {
  const task = await makeTask();
  const { status, body } = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA,
    body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED" },
  });
  assert.equal(status, 201);
  assert.equal(body.work.status, "APPROVED");
  assert.equal(body.review.qualityPoints, 8);
  assert.equal(body.review.qualityMax, 8);

  const review = await reviewFor("TASK", task.id);
  assert.equal(review.outcome, "APPROVED");
  assert.equal(review.severity, null);
  assert.equal(review.source, "SUPERVISOR");
});

test("REVIEW: the three correction levels score 6/4/2 out of 8 and all leave the work APPROVED", async () => {
  // The spec's own example: an item worth 8 quality points.
  const expected = { MINOR: 6, MODERATE: 4, MAJOR: 2 };
  for (const [severity, points] of Object.entries(expected)) {
    const task = await makeTask();
    const { status, body } = await apiFetch(baseUrl, "/api/work-reviews", {
      method: "POST", token: tokenSupervisorA,
      body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED_WITH_CORRECTION", severity, reason: `${severity} fix` },
    });
    assert.equal(status, 201);
    assert.equal(body.review.qualityPoints, points, `${severity} should score ${points}/8`);

    // A correction is still an ACCEPTANCE — the workflow status the rest of
    // the app reads must stay APPROVED, not a new enum value.
    assert.equal(body.work.status, "APPROVED", "a correction must not introduce a new workflow status");
    // ...and it must not masquerade as a rejection on the existing column.
    const stored = await prisma.task.findUnique({ where: { id: task.id } });
    assert.equal(stored.rejectionReason, null, "a correction note must not land in rejectionReason");

    const review = await reviewFor("TASK", task.id);
    assert.equal(review.severity, severity);
    assert.equal(review.reason, `${severity} fix`);
  }
});

test("REVIEW: every rejection severity scores strictly below the WORST correction", async () => {
  const worstCorrection = 2; // MAJOR correction on a weight-8 item
  for (const severity of ["MINOR", "MODERATE", "MAJOR"]) {
    const task = await makeTask();
    const { status, body } = await apiFetch(baseUrl, "/api/work-reviews", {
      method: "POST", token: tokenSupervisorA,
      body: { targetType: "TASK", targetId: task.id, outcome: "REJECTED", severity, reason: "not acceptable" },
    });
    assert.equal(status, 201);
    assert.equal(body.work.status, "REJECTED");
    assert.ok(
      body.review.qualityPoints < worstCorrection,
      `rejection/${severity} (${body.review.qualityPoints}) must score below the worst correction (${worstCorrection})`
    );
  }
});

test("REVIEW: all five work types are reviewable through the one endpoint", async () => {
  const targets = [
    ["ACTIVITY", (await makeActivity()).id],
    ["TASK", (await makeTask()).id],
    ["ITEM_REPORT", (await makeItemReport()).id],
    ["PRICE_REPORT", (await makePriceReport()).id],
    ["WASTED_OVERALL", (await makeWastedOverall()).id],
  ];
  for (const [targetType, targetId] of targets) {
    const { status } = await apiFetch(baseUrl, "/api/work-reviews", {
      method: "POST", token: tokenSupervisorA,
      body: { targetType, targetId, outcome: "APPROVED" },
    });
    assert.equal(status, 201, `${targetType} should be reviewable`);
    const review = await reviewFor(targetType, targetId);
    assert.ok(review, `${targetType} must have a WorkReview row`);
    assert.equal(review.employeeId, worker.id);
    assert.equal(review.marketId, marketA.id);
  }
});

// --- ATOMICITY / IDEMPOTENCY -------------------------------------------

test("REVIEW: a second review of the same work is refused with a clean 400, never a 500", async () => {
  const task = await makeTask();
  const first = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA, body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED" },
  });
  assert.equal(first.status, 201);

  const second = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA, body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED" },
  });
  assert.equal(second.status, 400);
  assert.ok(second.body.error);

  const count = await prisma.workReview.count({ where: { targetType: "TASK", targetId: task.id } });
  assert.equal(count, 1, "a double review must never produce two scoring rows");
});

test("REVIEW: the status update, the WorkReview row and the audit entry are one transaction", async () => {
  const task = await makeTask();
  await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA,
    body: { targetType: "TASK", targetId: task.id, outcome: "REJECTED", severity: "MAJOR", reason: "falsified" },
  });

  const [stored, review, audit] = await Promise.all([
    prisma.task.findUnique({ where: { id: task.id } }),
    reviewFor("TASK", task.id),
    prisma.auditLog.findFirst({ where: { action: "WORK_REVIEW_RECORDED", targetId: task.id } }),
  ]);
  assert.equal(stored.status, "REJECTED");
  assert.ok(review, "WorkReview row must exist");
  assert.ok(audit, "an audit row must be written — reviews were previously unaudited");
  assert.equal(audit.newValue.outcome, "REJECTED");
});

test("REVIEW: reviewing work that does not exist is a 404, and a soft-deleted report is invisible", async () => {
  const missing = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA, body: { targetType: "TASK", targetId: "does-not-exist", outcome: "APPROVED" },
  });
  assert.equal(missing.status, 404);

  const report = await makeItemReport();
  await prisma.itemReport.update({ where: { id: report.id }, data: { deletedAt: new Date() } });
  const deleted = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA, body: { targetType: "ITEM_REPORT", targetId: report.id, outcome: "APPROVED" },
  });
  assert.equal(deleted.status, 404, "a soft-deleted report must not be scorable");
});

// --- INPUT INTEGRITY (spec §20) ----------------------------------------

test("SECURITY: the API refuses a client-supplied quality point value", async () => {
  const task = await makeTask();
  const { status } = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA,
    body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED", qualityPoints: 999, qualityMax: 999 },
  });
  assert.equal(status, 400, "the request schema is .strict() — fabricated scores must be rejected outright");

  const review = await reviewFor("TASK", task.id);
  assert.equal(review, null, "a rejected request must not have recorded anything");
});

test("SECURITY: a plain approval cannot carry a correction level, and a correction must specify one", async () => {
  const withSeverity = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA,
    body: { targetType: "TASK", targetId: (await makeTask()).id, outcome: "APPROVED", severity: "MAJOR" },
  });
  assert.equal(withSeverity.status, 400);

  const withoutSeverity = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA,
    body: { targetType: "TASK", targetId: (await makeTask()).id, outcome: "APPROVED_WITH_CORRECTION", reason: "x" },
  });
  assert.equal(withoutSeverity.status, 400);

  const rejectionWithoutReason = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA,
    body: { targetType: "TASK", targetId: (await makeTask()).id, outcome: "REJECTED", severity: "MINOR" },
  });
  assert.equal(rejectionWithoutReason.status, 400, "rejecting has always required a reason");
});

// --- AUTHORIZATION ------------------------------------------------------

test("SECURITY: a Supervisor cannot review work in another market, and an employee cannot review at all", async () => {
  const task = await makeTask();

  const crossMarket = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorB, body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED" },
  });
  assert.equal(crossMarket.status, 403);

  const asEmployee = await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenWorker, body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED" },
  });
  assert.equal(asEmployee.status, 403);

  const untouched = await prisma.task.findUnique({ where: { id: task.id } });
  assert.equal(untouched.status, "PENDING");
});

// --- BACKWARD COMPATIBILITY OF THE EXISTING ENDPOINTS ------------------

test("COMPAT: POST /activities/:id/review still works, still returns images, and now records a WorkReview", async () => {
  const activity = await makeActivity();
  const { status, body } = await apiFetch(baseUrl, `/api/activities/${activity.id}/review`, {
    method: "POST", token: tokenSupervisorA, body: { status: "APPROVED" },
  });
  assert.equal(status, 200);
  assert.equal(body.status, "APPROVED");
  assert.ok(Array.isArray(body.images), "TodayActivityFeed reads images off this response — the shape must not change");

  const review = await reviewFor("ACTIVITY", activity.id);
  assert.ok(review, "the legacy endpoint must now also record the scoring row");
  assert.equal(review.outcome, "APPROVED");
  assert.equal(review.severity, null, "an endpoint with no severity field must not invent one");
});

test("COMPAT: rejecting through the legacy activity endpoint still stores the rejection reason", async () => {
  const activity = await makeActivity();
  const { status, body } = await apiFetch(baseUrl, `/api/activities/${activity.id}/review`, {
    method: "POST", token: tokenSupervisorA, body: { status: "REJECTED", rejectionReason: "blurry photo" },
  });
  assert.equal(status, 200);
  assert.equal(body.status, "REJECTED");
  assert.equal(body.rejectionReason, "blurry photo");

  const review = await reviewFor("ACTIVITY", activity.id);
  assert.equal(review.outcome, "REJECTED");
  assert.equal(review.reason, "blurry photo");
});

test("COMPAT: reviewing an already-reviewed activity through the legacy endpoint is still a 400", async () => {
  const activity = await makeActivity();
  await apiFetch(baseUrl, `/api/activities/${activity.id}/review`, {
    method: "POST", token: tokenSupervisorA, body: { status: "APPROVED" },
  });
  const again = await apiFetch(baseUrl, `/api/activities/${activity.id}/review`, {
    method: "POST", token: tokenSupervisorA, body: { status: "APPROVED" },
  });
  assert.equal(again.status, 400);
});

test("COMPAT: PATCH /tasks/:id/approve and /reject still work and record reviews", async () => {
  const approved = await makeTask();
  const a = await apiFetch(baseUrl, `/api/tasks/${approved.id}/approve`, { method: "PATCH", token: tokenSupervisorA });
  assert.equal(a.status, 200);
  assert.equal(a.body.status, "APPROVED");
  assert.ok(await reviewFor("TASK", approved.id));

  const rejected = await makeTask();
  const r = await apiFetch(baseUrl, `/api/tasks/${rejected.id}/reject`, {
    method: "PATCH", token: tokenSupervisorA, body: { rejectionReason: "incomplete" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "REJECTED");
  assert.equal(r.body.rejectionReason, "incomplete");
  assert.ok(await reviewFor("TASK", rejected.id));
});

test("COMPAT: a task review still sends no notification (unchanged behaviour)", async () => {
  const before = await prisma.notification.count({ where: { employeeId: worker.id, type: "SUBMISSION_REVIEWED" } });
  const task = await makeTask();
  await apiFetch(baseUrl, `/api/tasks/${task.id}/approve`, { method: "PATCH", token: tokenSupervisorA });
  const after = await prisma.notification.count({ where: { employeeId: worker.id, type: "SUBMISSION_REVIEWED" } });
  assert.equal(after, before, "approveTask has never notified the employee — Phase 1 must not change that");
});

test("COMPAT: POST /wasted-overall/:id/review still works and records a review", async () => {
  const report = await makeWastedOverall();
  const { status, body } = await apiFetch(baseUrl, `/api/wasted-overall/${report.id}/review`, {
    method: "POST", token: tokenSupervisorA, body: { status: "APPROVED" },
  });
  assert.equal(status, 200);
  assert.equal(body.status, "APPROVED");
  assert.ok(await reviewFor("WASTED_OVERALL", report.id));
});

// --- QUEUE --------------------------------------------------------------

test("QUEUE: pending work from all five models appears, and reviewing removes it", async () => {
  const activity = await makeActivity();
  const task = await makeTask();
  const item = await makeItemReport();

  const before = await apiFetch(baseUrl, `/api/work-reviews/queue?marketId=${marketA.id}`, { token: tokenSupervisorA });
  assert.equal(before.status, 200);
  const idsBefore = before.body.items.map((i) => i.targetId);
  for (const id of [activity.id, task.id, item.id]) {
    assert.ok(idsBefore.includes(id), "pending work should be in the review queue");
  }

  await apiFetch(baseUrl, "/api/work-reviews", {
    method: "POST", token: tokenSupervisorA, body: { targetType: "TASK", targetId: task.id, outcome: "APPROVED" },
  });

  const after = await apiFetch(baseUrl, `/api/work-reviews/queue?marketId=${marketA.id}`, { token: tokenSupervisorA });
  assert.ok(!after.body.items.some((i) => i.targetId === task.id), "reviewed work must leave the queue");
});

test("QUEUE: a Supervisor cannot read another market's queue", async () => {
  const { status } = await apiFetch(baseUrl, `/api/work-reviews/queue?marketId=${marketA.id}`, { token: tokenSupervisorB });
  assert.equal(status, 403);
});
