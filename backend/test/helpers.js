// test/helpers.js — shared setup for the security test suite. No test
// framework was previously installed in this repo (checked package.json
// before adding anything) — this uses Node's own built-in test runner
// (`node --test`, stable since Node 18) plus the platform's global
// fetch(), so running the suite requires zero new dependencies.
//
// Test data safety: every row this suite creates is tagged with a
// per-run random suffix (TAG below) so it can never collide with real
// seed/dev data, and every test file deletes everything it created in
// its own `after()` hook (see cleanup() below) — this suite is safe to
// run against a developer's normal dev database. For real isolation,
// set TEST_DATABASE_URL in backend/.env to point at a separate database
// (e.g. "teammart_test") and it's used automatically; if unset, it falls
// back to the same DATABASE_URL the app itself uses. This suite never
// runs a migration reset or truncates any table — it only ever creates
// and deletes its own tagged rows.
import "dotenv/config";
import http from "http";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { unlink } from "fs/promises";
import path from "path";
import { app } from "../src/app.js";
import { signStaffToken, signEmployeeToken } from "../src/utils/jwt.js";
import { UPLOADS_DIR } from "../src/utils/fileStorage.js";

export const prisma = new PrismaClient(
  process.env.TEST_DATABASE_URL ? { datasources: { db: { url: process.env.TEST_DATABASE_URL } } } : undefined
);

export const TAG = `sectest-${randomUUID().slice(0, 8)}`;

export async function startServer() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

export async function stopServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

// Thin fetch wrapper: pass a token (or omit for unauthenticated), get
// back { status, body }. Keeps every test focused on what it's actually
// asserting instead of repeating header/JSON boilerplate.
export async function apiFetch(baseUrl, path, { method = "GET", token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let requestBody;
  if (formData) {
    requestBody = formData; // fetch sets the multipart Content-Type itself
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: requestBody });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response (e.g. a raw file) — caller uses res.status /
    // raw text/blob directly for those cases via rawFetch below.
  }
  return { status: res.status, body: json, headers: res.headers };
}

// For endpoints that return a real file body rather than JSON (the
// GET /api/uploads/:filename download route).
export async function rawFetch(baseUrl, path, { token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { headers });
  return res;
}

// --- Fixture builders -----------------------------------------------
// Every builder tracks what it created so cleanup() can remove exactly
// that, in dependency order (Employee -> Market -> Zone -> User -> the
// few extra tables that reference them).
const created = {
  employees: [], activities: [], activityImages: [], markets: [], zones: [], users: [], uploadedFiles: [],
  conversations: [], attendanceRecords: [], breaks: [], fingerprintEvents: [],
};

export async function makeZone(number) {
  const zone = await prisma.zone.create({ data: { number } });
  created.zones.push(zone.id);
  return zone;
}

export async function makeStaffUser({ role, name = `${TAG} ${role}` }) {
  const user = await prisma.user.create({
    data: { name, email: `${TAG}-${randomUUID().slice(0, 8)}@test.local`, passwordHash: "not-used-tests-sign-tokens-directly", role },
  });
  created.users.push(user.id);
  return user;
}

export async function makeMarket({ zoneId, supervisorId = null, overlookingSupervisorId = null, name = `${TAG} Market` }) {
  const market = await prisma.market.create({ data: { name, zoneId, supervisorId, overlookingSupervisorId, status: "ACTIVE" } });
  created.markets.push(market.id);
  return market;
}

export async function makeEmployee({ marketId, name = `${TAG} Employee`, role = "WORKER" }) {
  const employee = await prisma.employee.create({
    data: { name, position: "Test Position", marketId, role, employeeCode: `${TAG}-${randomUUID().slice(0, 6)}`, passwordHash: "not-used" },
  });
  created.employees.push(employee.id);
  return employee;
}

