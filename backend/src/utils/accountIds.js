import { prisma } from "../lib/prisma.js";

// accountIds.js — the "User ID" concept spans two tables (Employee.
// employeeCode/username for Worker/Cashier, User.loginId for Supervisor/
// Overlooking) but the spec is explicit it must be unique "across the
// entire application" (§7), case-insensitively (§5), even across those
// different fields/tables. This is the one place that check lives, so
// every caller that creates or changes a User ID — self-service (spec
// §7) or staff-assigned (activating a pending hire) — enforces the same
// rule instead of three subtly different ones.
//
// Excludes are by id, not by value, so an account can "change" its own
// User ID to a value that only collides with itself (a no-op rename).
export async function userIdTaken(value, { excludeEmployeeId, excludeUserId } = {}) {
  const [byCode, byUsername, byLoginId] = await Promise.all([
    prisma.employee.findFirst({
      where: { employeeCode: { equals: value, mode: "insensitive" }, id: excludeEmployeeId ? { not: excludeEmployeeId } : undefined },
      select: { id: true },
    }),
    prisma.employee.findFirst({
      where: { username: { equals: value, mode: "insensitive" }, id: excludeEmployeeId ? { not: excludeEmployeeId } : undefined },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { loginId: { equals: value, mode: "insensitive" }, id: excludeUserId ? { not: excludeUserId } : undefined },
      select: { id: true },
    }),
  ]);
  return !!(byCode || byUsername || byLoginId);
}
