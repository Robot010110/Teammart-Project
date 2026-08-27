// phase3Chat.test.js — Phase 3's new chat-organization surface: Important
// People (STAFF_DIRECT + ImportantContact), Group types (NORMAL/WARNING
// posting restriction), staff unread tracking (ConversationRead.staffUserId),
// the /organized aggregator, and IDOR protection across the new endpoints.
// See test/helpers.js for the fixture/cleanup strategy shared with the
// rest of this suite.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, zoneB, marketA, marketB;
let admin, rmA, rmB, supervisorA, supervisorB, overlookingC;
let tokenAdmin, tokenRmA, tokenRmB, tokenSupervisorA, tokenSupervisorB, tokenOverlookingC;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90501);
  zoneB = await makeZone(90502);

  admin = await makeStaffUser({ role: "ADMIN" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  overlookingC = await makeStaffUser({ role: "OVERLOOKING_SUPERVISOR" });

  // zoneA is managed by rmA; supervisorA/overlookingC both sit in a
  // market inside zoneA, so authorizedStaffContactsFor should resolve
  // rmA as their Regional Manager. zoneB (rmB) is deliberately
  // unrelated to marketA — used for cross-zone IDOR checks.
  await prisma.zone.update({ where: { id: zoneA.id }, data: { managerId: rmA.id } });
  await prisma.zone.update({ where: { id: zoneB.id }, data: { managerId: rmB.id } });

  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id, overlookingSupervisorId: overlookingC.id });
  marketB = await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorB.id });

  tokenAdmin = tokenForStaff(admin);
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenRmB = tokenForStaff(rmB, { managedZones: [zoneB] });
  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  tokenSupervisorB = tokenForStaff(supervisorB, { managedMarket: marketB });
  tokenOverlookingC = tokenForStaff(overlookingC, { managedOverlookingMarket: marketA });
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- IMPORTANT PEOPLE / STAFF_DIRECT ---------------------------------

test("STAFF CONTACTS: a Regional Manager's authorized contacts are ADMIN accounts, not an unrelated Supervisor", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/conversations/staff-contacts", { token: tokenRmA });
  assert.equal(status, 200);
  assert.ok(body.some((c) => c.id === admin.id));
  assert.ok(!body.some((c) => c.id === supervisorB.id));
  assert.ok(!body.some((c) => c.id === rmB.id));
});

test("STAFF CONTACTS: a Supervisor's authorized contacts are their own zone's Regional Manager + Admin, not an unrelated RM", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/conversations/staff-contacts", { token: tokenSupervisorA });
  assert.equal(status, 200);
  assert.ok(body.some((c) => c.id === rmA.id));
  assert.ok(body.some((c) => c.id === admin.id));
  assert.ok(!body.some((c) => c.id === rmB.id));
});

test("STAFF_DIRECT: a Regional Manager can open a real conversation with an authorized Admin contact", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${admin.id}`, { token: tokenRmA });
  assert.equal(status, 200);
  assert.equal(body.type, "STAFF_DIRECT");

  // Re-requesting resolves to the exact same conversation (idempotent
  // get-or-create), regardless of which side initiates.
  const second = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${admin.id}`, { token: tokenRmA });
  assert.equal(second.body.id, body.id);
  const fromAdminSide = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${rmA.id}`, { token: tokenAdmin });
  assert.equal(fromAdminSide.body.id, body.id);
});

test("STAFF_DIRECT: a Regional Manager cannot open a conversation with an unrelated zone's Supervisor (not an authorized contact)", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${supervisorB.id}`, { token: tokenRmA });
  assert.equal(status, 403);
  assert.ok(body.error);
});

