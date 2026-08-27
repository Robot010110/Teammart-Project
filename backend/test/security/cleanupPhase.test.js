// cleanupPhase.test.js — TeamMart Final Repair, Cleanup & Consistency
// Pass: canonical department enforcement, the Total Sales Approve/Reject
// workflow (previously permanently informational-only), Supervisor <->
// Regional Manager chat contact visibility (previously one-directional),
// and Item/Price Report -> Supervisor notification routing (previously
// never notified anyone). See test/helpers.js for the shared fixture/
// cleanup strategy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market;
let admin, tokenAdmin;
let rm, tokenRm;
let supervisor, tokenSupervisor;
let worker, tokenWorker;
let cashier, tokenCashier;
let product;

const createdReports = [];

before(async () => {
  ({ server, baseUrl } = await startServer());

  zone = await makeZone(93301);
  admin = await makeStaffUser({ role: "ADMIN" });
  rm = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id, name: "CleanupTest Market" });
  // authorizedStaffContactsFor's SUPERVISOR branch resolves the zone's
  // manager from the REAL Zone.managerId column, not from the requesting
  // token's zoneIds claim — makeZone/tokenForStaff alone don't set this,
  // so it must be wired explicitly for the Supervisor-sees-RM direction.
  await prisma.zone.update({ where: { id: zone.id }, data: { managerId: rm.id } });

  tokenAdmin = tokenForStaff(admin);
  tokenRm = tokenForStaff(rm, { managedZones: [zone] });
  tokenSupervisor = tokenForStaff(supervisor, { managedMarket: market });

  worker = await makeEmployee({ marketId: market.id, name: "CleanupTest Worker", role: "WORKER" });
  cashier = await makeEmployee({ marketId: market.id, name: "CleanupTest Cashier", role: "CASHIER" });
  tokenWorker = tokenForEmployee(worker);
  tokenCashier = tokenForEmployee(cashier);

  product = await prisma.product.create({
    data: { market: { connect: { id: market.id } }, createdBy: { connect: { id: admin.id } }, barcode: `CLEANUP-${Date.now()}`, name: "Test Product", stockQuantity: 100 },
  });
});

after(async () => {
  await stopServer(server);
  if (createdReports.length) {
    await prisma.totalSalesReport.deleteMany({ where: { id: { in: createdReports } } }).catch(() => {});
  }
  // ItemReport/PriceReport reference this product with a RESTRICT FK —
  // must go before the product itself, or the delete below fails.
  await prisma.itemReport.deleteMany({ where: { productId: product.id } }).catch(() => {});
  await prisma.priceReport.deleteMany({ where: { marketId: market.id } }).catch(() => {});
  await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: [supervisor.id, rm.id] } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { employeeId: { in: [worker.id, cashier.id] } } }).catch(() => {});
  await cleanup();
});

// --- DEPARTMENTS: canonical enum enforced ------------------------------

