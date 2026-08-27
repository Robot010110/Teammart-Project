// conversationMedia.test.js — Group Information's real Media/Voice/Files
// browser (GET /api/conversations/:id/media), backed directly by real
// Message rows — never a fabricated category. This schema only supports
// image/voice/file attachments (no video type), so only those three are
// ever returned.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, marketB, worker, outsiderWorker;
let tokenWorker, tokenOutsider;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94401);
  const supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  marketB = await makeMarket({ zoneId: zone.id });

  worker = await makeEmployee({ marketId: market.id, name: "Media Worker" });
  outsiderWorker = await makeEmployee({ marketId: marketB.id, name: "Media Outsider" });

  tokenWorker = tokenForEmployee(worker);
  tokenOutsider = tokenForEmployee(outsiderWorker);
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

test("MEDIA: starts empty for a conversation with only text messages", async () => {
  const group = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorker });
  await apiFetch(baseUrl, `/api/conversations/${group.body.id}/messages`, { method: "POST", token: tokenWorker, body: { body: "just text" } });

  const media = await apiFetch(baseUrl, `/api/conversations/${group.body.id}/media`, { token: tokenWorker });
  assert.equal(media.status, 200);
  assert.deepEqual(media.body, { images: [], voice: [], files: [] });
});

test("MEDIA: an image message appears under images with the real sender name, a voice message under voice, a file under files", async () => {
  const group = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorker });
  const conversationId = group.body.id;

  await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorker, body: { body: "", imageUrl: "https://example.com/photo.png" },
  });
  await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorker,
    body: { body: "", attachmentType: "VOICE", attachmentUrl: "https://example.com/voice.webm", attachmentDurationSec: 12 },
  });
  await apiFetch(baseUrl, `/api/conversations/${conversationId}/messages`, {
    method: "POST", token: tokenWorker,
    body: { body: "", attachmentType: "FILE", attachmentUrl: "https://example.com/doc.pdf", attachmentName: "doc.pdf", attachmentSize: 4096 },
  });

  const media = await apiFetch(baseUrl, `/api/conversations/${conversationId}/media`, { token: tokenWorker });
  assert.equal(media.status, 200);
  assert.equal(media.body.images.length, 1);
  assert.equal(media.body.images[0].url, "https://example.com/photo.png");
  assert.equal(media.body.images[0].senderName, "Media Worker");

  assert.equal(media.body.voice.length, 1);
  assert.equal(media.body.voice[0].durationSec, 12);

  assert.equal(media.body.files.length, 1);
  assert.equal(media.body.files[0].name, "doc.pdf");
  assert.equal(media.body.files[0].size, 4096);

  // No fabricated "videos" category — this schema doesn't support one.
  assert.ok(!("videos" in media.body));
});

test("MEDIA IDOR: an employee outside the market cannot browse this market's media", async () => {
  const group = await apiFetch(baseUrl, "/api/conversations/market-group", { token: tokenWorker });
  const res = await apiFetch(baseUrl, `/api/conversations/${group.body.id}/media`, { token: tokenOutsider });
  assert.equal(res.status, 404);
});
