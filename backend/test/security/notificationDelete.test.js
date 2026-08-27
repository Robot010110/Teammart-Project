// notificationDelete.test.js — Repair Pass §6: notification deletion is
// a real, persisted soft-delete (Notification.deletedAt), not a
// React-state-only hide, and ownership is enforced server-side so a
// client can never delete another account's notification by editing the
// id in the URL.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, supervisor, supervisorB, employee, employeeB;
let tokenSupervisor, tokenSupervisorB, tokenEmployee, tokenEmployeeB;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zone = await makeZone(90401);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  employee = await makeEmployee({ marketId: market.id, role: "WORKER" });
  employeeB = await makeEmployee({ marketId: market.id, role: "WORKER" });

  tokenSupervisor = tokenForStaff(supervisor, { managedMarket: market });
  tokenSupervisorB = tokenForStaff(supervisorB);
  tokenEmployee = tokenForEmployee(employee);
  tokenEmployeeB = tokenForEmployee(employeeB);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

async function makeEmployeeNotification(read = false) {
  return prisma.notification.create({
    data: { type: "ANNOUNCEMENT", title: "Test", body: "Test body", employeeId: employee.id, read },
  });
}

async function makeStaffNotification(userId, read = false) {
  return prisma.notification.create({
    data: { type: "MARKET_FEEDBACK", title: "Test", body: "Test body", userId, read },
  });
}

test("DELETE: an employee can delete their own notification, and it is really persisted (excluded from a fresh fetch)", async () => {
  const n = await makeEmployeeNotification();

  const res = await apiFetch(baseUrl, `/api/notifications/${n.id}`, { method: "DELETE", token: tokenEmployee });
  assert.equal(res.status, 204);

  const stillInDb = await prisma.notification.findUnique({ where: { id: n.id } });
  assert.ok(stillInDb, "row must still exist (soft delete, not a hard delete)");
  assert.ok(stillInDb.deletedAt, "deletedAt must be set");

  const list = await apiFetch(baseUrl, "/api/notifications", { token: tokenEmployee });
  assert.equal(list.status, 200);
  assert.ok(!list.body.notifications.some((x) => x.id === n.id), "deleted notification must not reappear in a fresh fetch");
});

test("DELETE: deleting an unread notification decrements unreadCount correctly", async () => {
  const n = await makeEmployeeNotification(false);
  const before_ = await apiFetch(baseUrl, "/api/notifications", { token: tokenEmployee });
  const beforeUnread = before_.body.unreadCount;

  await apiFetch(baseUrl, `/api/notifications/${n.id}`, { method: "DELETE", token: tokenEmployee });

  const after_ = await apiFetch(baseUrl, "/api/notifications", { token: tokenEmployee });
  assert.equal(after_.body.unreadCount, beforeUnread - 1);
});

test("DELETE: is idempotent — deleting an already-deleted notification still returns 204, not an error", async () => {
  const n = await makeEmployeeNotification();
  const first = await apiFetch(baseUrl, `/api/notifications/${n.id}`, { method: "DELETE", token: tokenEmployee });
  assert.equal(first.status, 204);
  const second = await apiFetch(baseUrl, `/api/notifications/${n.id}`, { method: "DELETE", token: tokenEmployee });
  assert.equal(second.status, 204);
});

test("DELETE: 404 for a notification id that doesn't exist", async () => {
  const res = await apiFetch(baseUrl, "/api/notifications/does-not-exist", { method: "DELETE", token: tokenEmployee });
  assert.equal(res.status, 404);
});

test("DELETE IDOR: an employee cannot delete another employee's notification by editing the id", async () => {
  const n = await makeEmployeeNotification();
  // employeeB attempts to delete employee's notification.
  const res = await apiFetch(baseUrl, `/api/notifications/${n.id}`, { method: "DELETE", token: tokenEmployeeB });
  assert.equal(res.status, 403);

  const stillThere = await prisma.notification.findUnique({ where: { id: n.id } });
  assert.equal(stillThere.deletedAt, null, "the real owner's notification must be untouched");
});

test("DELETE IDOR: one Supervisor cannot delete another Supervisor's (staff-recipient) notification", async () => {
  const n = await makeStaffNotification(supervisor.id);
  const res = await apiFetch(baseUrl, `/api/notifications/${n.id}`, { method: "DELETE", token: tokenSupervisorB });
  assert.equal(res.status, 403);

  const stillThere = await prisma.notification.findUnique({ where: { id: n.id } });
  assert.equal(stillThere.deletedAt, null);
});

test("DELETE: a Supervisor (staff recipient) can delete their own notification", async () => {
  const n = await makeStaffNotification(supervisor.id);
  const res = await apiFetch(baseUrl, `/api/notifications/${n.id}`, { method: "DELETE", token: tokenSupervisor });
  assert.equal(res.status, 204);

  const list = await apiFetch(baseUrl, "/api/notifications", { token: tokenSupervisor });
  assert.ok(!list.body.notifications.some((x) => x.id === n.id));
});

test("DELETE ALL: removes every one of the caller's own notifications in one request, and it persists", async () => {
  const n1 = await makeEmployeeNotification(false);
  const n2 = await makeEmployeeNotification(true);
  const n3 = await makeEmployeeNotification(false);

  const res = await apiFetch(baseUrl, "/api/notifications", { method: "DELETE", token: tokenEmployee });
  assert.equal(res.status, 204);

  const list = await apiFetch(baseUrl, "/api/notifications", { token: tokenEmployee });
  assert.equal(list.body.unreadCount, 0);
  for (const n of [n1, n2, n3]) {
    assert.ok(!list.body.notifications.some((x) => x.id === n.id));
  }

  const rows = await prisma.notification.findMany({ where: { id: { in: [n1.id, n2.id, n3.id] } } });
  assert.equal(rows.length, 3, "rows must still exist (soft delete, not a hard delete)");
  assert.ok(rows.every((r) => r.deletedAt));
});

test("DELETE ALL: never touches another account's notifications", async () => {
  const mine = await makeEmployeeNotification(false);
  const theirs = await makeEmployeeNotification(false); // owned by `employee`, will delete as employeeB below by mistake-checking

  // employeeB deletes their own (empty) feed; employee's notification (`mine`) must survive untouched.
  const res = await apiFetch(baseUrl, "/api/notifications", { method: "DELETE", token: tokenEmployeeB });
  assert.equal(res.status, 204);

  const stillThere = await prisma.notification.findUnique({ where: { id: mine.id } });
  assert.equal(stillThere.deletedAt, null);
  const theirsRow = await prisma.notification.findUnique({ where: { id: theirs.id } });
  assert.equal(theirsRow.deletedAt, null);
});

test("DELETE ALL: is idempotent — calling it again with nothing left to delete still returns 204", async () => {
  await apiFetch(baseUrl, "/api/notifications", { method: "DELETE", token: tokenEmployee });
  const res = await apiFetch(baseUrl, "/api/notifications", { method: "DELETE", token: tokenEmployee });
  assert.equal(res.status, 204);
});
