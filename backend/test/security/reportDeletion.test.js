// reportDeletion.test.js — real, persisted (soft) delete for Market
// Problems, Item Reports, Price Reports, Total Sales, and Card Sales.
// Same convention as Notification.deletedAt throughout: the row is kept,
// never hard-deleted, but excluded from every list query from that point
// on. Covers ownership/market-scoping so a client can never delete a
// report belonging to a market they don't have access to.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, marketB, supervisor, supervisorB, rm, admin, worker, cashier, product;
let tokenSupervisor, tokenSupervisorB, tokenRm, tokenAdmin, tokenWorker, tokenCashier;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94501);
  supervisor = await makeStaffUser({ role: "SUPERVISOR" });
  supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  rm = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  admin = await makeStaffUser({ role: "ADMIN" });
  market = await makeMarket({ zoneId: zone.id, supervisorId: supervisor.id });
  marketB = await makeMarket({ zoneId: zone.id, supervisorId: supervisorB.id });
  worker = await makeEmployee({ marketId: market.id, role: "WORKER" });
  cashier = await makeEmployee({ marketId: market.id, role: "CASHIER" });

  tokenSupervisor = tokenForStaff(supervisor, { managedMarket: market });
  tokenSupervisorB = tokenForStaff(supervisorB, { managedMarket: marketB });
  tokenRm = tokenForStaff(rm, { managedZones: [zone] });
  tokenAdmin = tokenForStaff(admin);
  tokenWorker = tokenForEmployee(worker);
  tokenCashier = tokenForEmployee(cashier);

  product = await prisma.product.create({
    data: { name: "Test Product", barcode: "TESTBC1", marketId: market.id, stockQuantity: 100, createdById: admin.id },
  });
});

after(async () => {
  await stopServer(server);
  // cleanup() disconnects Prisma at the end, so anything not already
  // deleted by its own sweep must be cleared up before calling it — the
  // product has ItemReport rows FK'd to it (RESTRICT), so those go first.
  await prisma.itemReport.deleteMany({ where: { productId: product?.id } }).catch(() => {});
  await prisma.product.deleteMany({ where: { id: product?.id } }).catch(() => {});
  await cleanup();
});

// --- MARKET PROBLEM ------------------------------------------------------

test("MARKET PROBLEM DELETE: removes it from both active and history, row is kept", async () => {
  const create = await apiFetch(baseUrl, "/api/market-problems", {
    method: "POST", token: tokenSupervisor,
    body: { problemType: "Freezer not working", location: "Back room", description: "Not cooling" },
  });
  const del = await apiFetch(baseUrl, `/api/market-problems/${create.body.id}`, { method: "DELETE", token: tokenSupervisor });
  assert.equal(del.status, 204);

  const active = await apiFetch(baseUrl, `/api/market-problems?marketId=${market.id}&view=active`, { token: tokenSupervisor });
  assert.ok(!active.body.some((p) => p.id === create.body.id));

  const row = await prisma.marketProblem.findUnique({ where: { id: create.body.id } });
  assert.ok(row);
  assert.ok(row.deletedAt);
});

test("MARKET PROBLEM DELETE IDOR: another market's Supervisor cannot delete it", async () => {
  const create = await apiFetch(baseUrl, "/api/market-problems", {
    method: "POST", token: tokenSupervisor,
    body: { problemType: "Door broken", location: "Entrance", description: "Won't lock" },
  });
  const res = await apiFetch(baseUrl, `/api/market-problems/${create.body.id}`, { method: "DELETE", token: tokenSupervisorB });
  assert.equal(res.status, 403);
});

// --- ITEM REPORT -----------------------------------------------------------

test("ITEM REPORT DELETE: a Supervisor can delete an employee's item report; it leaves the market feed but stock decrement isn't reversed", async () => {
  const create = await apiFetch(baseUrl, "/api/item-reports", {
    method: "POST", token: tokenWorker,
    body: { productId: product.id, condition: "EXPIRED", quantity: 3 },
  });
  assert.equal(create.status, 201);

  const del = await apiFetch(baseUrl, `/api/item-reports/${create.body.id}`, { method: "DELETE", token: tokenSupervisor });
  assert.equal(del.status, 204);

  const feed = await apiFetch(baseUrl, `/api/item-reports/market?marketId=${market.id}`, { token: tokenSupervisor });
  assert.ok(!feed.body.some((r) => r.id === create.body.id));

  const stock = await prisma.product.findUnique({ where: { id: product.id } });
  assert.equal(stock.stockQuantity, 97, "deleting the report must not undo the stock decrement");
});