test("DEPARTMENTS: a canonical department is accepted", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/employees/${worker.id}/department`, {
    method: "POST", token: tokenSupervisor, body: { department: "Fresh" },
  });
  assert.equal(status, 201);
  assert.equal(body.department, "Fresh");
});

test("DEPARTMENTS: a non-canonical, free-typed department name is rejected", async () => {
  const { status } = await apiFetch(baseUrl, `/api/employees/${worker.id}/department`, {
    method: "POST", token: tokenSupervisor, body: { department: "Made Up Department" },
  });
  assert.equal(status, 400);
});

// --- MONEY: Total Sales submit -> Approve / Reject ----------------------

test("MONEY: a submitted Total Sales report starts PENDING and is visible to the RM", async () => {
  const submit = await apiFetch(baseUrl, "/api/total-sales", {
    method: "POST", token: tokenSupervisor,
    body: { date: new Date().toISOString().slice(0, 10), amount: 25000000, photoUrl: "https://example.com/receipt.jpg" },
  });
  assert.equal(submit.status, 201);
  assert.equal(submit.body.status, "PENDING");
  createdReports.push(submit.body.id);

  const list = await apiFetch(baseUrl, `/api/total-sales?marketId=${market.id}&status=PENDING`, { token: tokenRm });
  assert.equal(list.status, 200);
  assert.ok(list.body.some((r) => r.id === submit.body.id));
});

test("MONEY: the RM can Approve a PENDING report, which then leaves the PENDING filter and appears reviewed in full history", async () => {
  const submit = await apiFetch(baseUrl, "/api/total-sales", {
    method: "POST", token: tokenSupervisor,
    body: { date: new Date().toISOString().slice(0, 10), amount: 1000000, photoUrl: "https://example.com/receipt2.jpg" },
  });
  createdReports.push(submit.body.id);

  const approve = await apiFetch(baseUrl, `/api/total-sales/${submit.body.id}/review`, {
    method: "PATCH", token: tokenRm, body: { status: "APPROVED" },
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.body.status, "APPROVED");
  assert.ok(approve.body.reviewedAt);
  assert.equal(approve.body.reviewedById, rm.id);

  const pending = await apiFetch(baseUrl, `/api/total-sales?marketId=${market.id}&status=PENDING`, { token: tokenRm });
  assert.ok(!pending.body.some((r) => r.id === submit.body.id), "an approved report must not remain in the PENDING/active view");

  const full = await apiFetch(baseUrl, `/api/total-sales?marketId=${market.id}`, { token: tokenRm });
  assert.ok(full.body.some((r) => r.id === submit.body.id && r.status === "APPROVED"), "the historical record must remain available");

  const notification = await prisma.notification.findFirst({ where: { userId: supervisor.id, type: "SUBMISSION_REVIEWED" }, orderBy: { createdAt: "desc" } });
  assert.ok(notification, "the submitting Supervisor must be notified of the outcome");
});

test("MONEY: Reject requires a reason, and the report cannot be reviewed twice", async () => {
  const submit = await apiFetch(baseUrl, "/api/total-sales", {
    method: "POST", token: tokenSupervisor,
    body: { date: new Date().toISOString().slice(0, 10), amount: 500000, photoUrl: "https://example.com/receipt3.jpg" },
  });
  createdReports.push(submit.body.id);

  const noReason = await apiFetch(baseUrl, `/api/total-sales/${submit.body.id}/review`, { method: "PATCH", token: tokenRm, body: { status: "REJECTED" } });
  assert.equal(noReason.status, 400);

  const reject = await apiFetch(baseUrl, `/api/total-sales/${submit.body.id}/review`, {
    method: "PATCH", token: tokenRm, body: { status: "REJECTED", rejectionReason: "Amount does not match the photo." },
  });
  assert.equal(reject.status, 200);
  assert.equal(reject.body.status, "REJECTED");

  const again = await apiFetch(baseUrl, `/api/total-sales/${submit.body.id}/review`, { method: "PATCH", token: tokenRm, body: { status: "APPROVED" } });
  assert.equal(again.status, 409, "an already-decided report cannot be reviewed again");
});

test("MONEY: a Supervisor cannot review their own (or anyone's) Total Sales report", async () => {
  const submit = await apiFetch(baseUrl, "/api/total-sales", {
    method: "POST", token: tokenSupervisor,
    body: { date: new Date().toISOString().slice(0, 10), amount: 750000, photoUrl: "https://example.com/receipt4.jpg" },
  });
  createdReports.push(submit.body.id);

  const { status } = await apiFetch(baseUrl, `/api/total-sales/${submit.body.id}/review`, { method: "PATCH", token: tokenSupervisor, body: { status: "APPROVED" } });
  assert.equal(status, 403);
});

test("MONEY: a Regional Manager outside this zone cannot review this market's report (IDOR)", async () => {
  const zoneB = await makeZone(93302);
  const rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  const tokenRmB = tokenForStaff(rmB, { managedZones: [zoneB] });

  const submit = await apiFetch(baseUrl, "/api/total-sales", {
    method: "POST", token: tokenSupervisor,
    body: { date: new Date().toISOString().slice(0, 10), amount: 300000, photoUrl: "https://example.com/receipt5.jpg" },
  });
  createdReports.push(submit.body.id);

  const { status } = await apiFetch(baseUrl, `/api/total-sales/${submit.body.id}/review`, { method: "PATCH", token: tokenRmB, body: { status: "APPROVED" } });
  assert.equal(status, 403);

  await prisma.zone.delete({ where: { id: zoneB.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: rmB.id } }).catch(() => {});
});

// --- SUPERVISOR <-> REGIONAL MANAGER CONNECTION -------------------------

test("CONNECTION: a Regional Manager's authorized staff contacts now include the Supervisors of markets in their own zone", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/conversations/staff-contacts", { token: tokenRm });
  assert.equal(status, 200);
  assert.ok(body.some((c) => c.id === supervisor.id), "the RM must see the Supervisor of a market in their own zone");
});

test("CONNECTION: a Supervisor's authorized staff contacts already include their own zone's Regional Manager", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/conversations/staff-contacts", { token: tokenSupervisor });
  assert.equal(status, 200);
  assert.ok(body.some((c) => c.id === rm.id));
});

test("CONNECTION: the RM and Supervisor can open a real direct conversation and exchange messages", async () => {
  const open = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${supervisor.id}`, { token: tokenRm });
  assert.equal(open.status, 200);

  const send = await apiFetch(baseUrl, `/api/conversations/${open.body.id}/messages`, { method: "POST", token: tokenRm, body: { body: "Please review today's numbers." } });
  assert.equal(send.status, 201);

  const supervisorView = await apiFetch(baseUrl, `/api/conversations/${open.body.id}/messages`, { token: tokenSupervisor });
  assert.equal(supervisorView.status, 200);
  assert.ok(supervisorView.body.messages.some((m) => m.body === "Please review today's numbers."));
});

