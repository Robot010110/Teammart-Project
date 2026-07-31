// Seeds the DB with data shaped like the frontend's mock data
// (src/data/mockData.js), so you can compare real API output to the mock
// before wiring up the frontend's fetch() calls.
//
// Run with: npm run prisma:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ---------------------------------------------------------------
  // Staff accounts — one of each role, so every login flow can be tested.
  // ---------------------------------------------------------------
  const adminPasswordHash = await bcrypt.hash("Admin123!", 10);
  const admin = await prisma.user.upsert({
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

  const supervisorPasswordHash = await bcrypt.hash("Supervisor123!", 10);
  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor.qushtapa1@teammart.test" },
    update: {},
    create: {
      name: "Qushtapa 1 Supervisor",
      email: "supervisor.qushtapa1@teammart.test",
      passwordHash: supervisorPasswordHash,
      role: "SUPERVISOR",
    },
  });

  // ---------------------------------------------------------------
  // Zone 1, managed by Ali Hassan
  // ---------------------------------------------------------------
  const zone1 = await prisma.zone.upsert({
    where: { number: 1 },
    update: { managerId: regionalManager.id },
    create: { number: 1, managerId: regionalManager.id },
  });

  const otherZonesData = [
    { number: 2, markets: [{ name: "Italyan 1", status: "ACTIVE" }, { name: "Royal 1", status: "MAINTENANCE" }] },
    { number: 3, markets: [{ name: "Dream City 1", status: "ACTIVE" }, { name: "Empire 1", status: "CLOSED" }] },
  ];

  for (const z of otherZonesData) {
    const zone = await prisma.zone.upsert({ where: { number: z.number }, update: {}, create: { number: z.number } });
    for (const m of z.markets) {
      // Market has no natural unique key besides its generated id, so we
      // check by name+zone first instead of upserting, to keep this script
      // safely re-runnable without creating duplicates.
      const existing = await prisma.market.findFirst({ where: { name: m.name, zoneId: zone.id } });
      if (!existing) {
        await prisma.market.create({ data: { name: m.name, status: m.status, zoneId: zone.id } });
      }
    }
  }

  // Market with a real Supervisor login, in Zone 1.
  let market = await prisma.market.findFirst({ where: { name: "Qushtapa 1", zoneId: zone1.id } });
  if (!market) {
    market = await prisma.market.create({
      data: { name: "Qushtapa 1", status: "ACTIVE", zoneId: zone1.id, supervisorId: supervisor.id },
    });
  } else {
    await prisma.market.update({ where: { id: market.id }, data: { supervisorId: supervisor.id } });
  }

  await prisma.market.createMany({
    data: [
      { name: "Qushtapa 2", status: "ACTIVE", zoneId: zone1.id },
      { name: "Zhyan 1", status: "ACTIVE", zoneId: zone1.id },
    ],
    skipDuplicates: true,
  });

  // ---------------------------------------------------------------
  // A couple of employees in Qushtapa 1, with real logins.
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
          marketId: market.id,
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
      marketId: market.id,
    },
  });

  // ---------------------------------------------------------------
  // Two sample Cashier accounts (Cashier role module) — same market as
  // the Worker employees above, so they're immediately usable with the
  // existing Supervisor account. Cashiers log in with username+password,
  // not employeeCode+password (see authController.cashierLogin).
  // ---------------------------------------------------------------
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
      marketId: market.id,
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
      marketId: market.id,
    },
  });

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
          marketId: market.id,
          reviewedById: supervisor.id,
          reviewedAt: new Date(),
        },
        {
          type: "SHELF_CLEANING",
          label: "Report Completed Cleaning",
          department: "Fresh",
          status: "PENDING",
          requiresPhoto: true,
          employeeId: employee.id,
          marketId: market.id,
        },
      ],
    });
  }

  console.log("Seed complete. Test logins:");
  console.log("  Admin:      admin@teammart.test / Admin123!");
  console.log("  Manager:    ali.hassan@teammart.test / Manager123! (Zone 1)");
  console.log("  Supervisor: supervisor.qushtapa1@teammart.test / Supervisor123! (Qushtapa 1)");
  console.log("  Employee:   TM-1001 / Employee123! (Shalaw Naji, Qushtapa 1)");
  console.log("  Cashier:    cashier_morning01 / Market2026! (Ahmed Karim, Morning, Snacks)");
  console.log("  Cashier:    cashier_evening01 / Market2026! (Sara Ali, Evening, Cashier)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