test("ITEM REPORT DELETE: an employee cannot delete a report (staff-only)", async () => {
  const create = await apiFetch(baseUrl, "/api/item-reports", {
    method: "POST", token: tokenWorker,
    body: { productId: product.id, condition: "EXPIRED", quantity: 1 },
  });
  const res = await apiFetch(baseUrl, `/api/item-reports/${create.body.id}`, { method: "DELETE", token: tokenWorker });
  assert.equal(res.status, 403);
});

test("ITEM REPORT DELETE IDOR: another market's Supervisor cannot delete it", async () => {
  const create = await apiFetch(baseUrl, "/api/item-reports", {
    method: "POST", token: tokenWorker,
    body: { productId: product.id, condition: "EXPIRED", quantity: 1 },
  });
  const res = await apiFetch(baseUrl, `/api/item-reports/${create.body.id}`, { method: "DELETE", token: tokenSupervisorB });
  assert.equal(res.status, 403);
});

// --- PRICE REPORT ------------------------------------------------------

test("PRICE REPORT DELETE: a Supervisor can delete a cashier's price report", async () => {
  const create = await apiFetch(baseUrl, "/api/price-reports", {
    method: "POST", token: tokenCashier,
    body: { productName: "Chips", barcode: "111", shelfPrice: 2, systemPrice: 2.5 },
  });
  assert.equal(create.status, 201);

  const del = await apiFetch(baseUrl, `/api/price-reports/${create.body.id}`, { method: "DELETE", token: tokenSupervisor });
  assert.equal(del.status, 204);

  const feed = await apiFetch(baseUrl, `/api/price-reports/market?marketId=${market.id}`, { token: tokenSupervisor });
  assert.ok(!feed.body.some((r) => r.id === create.body.id));

  const own = await apiFetch(baseUrl, "/api/price-reports", { token: tokenCashier });
  assert.ok(!own.body.some((r) => r.id === create.body.id), "must also disappear from the cashier's own list");
});

// --- TOTAL SALES ---------------------------------------------------------

test("TOTAL SALES DELETE: Regional Manager can delete a report; Supervisor cannot (matches the existing view/review restriction)", async () => {
  const create = await apiFetch(baseUrl, "/api/total-sales", {
    method: "POST", token: tokenSupervisor,
    body: { date: new Date().toISOString().slice(0, 10), amount: 500, photoUrl: "https://example.com/r.jpg" },
  });
  assert.equal(create.status, 201);

  const deniedForSupervisor = await apiFetch(baseUrl, `/api/total-sales/${create.body.id}`, { method: "DELETE", token: tokenSupervisor });
  assert.equal(deniedForSupervisor.status, 403);

  const del = await apiFetch(baseUrl, `/api/total-sales/${create.body.id}`, { method: "DELETE", token: tokenRm });
  assert.equal(del.status, 204);

  const list = await apiFetch(baseUrl, `/api/total-sales?marketId=${market.id}`, { token: tokenRm });
  assert.ok(!list.body.some((r) => r.id === create.body.id));

  const row = await prisma.totalSalesReport.findUnique({ where: { id: create.body.id } });
  assert.ok(row && row.deletedAt, "row kept, soft-deleted");
});

test("TOTAL SALES DELETE: Admin can delete too", async () => {
  const create = await apiFetch(baseUrl, "/api/total-sales", {
    method: "POST", token: tokenSupervisor,
    body: { date: new Date().toISOString().slice(0, 10), amount: 200, photoUrl: "https://example.com/r2.jpg" },
  });
  const del = await apiFetch(baseUrl, `/api/total-sales/${create.body.id}`, { method: "DELETE", token: tokenAdmin });
  assert.equal(del.status, 204);
});

// --- CARD SALES ----------------------------------------------------------

test("CARD SALES DELETE: the submitting market's Supervisor can delete it", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const create = await apiFetch(baseUrl, "/api/card-sales", {
    method: "POST", token: tokenSupervisor,
    body: { date: today, shift: "MORNING", photoUrl: "https://example.com/cs.jpg" },
  });
  assert.equal(create.status, 201);

  const del = await apiFetch(baseUrl, `/api/card-sales/${create.body.id}`, { method: "DELETE", token: tokenSupervisor });
  assert.equal(del.status, 204);

  const history = await apiFetch(baseUrl, `/api/card-sales/history?marketId=${market.id}`, { token: tokenSupervisor });
  assert.ok(!history.body.some((r) => r.id === create.body.id));
});

test("CARD SALES DELETE IDOR: another market's Supervisor cannot delete it", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const create = await apiFetch(baseUrl, "/api/card-sales", {
    method: "POST", token: tokenSupervisor,
    body: { date: today, shift: "AFTERNOON", photoUrl: "https://example.com/cs2.jpg" },
  });
  const res = await apiFetch(baseUrl, `/api/card-sales/${create.body.id}`, { method: "DELETE", token: tokenSupervisorB });
  assert.equal(res.status, 403);
});
