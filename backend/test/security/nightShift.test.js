// nightShift.test.js — Night Shift: employee assignment (operational
// shift, main/additional departments), idempotent daily task
// generation, the operational-shift-date calculation across midnight,
// Washing Market evidence enforcement + completion, automatic group
// posting + management notification, duplicate-completion prevention,
// and IDOR/authorization. See test/helpers.js for the shared fixture/
// cleanup strategy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.js";
import { operationalDateFor, generateNightShiftTasks, notifyNightShiftCompletion } from "../../src/services/nightShiftService.js";
import {
  startServer, stopServer, apiFetch,
  makeZone, makeStaffUser, makeMarket, makeEmployee,
  tokenForStaff, tokenForEmployee, trackActivity, trackEmployee, cleanup,
} from "../helpers.js";

let server, baseUrl;
let zoneA, marketA;
let admin, tokenAdmin;
let supervisorA, tokenSupervisorA;
let nightWorker, tokenNightWorker;
let dayWorker, tokenDayWorker;
let inactiveNightWorker;
let cashier;
let washingMarketDef;

before(async () => {
  ({ server, baseUrl } = await startServer());

  zoneA = await makeZone(90901);
  admin = await makeStaffUser({ role: "ADMIN" });
  supervisorA = await makeStaffUser({ role: "SUPERVISOR" });
  marketA = await makeMarket({ zoneId: zoneA.id, supervisorId: supervisorA.id, name: "AdminNS Market A" });

  nightWorker = await makeEmployee({ marketId: marketA.id, name: "AdminNS Night Worker", role: "WORKER" });
  dayWorker = await makeEmployee({ marketId: marketA.id, name: "AdminNS Day Worker", role: "WORKER" });
  inactiveNightWorker = await makeEmployee({ marketId: marketA.id, name: "AdminNS Inactive Night Worker", role: "WORKER" });
  cashier = await makeEmployee({ marketId: marketA.id, name: "AdminNS Cashier", role: "CASHIER" });

  tokenAdmin = tokenForStaff(admin);
  tokenSupervisorA = tokenForStaff(supervisorA, { managedMarket: marketA });

  // Assign main departments (required before Night Shift tasks can be
  // meaningfully scoped by department).
  await apiFetch(baseUrl, `/api/employees/${nightWorker.id}/department`, { method: "POST", token: tokenSupervisorA, body: { department: "Food" } });
  await apiFetch(baseUrl, `/api/employees/${dayWorker.id}/department`, { method: "POST", token: tokenSupervisorA, body: { department: "Food" } });
  await apiFetch(baseUrl, `/api/employees/${inactiveNightWorker.id}/department`, { method: "POST", token: tokenSupervisorA, body: { department: "Food" } });
});

after(async () => {
  await stopServer(server);
  if (washingMarketDef) await prisma.nightShiftTaskDefinition.delete({ where: { id: washingMarketDef.id } }).catch(() => {});
  await prisma.conversation.deleteMany({ where: { marketId: marketA.id, type: "CUSTOM_GROUP" } }).catch(() => {});
  await cleanup();
});

// --- EMPLOYEE ASSIGNMENT --------------------------------------------

test("ASSIGNMENT: a Worker can be assigned Night Shift", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/employees/${nightWorker.id}`, {
    method: "PATCH", token: tokenSupervisorA, body: { operationalShift: "NIGHT" },
  });
  assert.equal(status, 200);
  assert.equal(body.operationalShift, "NIGHT");
  tokenNightWorker = tokenForEmployee({ ...nightWorker, operationalShift: "NIGHT" });
});

test("ASSIGNMENT: a Cashier cannot be assigned Night Shift", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/employees/${cashier.id}`, {
    method: "PATCH", token: tokenSupervisorA, body: { operationalShift: "NIGHT" },
  });
  assert.equal(status, 400);
  assert.match(body.error, /Cashier/i);
});

