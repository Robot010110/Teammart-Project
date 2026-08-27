// productionChat.test.js — Production Chat expansion: Zone General/
// Announcements (auto-provisioned, membership + posting authorization),
// Mentions (structured, server-validated against real conversation
// membership), and Management Recognition (authorization on the reaction
// itself, never trusted from the request). See test/helpers.js for the
// shared fixture/cleanup strategy.
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
let marketA1, marketB1;
let admin, tokenAdmin;
let rmA, tokenRmA;
let rmB, tokenRmB;
let supervisorA1, tokenSupervisorA1;
let workerA1, tokenWorkerA1;
let workerA1b, tokenWorkerA1b;
let workerB1, tokenWorkerB1;

const trackedConversationIds = [];

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(92201);
  zoneB = await makeZone(92202);
  admin = await makeStaffUser({ role: "ADMIN" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  supervisorA1 = await makeStaffUser({ role: "SUPERVISOR" });

  marketA1 = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA1.id, name: "ProdChat Market A1" });
  marketB1 = await makeMarket({ zoneId: zoneB.id, name: "ProdChat Market B1" });

  tokenAdmin = tokenForStaff(admin);
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenRmB = tokenForStaff(rmB, { managedZones: [zoneB] });
  tokenSupervisorA1 = tokenForStaff(supervisorA1, { managedMarket: marketA1 });

  // The JWT's zoneIds claim (set above) is what assertZoneAccess/
  // isZoneMember read for the ACTING user; the mention-eligibility check
  // (staffMentionEligible) instead looks up a TARGET user's real
  // Zone.managerId from the DB, since there's no token for a mention
  // target — so the DB relation needs to be set too, same as
  // cleanupPhase.test.js's own fixture for the reverse direction.
  await prisma.zone.update({ where: { id: zoneA.id }, data: { managerId: rmA.id } });
  await prisma.zone.update({ where: { id: zoneB.id }, data: { managerId: rmB.id } });

  workerA1 = await makeEmployee({ marketId: marketA1.id, name: "ProdChat Worker A1" });
  workerA1b = await makeEmployee({ marketId: marketA1.id, name: "ProdChat Worker A1b" });
  workerB1 = await makeEmployee({ marketId: marketB1.id, name: "ProdChat Worker B1" });
  tokenWorkerA1 = tokenForEmployee(workerA1);
  tokenWorkerA1b = tokenForEmployee(workerA1b);
  tokenWorkerB1 = tokenForEmployee(workerB1);
});

after(async () => {
  await stopServer(server);
  const zoneIds = [zoneA.id, zoneB.id];
  const conversations = await prisma.conversation.findMany({ where: { zoneId: { in: zoneIds } }, select: { id: true } });
  const conversationIds = [...new Set([...conversations.map((c) => c.id), ...trackedConversationIds])];
  if (conversationIds.length) {
    await prisma.conversationRead.deleteMany({ where: { conversationId: { in: conversationIds } } }).catch(() => {});
    await prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } }).catch(() => {});
  }
  await prisma.notification.deleteMany({ where: { employeeId: { in: [workerA1?.id, workerA1b?.id, workerB1?.id].filter(Boolean) } } }).catch(() => {});
  await cleanup();
});

// --- ZONE GROUP / ANNOUNCEMENTS -------------------------------------

test("ZONE GROUP: an employee can open their own zone's General Zone chat, but not another zone's", async () => {
  const own = await apiFetch(baseUrl, `/api/conversations/zone/${zoneA.id}/group`, { token: tokenWorkerA1 });
  assert.equal(own.status, 200);
  assert.equal(own.body.type, "ZONE_GROUP");
  trackedConversationIds.push(own.body.id);

  const other = await apiFetch(baseUrl, `/api/conversations/zone/${zoneB.id}/group`, { token: tokenWorkerA1 });
  assert.equal(other.status, 403);
});

test("ZONE GROUP: appears automatically in an employee's conversation list and a Supervisor's inbox", async () => {
  const employeeList = await apiFetch(baseUrl, "/api/conversations", { token: tokenWorkerA1 });
  assert.equal(employeeList.status, 200);
  assert.ok(employeeList.body.some((c) => c.type === "ZONE_GROUP" && c.zoneId === zoneA.id));

  const supervisorList = await apiFetch(baseUrl, "/api/conversations/staff", { token: tokenSupervisorA1 });
  assert.equal(supervisorList.status, 200);
  assert.ok(supervisorList.body.some((c) => c.type === "ZONE_GROUP" && c.zoneId === zoneA.id));
});

