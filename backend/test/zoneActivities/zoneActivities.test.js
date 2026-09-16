// zoneActivities.test.js — Zone Activities (Regional Manager): a
// read-only aggregation layer over EXISTING Activity/ItemReport/
// WastedOverallReport/PriceReport/MarketProblem records. See the approved
// plan (C:\Users\Lenovo\.claude\plans\first-thing-you-gonna-harmonic-charm.md)
// for the full category-mapping reasoning this test verifies.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import {
  prisma, TAG, startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, trackEmployee, cleanup,
} from "../helpers.js";
import { startOfWeek } from "../../src/utils/period.js";

let server, baseUrl;
let zoneA, zoneB, marketA, marketB;
let admin, tokenAdmin;
let rmA, tokenRmA; // manages zoneA only
let rmB, tokenRmB; // manages zoneB only
let workerA, tokenWorkerA;
let cashierA, tokenCashierA;
let supervisorA, tokenSupervisorA;

async function makeProduct(marketId) {
  return prisma.product.create({
    data: { barcode: `${TAG}-${randomUUID().slice(0, 8)}`, name: `${TAG} product`, marketId, createdById: admin.id },
  });
}

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(94930);
  zoneB = await makeZone(94931);

  admin = await makeStaffUser({ role: "ADMIN" });
  rmA = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  rmB = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });

  marketA = await makeMarket({ zoneId: zoneA.id, name: `${TAG} Market A` });
  marketB = await makeMarket({ zoneId: zoneB.id, name: `${TAG} Market B` });

  workerA = await makeEmployee({ marketId: marketA.id, name: `${TAG} Worker A`, role: "WORKER" });
  trackEmployee(workerA.id);
  cashierA = await prisma.employee.create({
    data: {
      name: `${TAG} Cashier A`, position: "Cashier", role: "CASHIER", marketId: marketA.id,
      employeeCode: `${TAG}-cash`, passwordHash: "not-used", username: `${TAG}cashA`,
    },
  });
  trackEmployee(cashierA.id);

  tokenAdmin = tokenForStaff(admin);
  tokenRmA = tokenForStaff(rmA, { managedZones: [zoneA] });
  tokenRmB = tokenForStaff(rmB, { managedZones: [zoneB] });
  tokenWorkerA = tokenForEmployee(workerA);
  tokenCashierA = tokenForEmployee(cashierA);
  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });
});

after(async () => {
  await cleanup();
  await stopServer(server);
  await prisma.$disconnect();
});

// --- AUTHORIZATION --------------------------------------------------------

test("AUTH: Worker, Cashier, and Supervisor cannot reach either Zone Activities endpoint", async () => {
  for (const [label, token] of [["worker", tokenWorkerA], ["cashier", tokenCashierA], ["supervisor", tokenSupervisorA]]) {
    const counts = await apiFetch(baseUrl, "/api/zone-activities/counts", { token });
    assert.equal(counts.status, 403, `${label} counts`);
    const detail = await apiFetch(baseUrl, "/api/zone-activities/expired-items", { token });
    assert.equal(detail.status, 403, `${label} detail`);
  }
});

test("AUTH: an unauthenticated request is rejected", async () => {
  const { status } = await apiFetch(baseUrl, "/api/zone-activities/counts");
  assert.equal(status, 401);
});

test("AUTH: a Regional Manager cannot pass another zone's id to see its data", async () => {
  const { status } = await apiFetch(baseUrl, `/api/zone-activities/counts?zoneId=${zoneB.id}`, { token: tokenRmA });
  assert.equal(status, 403);
});

test("AUTH: category detail from another zone never leaks, even when requested directly", async () => {
  const empB = await makeEmployee({ marketId: marketB.id, name: `${TAG} zoneB-only-employee` });
  trackEmployee(empB.id);
  const product = await makeProduct(marketB.id);
  const report = await prisma.itemReport.create({
    data: { condition: "EXPIRED", quantity: 1, productId: product.id, employeeId: empB.id, marketId: marketB.id },
  });

  const { status, body } = await apiFetch(baseUrl, "/api/zone-activities/expired-items?period=month", { token: tokenRmA });
  assert.equal(status, 200);
  assert.ok(!body.records.some((r) => r.id === report.id), "Zone A's RM must never see a Zone B expired-item record");
});