test("ASSIGNMENT: zero, one, and multiple additional departments all work and are shown to management but not to the employee", async () => {
  await apiFetch(baseUrl, `/api/employees/${nightWorker.id}/additional-departments`, { method: "POST", token: tokenSupervisorA, body: { department: "Snacks" } });
  await apiFetch(baseUrl, `/api/employees/${nightWorker.id}/additional-departments`, { method: "POST", token: tokenSupervisorA, body: { department: "Frozen" } });

  const asStaff = await apiFetch(baseUrl, `/api/employees/${nightWorker.id}`, { token: tokenSupervisorA });
  assert.equal(asStaff.status, 200);
  assert.deepEqual(new Set(asStaff.body.additionalDepartments), new Set(["Snacks", "Frozen"]));

  tokenDayWorker = tokenForEmployee(dayWorker);
  const asSelf = await apiFetch(baseUrl, `/api/employees/${nightWorker.id}`, { token: tokenForEmployee(nightWorker) });
  assert.equal(asSelf.status, 200); // an employee CAN view their own record...
  assert.equal(asSelf.body.additionalDepartments, undefined); // ...but never the Main/Additional breakdown (spec §5 — staff-only detail)

  // Removing one leaves exactly one additional department.
  await apiFetch(baseUrl, `/api/employees/${nightWorker.id}/additional-departments/Frozen`, { method: "DELETE", token: tokenSupervisorA });
  const afterRemoval = await apiFetch(baseUrl, `/api/employees/${nightWorker.id}`, { token: tokenSupervisorA });
  assert.deepEqual(afterRemoval.body.additionalDepartments, ["Snacks"]);
});

test("ASSIGNMENT: an idle employee (no additional departments) shows an empty list, never fake data", async () => {
  const { body } = await apiFetch(baseUrl, `/api/employees/${dayWorker.id}`, { token: tokenSupervisorA });
  assert.deepEqual(body.additionalDepartments, []);
});

// --- OPERATIONAL DATE ------------------------------------------------

// Local-date (not UTC) comparison — operationalDateFor deliberately
// works in local wall-clock time (it zeroes via setHours, not
// setUTCHours), so toISOString() would shift the result across the
// machine's own UTC offset. Compare local Y-M-D components instead.
const localYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("OPERATIONAL DATE: a completion just after midnight belongs to the PREVIOUS day's shift", () => {
  const lateNight = new Date(2026, 7, 27, 1, 30); // Aug 27 2026, 1:30 AM local
  const resolved = operationalDateFor(lateNight);
  assert.equal(localYmd(resolved), "2026-08-26");
});

test("OPERATIONAL DATE: a shift-start timestamp in the evening belongs to that same day", () => {
  const eveningStart = new Date(2026, 7, 26, 22, 0); // Aug 26 2026, 10:00 PM local
  const resolved = operationalDateFor(eveningStart);
  assert.equal(localYmd(resolved), "2026-08-26");
});

// --- TASK GENERATION ---------------------------------------------------

test("GENERATION: eligible Night Shift employees receive Washing Market; non-Night-Shift and inactive employees do not; repeated calls are idempotent", async () => {
  washingMarketDef = await prisma.nightShiftTaskDefinition.create({
    data: { key: "WASHING_MARKET_TEST", name: "Washing Market", requiresEvidence: true, minPhotos: 7, createdById: admin.id, marketId: marketA.id },
  });

  await prisma.employee.update({ where: { id: inactiveNightWorker.id }, data: { operationalShift: "NIGHT", employmentStatus: "INACTIVE" } });

  const first = await generateNightShiftTasks();
  const second = await generateNightShiftTasks(); // idempotent re-run

  const nightWorkerTasks = await prisma.activity.findMany({ where: { employeeId: nightWorker.id, nightShiftTaskDefinitionId: washingMarketDef.id } });
  assert.equal(nightWorkerTasks.length, 1, "exactly one instance, even after generating twice");
  nightWorkerTasks.forEach((t) => trackActivity(t.id));

  const dayWorkerTasks = await prisma.activity.findMany({ where: { employeeId: dayWorker.id, nightShiftTaskDefinitionId: washingMarketDef.id } });
  assert.equal(dayWorkerTasks.length, 0, "a non-Night-Shift employee must never receive this task");

  const inactiveTasks = await prisma.activity.findMany({ where: { employeeId: inactiveNightWorker.id, nightShiftTaskDefinitionId: washingMarketDef.id } });
  assert.equal(inactiveTasks.length, 0, "an inactive employee must not receive new tasks");

  assert.ok(second.created <= first.created); // second run created nothing new (or the same 0)
});

