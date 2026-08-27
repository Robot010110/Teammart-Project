// communications.test.js — Warnings & Notifications: the targeting
// engine (role + Main/Additional department + market/zone/company
// scope), send-time authorization (Admin vs Zone/Regional Manager
// boundaries, IDOR), recipient snapshotting, duplicate-send protection,
// and the employee-facing read/acknowledge/complete state machine. See
// test/helpers.js for the shared fixture/cleanup strategy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB;
let marketA1, marketA2, marketB1;
let admin, tokenAdmin;
let rmA, tokenRmA;
let rmB, tokenRmB;
let supervisorA1, tokenSupervisorA1;

let workerDrinksA1, workerNutsAdditionalDrinksA1, workerFrozenA1, cashierA1, inactiveWorkerA1;
let workerDrinksA2, workerDrinksB1;
let tokenWorkerDrinksA1;
let baselineSnacksWorkerCount;

const createdCommunications = [];
function trackCommunication(id) {
  createdCommunications.push(id);
}

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(91101);
  zoneB = await makeZone(91102);
  admin = await makeStaffUser({ role: "ADMIN" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  supervisorA1 = await makeStaffUser({ role: "SUPERVISOR" });

  marketA1 = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA1.id, name: "CommTest Market A1" });
  marketA2 = await makeMarket({ zoneId: zoneA.id, name: "CommTest Market A2" });
  marketB1 = await makeMarket({ zoneId: zoneB.id, name: "CommTest Market B1" });

  tokenAdmin = tokenForStaff(admin);
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenRmB = tokenForStaff(rmB, { managedZones: [zoneB] });
  tokenSupervisorA1 = tokenForStaff(supervisorA1, { managedMarket: marketA1 });

  // ALL_MARKETS is company-wide with no geographic filter, so it can
  // legitimately match real pre-existing employees in the shared dev
  // database (e.g. seeded data) in addition to this file's own fixtures
  // — an exact hardcoded count would be wrong the moment the seed data
  // changes. Captured before this file assigns any Snacks department
  // below, so "TARGETING: All Markets" can assert against the real
  // baseline + this file's own known delta instead of an absolute
  // number (verified via a live repro: the seeded dev DB already has a
  // real ACTIVE WORKER with a Snacks assignment, which silently made the
  // old hardcoded "4" wrong).
  const baselineAllMarketsSnacksWorkers = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "ALL_MARKETS", targetRole: "WORKER", targetDepartment: "Snacks" },
  });
  baselineSnacksWorkerCount = baselineAllMarketsSnacksWorkers.body.recipientCount;

  workerDrinksA1 = await makeEmployee({ marketId: marketA1.id, name: "CommTest Worker Drinks A1", role: "WORKER" });
  workerNutsAdditionalDrinksA1 = await makeEmployee({ marketId: marketA1.id, name: "CommTest Worker Nuts+Drinks A1", role: "WORKER" });
  workerFrozenA1 = await makeEmployee({ marketId: marketA1.id, name: "CommTest Worker Frozen A1", role: "WORKER" });
  cashierA1 = await makeEmployee({ marketId: marketA1.id, name: "CommTest Cashier A1", role: "CASHIER" });
  inactiveWorkerA1 = await makeEmployee({ marketId: marketA1.id, name: "CommTest Inactive Worker A1", role: "WORKER" });
  workerDrinksA2 = await makeEmployee({ marketId: marketA2.id, name: "CommTest Worker Drinks A2", role: "WORKER" });
  workerDrinksB1 = await makeEmployee({ marketId: marketB1.id, name: "CommTest Worker Drinks B1", role: "WORKER" });

  await apiFetch(baseUrl, `/api/employees/${workerDrinksA1.id}/department`, { method: "POST", token: tokenSupervisorA1, body: { department: "Snacks" } });
  await apiFetch(baseUrl, `/api/employees/${workerNutsAdditionalDrinksA1.id}/department`, { method: "POST", token: tokenSupervisorA1, body: { department: "Food" } });
  await apiFetch(baseUrl, `/api/employees/${workerNutsAdditionalDrinksA1.id}/additional-departments`, { method: "POST", token: tokenSupervisorA1, body: { department: "Snacks" } });
  await apiFetch(baseUrl, `/api/employees/${workerFrozenA1.id}/department`, { method: "POST", token: tokenSupervisorA1, body: { department: "Frozen" } });
  await apiFetch(baseUrl, `/api/employees/${inactiveWorkerA1.id}/department`, { method: "POST", token: tokenSupervisorA1, body: { department: "Snacks" } });
  await prisma.employee.update({ where: { id: inactiveWorkerA1.id }, data: { employmentStatus: "INACTIVE" } });

  await apiFetch(baseUrl, `/api/employees/${workerDrinksA2.id}/department`, { method: "POST", token: tokenAdmin, body: { department: "Snacks" } });
  await apiFetch(baseUrl, `/api/employees/${workerDrinksB1.id}/department`, { method: "POST", token: tokenAdmin, body: { department: "Snacks" } });

  tokenWorkerDrinksA1 = tokenForEmployee(workerDrinksA1);
});