test("STAFF_DIRECT IDOR: Supervisor B cannot read messages in Supervisor A's STAFF_DIRECT conversation with the RM", async () => {
  const created = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${rmA.id}`, { token: tokenSupervisorA });
  assert.equal(created.status, 200);
  const conversationId = created.body.id;

  const asOther = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, { token: tokenSupervisorB });
  assert.equal(asOther.status, 404);
});

test("IMPORTANT PEOPLE: favoriting an unauthorized contact is rejected (favoriting is not an authorization mechanism)", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/conversations/important-people", {
    method: "POST", token: tokenRmA, body: { contactUserId: supervisorB.id },
  });
  assert.equal(status, 403);
  assert.ok(body.error);
});

test("IMPORTANT PEOPLE: RM can favorite an authorized Admin contact, list it, reorder it, and remove it", async () => {
  const add = await apiFetch(baseUrl, "/api/conversations/important-people", {
    method: "POST", token: tokenRmA, body: { contactUserId: admin.id, priority: 5 },
  });
  assert.equal(add.status, 201);
  assert.equal(add.body.contactUserId, admin.id);
  assert.equal(add.body.priority, 5);

  const list = await apiFetch(baseUrl, "/api/conversations/important-people", { token: tokenRmA });
  assert.equal(list.status, 200);
  assert.ok(list.body.some((c) => c.id === add.body.id));

  const reorder = await apiFetch(baseUrl, `/api/conversations/important-people/${add.body.id}`, {
    method: "PATCH", token: tokenRmA, body: { priority: 99 },
  });
  assert.equal(reorder.status, 200);

  const remove = await apiFetch(baseUrl, `/api/conversations/important-people/${add.body.id}`, {
    method: "DELETE", token: tokenRmA,
  });
  assert.equal(remove.status, 200);
  const listAfter = await apiFetch(baseUrl, "/api/conversations/important-people", { token: tokenRmA });
  assert.ok(!listAfter.body.some((c) => c.id === add.body.id));
});

test("IMPORTANT PEOPLE IDOR: Admin cannot reorder or remove a contact row owned by the Regional Manager", async () => {
  const add = await apiFetch(baseUrl, "/api/conversations/important-people", {
    method: "POST", token: tokenRmA, body: { contactUserId: admin.id },
  });
  assert.equal(add.status, 201);

  const reorder = await apiFetch(baseUrl, `/api/conversations/important-people/${add.body.id}`, {
    method: "PATCH", token: tokenAdmin, body: { priority: 1 },
  });
  assert.equal(reorder.status, 404);

  const remove = await apiFetch(baseUrl, `/api/conversations/important-people/${add.body.id}`, {
    method: "DELETE", token: tokenAdmin,
  });
  assert.equal(remove.status, 200); // deleteMany scoped to Admin's own ownerUserId — deletes nothing
  const stillThere = await prisma.importantContact.findUnique({ where: { id: add.body.id } });
  assert.ok(stillThere, "the RM's contact row must survive an unrelated staff account's delete attempt");

  await apiFetch(baseUrl, `/api/conversations/important-people/${add.body.id}`, { method: "DELETE", token: tokenRmA });
});

// --- GROUP TYPES (NORMAL / WARNING) -----------------------------------

test("GROUPS: a WARNING-type group can be created, and only a group admin may post in it", async () => {
  const employeeInMarketA = await makeEmployee({ marketId: marketA.id });
  const create = await apiFetch(baseUrl, "/api/conversations/groups", {
    method: "POST", token: tokenSupervisorA,
    body: { name: "Market A Announcements", marketId: marketA.id, memberEmployeeIds: [employeeInMarketA.id], groupType: "WARNING" },
  });
  assert.equal(create.status, 201);
  assert.equal(create.body.groupType, "WARNING");
  const conversationId = create.body.id;

  // The creator (auto-admin) can post.
  const asAdmin = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenSupervisorA, body: { body: "Store closes early today" },
  });
  assert.equal(asAdmin.status, 201);

  // A non-admin employee member cannot.
  const employeeToken = tokenForEmployee(employeeInMarketA);
  const asMember = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: employeeToken, body: { body: "Can I post here?" },
  });
  assert.equal(asMember.status, 403);
});

test("GROUPS: a default NORMAL-type group lets any member post", async () => {
  const employeeInMarketA = await makeEmployee({ marketId: marketA.id });
  const create = await apiFetch(baseUrl, "/api/conversations/groups", {
    method: "POST", token: tokenSupervisorA,
    body: { name: "Market A Team Chat", marketId: marketA.id, memberEmployeeIds: [employeeInMarketA.id] },
  });
  assert.equal(create.status, 201);
  assert.equal(create.body.groupType, "NORMAL");

  const employeeToken = tokenForEmployee(employeeInMarketA);
  const asMember = await apiFetch(baseUrl, `/api/conversations/${create.body.id}/messages`, {
    method: "POST", token: employeeToken, body: { body: "hello team" },
  });
  assert.equal(asMember.status, 201);
});

// --- STAFF UNREAD TRACKING --------------------------------------------

test("UNREAD (staff): a message in a STAFF_DIRECT conversation counts as unread until the recipient marks it read", async () => {
  const created = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${admin.id}`, { token: tokenRmA });
  const conversationId = created.body.id;

  const sent = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenAdmin, body: { body: "Please review the Q3 numbers" },
  });
  assert.equal(sent.status, 201);

  const inboxBefore = await apiFetch(baseUrl, "/api/conversations/rm", { token: tokenRmA });
  const convoBefore = inboxBefore.body.find((c) => c.id === conversationId);
  assert.ok(convoBefore, "the STAFF_DIRECT conversation must appear in the RM's own inbox");
  assert.equal(convoBefore.unreadCount, 1);

  const organizedBefore = await apiFetch(baseUrl, "/api/conversations/organized", { token: tokenRmA });
  assert.ok(organizedBefore.body.unread.some((c) => c.id === conversationId));
  assert.ok(organizedBefore.body.individuals.some((c) => c.id === conversationId));

  const markRead = await apiFetch(baseUrl, `/api/conversations/${conversationId}/read`, { method: "POST", token: tokenRmA });
  assert.equal(markRead.status, 200);

  const inboxAfter = await apiFetch(baseUrl, "/api/conversations/rm", { token: tokenRmA });
  const convoAfter = inboxAfter.body.find((c) => c.id === conversationId);
  assert.equal(convoAfter.unreadCount, 0);

  const organizedAfter = await apiFetch(baseUrl, "/api/conversations/organized", { token: tokenRmA });
  assert.ok(!organizedAfter.body.unread.some((c) => c.id === conversationId));
});

