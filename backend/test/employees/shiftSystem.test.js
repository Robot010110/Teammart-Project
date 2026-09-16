// shiftSystem.test.js — Shift System Cleanup & Standardization: exactly
// three canonical employee-profile shift values (MORNING/AFTERNOON/
// NIGHT), no "Evening", enforced at the API boundary and backed by a
// real Postgres enum (EmployeeShift) rather than free text. See
// backend/prisma/schema.prisma's EmployeeShift comment and
// utils/validate.js's EMPLOYEE_SHIFTS for the single source of truth
// this test exercises.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  prisma, TAG, startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, trackEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zone, market, admin, adminToken;

before(async () => {
  ({ server, baseUrl } = await startServer());
  zone = await makeZone(94910);
  admin = await makeStaffUser({ role: "ADMIN" });
  adminToken = tokenForStaff(admin);
  market = await makeMarket({ zoneId: zone.id });
});

after(async () => {
  await cleanup();
  await stopServer(server);
  await prisma.$disconnect();
});

test("SCHEMA: the EmployeeShift enum has exactly the three canonical values, and the old CashierShift enum is gone", async () => {
  const rows = await prisma.$queryRaw`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'EmployeeShift'
    ORDER BY enumlabel
  `;
  assert.deepEqual(rows.map((r) => r.enumlabel), ["AFTERNOON", "MORNING", "NIGHT"]);

  const oldEnum = await prisma.$queryRaw`SELECT 1 FROM pg_type WHERE typname = 'CashierShift'`;
  assert.equal(oldEnum.length, 0, "the retired CashierShift enum must not still exist");
});