after(async () => {
  await stopServer(server);
  if (createdCommunications.length) {
    await prisma.communicationRecipient.deleteMany({ where: { communicationId: { in: createdCommunications } } }).catch(() => {});
    await prisma.communication.deleteMany({ where: { id: { in: createdCommunications } } }).catch(() => {});
  }
  await prisma.notification.deleteMany({ where: { type: "COMMUNICATION", employeeId: { in: [
    workerDrinksA1?.id, workerNutsAdditionalDrinksA1?.id, workerFrozenA1?.id, cashierA1?.id,
    inactiveWorkerA1?.id, workerDrinksA2?.id, workerDrinksB1?.id,
  ].filter(Boolean) } } }).catch(() => {});
  await cleanup();
});

// --- TARGETING -----------------------------------------------------

test("TARGETING: specific market + role + department matches Main AND Additional department, excludes non-matching department/market/inactive", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Snacks" },
  });
  assert.equal(status, 200);
  // workerDrinksA1 (Main=Drinks) + workerNutsAdditionalDrinksA1 (Additional=Drinks) = 2.
  // workerFrozenA1, cashierA1 (wrong role), inactiveWorkerA1 (inactive) all excluded.
  assert.equal(body.recipientCount, 2);
});

test("TARGETING: All Departments in one market matches every qualifying role regardless of department", async () => {
  const { body } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER" },
  });
  // workerDrinksA1, workerNutsAdditionalDrinksA1, workerFrozenA1 = 3 (inactive excluded).
  assert.equal(body.recipientCount, 3);
});

test("TARGETING: Entire Zone reaches every qualifying market in that zone but not other zones", async () => {
  const { body } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "ZONE", zoneId: zoneA.id, targetRole: "WORKER", targetDepartment: "Snacks" },
  });
  // workerDrinksA1 + workerNutsAdditionalDrinksA1 (marketA1) + workerDrinksA2 (marketA2) = 3. workerDrinksB1 (zoneB) excluded.
  assert.equal(body.recipientCount, 3);
});

test("TARGETING: All Markets (Admin only) reaches every zone", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "ALL_MARKETS", targetRole: "WORKER", targetDepartment: "Snacks" },
  });
  assert.equal(status, 200);
  // This file's own fixtures add exactly 4 matching workers (workerDrinksA1,
  // workerNutsAdditionalDrinksA1 via Additional, workerDrinksA2,
  // workerDrinksB1) on top of whatever else already exists company-wide —
  // see baselineSnacksWorkerCount's own comment for why this is a delta,
  // not a hardcoded absolute count.
  assert.equal(body.recipientCount, baselineSnacksWorkerCount + 4);
});

test("TARGETING: Everyone role matches every employee role, and cannot be combined with a specific department", async () => {
  const everyone = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "EVERYONE" },
  });
  // 3 Workers + 1 Cashier = 4 (inactive excluded).
  assert.equal(everyone.body.recipientCount, 4);

  const invalid = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "EVERYONE", targetDepartment: "Snacks" },
  });
  assert.equal(invalid.status, 400);
});