test("GENERATION: the dashboard endpoint's lazy generation is also idempotent", async () => {
  const first = await apiFetch(baseUrl, "/api/night-shift/my-dashboard", { token: tokenNightWorker });
  const second = await apiFetch(baseUrl, "/api/night-shift/my-dashboard", { token: tokenNightWorker });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.tasks.length, second.body.tasks.length);
  assert.equal(first.body.tasks[0]?.id, second.body.tasks[0]?.id);
  assert.equal(first.body.mainDepartment, "Food");
  assert.deepEqual(first.body.additionalDepartments, ["Snacks"]);
});

// --- WASHING MARKET ------------------------------------------------

test("WASHING MARKET: fewer than 7 photos cannot be submitted; the backend enforces this independently of any client-supplied count", async () => {
  const { body: dashboard } = await apiFetch(baseUrl, "/api/night-shift/my-dashboard", { token: tokenNightWorker });
  const task = dashboard.tasks.find((t) => t.key === "WASHING_MARKET_TEST");
  assert.ok(task, "Washing Market must appear on the dashboard");
  assert.equal(task.status, "DRAFT");

  for (let i = 0; i < 6; i++) {
    const { status } = await apiFetch(baseUrl, `/api/activities/${task.id}/images`, { method: "POST", token: tokenNightWorker, body: { url: `https://example.com/photo${i}.jpg` } });
    assert.equal(status, 201);
  }

  const submitAttempt = await apiFetch(baseUrl, `/api/activities/${task.id}`, { method: "PATCH", token: tokenNightWorker, body: { status: "PENDING" } });
  assert.equal(submitAttempt.status, 400);
  assert.match(submitAttempt.body.error, /7 photos/i);
});

test("WASHING MARKET: exactly 7 photos succeeds, posts to the market's Night Shift group, and notifies the Supervisor", async () => {
  const { body: dashboard } = await apiFetch(baseUrl, "/api/night-shift/my-dashboard", { token: tokenNightWorker });
  const task = dashboard.tasks.find((t) => t.key === "WASHING_MARKET_TEST");
  assert.equal(task.photoCount, 6, "the 6 photos from the previous test must already be attached");

  await apiFetch(baseUrl, `/api/activities/${task.id}/images`, { method: "POST", token: tokenNightWorker, body: { url: "https://example.com/photo7.jpg" } });

  const submit = await apiFetch(baseUrl, `/api/activities/${task.id}`, { method: "PATCH", token: tokenNightWorker, body: { status: "PENDING" } });
  assert.equal(submit.status, 200);
  assert.equal(submit.body.status, "PENDING");
  assert.equal(submit.body.images.length, 7);
  assert.ok(submit.body.operationalDate);
  assert.equal(submit.body.employeeId, nightWorker.id);
  assert.equal(submit.body.marketId, marketA.id);

  const group = await prisma.conversation.findFirst({ where: { type: "CUSTOM_GROUP", marketId: marketA.id, name: "AdminNS Market A Night Shifters" } });
  assert.ok(group, "the market's Night Shift group must have been created");
  const messages = await prisma.message.findMany({ where: { conversationId: group.id } });
  assert.equal(messages.length, 1);
  assert.match(messages[0].body, /Washing Market/);
  assert.match(messages[0].body, new RegExp(nightWorker.name));

  const notification = await prisma.notification.findFirst({ where: { userId: supervisorA.id, type: "NIGHT_SHIFT_TASK_COMPLETED" }, orderBy: { createdAt: "desc" } });
  assert.ok(notification, "the market's Supervisor must be notified");
});

test("WASHING MARKET: re-saving an already-PENDING task (e.g. adding another photo) does not create a duplicate group post", async () => {
  const { body: dashboard } = await apiFetch(baseUrl, "/api/night-shift/my-dashboard", { token: tokenNightWorker });
  const task = dashboard.tasks.find((t) => t.key === "WASHING_MARKET_TEST");

  await apiFetch(baseUrl, `/api/activities/${task.id}/images`, { method: "POST", token: tokenNightWorker, body: { url: "https://example.com/photo-extra.jpg" } });
  const resave = await apiFetch(baseUrl, `/api/activities/${task.id}`, { method: "PATCH", token: tokenNightWorker, body: { status: "PENDING" } });
  assert.equal(resave.status, 200);

  const group = await prisma.conversation.findFirst({ where: { type: "CUSTOM_GROUP", marketId: marketA.id, name: "AdminNS Market A Night Shifters" } });
  const messages = await prisma.message.findMany({ where: { conversationId: group.id } });
  assert.equal(messages.length, 1, "no duplicate group post from a re-save");
});

