// fileAuthorization.test.js — the most important suite in this repo per
// the task that added it: "knowing the URL is not enough." Covers both
// upload-time validation (E) and, more importantly, read-time
// authorization (F, G) — a private file must be resolvable only by
// whoever the underlying business resource says is allowed to see it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch, rawFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, trackActivity, trackUploadedFile, trackConversation, cleanup,
} from "../helpers.js";

let server, baseUrl;

// A minimal real 1x1 PNG — needed for the magic-byte signature check in
// uploadsController.js to accept it as a genuine image.
const REAL_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000376ef9240000000a49444154789c6300010000050001a5f645400000000049454e44ae426082",
  "hex"
);

function pngFormData() {
  const fd = new FormData();
  fd.append("file", new Blob([REAL_PNG], { type: "image/png" }), "test.png");
  return fd;
}

before(async () => {
  ({ server, baseUrl } = await startServer());
});

after(async () => {
  await stopServer(server);
  await cleanup();
});

// --- E. Upload authorization -------------------------------------------
test("E: authenticated user can upload a valid file", async () => {
  const zone = await makeZone(90101);
  const market = await makeMarket({ zoneId: zone.id });
  const employee = await makeEmployee({ marketId: market.id });
  const token = tokenForEmployee(employee);

  const { status, body } = await apiFetch(baseUrl, "/api/uploads", { method: "POST", token, formData: pngFormData() });
  assert.equal(status, 201);
  assert.match(body.url, /\/api\/uploads\/[0-9a-f-]{36}\.png$/);
  trackUploadedFile(body.url.split("/").pop());
});

test("E: unauthenticated upload is denied", async () => {
  const { status } = await apiFetch(baseUrl, "/api/uploads", { method: "POST", formData: pngFormData() });
  assert.equal(status, 401);
});

test("E: an unsupported file type is rejected", async () => {
  const zone = await makeZone(90102);
  const market = await makeMarket({ zoneId: zone.id });
  const employee = await makeEmployee({ marketId: market.id });
  const token = tokenForEmployee(employee);

  const fd = new FormData();
  fd.append("file", new Blob([Buffer.from("not an image")], { type: "text/plain" }), "test.txt");
  const { status } = await apiFetch(baseUrl, "/api/uploads", { method: "POST", token, formData: fd });
  assert.equal(status, 400);
});

test("E: an oversized file is rejected", async () => {
  const zone = await makeZone(90103);
  const market = await makeMarket({ zoneId: zone.id });
  const employee = await makeEmployee({ marketId: market.id });
  const token = tokenForEmployee(employee);

  const oversized = Buffer.alloc(16 * 1024 * 1024, 0); // 16MB > the 15MB limit
  const fd = new FormData();
  fd.append("file", new Blob([oversized], { type: "image/png" }), "big.png");
  const { status } = await apiFetch(baseUrl, "/api/uploads", { method: "POST", token, formData: fd });
  assert.equal(status, 400);
});

test("E: a spoofed file signature is rejected (claims image/png, isn't one)", async () => {
  const zone = await makeZone(90104);
  const market = await makeMarket({ zoneId: zone.id });
  const employee = await makeEmployee({ marketId: market.id });
  const token = tokenForEmployee(employee);

  const fd = new FormData();
  fd.append("file", new Blob([Buffer.from("<script>alert(1)</script>")], { type: "image/png" }), "fake.png");
  const { status, body } = await apiFetch(baseUrl, "/api/uploads", { method: "POST", token, formData: fd });
  assert.equal(status, 400);
  assert.match(body.error, /does not match its declared type/i);
});