test("TARGETING: Cashier role cannot be combined with a specific department (Cashiers have no department)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "CASHIER", targetDepartment: "Snacks" },
  });
  assert.equal(status, 400);
});

test("TARGETING: an empty audience cannot be sent", async () => {
  const preview = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "BUTCHER" },
  });
  assert.equal(preview.body.recipientCount, 0);

  const send = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "BUTCHER", type: "ANNOUNCEMENT", category: "GENERAL", title: "x", message: "x" },
  });
  assert.equal(send.status, 422);
});

// --- AUTHORIZATION / IDOR ------------------------------------------

test("AUTH: a Zone Manager cannot target a zone they don't manage", async () => {
  const { status } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "ZONE", zoneId: zoneB.id, targetRole: "WORKER" },
  });
  assert.equal(status, 403);
});

test("AUTH: a Zone Manager cannot target a market outside their zone", async () => {
  const { status } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "MARKET", marketId: marketB1.id, targetRole: "WORKER" },
  });
  assert.equal(status, 403);
});

test("AUTH: a Zone Manager cannot use ALL_MARKETS scope", async () => {
  const { status } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "ALL_MARKETS", targetRole: "WORKER" },
  });
  assert.equal(status, 403);
});

test("AUTH: a Zone Manager CAN target their own zone and a market inside it", async () => {
  const zoneOk = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "ZONE", zoneId: zoneA.id, targetRole: "WORKER" },
  });
  assert.equal(zoneOk.status, 200);

  const marketOk = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER" },
  });
  assert.equal(marketOk.status, 200);
});

test("AUTH: a Supervisor cannot send communications at all (not an authorized sender role)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenSupervisorA1,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER" },
  });
  assert.equal(status, 403);
});

test("AUTH: an employee cannot preview or send", async () => {
  const preview = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenWorkerDrinksA1,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER" },
  });
  assert.equal(preview.status, 403);

  const send = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenWorkerDrinksA1,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", type: "ANNOUNCEMENT", category: "GENERAL", title: "x", message: "x" },
  });
  assert.equal(send.status, 403);
});

test("AUTH: an unauthenticated request is rejected", async () => {
  const { status } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST",
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER" },
  });
  assert.equal(status, 401);
});

test("AUTH: manipulating marketId in the request body cannot bypass a Zone Manager's real scope", async () => {
  // rmA only manages zoneA — marketB1 belongs to zoneB. Even though the
  // request LOOKS like a normal, well-formed targeting request, the
  // backend must re-resolve marketB1's real zone and reject it.
  const { status } = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "MARKET", marketId: marketB1.id, targetRole: "WORKER", type: "WARNING", category: "GENERAL", title: "Bypass attempt", message: "x" },
  });
  assert.equal(status, 403);
  const leaked = await prisma.communication.findFirst({ where: { title: "Bypass attempt" } });
  assert.equal(leaked, null, "no Communication row must be created when authorization fails");
});

// --- SEND, SNAPSHOT, DUPLICATE PROTECTION ---------------------------

test("SEND: a real send creates the Communication + exact recipient snapshot, and a bell notification per recipient", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: {
      scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Snacks",
      type: "TASK", category: "STOCK_CHECK", title: "Drinks Stock Check", message: "Please count the Drinks department.",
      priority: "IMPORTANT", actionType: "COMPLETION",
    },
  });
  assert.equal(status, 201);
  assert.equal(body.recipientCount, 2);
  trackCommunication(body.id);

  const recipients = await prisma.communicationRecipient.findMany({ where: { communicationId: body.id } });
  assert.equal(recipients.length, 2);
  assert.ok(recipients.every((r) => r.status === "UNREAD"));

  const bellNotifications = await prisma.notification.findMany({ where: { type: "COMMUNICATION", linkId: body.id } });
  assert.equal(bellNotifications.length, 2);
});

