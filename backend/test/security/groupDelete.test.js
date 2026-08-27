// groupDelete.test.js — DELETE /api/conversations/:id, a real hard
// delete of a CUSTOM_GROUP (unlike every report-deletion endpoint
// elsewhere in this app, a chat group has no audit-retention
// requirement — see chatController.deleteGroup's own comment). Admin-
// only (requireGroupAdmin — a real ConversationMember.isAdmin=true row,
// never role alone), and only ever matches CUSTOM_GROUP, never a
// market/zone's shared implicit channel.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, supervisor, memberEmployee;
let tokenSupervisor, tokenMemberEmployee;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94701);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  memberEmployee = await makeEmployee({ marketId: market.id, role: "WORKER" });

  tokenSupervisor = tokenForStaff(supervisor, { managedMarket: market });
  tokenMemberEmployee = tokenForEmployee(memberEmployee);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

async function createGroup(token) {
  const res = await apiFetch(baseUrl, "/api/conversations/groups", {
    method: "POST", token,
    body: { name: "Delete-Test Group", marketId: market.id, memberEmployeeIds: [memberEmployee.id], groupType: "NORMAL" },
  });
  assert.equal(res.status, 201);
  return res.body;
}

test("GROUP DELETE: the creating admin can delete the group; messages/reactions/members are all really gone", async () => {
  const group = await createGroup(tokenSupervisor);

  const send = await apiFetch(baseUrl, `/api/conversations/${group.id}/messages`, {
    method: "POST", token: tokenSupervisor, body: { body: "Hello group" },
  });
  assert.equal(send.status, 201);
  await apiFetch(baseUrl, `/api/conversations/${group.id}/messages/${send.body.id}/reactions`, {
    method: "POST", token: tokenMemberEmployee, body: { emoji: "👍" },
  });

  const del = await apiFetch(baseUrl, `/api/conversations/${group.id}`, { method: "DELETE", token: tokenSupervisor });
  assert.equal(del.status, 204);

  const conversationGone = await prisma.conversation.findUnique({ where: { id: group.id } });
  assert.equal(conversationGone, null);
  const messageGone = await prisma.message.findUnique({ where: { id: send.body.id } });
  assert.equal(messageGone, null);
  const reactionsGone = await prisma.messageReaction.findMany({ where: { messageId: send.body.id } });
  assert.equal(reactionsGone.length, 0);
  const membersGone = await prisma.conversationMember.findMany({ where: { conversationId: group.id } });
  assert.equal(membersGone.length, 0);
});

test("GROUP DELETE: a non-admin member cannot delete the group", async () => {
  const group = await createGroup(tokenSupervisor);

  const res = await apiFetch(baseUrl, `/api/conversations/${group.id}`, { method: "DELETE", token: tokenMemberEmployee });
  assert.equal(res.status, 403);

  const stillThere = await prisma.conversation.findUnique({ where: { id: group.id } });
  assert.ok(stillThere, "the group must survive a non-admin's delete attempt");

  await apiFetch(baseUrl, `/api/conversations/${group.id}`, { method: "DELETE", token: tokenSupervisor });
});

test("GROUP DELETE: a member promoted to admin (not the original creator) can delete it", async () => {
  const group = await createGroup(tokenSupervisor);
  const members = await apiFetch(baseUrl, `/api/conversations/${group.id}/members`, { token: tokenSupervisor });
  const memberRow = members.body.find((m) => m.employeeId === memberEmployee.id);

  const promote = await apiFetch(baseUrl, `/api/conversations/${group.id}/members/${memberRow.id}`, {
    method: "PATCH", token: tokenSupervisor, body: { isAdmin: true },
  });
  assert.equal(promote.status, 200);

  const del = await apiFetch(baseUrl, `/api/conversations/${group.id}`, { method: "DELETE", token: tokenMemberEmployee });
  assert.equal(del.status, 204);
});

test("GROUP DELETE: cannot be used on a non-CUSTOM_GROUP conversation (e.g. the market's implicit Market Group)", async () => {
  const marketGroup = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenMemberEmployee });
  const res = await apiFetch(baseUrl, `/api/conversations/${marketGroup.body.id}`, { method: "DELETE", token: tokenSupervisor });
  assert.equal(res.status, 404);

  const stillThere = await prisma.conversation.findUnique({ where: { id: marketGroup.body.id } });
  assert.ok(stillThere, "the market's shared channel must never be deletable this way");
});

test("GROUP DELETE: a nonexistent group id returns 404", async () => {
  const res = await apiFetch(baseUrl, "/api/conversations/does-not-exist", { method: "DELETE", token: tokenSupervisor });
  assert.equal(res.status, 404);
});