test("ZONE ANNOUNCEMENTS: an employee can read but not post directly (must go through the broadcast endpoint)", async () => {
  const conv = await apiFetch(baseUrl, `/api/conversations/zone/${zoneA.id}/announcements`, { token: tokenWorkerA1 });
  assert.equal(conv.status, 200);
  trackedConversationIds.push(conv.body.id);

  const post = await apiFetch(baseUrl, `/api/conversations/${conv.body.id}/messages`, {
    method: "POST", token: tokenWorkerA1, body: { body: "trying to post directly" },
  });
  assert.equal(post.status, 403);
});

test("ZONE ANNOUNCEMENTS: the zone's own Regional Manager can broadcast, and it reaches every employee in the zone", async () => {
  const res = await apiFetch(baseUrl, "/api/conversations/zone-announcements/broadcast", {
    method: "POST", token: tokenRmA, body: { zoneId: zoneA.id, body: "Zone-wide operational update" },
  });
  assert.equal(res.status, 201);

  const notif = await prisma.notification.findFirst({ where: { employeeId: workerA1.id, type: "ANNOUNCEMENT", title: "New Zone Announcement" } });
  assert.ok(notif, "employee in the zone should have been notified");
});

test("ZONE ANNOUNCEMENTS: Admin can broadcast to any zone, but a Supervisor cannot broadcast at all", async () => {
  const asAdmin = await apiFetch(baseUrl, "/api/conversations/zone-announcements/broadcast", {
    method: "POST", token: tokenAdmin, body: { zoneId: zoneB.id, body: "Admin zone announcement" },
  });
  assert.equal(asAdmin.status, 201);

  const asSupervisor = await apiFetch(baseUrl, "/api/conversations/zone-announcements/broadcast", {
    method: "POST", token: tokenSupervisorA1, body: { zoneId: zoneA.id, body: "should not be allowed" },
  });
  assert.equal(asSupervisor.status, 403);
});

test("ZONE ANNOUNCEMENTS IDOR: a Regional Manager cannot broadcast into a zone they don't manage", async () => {
  const res = await apiFetch(baseUrl, "/api/conversations/zone-announcements/broadcast", {
    method: "POST", token: tokenRmB, body: { zoneId: zoneA.id, body: "cross-zone attempt" },
  });
  assert.equal(res.status, 403);
});

// --- MENTIONS ---------------------------------------------------------

test("MENTIONS: a valid mention (real coworker, real market membership) creates a MessageMention and a real notification", async () => {
  const groupRes = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA1 });
  const conversationId = groupRes.body.id;
  trackedConversationIds.push(conversationId);

  const send = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorkerA1,
    body: { body: `Hey @${workerA1b.name}`, mentions: [{ employeeId: workerA1b.id }] },
  });
  assert.equal(send.status, 201);
  assert.equal(send.body.mentions.length, 1);
  assert.equal(send.body.mentions[0].employeeId, workerA1b.id);

  const mention = await prisma.messageMention.findFirst({ where: { messageId: send.body.id, employeeId: workerA1b.id } });
  assert.ok(mention);
  const notif = await prisma.notification.findFirst({ where: { employeeId: workerA1b.id, type: "MENTION" } });
  assert.ok(notif, "mentioned employee should have a real MENTION notification");
});

test("MENTIONS: mentioning someone outside the conversation's real membership is silently dropped, never persisted", async () => {
  const groupRes = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA1 });
  const conversationId = groupRes.body.id;
  trackedConversationIds.push(conversationId);

  // workerB1 is in a different market — not a valid mention target here.
  const send = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorkerA1,
    body: { body: `Hey @${workerB1.name}`, mentions: [{ employeeId: workerB1.id }] },
  });
  assert.equal(send.status, 201);
  assert.equal(send.body.mentions.length, 0);

  const mention = await prisma.messageMention.findFirst({ where: { messageId: send.body.id } });
  assert.equal(mention, null);
  const notif = await prisma.notification.findFirst({ where: { employeeId: workerB1.id, type: "MENTION" } });
  assert.equal(notif, null);
});