test("WASHING MARKET: duplicate completion for the same operational date is structurally prevented (unique instance, not a new one)", async () => {
  const result = await generateNightShiftTasks();
  const tasksAfter = await prisma.activity.findMany({ where: { employeeId: nightWorker.id, nightShiftTaskDefinitionId: washingMarketDef.id } });
  assert.equal(tasksAfter.length, 1, "still exactly one instance for today — generation never creates a second one");
});

// --- SECURITY / AUTHORIZATION -----------------------------------------

test("SECURITY: only ADMIN can create or edit a task definition", async () => {
  const attempt = await apiFetch(baseUrl, "/api/night-shift/task-definitions", {
    method: "POST", token: tokenSupervisorA, body: { key: "SUPERVISOR_ATTEMPT", name: "x" },
  });
  assert.equal(attempt.status, 403);
});

test("SECURITY: an employee cannot access another employee's Night Shift task", async () => {
  const { body: dashboard } = await apiFetch(baseUrl, "/api/night-shift/my-dashboard", { token: tokenNightWorker });
  const task = dashboard.tasks.find((t) => t.key === "WASHING_MARKET_TEST");

  const foreignAttempt = await apiFetch(baseUrl, `/api/activities/${task.id}/images`, {
    method: "POST", token: tokenForEmployee(dayWorker), body: { url: "https://example.com/hack.jpg" },
  });
  assert.equal(foreignAttempt.status, 403);
});

test("SECURITY: a staff caller from an unrelated market cannot view this market's Night Shift activity (IDOR)", async () => {
  const zoneB = await makeZone(90902);
  const supervisorB = await makeStaffUser({ role: "SUPERVISOR" });
  const marketB = await makeMarket({ zoneId: zoneB.id, supervisorId: supervisorB.id, name: "AdminNS Market B" });
  const tokenSupervisorB = tokenForStaff(supervisorB, { managedMarket: marketB });

  const { status } = await apiFetch(baseUrl, `/api/night-shift/market/${marketA.id}`, { token: tokenSupervisorB });
  assert.equal(status, 403);
});

test("MANAGEMENT: the market's own Supervisor can view Night Shift activity for their market", async () => {
  const { status, body } = await apiFetch(baseUrl, `/api/night-shift/market/${marketA.id}`, { token: tokenSupervisorA });
  assert.equal(status, 200);
  assert.ok(body.some((a) => a.employee.id === nightWorker.id && a.status === "PENDING"));
});

// --- HISTORICAL PRESERVATION (audit finding — see nightShiftController.js
// listNightShiftActivityForMarket's own comment) -----------------------