// --- ORGANIZED AGGREGATOR / DEPARTMENT REPORT INTEGRATION --------------

test("ORGANIZED: a Supervisor's Market Group still categorizes correctly under Groups (Department Report integration untouched)", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/conversations/organized", { token: tokenSupervisorA });
  assert.equal(status, 200);
  const marketGroup = body.groups.find((c) => c.type === "MARKET_GROUP" && c.marketId === marketA.id);
  assert.ok(marketGroup, "the market's own Market Group must appear under the Groups view");
});

test("ORGANIZED: an employee token gets no Important People bucket (organizational feature is staff-only)", async () => {
  const employee = await makeEmployee({ marketId: marketA.id });
  const employeeToken = tokenForEmployee(employee);
  const { status, body } = await apiFetch(baseUrl, "/api/conversations/organized", { token: employeeToken });
  assert.equal(status, 200);
  assert.deepEqual(body.importantPeople, []);
});

// --- ADMIN CHAT INBOX (Phase 3.5) --------------------------------------

test("ADMIN INBOX: /api/conversations/admin is Admin-only", async () => {
  const asRm = await apiFetch(baseUrl, "/api/conversations/admin", { token: tokenRmA });
  assert.equal(asRm.status, 403);
});

test("ADMIN INBOX: an Admin's STAFF_DIRECT and CUSTOM_GROUP conversations appear in both /admin and /organized, with real unread counts", async () => {
  const staffDirect = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${rmA.id}`, { token: tokenAdmin });
  assert.equal(staffDirect.status, 200);

  const employeeInMarketA = await makeEmployee({ marketId: marketA.id });
  // Admin creates its own group (Admin always passes assertMarketAccess —
  // see staffCanAccessMarket — and the creator is always auto-added
  // regardless of the member-scope check, same as any other creator).
  const group = await apiFetch(baseUrl, "/api/conversations/groups", {
    method: "POST", token: tokenAdmin,
    body: { name: "Admin+Supervisor Sync", marketId: marketA.id, memberEmployeeIds: [employeeInMarketA.id] },
  });
  assert.equal(group.status, 201);

  const sent = await apiFetch(baseUrl, `/api/conversations/${staffDirect.body.id}/messages`, {
    method: "POST", token: tokenRmA, body: { body: "Quarterly sync request" },
  });
  assert.equal(sent.status, 201);

  const inbox = await apiFetch(baseUrl, "/api/conversations/admin", { token: tokenAdmin });
  assert.equal(inbox.status, 200);
  // This STAFF_DIRECT pair (Admin<->rmA) is reused across earlier tests
  // in this file (staffDirectPair dedupes on the pair), so assert
  // "at least the message just sent counts as unread" rather than an
  // exact count.
  assert.ok(inbox.body.some((c) => c.id === staffDirect.body.id && c.unreadCount > 0));
  assert.ok(inbox.body.some((c) => c.id === group.body.id && c.type === "CUSTOM_GROUP"));

  const organized = await apiFetch(baseUrl, "/api/conversations/organized", { token: tokenAdmin });
  assert.equal(organized.status, 200);
  assert.ok(organized.body.unread.some((c) => c.id === staffDirect.body.id));
  assert.ok(organized.body.groups.some((c) => c.id === group.body.id));
  assert.ok(organized.body.individuals.some((c) => c.id === staffDirect.body.id));
});