test("CONNECTION: a Regional Manager cannot message a Supervisor outside their own zone", async () => {
  const zoneC = await makeZone(93303);
  const supervisorC = await makeStaffUser({ role: "SUPERVISOR" });
  await makeMarket({ zoneId: zoneC.id, supervisorId: supervisorC.id, name: "CleanupTest Market C" });

  const { status } = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${supervisorC.id}`, { token: tokenRm });
  assert.equal(status, 403);

  await prisma.market.deleteMany({ where: { zoneId: zoneC.id } }).catch(() => {});
  await prisma.zone.delete({ where: { id: zoneC.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: supervisorC.id } }).catch(() => {});
});

// --- EMPLOYEE REPORTS -> SUPERVISOR NOTIFICATION -----------------------

test("REPORTS: submitting an Item Report notifies the market's own Supervisor (not Admin)", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/item-reports", {
    method: "POST", token: tokenWorker, body: { productId: product.id, condition: "EXPIRED", quantity: 3 },
  });
  assert.equal(status, 201);

  const notification = await prisma.notification.findFirst({ where: { userId: supervisor.id, type: "EMPLOYEE_REPORT_SUBMITTED", linkId: body.id } });
  assert.ok(notification, "the market's Supervisor must be notified of the Item Report");
});

test("REPORTS: submitting a Price Report notifies the market's own Supervisor", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/price-reports", {
    method: "POST", token: tokenCashier, body: { productName: "White Monster", barcode: "123456", shelfPrice: 2.5, systemPrice: 3 },
  });
  assert.equal(status, 201);

  const notification = await prisma.notification.findFirst({ where: { userId: supervisor.id, type: "EMPLOYEE_REPORT_SUBMITTED", linkId: body.id } });
  assert.ok(notification, "the market's Supervisor must be notified of the Price Report");
});

// --- ATTENDANCE: Employee/Supervisor keep Break; Regional Manager doesn't ---

// Repair Pass §1 — check-out is only available 8 hours after check-in
// (enforced server-side); these two tests now backdate the record's
// checkIn via Prisma before checking out, same "testable time logic"
// convention used throughout attendanceRepairPass.test.js, rather than
// actually waiting 8 hours.
test("ATTENDANCE: a Regional Manager can Check In and Check Out 8h later (no marketId required)", async () => {
  const checkIn = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token: tokenRm });
  assert.equal(checkIn.status, 201);
  assert.ok(checkIn.body.checkIn);
  assert.equal(checkIn.body.marketId, null);

  await prisma.attendanceRecord.update({ where: { id: checkIn.body.id }, data: { checkIn: new Date(Date.now() - 8.5 * 3600_000) } });

  const checkOut = await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token: tokenRm });
  assert.equal(checkOut.status, 200);
  assert.ok(checkOut.body.checkOut);

  await prisma.attendanceRecord.deleteMany({ where: { staffUserId: rm.id } });
});

test("ATTENDANCE: a Supervisor's check-in still requires and records a real marketId, unchanged", async () => {
  const checkIn = await apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token: tokenSupervisor });
  assert.equal(checkIn.status, 201);
  assert.equal(checkIn.body.marketId, market.id);

  await prisma.attendanceRecord.update({ where: { id: checkIn.body.id }, data: { checkIn: new Date(Date.now() - 8.5 * 3600_000) } });
  await apiFetch(baseUrl, "/api/attendance/check-out", { method: "POST", token: tokenSupervisor });
  await prisma.attendanceRecord.deleteMany({ where: { staffUserId: supervisor.id } });
});

// --- SUPERVISOR <-> ADMIN (verification pass §2 — pre-existing, confirmed unchanged) ---

test("CONNECTION: Admin sees Supervisors in the company-wide staff directory", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/auth/staff?role=SUPERVISOR", { token: tokenAdmin });
  assert.equal(status, 200);
  assert.ok(body.some((s) => s.id === supervisor.id));
});

test("CONNECTION: a Supervisor's authorized staff contacts already include Admin (unconditionally, not zone-scoped)", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/conversations/staff-contacts", { token: tokenSupervisor });
  assert.equal(status, 200);
  assert.ok(body.some((c) => c.id === admin.id && c.role === "ADMIN"));
});

test("CONNECTION: Admin and Supervisor can open a real direct conversation", async () => {
  const open = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${supervisor.id}`, { token: tokenAdmin });
  assert.equal(open.status, 200);
  const send = await apiFetch(baseUrl, `/api/conversations/${open.body.id}/messages`, { method: "POST", token: tokenAdmin, body: { body: "Admin to Supervisor direct message." } });
  assert.equal(send.status, 201);
  const supervisorView = await apiFetch(baseUrl, `/api/conversations/${open.body.id}/messages`, { token: tokenSupervisor });
  assert.ok(supervisorView.body.messages.some((m) => m.body === "Admin to Supervisor direct message."));
});

test("CONNECTION: Admin account actions on a Supervisor (e.g. status change) notify that Supervisor", async () => {
  const suspend = await apiFetch(baseUrl, `/api/admin/staff/${supervisor.id}/status`, { method: "POST", token: tokenAdmin, body: { status: "SUSPENDED", reason: "Verification pass test" } });
  assert.equal(suspend.status, 200);
  const notification = await prisma.notification.findFirst({ where: { userId: supervisor.id, type: "ACCOUNT_STATUS_CHANGED" }, orderBy: { createdAt: "desc" } });
  assert.ok(notification, "the Supervisor must be notified of their own account status change");

  // Reactivate immediately — later tests in this file/other files still
  // need this Supervisor's token to authenticate normally.
  const reactivate = await apiFetch(baseUrl, `/api/admin/staff/${supervisor.id}/status`, { method: "POST", token: tokenAdmin, body: { status: "ACTIVE" } });
  assert.equal(reactivate.status, 200);
  await prisma.user.update({ where: { id: supervisor.id }, data: { tokenVersion: 0 } });
});