test("SCHEMA: no employee row anywhere has a non-canonical shift/cashierShift value (post-migration regression guard)", async () => {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT "shift"::text AS v FROM "Employee" WHERE "shift" IS NOT NULL
    UNION
    SELECT DISTINCT "cashierShift"::text AS v FROM "Employee" WHERE "cashierShift" IS NOT NULL
  `;
  const values = rows.map((r) => r.v);
  for (const v of values) {
    assert.ok(["MORNING", "AFTERNOON", "NIGHT"].includes(v), `unexpected legacy shift value still in the database: ${v}`);
  }
});

test("CREATE: MORNING is accepted for a new Worker", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/employees", {
    method: "POST", token: adminToken,
    body: { name: `${TAG} morning-worker`, position: "Stocker", marketId: market.id, shift: "MORNING" },
  });
  assert.equal(status, 201);
  trackEmployee(body.id);
  assert.equal(body.shift, "MORNING");
});

test("CREATE: AFTERNOON is accepted for a new Worker", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/employees", {
    method: "POST", token: adminToken,
    body: { name: `${TAG} afternoon-worker`, position: "Stocker", marketId: market.id, shift: "AFTERNOON" },
  });
  assert.equal(status, 201);
  trackEmployee(body.id);
  assert.equal(body.shift, "AFTERNOON");
});

test("CREATE: NIGHT is accepted for a new Worker", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/employees", {
    method: "POST", token: adminToken,
    body: { name: `${TAG} night-worker`, position: "Stocker", marketId: market.id, shift: "NIGHT" },
  });
  assert.equal(status, 201);
  trackEmployee(body.id);
  assert.equal(body.shift, "NIGHT");
});

test("CREATE: EVENING is rejected — there is no Evening shift anymore", async () => {
  const { status, body } = await apiFetch(baseUrl, "/api/employees", {
    method: "POST", token: adminToken,
    body: { name: `${TAG} evening-worker`, position: "Stocker", marketId: market.id, shift: "EVENING" },
  });
  assert.equal(status, 400);
  assert.ok(body.error, "expected a validation error");
});

test("CREATE: an arbitrary free-text shift value is rejected (no free-text shift entry)", async () => {
  const { status } = await apiFetch(baseUrl, "/api/employees", {
    method: "POST", token: adminToken,
    body: { name: `${TAG} freetext-worker`, position: "Stocker", marketId: market.id, shift: "Morning Shift" },
  });
  assert.equal(status, 400);
});

test("PERSIST: a created Worker's shift persists and is retrieved correctly via GET", async () => {
  const created = await apiFetch(baseUrl, "/api/employees", {
    method: "POST", token: adminToken,
    body: { name: `${TAG} persist-worker`, position: "Stocker", marketId: market.id, shift: "AFTERNOON" },
  });
  assert.equal(created.status, 201);
  trackEmployee(created.body.id);

  const fetched = await apiFetch(baseUrl, `/api/employees/${created.body.id}`, { token: adminToken });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.shift, "AFTERNOON");

  const listed = await apiFetch(baseUrl, `/api/employees?marketId=${market.id}`, { token: adminToken });
  const row = listed.body.find((e) => e.id === created.body.id);
  assert.equal(row.shift, "AFTERNOON");
});

test("UPDATE: a Worker's shift can be changed to any of the three canonical values", async () => {
  const created = await apiFetch(baseUrl, "/api/employees", {
    method: "POST", token: adminToken,
    body: { name: `${TAG} update-worker`, position: "Stocker", marketId: market.id, shift: "MORNING" },
  });
  trackEmployee(created.body.id);
  const updated = await apiFetch(baseUrl, `/api/employees/${created.body.id}`, {
    method: "PATCH", token: adminToken, body: { shift: "NIGHT" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.shift, "NIGHT");
});

test("UPDATE: EVENING is rejected on update too", async () => {
  const created = await apiFetch(baseUrl, "/api/employees", {
    method: "POST", token: adminToken,
    body: { name: `${TAG} update-reject-worker`, position: "Stocker", marketId: market.id },
  });
  trackEmployee(created.body.id);
  const updated = await apiFetch(baseUrl, `/api/employees/${created.body.id}`, {
    method: "PATCH", token: adminToken, body: { shift: "EVENING" },
  });
  assert.equal(updated.status, 400);
});

test("CASHIER: cashierShift accepts all three canonical values, including NIGHT (business decision: Cashiers can now display a Night shift)", async () => {
  const cashier = await prisma.employee.create({
    data: {
      name: `${TAG} cashier`, position: "Cashier", role: "CASHIER", marketId: market.id,
      employeeCode: `${TAG}-cash1`, passwordHash: "not-used", username: `${TAG}cash1`,
    },
  });
  trackEmployee(cashier.id);
  const updated = await apiFetch(baseUrl, `/api/employees/${cashier.id}`, {
    method: "PATCH", token: adminToken, body: { cashierShift: "NIGHT" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.cashierShift, "NIGHT");

  const fetched = await apiFetch(baseUrl, `/api/employees/${cashier.id}`, { token: adminToken });
  assert.equal(fetched.body.cashierShift, "NIGHT");
});

test("CASHIER: PATCH cashierShift actually applies — regression test for the field being silently stripped by validateBody", async () => {
  const cashier = await prisma.employee.create({
    data: {
      name: `${TAG} cashier2`, position: "Cashier", role: "CASHIER", marketId: market.id,
      employeeCode: `${TAG}-cash2`, passwordHash: "not-used", username: `${TAG}cash2`,
    },
  });
  trackEmployee(cashier.id);
  assert.equal(cashier.cashierShift, null);

  const updated = await apiFetch(baseUrl, `/api/employees/${cashier.id}`, {
    method: "PATCH", token: adminToken, body: { cashierShift: "AFTERNOON" },
  });
  assert.equal(updated.status, 200);
  // Before the fix, cashierShift was absent from updateEmployeeSchema, so
  // validateBody's default "strip unknown keys" behaviour silently
  // dropped it and the database value never changed.
  const row = await prisma.employee.findUnique({ where: { id: cashier.id } });
  assert.equal(row.cashierShift, "AFTERNOON");
});

test("CASHIER: EVENING is rejected for cashierShift too", async () => {
  const cashier = await prisma.employee.create({
    data: {
      name: `${TAG} cashier3`, position: "Cashier", role: "CASHIER", marketId: market.id,
      employeeCode: `${TAG}-cash3`, passwordHash: "not-used", username: `${TAG}cash3`,
    },
  });
  trackEmployee(cashier.id);
  const { status } = await apiFetch(baseUrl, `/api/employees/${cashier.id}`, {
    method: "PATCH", token: adminToken, body: { cashierShift: "EVENING" },
  });
  assert.equal(status, 400);
});
