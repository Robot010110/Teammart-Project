// messageSeenBy.test.js — real per-message "Seen by" reader list for
// group conversations, derived from ConversationRead (see
// chatController.getMessageSeenBy's own comment for why this is derived
// rather than a new per-message-read table). Verifies it's genuinely
// per-message (not just "conversation has been opened at some point")
// and that access is still scoped to real conversation membership.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, marketB, supervisor, workerA, workerB, workerC, outsiderWorker;
let tokenWorkerA, tokenWorkerB, tokenWorkerC, tokenOutsider;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94301);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  marketB = await makeMarket({ zoneId: zone.id });

  workerA = await makeEmployee({ marketId: market.id, name: "SeenBy Worker A" });
  workerB = await makeEmployee({ marketId: market.id, name: "SeenBy Worker B" });
  workerC = await makeEmployee({ marketId: market.id, name: "SeenBy Worker C" });
  outsiderWorker = await makeEmployee({ marketId: marketB.id, name: "SeenBy Outsider" });

  tokenWorkerA = tokenForEmployee(workerA);
  tokenWorkerB = tokenForEmployee(workerB);
  tokenWorkerC = tokenForEmployee(workerC);
  tokenOutsider = tokenForEmployee(outsiderWorker);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

test("SEEN BY: a group message starts with zero readers (besides the sender, who is never listed)", async () => {
  const group = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA });
  const send = await apiFetch(baseUrl, `/api/conversations/${group.body.id}/messages`, {
    method: "POST", token: tokenWorkerA, body: { body: "First message" },
  });
  assert.equal(send.status, 201);

  const seenBy = await apiFetch(baseUrl, `/api/conversations/${group.body.id}/messages/${send.body.id}/seen-by`, { token: tokenWorkerA });
  assert.equal(seenBy.status, 200);
  assert.equal(seenBy.body.count, 0);
});

test("SEEN BY: only members who have actually marked the conversation read AFTER this message appear, by name", async () => {
  const group = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA });
  const conversationId = group.body.id;

  const send = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorkerA, body: { body: "Read-tracked message" },
  });

  // B reads (sees it); C never reads.
  const markRead = await apiFetch(baseUrl, `/api/conversations/${conversationId}/read`, { method: "POST", token: tokenWorkerB });
  assert.equal(markRead.status, 200);

  const seenBy = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages/${send.body.id}/seen-by`, { token: tokenWorkerA });
  assert.equal(seenBy.status, 200);
  assert.equal(seenBy.body.count, 1);
  assert.equal(seenBy.body.readers[0].name, "SeenBy Worker B");
  assert.equal(seenBy.body.readers[0].kind, "employee");
  assert.ok(seenBy.body.readers[0].readAt);
  assert.ok(!seenBy.body.readers.some((r) => r.name === "SeenBy Worker C"), "C never read, must not appear");
  assert.ok(!seenBy.body.readers.some((r) => r.name === "SeenBy Worker A"), "the sender is never listed as their own reader");
});

test("SEEN BY: is genuinely per-message — a reader's earlier read does not count for a message sent after it", async () => {
  const group = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA });
  const conversationId = group.body.id;

  // C reads now (nothing new to read yet)...
  await apiFetch(baseUrl, `/api/conversations/${conversationId}/read`, { method: "POST", token: tokenWorkerC });

  // ...then a NEW message is sent after that read.
  const send = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorkerA, body: { body: "Sent after C's last read" },
  });

  const seenBy = await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages/${send.body.id}/seen-by`, { token: tokenWorkerA });
  assert.ok(!seenBy.body.readers.some((r) => r.name === "SeenBy Worker C"), "C's read predates this message, so C hasn't actually seen THIS one yet");
});

test("SEEN BY IDOR: an employee outside the market cannot query seen-by for this conversation", async () => {
  const group = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA });
  const send = await apiFetch(baseUrl, `/api/conversations/${group.body.id}/messages`, {
    method: "POST", token: tokenWorkerA, body: { body: "Private to this market" },
  });

  const res = await apiFetch(baseUrl, `/api/conversations/${group.body.id}/messages/${send.body.id}/seen-by`, { token: tokenOutsider });
  assert.equal(res.status, 404, "an outsider must not even learn the conversation exists");
});

test("SEEN BY: a messageId that doesn't belong to this conversation is rejected, not leaked from elsewhere", async () => {
  const groupA = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorkerA });
  const groupOutsider = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenOutsider });
  const sendOutsider = await apiFetch(baseUrl, `/api/conversations/${groupOutsider.body.id}/messages`, {
    method: "POST", token: tokenOutsider, body: { body: "Message in a different market" },
  });

  const res = await apiFetch(baseUrl, `/api/conversations/${groupA.body.id}/messages/${sendOutsider.body.id}/seen-by`, { token: tokenWorkerA });
  assert.equal(res.status, 404);
});