test("SEND: senderZoneSnapshot stores the human-readable Zone NUMBER, never the internal Zone id", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "ZONE", zoneId: zoneA.id, targetRole: "WORKER", type: "ANNOUNCEMENT", category: "GENERAL", title: "Zone Number Snapshot Test", message: "x" },
  });
  assert.equal(status, 201);
  trackCommunication(body.id);
  // zoneA was created with number: 91101 (see makeZone(91101) above) — a
  // completely different value from zoneA.id (an unrelated autoincrement
  // sequence). Asserting the snapshot equals the NUMBER, not the id,
  // catches a real bug found during frontend work: the controller
  // originally stored Zone.id here, which would have displayed a
  // meaningless internal id instead of "Zone 91101" in the UI.
  assert.equal(body.senderZoneSnapshot, 91101);
  assert.notEqual(body.senderZoneSnapshot, zoneA.id);
});

test("SEND: duplicate-send protection — the same clientRequestId never creates a second Communication", async () => {
  const payload = {
    scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Frozen",
    type: "ANNOUNCEMENT", category: "GENERAL", title: "Frozen Announcement", message: "x",
    clientRequestId: "communications-test-idempotency-key-1",
  };
  const first = await apiFetch(baseUrl, "/api/communications", { method: "POST", token: tokenAdmin, body: payload });
  assert.equal(first.status, 201);
  trackCommunication(first.body.id);

  const second = await apiFetch(baseUrl, "/api/communications", { method: "POST", token: tokenAdmin, body: payload });
  assert.equal(second.status, 200);
  assert.equal(second.body.id, first.body.id);
  assert.equal(second.body.alreadySent, true);

  const count = await prisma.communication.count({ where: { clientRequestId: payload.clientRequestId } });
  assert.equal(count, 1);
});

test("SNAPSHOT: a recipient reassigned to a different market after send still retains the communication", async () => {
  const send = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: {
      scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Snacks",
      type: "ANNOUNCEMENT", category: "GENERAL", title: "Snapshot Test", message: "x",
    },
  });
  assert.equal(send.status, 201);
  trackCommunication(send.body.id);

  const before = await apiFetch(baseUrl, "/api/communications/my", { token: tokenWorkerDrinksA1 });
  assert.ok(before.body.some((c) => c.id === send.body.id));

  // Reassign the recipient to an entirely different market/zone.
  await apiFetch(baseUrl, `/api/employees/${workerDrinksA1.id}`, { method: "PATCH", token: tokenAdmin, body: { marketId: marketB1.id } });

  const after = await apiFetch(baseUrl, "/api/communications/my", { token: tokenWorkerDrinksA1 });
  assert.ok(
    after.body.some((c) => c.id === send.body.id),
    "the historical recipient snapshot must survive the employee's later reassignment"
  );

  // Move them back so later tests in this file aren't affected.
  await apiFetch(baseUrl, `/api/employees/${workerDrinksA1.id}`, { method: "PATCH", token: tokenAdmin, body: { marketId: marketA1.id } });
});

// --- RECIPIENT STATE MACHINE ----------------------------------------

test("STATE: unread -> read on open, acknowledge flow, and cannot acknowledge an INFORMATIONAL communication", async () => {
  const informational = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Snacks", type: "ANNOUNCEMENT", category: "GENERAL", title: "Info Only", message: "x" },
  });
  trackCommunication(informational.body.id);

  const opened = await apiFetch(baseUrl, `/api/communications/my/${informational.body.id}`, { token: tokenWorkerDrinksA1 });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.myStatus, "READ");
  assert.ok(opened.body.readAt);

  const ackAttempt = await apiFetch(baseUrl, `/api/communications/my/${informational.body.id}/acknowledge`, { method: "PATCH", token: tokenWorkerDrinksA1 });
  assert.equal(ackAttempt.status, 400);

  const ackComm = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Snacks", type: "WARNING", category: "GENERAL", title: "Please Acknowledge", message: "x", actionType: "ACKNOWLEDGEMENT" },
  });
  trackCommunication(ackComm.body.id);

  const ack = await apiFetch(baseUrl, `/api/communications/my/${ackComm.body.id}/acknowledge`, { method: "PATCH", token: tokenWorkerDrinksA1 });
  assert.equal(ack.status, 200);
  assert.equal(ack.body.myStatus, "ACKNOWLEDGED");
  assert.ok(ack.body.acknowledgedAt);
});