// --- CATEGORY COUNTS: correctness + isolation -----------------------------

test("COUNTS: one real record of each category counts exactly once, with no cross-category contamination", async () => {
  const product = await makeProduct(marketA.id);

  await prisma.itemReport.create({
    data: { condition: "EXPIRED", quantity: 3, productId: product.id, employeeId: workerA.id, marketId: marketA.id },
  });
  await prisma.itemReport.create({
    data: { condition: "WASTED", quantity: 2, productId: product.id, employeeId: workerA.id, marketId: marketA.id },
  });
  await prisma.wastedOverallReport.create({
    data: { item: "EGGS", quantityCount: 10, employeeId: workerA.id, marketId: marketA.id, status: "PENDING" },
  });
  await prisma.priceReport.create({
    data: { productName: `${TAG} priced item`, shelfPrice: 1, systemPrice: 2, employeeId: cashierA.id, marketId: marketA.id, status: "PENDING" },
  });
  await prisma.marketProblem.create({
    data: { marketId: marketA.id, problemType: "Freezer not working", location: "Back room", description: "Not cooling", reportedByUserId: supervisorA.id },
  });

  const activityCategories = ["LABEL_CHECKING", "SHELF_CLEANING", "PRODUCT_CUSTOMIZATION", "ITEM_COUNTING", "FACING", "REFILLING", "DAILY_CLEANING"];
  for (const category of activityCategories) {
    await prisma.activity.create({
      data: { category, date: new Date(), time: "9:00 AM", status: "PENDING", employeeId: workerA.id },
    });
  }

  const { status, body } = await apiFetch(baseUrl, "/api/zone-activities/counts?period=today", { token: tokenRmA });
  assert.equal(status, 200);
  const byKey = Object.fromEntries(body.categories.map((c) => [c.key, c.count]));

  assert.equal(byKey["expired-items"], 1);
  assert.equal(byKey["waste-reports"], 2, "ItemReport(WASTED) + WastedOverallReport merged");
  assert.equal(byKey["label-checking"], 1);
  assert.equal(byKey["shelf-cleaning"], 1);
  assert.equal(byKey["customization"], 1);
  assert.equal(byKey["market-washing"], 0, "no NightShiftTaskDefinition seeded — honestly zero, not fabricated");
  assert.equal(byKey["inventory-checking"], 1);
  assert.equal(byKey["product-checking"], 1);
  assert.equal(byKey["facing"], 1);
  assert.equal(byKey["refilling"], 1);
  assert.equal(byKey["daily-cleaning"], 1);
  assert.equal(byKey["maintenance-reports"], 1);
});

test("COUNTS: a DRAFT activity does not count (not yet submitted), but PENDING/APPROVED/REJECTED all do", async () => {
  await prisma.activity.deleteMany({ where: { employeeId: workerA.id, category: "FACING" } });

  await prisma.activity.create({ data: { category: "FACING", date: new Date(), time: "9:00 AM", status: "DRAFT", employeeId: workerA.id } });
  await prisma.activity.create({ data: { category: "FACING", date: new Date(), time: "9:00 AM", status: "PENDING", employeeId: workerA.id } });
  await prisma.activity.create({ data: { category: "FACING", date: new Date(), time: "9:00 AM", status: "APPROVED", employeeId: workerA.id } });
  await prisma.activity.create({ data: { category: "FACING", date: new Date(), time: "9:00 AM", status: "REJECTED", employeeId: workerA.id } });

  const { body } = await apiFetch(baseUrl, "/api/zone-activities/counts?period=today", { token: tokenRmA });
  const byKey = Object.fromEntries(body.categories.map((c) => [c.key, c.count]));
  assert.equal(byKey["facing"], 3, "PENDING + APPROVED + REJECTED count; DRAFT does not");
});