test("HISTORY: a completed task stays attributed to the ORIGINAL market after the employee is reassigned to a different market", async () => {
  const zoneH = await makeZone(90903);
  const supervisorH1 = await makeStaffUser({ role: "SUPERVISOR" });
  const supervisorH2 = await makeStaffUser({ role: "SUPERVISOR" });
  const marketH1 = await makeMarket({ zoneId: zoneH.id, supervisorId: supervisorH1.id, name: "AdminNS History Market 1" });
  const marketH2 = await makeMarket({ zoneId: zoneH.id, supervisorId: supervisorH2.id, name: "AdminNS History Market 2" });
  const historyWorker = await makeEmployee({ marketId: marketH1.id, name: "AdminNS History Worker", role: "WORKER" });
  const tokenSupervisorH1 = tokenForStaff(supervisorH1, { managedMarket: marketH1 });
  const tokenSupervisorH2 = tokenForStaff(supervisorH2, { managedMarket: marketH2 });

  await apiFetch(baseUrl, `/api/employees/${historyWorker.id}/department`, { method: "POST", token: tokenSupervisorH1, body: { department: "Food" } });
  await apiFetch(baseUrl, `/api/employees/${historyWorker.id}`, { method: "PATCH", token: tokenSupervisorH1, body: { operationalShift: "NIGHT" } });

  const historyDef = await prisma.nightShiftTaskDefinition.create({
    data: { key: "HISTORY_TASK_TEST", name: "History Task", requiresEvidence: false, minPhotos: 0, createdById: admin.id, marketId: marketH1.id },
  });

  await generateNightShiftTasks();
  const created = await prisma.activity.findFirst({ where: { employeeId: historyWorker.id, nightShiftTaskDefinitionId: historyDef.id } });
  assert.ok(created, "the task must have generated for the employee's original market");
  assert.equal(created.marketId, marketH1.id);
  trackActivity(created.id);

  const submit = await apiFetch(baseUrl, `/api/activities/${created.id}`, { method: "PATCH", token: tokenForEmployee(historyWorker), body: { status: "PENDING" } });
  assert.equal(submit.status, 200);

  // Reassign the employee to a completely different market — the past
  // completion above must not move with them.
  const reassign = await apiFetch(baseUrl, `/api/employees/${historyWorker.id}`, { method: "PATCH", token: tokenAdmin, body: { marketId: marketH2.id } });
  assert.equal(reassign.status, 200);
  assert.equal(reassign.body.marketId, marketH2.id);

  const stillInOriginalMarket = await apiFetch(baseUrl, `/api/night-shift/market/${marketH1.id}`, { token: tokenSupervisorH1 });
  assert.equal(stillInOriginalMarket.status, 200);
  assert.ok(
    stillInOriginalMarket.body.some((a) => a.id === created.id),
    "the historical completion must still be attributed to the ORIGINAL market, not silently vanish"
  );

  const notInNewMarket = await apiFetch(baseUrl, `/api/night-shift/market/${marketH2.id}`, { token: tokenSupervisorH2 });
  assert.equal(notInNewMarket.status, 200);
  assert.ok(
    !notInNewMarket.body.some((a) => a.id === created.id),
    "the historical completion must NOT be re-attributed to the employee's new (current) market"
  );

  await prisma.nightShiftTaskDefinition.delete({ where: { id: historyDef.id } }).catch(() => {});
  trackEmployee(historyWorker.id);
  await prisma.market.deleteMany({ where: { id: { in: [marketH1.id, marketH2.id] } } }).catch(() => {});
  await prisma.zone.delete({ where: { id: zoneH.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [supervisorH1.id, supervisorH2.id] } } }).catch(() => {});
});

// --- CONCURRENCY --------------------------------------------------------

test("GENERATION: near-simultaneous generation calls never create more than one task instance per employee/day", async () => {
  const zoneC = await makeZone(90904);
  const supervisorC = await makeStaffUser({ role: "SUPERVISOR" });
  const marketC = await makeMarket({ zoneId: zoneC.id, supervisorId: supervisorC.id, name: "AdminNS Concurrency Market" });
  const concurrencyWorker = await makeEmployee({ marketId: marketC.id, name: "AdminNS Concurrency Worker", role: "WORKER" });
  const tokenSupervisorC = tokenForStaff(supervisorC, { managedMarket: marketC });
  await apiFetch(baseUrl, `/api/employees/${concurrencyWorker.id}/department`, { method: "POST", token: tokenSupervisorC, body: { department: "Food" } });
  await apiFetch(baseUrl, `/api/employees/${concurrencyWorker.id}`, { method: "PATCH", token: tokenSupervisorC, body: { operationalShift: "NIGHT" } });

  const concurrencyDef = await prisma.nightShiftTaskDefinition.create({
    data: { key: "CONCURRENCY_TASK_TEST", name: "Concurrency Task", requiresEvidence: false, minPhotos: 0, createdById: admin.id, marketId: marketC.id },
  });

  // Simulates the real race this guards against: the lazy dashboard-load
  // generation and the periodic maintenanceScheduler sweep both firing at
  // once for the same employee (spec §9's own "whichever runs first
  // wins"). Relies on createMany({ skipDuplicates: true }) against the
  // real @@unique([employeeId, nightShiftTaskDefinitionId, operationalDate])
  // constraint doing the actual dedup at the database level — this test
  // fails if that constraint were ever accidentally removed/loosened.
  await Promise.all(Array.from({ length: 6 }, () => generateNightShiftTasks()));

  const rows = await prisma.activity.findMany({ where: { employeeId: concurrencyWorker.id, nightShiftTaskDefinitionId: concurrencyDef.id } });
  assert.equal(rows.length, 1, "exactly one task instance, even after 6 concurrent generation calls");
  rows.forEach((r) => trackActivity(r.id));

  await prisma.nightShiftTaskDefinition.delete({ where: { id: concurrencyDef.id } }).catch(() => {});
  trackEmployee(concurrencyWorker.id);
  await prisma.market.delete({ where: { id: marketC.id } }).catch(() => {});
  await prisma.zone.delete({ where: { id: zoneC.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: supervisorC.id } }).catch(() => {});
});