test("STATE: full Start -> Complete task flow with a structured response, and double-completion is blocked", async () => {
  const task = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Snacks", type: "TASK", category: "COUNTING", title: "White Monster Count", message: "Count it.", actionType: "COMPLETION" },
  });
  trackCommunication(task.body.id);

  const start = await apiFetch(baseUrl, `/api/communications/my/${task.body.id}/start`, { method: "PATCH", token: tokenWorkerDrinksA1 });
  assert.equal(start.status, 200);
  assert.equal(start.body.myStatus, "IN_PROGRESS");

  const complete = await apiFetch(baseUrl, `/api/communications/my/${task.body.id}/complete`, {
    method: "PATCH", token: tokenWorkerDrinksA1, body: { response: { quantity: 24, dailySales: 8, note: "shelf restocked" } },
  });
  assert.equal(complete.status, 200);
  assert.equal(complete.body.myStatus, "COMPLETED");
  assert.deepEqual(complete.body.response, { quantity: 24, dailySales: 8, note: "shelf restocked" });

  const doubleComplete = await apiFetch(baseUrl, `/api/communications/my/${task.body.id}/complete`, { method: "PATCH", token: tokenWorkerDrinksA1, body: {} });
  assert.equal(doubleComplete.status, 400);
});

test("STATE/IDOR: an employee cannot act on a communication they were not a recipient of", async () => {
  const comm = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Frozen", type: "ANNOUNCEMENT", category: "GENERAL", title: "Frozen Only", message: "x" },
  });
  trackCommunication(comm.body.id);

  const foreignAttempt = await apiFetch(baseUrl, `/api/communications/my/${comm.body.id}`, { token: tokenWorkerDrinksA1 });
  assert.equal(foreignAttempt.status, 404);
});

// --- MANAGEMENT HISTORY / PROGRESS -----------------------------------

test("MANAGEMENT: sender's progress counts are derived from real recipient rows", async () => {
  const comm = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Snacks", type: "WARNING", category: "GENERAL", title: "Progress Test", message: "x", actionType: "ACKNOWLEDGEMENT" },
  });
  trackCommunication(comm.body.id);

  await apiFetch(baseUrl, `/api/communications/my/${comm.body.id}`, { token: tokenWorkerDrinksA1 });
  await apiFetch(baseUrl, `/api/communications/my/${comm.body.id}/acknowledge`, { method: "PATCH", token: tokenWorkerDrinksA1 });

  const progress = await apiFetch(baseUrl, `/api/communications/${comm.body.id}`, { token: tokenAdmin });
  assert.equal(progress.status, 200);
  assert.equal(progress.body.progress.recipients, 2);
  assert.equal(progress.body.progress.read, 1);
  assert.equal(progress.body.progress.acknowledged, 1);
});

test("MANAGEMENT: a different sender cannot view another sender's communication progress", async () => {
  const comm = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "MARKET", marketId: marketA1.id, targetRole: "WORKER", targetDepartment: "Snacks", type: "ANNOUNCEMENT", category: "GENERAL", title: "Admin Sent This", message: "x" },
  });
  trackCommunication(comm.body.id);

  const { status } = await apiFetch(baseUrl, `/api/communications/${comm.body.id}`, { token: tokenRmA });
  assert.equal(status, 403);
});

test("MANAGEMENT: sent history is scoped to the sender's own communications", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/communications/sent", { token: tokenRmA });
  assert.equal(status, 200);
  assert.ok(body.every((c) => c.senderId === rmA.id));
  assert.ok(!body.some((c) => c.title === "Admin Sent This"));
});

// --- SPECIFIC_SUPERVISOR TARGETING (Verification pass §1) ---------------