// Builds a real JWT using the app's own signing functions, matching
// exactly what a real login would produce — bypasses bcrypt/login
// endpoints entirely for test speed, without duplicating the token-shape
// logic those functions already own.
export function tokenForStaff(user, { managedZones = [], managedMarket = null, managedOverlookingMarket = null } = {}) {
  return signStaffToken({ ...user, managedZones, managedMarket, managedOverlookingMarket });
}

export function tokenForEmployee(employee) {
  return signEmployeeToken(employee);
}

export function trackActivity(id) {
  created.activities.push(id);
}
// Admin Phase 2 — for rows created indirectly through an API call (e.g.
// promote/demote creating a new User/Employee) rather than through
// makeStaffUser/makeEmployee above, so cleanup() still finds them.
export function trackEmployee(id) {
  created.employees.push(id);
}
export function trackUser(id) {
  created.users.push(id);
}
export function trackUploadedFile(filename) {
  created.uploadedFiles.push(filename);
}
export function trackConversation(id) {
  created.conversations.push(id);
}
export function trackAttendanceRecord(id) {
  created.attendanceRecords.push(id);
}
export function trackBreak(id) {
  created.breaks.push(id);
}
export function trackFingerprintEvent(id) {
  created.fingerprintEvents.push(id);
}

// Phase 1 fixture helpers ------------------------------------------------

export async function checkInAs(baseUrl, token) {
  return apiFetch(baseUrl, "/api/attendance/check-in", { method: "POST", token });
}