test("COUNTS: a soft-deleted ItemReport does not count", async () => {
  const product = await makeProduct(marketA.id);
  const before = await apiFetch(baseUrl, "/api/zone-activities/counts?period=today", { token: tokenRmA });
  const beforeCount = Object.fromEntries(before.body.categories.map((c) => [c.key, c.count]))["expired-items"];

  await prisma.itemReport.create({
    data: { condition: "EXPIRED", quantity: 1, productId: product.id, employeeId: workerA.id, marketId: marketA.id, deletedAt: new Date() },
  });

  const after1 = await apiFetch(baseUrl, "/api/zone-activities/counts?period=today", { token: tokenRmA });
  const afterCount = Object.fromEntries(after1.body.categories.map((c) => [c.key, c.count]))["expired-items"];
  assert.equal(afterCount, beforeCount, "soft-deleted report must not be counted");
});

test("COUNTS: Zone B's RM never sees Zone A's records — no cross-zone contamination", async () => {
  // Zone A has real records in most categories by this point (created by
  // earlier tests in this file); Zone B has, at most, the one unrelated
  // expired-item report created by the "never leaks" test above. The
  // real assertion is that Zone B's total stays small and disjoint from
  // Zone A's much larger total, not that it's hard-zero (test order
  // elsewhere in this file legitimately adds a Zone B row).
  const [zoneAResult, zoneBResult] = await Promise.all([
    apiFetch(baseUrl, "/api/zone-activities/counts?period=today", { token: tokenRmA }),
    apiFetch(baseUrl, "/api/zone-activities/counts?period=today", { token: tokenRmB }),
  ]);
  const zoneATotal = zoneAResult.body.categories.reduce((sum, c) => sum + c.count, 0);
  const zoneBByKey = Object.fromEntries(zoneBResult.body.categories.map((c) => [c.key, c.count]));

  assert.ok(zoneATotal > 0, "sanity check: Zone A must have real records from earlier tests");
  assert.equal(zoneBByKey["waste-reports"], 0, "Zone B has never had a waste report — must not inherit Zone A's");
  assert.equal(zoneBByKey["label-checking"], 0, "Zone B has never had a label-checking activity — must not inherit Zone A's");
  assert.equal(zoneBByKey["maintenance-reports"], 0, "Zone B has never had a maintenance report — must not inherit Zone A's");
});

test("COUNTS: an RM with no assigned zone gets an honest all-zero grid, not everything", async () => {
  const rmNoZone = await makeStaffUser({ role: "REGIONAL_MANAGER" });
  const tokenNoZone = tokenForStaff(rmNoZone, { managedZones: [] });
  const { status, body } = await apiFetch(baseUrl, "/api/zone-activities/counts", { token: tokenNoZone });
  assert.equal(status, 200);
  assert.ok(body.categories.every((c) => c.count === 0));
});

// --- DATE FILTERING ---------------------------------------------------

test("DATE FILTERS: Day/Week/Month use identical boundaries for counts and detail, and a record just outside the week is excluded", async () => {
  const product = await makeProduct(marketA.id);

  // A record from exactly one day before this week's Saturday start.
  const weekStart = startOfWeek(new Date());
  const justBeforeWeek = new Date(weekStart);
  justBeforeWeek.setDate(justBeforeWeek.getDate() - 1);
  justBeforeWeek.setHours(23, 0, 0, 0);

  const oldReport = await prisma.itemReport.create({
    data: {
      condition: "EXPIRED", quantity: 1, productId: product.id, employeeId: workerA.id, marketId: marketA.id,
      reportedAt: justBeforeWeek,
    },
  });

  const weekCounts = await apiFetch(baseUrl, "/api/zone-activities/counts?period=week", { token: tokenRmA });
  const weekDetail = await apiFetch(baseUrl, "/api/zone-activities/expired-items?period=week", { token: tokenRmA });
  const weekCount = Object.fromEntries(weekCounts.body.categories.map((c) => [c.key, c.count]))["expired-items"];

  assert.equal(weekCount, weekDetail.body.total, "counts endpoint and detail endpoint must agree exactly");
  assert.ok(!weekDetail.body.records.some((r) => r.id === oldReport.id), "a record from before this week must not appear in the Week view");

  const monthCounts = await apiFetch(baseUrl, "/api/zone-activities/counts?period=month", { token: tokenRmA });
  const monthDetail = await apiFetch(baseUrl, "/api/zone-activities/expired-items?period=month", { token: tokenRmA });
  const monthCount = Object.fromEntries(monthCounts.body.categories.map((c) => [c.key, c.count]))["expired-items"];
  assert.equal(monthCount, monthDetail.body.total);
});

