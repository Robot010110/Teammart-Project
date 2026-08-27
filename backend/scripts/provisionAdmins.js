// scripts/provisionAdmins.js — Admin Phase 1 §2: secure, idempotent
// provisioning for the two real Admin accounts (Raxand ENVy, MoNReaL
// pride). Deliberately a SEPARATE script from prisma/seed.js, which
// exists for local dev/mock data with intentionally throwaway hardcoded
// passwords — real Admin credentials must never live in a script that's
// safe to read/commit.
//
// Passwords are read from environment variables ONLY — never hardcoded,
// never logged, never returned in any response, never stored except as
// a bcrypt hash (same hashing utility authController.js already uses).
// This script is safe to commit: it contains no secret, and re-running
// it is a no-op for an account that already exists (upsert-by-email,
// update: {} — an existing account's password/role is never silently
// overwritten by a re-run).
//
// Usage:
//   ADMIN_1_NAME="Raxand ENVy" ADMIN_1_EMAIL="raxand.envy@teammart.admin" ADMIN_1_PASSWORD="..." \
//   ADMIN_2_NAME="MoNReaL pride" ADMIN_2_EMAIL="monreal.pride@teammart.admin" ADMIN_2_PASSWORD="..." \
//   node scripts/provisionAdmins.js
//
// Only ADMIN_1_PASSWORD/ADMIN_2_PASSWORD are required — name/email fall
// back to the two intended accounts' real names and a generated email if
// unset, so a minimal run is just the two password variables.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMINS = [
  {
    name: process.env.ADMIN_1_NAME || "Raxand ENVy",
    email: process.env.ADMIN_1_EMAIL || "raxand.envy@teammart.admin",
    password: process.env.ADMIN_1_PASSWORD,
  },
  {
    name: process.env.ADMIN_2_NAME || "MoNReaL pride",
    email: process.env.ADMIN_2_EMAIL || "monreal.pride@teammart.admin",
    password: process.env.ADMIN_2_PASSWORD,
  },
];

async function main() {
  for (const admin of ADMINS) {
    if (!admin.password) {
      console.log(`Skipping ${admin.name} — no password provided (set ADMIN_1_PASSWORD / ADMIN_2_PASSWORD).`);
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email: admin.email } });
    if (existing) {
      // Never overwrite an existing account's credentials on a re-run —
      // provisioning is create-once, not a password-reset mechanism
      // (that's Admin Phase 2's explicit scope, not this script's).
      console.log(`${admin.name} <${admin.email}> already exists (id ${existing.id}) — left unchanged.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(admin.password, 10);
    const user = await prisma.user.create({
      data: { name: admin.name, email: admin.email, passwordHash, role: "ADMIN" },
    });
    console.log(`Provisioned ${admin.name} <${admin.email}> (id ${user.id}).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