export async function cleanup() {
  await prisma.activityImage.deleteMany({ where: { activityId: { in: created.activities } } }).catch(() => {});
  await prisma.activity.deleteMany({ where: { id: { in: created.activities } } }).catch(() => {});
  // Phase 3 — ConversationRead now has a staff counterpart too
  // (unread/pin/mute for Supervisor/RM); must go before Conversation
  // deletion (FK, no cascade), same reasoning as Message/ConversationMember.
  await prisma.conversationRead.deleteMany({ where: { conversationId: { in: created.conversations } } }).catch(() => {});
  await prisma.message.deleteMany({ where: { conversationId: { in: created.conversations } } }).catch(() => {});
  await prisma.conversationMember.deleteMany({ where: { conversationId: { in: created.conversations } } }).catch(() => {});
  await prisma.conversation.deleteMany({ where: { id: { in: created.conversations } } }).catch(() => {});
  // Phase 3 — ImportantContact rows (owner always staff) and any
  // ConversationRead rows this run's staff/employees created that
  // reference a conversation NOT tracked above (e.g. the market's own
  // MARKET_GROUP, found-or-created rather than explicitly tracked).
  if (created.users.length) {
    await prisma.importantContact.deleteMany({ where: { ownerUserId: { in: created.users } } }).catch(() => {});
    await prisma.importantContact.deleteMany({ where: { contactUserId: { in: created.users } } }).catch(() => {});
    await prisma.conversationRead.deleteMany({ where: { staffUserId: { in: created.users } } }).catch(() => {});
  }
  if (created.employees.length) {
    await prisma.importantContact.deleteMany({ where: { contactEmployeeId: { in: created.employees } } }).catch(() => {});
    await prisma.conversationRead.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => {});
  }
  await prisma.uploadedFile.deleteMany({ where: { filename: { in: created.uploadedFiles } } }).catch(() => {});
  await Promise.all(created.uploadedFiles.map((filename) => unlink(path.join(UPLOADS_DIR, filename)).catch(() => {})));
  await prisma.break.deleteMany({ where: { id: { in: created.breaks } } }).catch(() => {});
  await prisma.fingerprintEvent.deleteMany({ where: { id: { in: created.fingerprintEvents } } }).catch(() => {});
  await prisma.attendanceRecord.deleteMany({ where: { id: { in: created.attendanceRecords } } }).catch(() => {});
  // Also sweep any attendance/break rows this run's employees/staff
  // created indirectly (e.g. via a real check-in call, not tracked by
  // id up front) — scoped tightly to only the employee/user ids THIS
  // run created, never a broader delete.
  if (created.employees.length) {
    // RequiredHoursAdjustment/AttendanceAdjustmentRequest both reference
    // employeeId with no cascade too — left out, a leftover row (e.g.
    // one created directly via prisma in a manual-dismiss test, not
    // through trackAttendanceRecord) silently blocks Employee deletion
    // below (swallowed by .catch(() => {})), the same orphan-chain class
    // of bug already fixed here for MarketProblem/ItemReport/etc.
    await prisma.requiredHoursAdjustment.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => {});
    await prisma.attendanceAdjustmentRequest.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => {});
    await prisma.attendanceRecord.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => {});
    await prisma.break.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => {});
    await prisma.fingerprintEvent.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => {});
    // ActivityImage first (Activity.onDelete is NOT cascade-less here,
    // but being explicit avoids relying on that) then Activity itself —
    // catches anything a test created via the real API and didn't
    // clean up inline (e.g. a Department Closing submission).
    await prisma.activityImage.deleteMany({ where: { activity: { employeeId: { in: created.employees } } } }).catch(() => {});
    await prisma.activity.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => {});
    // DepartmentAssignment — created by the real assignDepartment
    // endpoint in the DEPARTMENT tests; blocks Employee deletion (FK,
    // no cascade) if left behind.
    await prisma.departmentAssignment.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => {});
  }
  if (created.users.length) {
    await prisma.attendanceRecord.deleteMany({ where: { staffUserId: { in: created.users } } }).catch(() => {});
    await prisma.break.deleteMany({ where: { staffUserId: { in: created.users } } }).catch(() => {});
  }
  if (created.markets.length) {
    // Phase 2: unassigned-department Activities own their own marketId
    // directly (employeeId null — see Activity.employeeId's own schema
    // comment), so the employeeId-scoped sweep above wouldn't catch
    // them; MarketDepartment/DepartmentReport both reference marketId
    // with no cascade, so either blocks Market deletion if left behind.
    await prisma.activityImage.deleteMany({ where: { activity: { marketId: { in: created.markets } } } }).catch(() => {});
    await prisma.activity.deleteMany({ where: { marketId: { in: created.markets } } }).catch(() => {});
    await prisma.departmentReport.deleteMany({ where: { marketId: { in: created.markets } } }).catch(() => {});
    await prisma.marketDepartment.deleteMany({ where: { marketId: { in: created.markets } } }).catch(() => {});
    // Repair Pass §4 — MarketProblem also references marketId with no
    // cascade; left out of this sweep, a leftover row silently blocks
    // Market deletion below (swallowed by the .catch(() => {})), which
    // in turn blocks the Zone deletion after it — the exact orphaned-
    // zone chain that broke an unrelated test file's fixed zone number.
    await prisma.marketProblem.deleteMany({ where: { marketId: { in: created.markets } } }).catch(() => {});
    // Same reasoning as MarketProblem just above — ItemReport/
    // PriceReport/TotalSalesReport/CardSalesReport all reference
    // marketId with no cascade too.
    await prisma.itemReport.deleteMany({ where: { marketId: { in: created.markets } } }).catch(() => {});
    await prisma.priceReport.deleteMany({ where: { marketId: { in: created.markets } } }).catch(() => {});
    await prisma.totalSalesReport.deleteMany({ where: { marketId: { in: created.markets } } }).catch(() => {});
    await prisma.cardSalesReport.deleteMany({ where: { marketId: { in: created.markets } } }).catch(() => {});
  }
  await prisma.employee.deleteMany({ where: { id: { in: created.employees } } }).catch(() => {});
  await prisma.market.deleteMany({ where: { id: { in: created.markets } } }).catch(() => {});
  await prisma.zone.deleteMany({ where: { id: { in: created.zones } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => {});
  await prisma.$disconnect();
}