// --- F. File download authorization (the most important group) --------
test("F: full access matrix for a private Activity image", async () => {
  const zoneA = await makeZone(90105);
  const zoneB = await makeZone(90106);
  const supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  const supervisorOther = await makeStaffUser({ role: "SUPERVISOR" });
  const rmOwning = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  const rmOutside = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  const admin = await makeStaffUser({ role: "ADMIN" });

  const marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id });
  const marketOther = await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorOther.id });

  const employeeA = await makeEmployee({ marketId: marketA.id });
  const employeeOther = await makeEmployee({ marketId: marketOther.id });

  const tokenEmployeeA = tokenForEmployee(employeeA);
  const tokenEmployeeOther = tokenForEmployee(employeeOther);
  const tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
  const tokenSupervisorOther = tokenForStaff(supervisorOther, { managedMarket: marketOther });
  const tokenRmOwning = tokenForStaff(rmOwning, { managedZones: [zoneA] });
  const tokenRmOutside = tokenForStaff(rmOutside, { managedZones: [zoneB] });
  const tokenAdmin = tokenForStaff(admin);

  // Create the private file belonging to Employee A, exactly as the real
  // upload -> attach flow works: upload first, then reference it from a
  // real Activity record.
  const uploadRes = await apiFetch(baseUrl, "/api/uploads", { method: "POST", token: tokenEmployeeA, formData: pngFormData() });
  assert.equal(uploadRes.status, 201);
  const filename = uploadRes.body.url.split("/").pop();
  trackUploadedFile(filename);

  const activity = await prisma.activity.create({
    data: { category: "SHELF_CLEANING", date: new Date(), time: "9:00 AM", employeeId: employeeA.id, status: "DRAFT" },
  });
  trackActivity(activity.id);
  await prisma.activityImage.create({ data: { url: uploadRes.body.url, activityId: activity.id } });

  const path = `/api/uploads/${filename}`;

  const cases = [
    ["Employee A (owner)", tokenEmployeeA, 200],
    ["Employee B (different employee)", tokenEmployeeOther, 403],
    ["Supervisor of Employee A's market", tokenSupervisorA, 200],
    ["Supervisor of a different market", tokenSupervisorOther, 403],
    ["Regional Manager owning the zone", tokenRmOwning, 200],
    ["Regional Manager outside the zone", tokenRmOutside, 403],
    ["Admin", tokenAdmin, 200],
  ];

  for (const [label, token, expected] of cases) {
    const res = await rawFetch(baseUrl, path, { token });
    assert.equal(res.status, expected, `${label} expected ${expected}, got ${res.status}`);
  }

  const unauth = await rawFetch(baseUrl, path);
  assert.equal(unauth.status, 401, "unauthenticated request expected 401");
});

test("F: a file URL cannot be reached via the old public static path", async () => {
  const zone = await makeZone(90107);
  const market = await makeMarket({ zoneId: zone.id });
  const employee = await makeEmployee({ marketId: market.id });
  const token = tokenForEmployee(employee);

  const uploadRes = await apiFetch(baseUrl, "/api/uploads", { method: "POST", token, formData: pngFormData() });
  const filename = uploadRes.body.url.split("/").pop();
  trackUploadedFile(filename);

  const res = await rawFetch(baseUrl, `/uploads/${filename}`);
  assert.equal(res.status, 404, "the old public /uploads/* static mount must no longer exist");
});

test("F: path traversal in the filename param is rejected, not resolved", async () => {
  const zone = await makeZone(90108);
  const market = await makeMarket({ zoneId: zone.id });
  const employee = await makeEmployee({ marketId: market.id });
  const token = tokenForEmployee(employee);

  const res = await rawFetch(baseUrl, "/api/uploads/..%2f..%2f..%2fbackend%2f.env", { token });
  assert.equal(res.status, 400);
});

test("F: a nonexistent (but well-formed) file id returns 404, not 403", async () => {
  const zone = await makeZone(90109);
  const market = await makeMarket({ zoneId: zone.id });
  const employee = await makeEmployee({ marketId: market.id });
  const token = tokenForEmployee(employee);

  const res = await rawFetch(baseUrl, "/api/uploads/00000000-0000-0000-0000-000000000000.png", { token });
  assert.equal(res.status, 404);
});

// --- G. Chat attachment authorization -----------------------------------
test("G: conversation member can access an attachment; non-member cannot", async () => {
  const zone = await makeZone(90110);
  const market = await makeMarket({ zoneId: zone.id });
  const member = await makeEmployee({ marketId: market.id });
  const nonMember = await makeEmployee({ marketId: market.id });
  const tokenMember = tokenForEmployee(member);
  const tokenNonMember = tokenForEmployee(nonMember);

  const uploadRes = await apiFetch(baseUrl, "/api/uploads", { method: "POST", token: tokenMember, formData: pngFormData() });
  const filename = uploadRes.body.url.split("/").pop();
  trackUploadedFile(filename);

  // A CUSTOM_GROUP with exactly one explicit member — the clearest,
  // least ambiguous membership model to test against (unlike
  // MARKET_GROUP/WARNINGS, which are implicitly market-wide).
  const conversation = await prisma.conversation.create({
    data: { type: "CUSTOM_GROUP", name: `${filename}-group`, marketId: market.id },
  });
  trackConversation(conversation.id);
  await prisma.conversationMember.create({ data: { conversationId: conversation.id, employeeId: member.id, isAdmin: true } });
  await prisma.message.create({
    data: { conversationId: conversation.id, body: "", imageUrl: uploadRes.body.url, senderEmployeeId: member.id },
  });

  const path = `/api/uploads/${filename}`;

  const memberRes = await rawFetch(baseUrl, path, { token: tokenMember });
  assert.equal(memberRes.status, 200, "conversation member should be able to access the attachment");

  const nonMemberRes = await rawFetch(baseUrl, path, { token: tokenNonMember });
  assert.equal(nonMemberRes.status, 403, "a non-member must not access the attachment");

  const unauthRes = await rawFetch(baseUrl, path);
  assert.equal(unauthRes.status, 401, "unauthenticated request must be denied");
});
