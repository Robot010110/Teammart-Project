// Seeds the DB with data shaped like the frontend's mock data
// (src/data/mockData.js), so you can compare real API output to the mock
// before wiring up the frontend's fetch() calls. Safe to re-run — every
// account/market lookup below is upsert-or-findFirst-guarded.
//
// Run with: npm run prisma:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Market has no natural unique key besides its generated id, so every
// market here is found-by-name+zone first instead of upserted, to keep
// this script safely re-runnable without creating duplicates (an
// earlier version of this helper's inline logic was missing this guard
// in one spot and quietly duplicated rows on every re-run — fixed here
// by routing every market creation through this one function).
async function findOrCreateMarket(name, zoneId, extra = {}) {
  const existing = await prisma.market.findFirst({ where: { name, zoneId } });
  if (existing) {
    if (Object.keys(extra).length) return prisma.market.update({ where: { id: existing.id }, data: extra });
    return existing;
  }
  return prisma.market.create({ data: { name, zoneId, status: "ACTIVE", ...extra } });
}

async function main() {
  // ---------------------------------------------------------------
  // Staff accounts.
  // ---------------------------------------------------------------
  const adminPasswordHash = await bcrypt.hash("Admin123!", 10);
  await prisma.user.upsert({
    where: { email: "admin@teammart.test" },
    update: {},
    create: { name: "Rawand Salih", email: "admin@teammart.test", passwordHash: adminPasswordHash, role: "ADMIN" },
  });

  const rmPasswordHash = await bcrypt.hash("Manager123!", 10);
  const regionalManager = await prisma.user.upsert({
    where: { email: "ali.hassan@teammart.test" },
    update: {},
    create: {
      name: "Ali Hassan",
      email: "ali.hassan@teammart.test",
      passwordHash: rmPasswordHash,
      role: "REGIONAL_MANAGER",
    },
  });

  // Zone Manager (Regional Manager role) for Zone 2 specifically — see
  // the Zone-2 restructuring below. A separate account from Ali Hassan,
  // who keeps managing Zones 1 and 3.
  const zoneManagerPasswordHash = await bcrypt.hash("ZoneManager123!", 10);
  const zoneManager = await prisma.user.upsert({
    where: { email: "ali.farsgardi@teammart.test" },
    update: { name: "Ali Fars Gardi" },
    create: {
      name: "Ali Fars Gardi",
      email: "ali.farsgardi@teammart.test",
      passwordHash: zoneManagerPasswordHash,
      role: "REGIONAL_MANAGER",
    },
  });

  // Sabur Xorani — the existing "Qushtapa 1 Supervisor" placeholder
  // account, given a real identity + a case-insensitive User ID login
  // (loginId) instead of the email-only login it started with (see
  // authController.staffIdLogin). Reusing this row (not creating a
  // parallel one) keeps every existing Qushtapa 1 relationship
  // (employees, activities, chat) intact. Not a plain upsert: the email
  // itself changes as part of this rename, so `where: { email }` can't
  // stay stable across re-runs — look up by the NEW email first (already
  // renamed, most runs), fall back to the OLD one (first run only,
  // migrating the placeholder), otherwise create fresh.
  const saburPasswordHash = await bcrypt.hash("Sr@9907", 10);
  const saburData = { name: "Sabur Xorani", email: "sabur.xorani@teammart.test", loginId: "em881", passwordHash: saburPasswordHash, role: "SUPERVISOR" };
  let sabur = await prisma.user.findUnique({ where: { email: saburData.email } });
  if (!sabur) sabur = await prisma.user.findUnique({ where: { email: "supervisor.qushtapa1@teammart.test" } });
  sabur = sabur
    ? await prisma.user.update({ where: { id: sabur.id }, data: saburData })
    : await prisma.user.create({ data: saburData });

  // Farman Farhad — second Supervisor, same permission model as Sabur
  // (spec: "Do not treat this as a completely different role").
  const farmanPasswordHash = await bcrypt.hash("Ff@0012", 10);
  const farman = await prisma.user.upsert({
    where: { email: "farman.farhad@teammart.test" },
    update: { loginId: "em120", passwordHash: farmanPasswordHash },
    create: {
      name: "Farman Farhad",
      email: "farman.farhad@teammart.test",
      loginId: "em120",
      passwordHash: farmanPasswordHash,
      role: "SUPERVISOR",
    },
  });

  // A real, distinct Overlooking/Night Supervisor account for Qushtapa 1
  // (not a shift label on the Supervisor login — see
  // Market.overlookingSupervisorId's schema comment).
  const overlookingPasswordHash = await bcrypt.hash("Overlooking123!", 10);
  const overlookingSupervisor = await prisma.user.upsert({
    where: { email: "overlooking.qushtapa1@teammart.test" },
    update: {},
    create: {
      name: "Qushtapa 1 Overlooking",
      email: "overlooking.qushtapa1@teammart.test",
      passwordHash: overlookingPasswordHash,
      role: "OVERLOOKING_SUPERVISOR",
    },
  });

  // ---------------------------------------------------------------
  // Zones 1 and 3 — managed by Ali Hassan, unchanged from before.
  // ---------------------------------------------------------------
  const zone1 = await prisma.zone.upsert({
    where: { number: 1 },
    update: { managerId: regionalManager.id },
    create: { number: 1, managerId: regionalManager.id },
  });
  const zone3 = await prisma.zone.upsert({
    where: { number: 3 },
    update: { managerId: regionalManager.id },
    create: { number: 3, managerId: regionalManager.id },
  });
  await findOrCreateMarket("Zhyan 1", zone1.id);
  await findOrCreateMarket("Dream City 1", zone3.id);
  await findOrCreateMarket("Empire 1", zone3.id, { status: "CLOSED" });

  // ---------------------------------------------------------------
  // Zone 2 — managed by Ali Fars Gardi, 12 markets (spec: "Qushtapa 1,
  // Qushtapa 2, plus the other markets belonging to Zone 2"). Qushtapa 1
  // and 2 move here from Zone 1 (their existing employees/Supervisor/
  // Overlooking relationships are untouched — only the market's own
  // zoneId changes). The remaining 8 are placeholder names — the real
  // ones weren't given in the spec; rename them via Markets management
  // once known, the structure (12 markets under this zone) is what
  // matters for now.
  // ---------------------------------------------------------------
  const zone2 = await prisma.zone.upsert({
    where: { number: 2 },
    update: { managerId: zoneManager.id },
    create: { number: 2, managerId: zoneManager.id },
  });

  // Move any existing "Qushtapa 1"/"Qushtapa 2" row OUT of zone 1 first
  // (they were originally seeded there — see the git history of this
  // file) — before findOrCreateMarket below looks for them by name
  // *within zone 2*, otherwise it would find nothing there yet and
  // create a second, duplicate market instead of relocating the real
  // one (with its existing employees/Supervisor/chat history intact).
  await prisma.market.updateMany({ where: { name: "Qushtapa 1", zoneId: zone1.id }, data: { zoneId: zone2.id } });
  await prisma.market.updateMany({ where: { name: "Qushtapa 2", zoneId: zone1.id }, data: { zoneId: zone2.id } });

  const qushtapa1 = await findOrCreateMarket("Qushtapa 1", zone2.id, {
    supervisorId: sabur.id,
    overlookingSupervisorId: overlookingSupervisor.id,
  });
  const qushtapa2 = await findOrCreateMarket("Qushtapa 2", zone2.id, { supervisorId: farman.id });
  await findOrCreateMarket("Italyan 1", zone2.id);
  await findOrCreateMarket("Royal 1", zone2.id, { status: "MAINTENANCE" });
  for (let i = 5; i <= 12; i += 1) {
    await findOrCreateMarket(`Zone 2 Market ${i}`, zone2.id);
  }

  // ---------------------------------------------------------------
  // Employees at Qushtapa 1 (Sabur's market) — the original two test
  // employees, plus the new Morning Cashier and Morning Worker.
  // ---------------------------------------------------------------
  const employeePasswordHash = await bcrypt.hash("Employee123!", 10);

  const existingEmployee = await prisma.employee.findUnique({ where: { employeeCode: "TM-1001" } });
  const employee = existingEmployee
    ? existingEmployee
    : await prisma.employee.create({
        data: {
          employeeCode: "TM-1001",
          name: "Shalaw Naji",
          passwordHash: employeePasswordHash,
          position: "Cashier",
          shift: "Morning Shift",
          marketId: qushtapa1.id,
        },
      });

  await prisma.employee.upsert({
    where: { employeeCode: "TM-1002" },
    update: {},
    create: {
      employeeCode: "TM-1002",
      name: "Ahmed Kareem",
      passwordHash: employeePasswordHash,
      position: "Worker",
      secondaryRole: "Assistant",
      shift: "Afternoon Shift",
      marketId: qushtapa1.id,
    },
  });

  const cashierPasswordHash = await bcrypt.hash("Market2026!", 10);
  await prisma.employee.upsert({
    where: { username: "cashier_morning01" },
    update: {},
    create: {
      employeeCode: "TM-2001",
      name: "Ahmed Karim",
      username: "cashier_morning01",
      passwordHash: cashierPasswordHash,
      position: "Cashier",
      role: "CASHIER",
      cashierShift: "MORNING",
      department: "Snacks",
      employmentStatus: "ACTIVE",
      whatsappNumber: "9647501234567",
      marketId: qushtapa1.id,
    },
  });
  await prisma.employee.upsert({
    where: { username: "cashier_evening01" },
    update: {},
    create: {
      employeeCode: "TM-2002",
      name: "Sara Ali",
      username: "cashier_evening01",
      passwordHash: cashierPasswordHash,
      position: "Cashier",
      role: "CASHIER",
      cashierShift: "EVENING",
      department: "Cashier",
      employmentStatus: "ACTIVE",
      whatsappNumber: "9647509876543",
      marketId: qushtapa1.id,
    },
  });

  // Rostam Omer — Morning Cashier, em149/Rr@0049.
  const rostamPasswordHash = await bcrypt.hash("Rr@0049", 10);
  await prisma.employee.upsert({
    where: { employeeCode: "em149" },
    update: {},
    create: {
      employeeCode: "em149",
      name: "Rostam Omer",
      passwordHash: rostamPasswordHash,
      position: "Cashier",
      role: "CASHIER",
      cashierShift: "MORNING",
      username: "em149",
      employmentStatus: "ACTIVE",
      marketId: qushtapa1.id,
    },
  });

  // Soran Tahseen — Morning Worker, em991/Ss@91.
  const soranPasswordHash = await bcrypt.hash("Ss@91", 10);
  await prisma.employee.upsert({
    where: { employeeCode: "em991" },
    update: {},
    create: {
      employeeCode: "em991",
      name: "Soran Tahseen",
      passwordHash: soranPasswordHash,
      position: "Worker",
      shift: "Morning",
      employmentStatus: "ACTIVE",
      marketId: qushtapa1.id,
    },
  });

  // ---------------------------------------------------------------
  // Employees at Qushtapa 2 (Farman's market).
  // ---------------------------------------------------------------

  // Rahand Mohammed — Evening Cashier, em148/Rr@0070.
  const rahandPasswordHash = await bcrypt.hash("Rr@0070", 10);
  await prisma.employee.upsert({
    where: { employeeCode: "em148" },
    update: {},
    create: {
      employeeCode: "em148",
      name: "Rahand Mohammed",
      passwordHash: rahandPasswordHash,
      position: "Cashier",
      role: "CASHIER",
      cashierShift: "EVENING",
      username: "em148",
      employmentStatus: "ACTIVE",
      marketId: qushtapa2.id,
    },
  });

  // Ramin — Night Cashier, em144/Rr@1414. CashierShift only has
  // MORNING/EVENING (spec: "Cashiers are never on a Night shift" — see
  // that enum's own schema comment); "Night" is recorded in the
  // free-text `shift` field instead so it's still real, visible data
  // rather than silently dropped or forced into the wrong bucket.
  const raminPasswordHash = await bcrypt.hash("Rr@1414", 10);
  await prisma.employee.upsert({
    where: { employeeCode: "em144" },
    update: {},
    create: {
      employeeCode: "em144",
      name: "Ramin",
      passwordHash: raminPasswordHash,
      position: "Cashier",
      role: "CASHIER",
      shift: "Night",
      username: "em144",
      employmentStatus: "ACTIVE",
      marketId: qushtapa2.id,
    },
  });

  // Hoshmand Ahmed and Aram — Evening Workers, credentials genuinely not
  // assigned yet (spec: "do not invent credentials, leave User ID and
  // password unassigned until provided"). employeeCode/passwordHash stay
  // null — see the Employee model's own comment on why that's supported
  // (they simply can't log in until a staff member assigns both via
  // PATCH /api/employees/:id, or self-service once that's possible).
  for (const name of ["Hoshmand Ahmed", "Aram"]) {
    const existing = await prisma.employee.findFirst({ where: { name, marketId: qushtapa2.id, employeeCode: null } });
    if (!existing) {
      await prisma.employee.create({
        data: { name, position: "Worker", shift: "Evening", employmentStatus: "ACTIVE", marketId: qushtapa2.id },
      });
    }
  }

  // A couple of sample tasks so /api/dashboard and /api/reports have
  // something to show immediately after seeding.
  const existingTasks = await prisma.task.count({ where: { employeeId: employee.id } });
  if (existingTasks === 0) {
    await prisma.task.createMany({
      data: [
        {
          type: "REFILLING",
          label: "Refilling Update",
          department: "Snacks",
          status: "APPROVED",
          employeeId: employee.id,
          marketId: qushtapa1.id,
          reviewedById: sabur.id,
          reviewedAt: new Date(),
        },
        {
          type: "SHELF_CLEANING",
          label: "Report Completed Cleaning",
          department: "Fresh",
          status: "PENDING",
          requiresPhoto: true,
          employeeId: employee.id,
          marketId: qushtapa1.id,
        },
      ],
    });
  }

  console.log("Seed complete. Test logins:");
  console.log("  Admin:         admin@teammart.test / Admin123!");
  console.log("  Manager:       ali.hassan@teammart.test / Manager123! (Zones 1 & 3)");
  console.log("  Zone Manager:  ali.farsgardi@teammart.test / ZoneManager123! (Ali Fars Gardi, Zone 2, 12 markets)");
  console.log("  Supervisor:    em881 / Sr@9907 (Sabur Xorani, Qushtapa 1)");
  console.log("  Supervisor:    em120 / Ff@0012 (Farman Farhad, Qushtapa 2)");
  console.log("  Overlooking:   overlooking.qushtapa1@teammart.test / Overlooking123! (Qushtapa 1)");
  console.log("  Employee:      TM-1001 / Employee123! (Shalaw Naji, Qushtapa 1)");
  console.log("  Cashier:       cashier_morning01 / Market2026! (Ahmed Karim, Morning, Snacks)");
  console.log("  Cashier:       cashier_evening01 / Market2026! (Sara Ali, Evening, Cashier)");
  console.log("  Cashier:       em149 / Rr@0049 (Rostam Omer, Morning, Qushtapa 1)");
  console.log("  Cashier:       em148 / Rr@0070 (Rahand Mohammed, Evening, Qushtapa 2)");
  console.log("  Cashier:       em144 / Rr@1414 (Ramin, Night, Qushtapa 2)");
  console.log("  Worker:        em991 / Ss@91 (Soran Tahseen, Morning, Qushtapa 1)");
  console.log("  Worker:        Hoshmand Ahmed, Aram — pending, no credentials assigned yet (Qushtapa 2)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