test("SPECIFIC_SUPERVISOR: a Zone Manager can preview and send a warning to a Supervisor inside their own zone", async () => {
  const preview = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "SPECIFIC_SUPERVISOR", targetSupervisorId: supervisorA1.id },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.recipientCount, 1);

  const send = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenRmA,
    body: {
      scopeType: "SPECIFIC_SUPERVISOR", targetSupervisorId: supervisorA1.id,
      type: "WARNING", category: "GENERAL", title: "Please review the closing checklist", message: "Yesterday's closing was incomplete.",
      actionType: "ACKNOWLEDGEMENT",
    },
  });
  assert.equal(send.status, 201);
  assert.equal(send.body.recipientCount, 1);
  assert.equal(send.body.targetSupervisorId, supervisorA1.id);
  assert.equal(send.body.targetRole, null, "role/department axis must be null for this scope");
  trackCommunication(send.body.id);

  const recipientRow = await prisma.communicationRecipient.findUnique({ where: { communicationId_userId: { communicationId: send.body.id, userId: supervisorA1.id } } });
  assert.ok(recipientRow, "a real CommunicationRecipient row must exist for the targeted Supervisor");
  assert.equal(recipientRow.employeeId, null);

  const bellNotification = await prisma.notification.findFirst({ where: { userId: supervisorA1.id, type: "COMMUNICATION", linkId: send.body.id } });
  assert.ok(bellNotification, "the Supervisor must get the same bell-notification pointer an employee recipient gets");
});

test("SPECIFIC_SUPERVISOR: the targeted Supervisor can see it in /my, read it, and acknowledge it", async () => {
  const send = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenRmA,
    body: {
      scopeType: "SPECIFIC_SUPERVISOR", targetSupervisorId: supervisorA1.id,
      type: "WARNING", category: "GENERAL", title: "Second warning to Supervisor A1", message: "x", actionType: "ACKNOWLEDGEMENT",
    },
  });
  trackCommunication(send.body.id);

  const list = await apiFetch(baseUrl, "/api/communications/my", { token: tokenSupervisorA1 });
  assert.equal(list.status, 200);
  assert.ok(list.body.some((c) => c.id === send.body.id));

  const detail = await apiFetch(baseUrl, `/api/communications/my/${send.body.id}`, { token: tokenSupervisorA1 });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.myStatus, "READ");

  const ack = await apiFetch(baseUrl, `/api/communications/my/${send.body.id}/acknowledge`, { method: "PATCH", token: tokenSupervisorA1 });
  assert.equal(ack.status, 200);
  assert.equal(ack.body.myStatus, "ACKNOWLEDGED");

  const progress = await apiFetch(baseUrl, `/api/communications/${send.body.id}`, { token: tokenRmA });
  assert.equal(progress.body.progress.acknowledged, 1);
});

test("SPECIFIC_SUPERVISOR: a Zone Manager cannot target a Supervisor outside their own zone (IDOR)", async () => {
  const supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorB.id, name: "CommTest Market B2" });

  const preview = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "SPECIFIC_SUPERVISOR", targetSupervisorId: supervisorB.id },
  });
  assert.equal(preview.status, 403);

  const send = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenRmA,
    body: { scopeType: "SPECIFIC_SUPERVISOR", targetSupervisorId: supervisorB.id, type: "WARNING", category: "GENERAL", title: "Bypass attempt", message: "x" },
  });
  assert.equal(send.status, 403);
  const leaked = await prisma.communication.findFirst({ where: { title: "Bypass attempt" } });
  assert.equal(leaked, null);

  await prisma.market.deleteMany({ where: { supervisorId: supervisorB.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: supervisorB.id } }).catch(() => {});
});

test("SPECIFIC_SUPERVISOR: an Admin can target any Supervisor company-wide", async () => {
  const send = await apiFetch(baseUrl, "/api/communications", {
    method: "POST", token: tokenAdmin,
    body: { scopeType: "SPECIFIC_SUPERVISOR", targetSupervisorId: supervisorA1.id, type: "ANNOUNCEMENT", category: "GENERAL", title: "From Admin directly", message: "x" },
  });
  assert.equal(send.status, 201);
  trackCommunication(send.body.id);
});

test("SPECIFIC_SUPERVISOR: an employee cannot use this scope at all", async () => {
  const { status } = await apiFetch(baseUrl, "/api/communications/preview", {
    method: "POST", token: tokenWorkerDrinksA1,
    body: { scopeType: "SPECIFIC_SUPERVISOR", targetSupervisorId: supervisorA1.id },
  });
  assert.equal(status, 403);
});