test("MENTION CANDIDATES: the market group's candidate list only includes real market members, not an outside employee", async () => {
  const groupRes = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA1 });
  const conversationId = groupRes.body.id;
  trackedConversationIds.push(conversationId);

  const candidates = await apiFetch(baseUrl, `/api/conversations/${conversationId}/mention-candidates`, { token: tokenWorkerA1 });
  assert.equal(candidates.status, 200);
  assert.ok(candidates.body.employees.some((e) => e.id === workerA1b.id));
  assert.ok(!candidates.body.employees.some((e) => e.id === workerB1.id));
});

test("AUDIT: an employee CAN mention their zone's Regional Manager in the Market Group (the RM has real read access to it via staffCanAccessMarket)", async () => {
  const groupRes = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA1 });
  const conversationId = groupRes.body.id;
  trackedConversationIds.push(conversationId);

  const send = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorkerA1,
    body: { body: `cc @${rmA.name}`, mentions: [{ userId: rmA.id }] },
  });
  assert.equal(send.status, 201);
  assert.equal(send.body.mentions.length, 1, "the RM manages this market's zone and can read Market Group, so a mention of them should persist");
});

test("AUDIT: editing a message without changing its mentions does not re-send a duplicate MENTION notification", async () => {
  const groupRes = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA1 });
  const conversationId = groupRes.body.id;
  trackedConversationIds.push(conversationId);

  const send = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorkerA1,
    body: { body: `Hey @${workerA1b.name}`, mentions: [{ employeeId: workerA1b.id }] },
  });
  assert.equal(send.status, 201);

  const beforeCount = await prisma.notification.count({ where: { employeeId: workerA1b.id, type: "MENTION" } });

  const edit = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages/${send.body.id}`, {
    method: "PATCH", token: tokenWorkerA1,
    body: { body: `Hey @${workerA1b.name}, edited`, mentions: [{ employeeId: workerA1b.id }] },
  });
  assert.equal(edit.status, 200);

  const afterCount = await prisma.notification.count({ where: { employeeId: workerA1b.id, type: "MENTION" } });
  assert.equal(afterCount, beforeCount, "re-saving the same mention on edit should not create a second notification");
});

// --- MANAGEMENT RECOGNITION --------------------------------------------

test("RECOGNITION: a Supervisor can send a Management Recognition reaction to an employee's message", async () => {
  const groupRes = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA1 });
  const conversationId = groupRes.body.id;
  trackedConversationIds.push(conversationId);

  const msg = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorkerA1, body: { body: "exceptional work today" },
  });

  const react = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages/${msg.body.id}/reactions`, {
    method: "POST", token: tokenSupervisorA1, body: { emoji: "👏", recognition: true },
  });
  assert.equal(react.status, 200);
  const reaction = react.body.reactions.find((r) => r.userId != null);
  assert.equal(reaction.isRecognition, true);

  const notif = await prisma.notification.findFirst({ where: { employeeId: workerA1.id, type: "MANAGEMENT_RECOGNITION" } });
  assert.ok(notif, "the recognized employee should be notified");
});

test("RECOGNITION: a Worker cannot fake a management reaction by setting recognition:true on their own request", async () => {
  const groupRes = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA1 });
  const conversationId = groupRes.body.id;
  trackedConversationIds.push(conversationId);

  const msg = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorkerA1b, body: { body: "another employee's message" },
  });

  const react = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages/${msg.body.id}/reactions`, {
    method: "POST", token: tokenWorkerA1, body: { emoji: "👍", recognition: true },
  });
  assert.equal(react.status, 403);
});

test("RECOGNITION: a Supervisor cannot send a recognition reaction to another staff member's message (only Employee work is recognized)", async () => {
  const dm = await apiFetch(baseUrl, `/api/conversations/staff-contacts/${rmA.id}`, { token: tokenAdmin });
  assert.equal(dm.status, 200);
  const conversationId = dm.body.id;
  trackedConversationIds.push(conversationId);

  const msg = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenRmA, body: { body: "a message from staff, not an employee" },
  });
  assert.equal(msg.status, 201);

  const react = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages/${msg.body.id}/reactions`, {
    method: "POST", token: tokenAdmin, body: { emoji: "👏", recognition: true },
  });
  assert.equal(react.status, 403);
});
