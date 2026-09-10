// kochOperation.test.js — Koch Operation (addition-only feature).
// Covers both submission shapes (Worker: operation type + photo; Cashier:
// multiple products + receipt photo), that identity/market/department are
// always derived from the AUTHENTICATED employee (never trusted from the
// request body), that a submission auto-posts into the market's own
// KOCH_OPERATION conversation, and cross-market/role IDOR.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeMarket, makeEmployee, tokenForEmployee, makeStaffUser, tokenForStaff, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, marketB;
let worker, cashier, workerB;
let tokenWorker, tokenCashier, tokenWorkerB;
let supervisor, tokenSupervisor;
let kochProduct;

// Rows this file creates that the shared cleanup() doesn't know about
// (KochOperation/KochOperationProduct have no-cascade FKs to
// Employee/Market — same class of gap MarketProblem/ItemReport already
// had before their own cleanup sweeps were added). Cleaned up in this
// file's own after() hook, before the shared cleanup() runs, so this
// stays entirely self-contained rather than touching shared test
// infrastructure other suites depend on.
const kochOperationIds = [];

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94201);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  marketB = await makeMarket({ zoneId: zone.id });
  worker = await makeEmployee({ marketId: market.id, role: "WORKER" });
  cashier = await makeEmployee({ marketId: market.id, role: "CASHIER" });
  workerB = await makeEmployee({ marketId: marketB.id, role: "WORKER" });
  await prisma.employee.update({ where: { id: worker.id }, data: { department: "Bakery" } });
  tokenWorker = tokenForEmployee(worker);
  tokenCashier = tokenForEmployee(cashier);
  tokenWorkerB = tokenForEmployee(workerB);
  tokenSupervisor = tokenForStaff(supervisor, { managedMarket: market });

  kochProduct = await prisma.kochProduct.findFirst({ where: { active: true } });
  assert.ok(kochProduct, "seed must have created at least one active KochProduct for these tests to run against");
});

after(async () => {
  await prisma.kochOperationProduct.deleteMany({ where: { kochOperationId: { in: kochOperationIds } } }).catch(() => {});
  await prisma.kochOperation.deleteMany({ where: { id: { in: kochOperationIds } } }).catch(() => {});
  await stopServer(server);
  await cleanup();
});

test("PRODUCTS: GET /api/koch-operations/products returns the real seeded catalog, never hardcoded", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations/products", { token: tokenWorker });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.some((p) => p.id === kochProduct.id));
  assert.ok(res.body.every((p) => p.active !== false));
});

test("WORKER CREATE: submitting Customization auto-fills identity/market/department and starts SUBMITTED", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenWorker,
    body: { operationType: "CUSTOMIZATION", evidenceUrl: "https://example.test/uploads/worker-photo.jpg" },
  });
  assert.equal(res.status, 201);
  kochOperationIds.push(res.body.id);

  assert.equal(res.body.employeeId, worker.id);
  assert.equal(res.body.marketId, market.id);
  assert.equal(res.body.department, "Bakery");
  assert.equal(res.body.operationType, "CUSTOMIZATION");
  assert.equal(res.body.status, "SUBMITTED");
  assert.equal(res.body.evidenceUrl, "https://example.test/uploads/worker-photo.jpg");
  assert.equal(res.body.products.length, 0);
});

test("WORKER CREATE: Discount Customization is a real, separate operation type", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenWorker,
    body: { operationType: "DISCOUNT_CUSTOMIZATION", evidenceUrl: "https://example.test/uploads/worker-photo-2.jpg" },
  });
  assert.equal(res.status, 201);
  kochOperationIds.push(res.body.id);
  assert.equal(res.body.operationType, "DISCOUNT_CUSTOMIZATION");
});

test("WORKER VALIDATION: no operation type selected is rejected", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenWorker,
    body: { evidenceUrl: "https://example.test/uploads/worker-photo-3.jpg" },
  });
  assert.equal(res.status, 400);
});

test("WORKER CHAT: a submission auto-posts a structured message into this market's KOCH_OPERATION group, never requiring the employee to open Chat", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenWorker,
    body: { operationType: "CUSTOMIZATION", evidenceUrl: "https://example.test/uploads/worker-photo-4.jpg" },
  });
  assert.equal(res.status, 201);
  kochOperationIds.push(res.body.id);
  assert.ok(res.body.conversationId);
  assert.ok(res.body.messageId);

  const conversation = await prisma.conversation.findUnique({ where: { id: res.body.conversationId } });
  assert.equal(conversation.type, "KOCH_OPERATION");
  assert.equal(conversation.marketId, market.id);

  const message = await prisma.message.findUnique({ where: { id: res.body.messageId } });
  assert.equal(message.senderEmployeeId, worker.id);
  assert.equal(message.imageUrl, "https://example.test/uploads/worker-photo-4.jpg");
  assert.match(message.body, /Koch Operation/);
  assert.match(message.body, /Worker: /);
  assert.match(message.body, /Customization/);
});