// --- PAGINATION ---------------------------------------------------------

test("PAGINATION: page/pageSize boundaries and total are correct", async () => {
  const product = await makeProduct(marketA.id);
  const empPag = await makeEmployee({ marketId: marketA.id, name: `${TAG} pagination-worker` });
  trackEmployee(empPag.id);

  for (let i = 0; i < 5; i++) {
    await prisma.itemReport.create({
      data: { condition: "EXPIRED", quantity: 1, productId: product.id, employeeId: empPag.id, marketId: marketA.id },
    });
  }

  const page1 = await apiFetch(baseUrl, "/api/zone-activities/expired-items?period=month&page=1&pageSize=2", { token: tokenRmA });
  assert.equal(page1.status, 200);
  assert.equal(page1.body.records.length, 2);
  assert.ok(page1.body.total >= 5);

  const allIds = new Set();
  let page = 1;
  const pageSize = 2;
  let total = Infinity;
  while ((page - 1) * pageSize < total) {
    const res = await apiFetch(baseUrl, `/api/zone-activities/expired-items?period=month&page=${page}&pageSize=${pageSize}`, { token: tokenRmA });
    total = res.body.total;
    for (const r of res.body.records) allIds.add(r.id);
    page++;
    if (page > 50) break; // safety
  }
  assert.equal(allIds.size, total, "paging through every page must yield exactly `total` unique records, no duplicates/gaps");
});

// --- MERGED WASTE REPORTS -------------------------------------------------

test("WASTE REPORTS: detail list includes both ItemReport(WASTED) and WastedOverallReport rows, each tagged with its real source", async () => {
  const { body } = await apiFetch(baseUrl, "/api/zone-activities/waste-reports?period=month", { token: tokenRmA });
  const sources = new Set(body.records.map((r) => r.source));
  assert.ok(sources.has("itemReport"), "expected at least one itemReport-sourced waste record");
  assert.ok(sources.has("wastedOverallReport"), "expected at least one wastedOverallReport-sourced waste record");
});

// --- DEPARTMENT CLOSING (placeholder only) --------------------------------

test("DEPARTMENT CLOSING: is not a valid backend category — no data, no logic exists for it", async () => {
  const { status } = await apiFetch(baseUrl, "/api/zone-activities/department-closing?period=today", { token: tokenRmA });
  assert.equal(status, 400);
});

// --- PHOTO AUTHORIZATION --------------------------------------------------

test("PHOTOS: an authorized zone RM can reach a Maintenance Report photo through the file-authorization pipeline; a different zone's RM cannot", async () => {
  const filename = `${randomUUID()}.jpg`;
  await prisma.uploadedFile.create({ data: { filename, mimetype: "image/jpeg", uploaderUserId: supervisorA.id } });
  await prisma.marketProblem.create({
    data: {
      marketId: marketA.id, problemType: "Leaking pipe", location: "Storage", description: "Water on the floor",
      photoUrl: `/api/uploads/${filename}`, reportedByUserId: supervisorA.id,
    },
  });

  const authorized = await apiFetch(baseUrl, `/api/uploads/${filename}`, { token: tokenRmA });
  assert.notEqual(authorized.status, 403, "Zone A's RM must not be blocked by authorization (a 404 for the missing physical file is fine)");

  const unauthorized = await apiFetch(baseUrl, `/api/uploads/${filename}`, { token: tokenRmB });
  assert.equal(unauthorized.status, 403, "Zone B's RM must be rejected");
});

// --- REGRESSION: existing zone-wide endpoints still work -----------------

test("REGRESSION: the existing /api/activities/company (RM zone feed) still works unchanged", async () => {
  const { status } = await apiFetch(baseUrl, "/api/activities/company", { token: tokenRmA });
  assert.equal(status, 200);
});

test("REGRESSION: the existing /api/item-reports/zone still works unchanged", async () => {
  const { status } = await apiFetch(baseUrl, "/api/item-reports/zone?period=month", { token: tokenRmA });
  assert.equal(status, 200);
});

test("REGRESSION: the existing /api/market-problems?zoneId= still works unchanged", async () => {
  const { status } = await apiFetch(baseUrl, `/api/market-problems?zoneId=${zoneA.id}`, { token: tokenRmA });
  assert.equal(status, 200);
});