// --- REAL MIDNIGHT-CROSSING GENERATION (integration-level, not just the
// pure operationalDateFor unit test above) ------------------------------

test("OPERATIONAL DATE: a task generated at 1:30 AM is persisted with the PREVIOUS day's operational date", async () => {
  const zoneM = await makeZone(90905);
  const supervisorM = await makeStaffUser({ role: "SUPERVISOR" });
  const marketM = await makeMarket({ zoneId: zoneM.id, supervisorId: supervisorM.id, name: "AdminNS Midnight Market" });
  const midnightWorker = await makeEmployee({ marketId: marketM.id, name: "AdminNS Midnight Worker", role: "WORKER" });
  const tokenSupervisorM = tokenForStaff(supervisorM, { managedMarket: marketM });
  await apiFetch(baseUrl, `/api/employees/${midnightWorker.id}/department`, { method: "POST", token: tokenSupervisorM, body: { department: "Food" } });
  await apiFetch(baseUrl, `/api/employees/${midnightWorker.id}`, { method: "PATCH", token: tokenSupervisorM, body: { operationalShift: "NIGHT" } });

  const midnightDef = await prisma.nightShiftTaskDefinition.create({
    data: { key: "MIDNIGHT_TASK_TEST", name: "Midnight Task", requiresEvidence: false, minPhotos: 0, createdById: admin.id, marketId: marketM.id },
  });

  // Aug 26 10:00 PM shift start.
  await generateNightShiftTasks(new Date(2026, 7, 26, 22, 0));
  // Aug 27 1:30 AM — "completion" time, still the SAME shift.
  const lateCall = await generateNightShiftTasks(new Date(2026, 7, 27, 1, 30));
  assert.equal(lateCall.created, 0, "the 1:30 AM call must resolve to the SAME operational date as the 10 PM call, not generate a second task");

  const rows = await prisma.activity.findMany({ where: { employeeId: midnightWorker.id, nightShiftTaskDefinitionId: midnightDef.id } });
  assert.equal(rows.length, 1);
  assert.equal(localYmd(rows[0].operationalDate), "2026-08-26", "the operational date must be Aug 26 (the night the shift started), not Aug 27");
  trackActivity(rows[0].id);

  await prisma.nightShiftTaskDefinition.delete({ where: { id: midnightDef.id } }).catch(() => {});
  trackEmployee(midnightWorker.id);
  await prisma.market.delete({ where: { id: marketM.id } }).catch(() => {});
  await prisma.zone.delete({ where: { id: zoneM.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: supervisorM.id } }).catch(() => {});
});

// --- NOTIFICATION/GROUP-POST FAILURE ISOLATION (spec §19/§21) ---------

test("FAILURE ISOLATION: a broken notification/group-post never throws past notifyNightShiftCompletion, and the Activity commit happens BEFORE it's even called", async () => {
  // A malformed/inconsistent activity (an employeeId that no longer
  // resolves to a real Employee — e.g. a genuinely corrupted or racing
  // read) is exactly the kind of unexpected condition the try/catch in
  // notifyNightShiftCompletion exists for. It must resolve cleanly, never
  // reject/throw — activitiesController.updateActivity already committed
  // the real Activity update and built its response BEFORE this function
  // is even called (see that controller's own code, lines ~512-534: the
  // prisma.activity.update + its returned `updated` object come first,
  // notifyNightShiftCompletion is awaited only after, and res.json(updated)
  // always follows regardless of what happens inside it).
  await assert.doesNotReject(() =>
    notifyNightShiftCompletion({ id: "does-not-exist", employeeId: "does-not-exist", nightShiftTaskDefinitionId: null })
  );

  // A real employee but a malformed activity id (wrong type entirely) —
  // this actually reaches and throws inside the try (a Prisma validation
  // error on activityImage.count), proving the catch genuinely swallows a
  // real thrown error, not just an early "employee not found" return.
  await assert.doesNotReject(() =>
    notifyNightShiftCompletion({ id: 12345, employeeId: nightWorker.id, nightShiftTaskDefinitionId: null })
  );
});