test("CASHIER CREATE: selecting multiple products records each with quantity and posts the product list to chat", async () => {
  const secondProduct = await prisma.kochProduct.findFirst({ where: { active: true, id: { not: kochProduct.id } } });
  const products = secondProduct
    ? [{ kochProductId: kochProduct.id, quantity: 2 }, { kochProductId: secondProduct.id, quantity: 1 }]
    : [{ kochProductId: kochProduct.id, quantity: 2 }];

  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenCashier,
    body: { evidenceUrl: "https://example.test/uploads/receipt.jpg", products },
  });
  assert.equal(res.status, 201);
  kochOperationIds.push(res.body.id);

  assert.equal(res.body.employeeId, cashier.id);
  assert.equal(res.body.marketId, market.id);
  assert.equal(res.body.operationType, null);
  assert.equal(res.body.products.length, products.length);
  assert.equal(res.body.products.find((p) => p.kochProductId === kochProduct.id).quantity, 2);

  const message = await prisma.message.findUnique({ where: { id: res.body.messageId } });
  assert.match(message.body, /Cashier: /);
  assert.match(message.body, /Products:/);
  assert.match(message.body, new RegExp(kochProduct.name));
});

test("CASHIER VALIDATION: submitting with no products selected is rejected", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenCashier,
    body: { evidenceUrl: "https://example.test/uploads/receipt-2.jpg", products: [] },
  });
  assert.equal(res.status, 400);
});

test("CASHIER VALIDATION: a fabricated/unknown kochProductId is rejected, never silently dropped or trusted", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenCashier,
    body: { evidenceUrl: "https://example.test/uploads/receipt-3.jpg", products: [{ kochProductId: "not-a-real-product-id", quantity: 1 }] },
  });
  assert.equal(res.status, 400);
});

test("IDENTITY: a Cashier cannot submit a Worker-shaped operation just by sending operationType — role is decided server-side from the authenticated employee, never the request", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenCashier,
    body: { operationType: "CUSTOMIZATION", evidenceUrl: "https://example.test/uploads/receipt-4.jpg" },
  });
  // Cashier role always requires `products` server-side, regardless of an
  // operationType also present in the body — the branch is decided by
  // employee.role, not by which fields the client happened to send.
  assert.equal(res.status, 400);
});

test("HISTORY: an employee only ever sees their own Koch Operation submissions", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", { token: tokenWorker });
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 0);
  assert.ok(res.body.every((op) => op.employeeId === worker.id));
});

test("IDOR: a market B employee's history never includes market A's operations", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", { token: tokenWorkerB });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 0);
});

test("CHAT ACCESS: the market's Supervisor can access the Koch Operation group (existing staffCanAccessMarket permissions, not a new RBAC system)", async () => {
  const worker0p = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenWorker,
    body: { operationType: "CUSTOMIZATION", evidenceUrl: "https://example.test/uploads/worker-photo-5.jpg" },
  });
  kochOperationIds.push(worker0p.body.id);

  const res = await apiFetch(baseUrl, `/api/conversations/${worker0p.body.conversationId}/messages`, { token: tokenSupervisor });
  assert.equal(res.status, 200);
  assert.ok(res.body.messages.some((m) => m.id === worker0p.body.messageId));
});

test("CHAT ACCESS: a Supervisor of a DIFFERENT market cannot access this market's Koch Operation group", async () => {
  const otherSupervisor = await makeStaffUser({ role: "SUPERVISOR" });
  const otherToken = tokenForStaff(otherSupervisor, { managedMarket: marketB });

  const op = await prisma.kochOperation.findFirst({ where: { employeeId: worker.id }, select: { conversationId: true } });
  const res = await apiFetch(baseUrl, `/api/conversations/${op.conversationId}/messages`, { token: otherToken });
  assert.equal(res.status, 404);

  await prisma.user.delete({ where: { id: otherSupervisor.id } }).catch(() => {});
});

test("AUTH: an unauthenticated request is rejected", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    body: { operationType: "CUSTOMIZATION", evidenceUrl: "https://example.test/uploads/x.jpg" },
  });
  assert.equal(res.status, 401);
});

test("AUTH: a staff (non-employee) token cannot submit a Koch Operation", async () => {
  const res = await apiFetch(baseUrl, "/api/koch-operations", {
    method: "POST",
    token: tokenSupervisor,
    body: { operationType: "CUSTOMIZATION", evidenceUrl: "https://example.test/uploads/x.jpg" },
  });
  assert.equal(res.status, 403);
});
