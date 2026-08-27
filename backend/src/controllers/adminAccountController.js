import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { userIdTaken } from "../utils/accountIds.js";
import { generateUniqueEmployeeCode } from "./employeesController.js";
import { createNotification, createNotificationForUser } from "../utils/notifications.js";
import { recordAudit } from "../utils/audit.js";

// adminAccountController.js — Admin Phase 2: administrative control over
// existing staff (User) and employee (Employee) accounts — role changes,
// market/zone reassignment, password reset, and account status
// (suspend/ban/reactivate). Every mutation here is ADMIN-only (see
// admin.routes.js) and reuses the exact same tables/relations every
// other part of this app already reads (Zone.managerId, Market.
// supervisorId/overlookingSupervisorId, Employee.marketId, etc.) — no
// parallel organizational model.
//
// Two identity spaces, one important architectural fact this whole file
// is built around: a staff account (User, Int id) and an employee
// account (Employee, String cuid id) are NOT the same row shape, and
// dozens of tables (Activity, AttendanceRecord, Message, ...) reference
// "whichever one this belongs to" via a dual-nullable-FK pair
// (employeeId OR staffUserId/senderUserId/etc.) rather than a single
// polymorphic owner. Converting a Worker into a Supervisor can NOT
// safely be "just change a role field" — that would either require an
// impossible id-space merge or silently orphan every historical row
// still pointing at the old employeeId. So promotion/demotion here is a
// LINKED identity transition: a new row is created in the target table,
// linked back via promotedFromEmployeeId/demotedFromUserId, and the old
// row is deactivated (accountStatus SUSPENDED) but never deleted — every
// past Activity/AttendanceRecord/Message stays exactly where it was,
// forever attached to the identity that actually created it.

function shapeEmployeeForAdmin(e) {
  const { passwordHash, tokenVersion, ...rest } = e;
  return rest;
}
function shapeUserForAdmin(u) {
  const { passwordHash, tokenVersion, ...rest } = u;
  return rest;
}

const STATUS_AUDIT_ACTION = { SUSPENDED: "ACCOUNT_SUSPENDED", BANNED: "ACCOUNT_BANNED", ACTIVE: "ACCOUNT_REACTIVATED" };

// Admin Phase 2 §20: "never leave the company with zero valid Admin
// accounts." Counts ACTIVE Admins excluding the one about to be changed
// — if that would hit zero, the caller rejects the whole operation.
// Deliberately role/count-based, never a hardcoded name/id check (spec
// explicitly forbids depending on the two current Admins' names).
async function wouldLeaveZeroAdmins(excludeUserId) {
  const remaining = await prisma.user.count({
    where: { role: "ADMIN", accountStatus: "ACTIVE", id: { not: excludeUserId } },
  });
  return remaining === 0;
}

// ---------------------------------------------------------------------
// Staff (User) profile — name/email/loginId only. Role/market/zone are
// their own dedicated endpoints below (each has real side effects a
// plain field edit shouldn't silently trigger).
// ---------------------------------------------------------------------
export async function updateStaffProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.userId) } });
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const { name, email, loginId } = req.body;
    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: "An account with that email already exists" });
    }
    if (loginId !== undefined && loginId !== null && loginId !== user.loginId) {
      if (await userIdTaken(loginId, { excludeUserId: user.id })) {
        return res.status(409).json({ error: "This User ID is already in use" });
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { ...(name !== undefined ? { name } : {}), ...(email !== undefined ? { email } : {}), ...(loginId !== undefined ? { loginId } : {}) },
    });

    if (loginId !== undefined && loginId !== user.loginId) {
      await recordAudit({
        actorUserId: req.user.userId, action: "EMPLOYEE_ID_CHANGED", targetType: "User", targetId: String(user.id),
        previousValue: { loginId: user.loginId }, newValue: { loginId },
      });
    }

    res.json(shapeUserForAdmin(updated));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// Change Role — same-table transition between the four StaffRole values
// (§4/§6-8). Never touches the Employee table; see promoteEmployeeToStaff
// / demoteStaffToEmployee below for the account-type-crossing cases.
// ---------------------------------------------------------------------
export async function changeStaffRole(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const { role, marketId, zoneIds } = req.body;

    if (user.role === "ADMIN" && role !== "ADMIN" && (await wouldLeaveZeroAdmins(userId))) {
      return res.status(400).json({ error: "Cannot change this account's role — it is the last remaining Admin account." });
    }

    if (role === "SUPERVISOR" || role === "OVERLOOKING_SUPERVISOR") {
      if (!marketId) return res.status(400).json({ error: "marketId is required for this role" });
      const market = await prisma.market.findUnique({ where: { id: marketId } });
      if (!market) return res.status(404).json({ error: "Market not found" });
    }
    if (role === "REGIONAL_MANAGER" && (!zoneIds || zoneIds.length === 0)) {
      return res.status(400).json({ error: "At least one zone is required for this role" });
    }

    const before = { role: user.role, marketId: null, zoneIds: [] };

    const updated = await prisma.$transaction(async (tx) => {
      // Clean up EVERY relationship the account's OLD role could have
      // held, regardless of what the new role needs — a stale
      // Supervisor/RM ownership row left behind would silently keep
      // granting old-role access (spec §8's explicit concern).
      await tx.market.updateMany({ where: { supervisorId: userId }, data: { supervisorId: null } });
      await tx.market.updateMany({ where: { overlookingSupervisorId: userId }, data: { overlookingSupervisorId: null } });
      await tx.zone.updateMany({ where: { managerId: userId }, data: { managerId: null } });

      if (role === "SUPERVISOR") {
        await tx.market.updateMany({ where: { supervisorId: userId, id: { not: marketId } }, data: { supervisorId: null } });
        await tx.market.update({ where: { id: marketId }, data: { supervisorId: userId } });
      } else if (role === "OVERLOOKING_SUPERVISOR") {
        await tx.market.updateMany({ where: { overlookingSupervisorId: userId, id: { not: marketId } }, data: { overlookingSupervisorId: null } });
        await tx.market.update({ where: { id: marketId }, data: { overlookingSupervisorId: userId } });
      } else if (role === "REGIONAL_MANAGER") {
        await tx.zone.updateMany({ where: { id: { in: zoneIds } }, data: { managerId: userId } });
      }

      // tokenVersion bump — any token already issued for this account
      // still carries the OLD role/scope claims; it must stop working so
      // the account is forced to re-authenticate and pick up the new
      // ones (spec's own explicit requirement, every promotion/demotion
      // section).
      return tx.user.update({ where: { id: userId }, data: { role, tokenVersion: { increment: 1 } } });
    });

    await recordAudit({
      actorUserId: req.user.userId, action: "ROLE_CHANGED", targetType: "User", targetId: String(userId),
      marketId: marketId ?? null, previousValue: { role: before.role }, newValue: { role, marketId, zoneIds },
    });

    await createNotificationForUser({
      userId,
      type: "ROLE_CHANGED",
      title: "Your role has changed",
      body: `Your account role changed from ${before.role} to ${role}. Please log in again.`,
    });

    res.json(shapeUserForAdmin(updated));
  } catch (err) {
    next(err);
  }
}

// Full-replace a Regional Manager's zone list (§10) — adds/removes only
// the delta between the current and requested set, in one transaction,
// preserving the "manages multiple zones" model (no one-zone-only
// shortcut).
export async function setRegionalManagerZones(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Staff account not found" });
    if (user.role !== "REGIONAL_MANAGER") {
      return res.status(400).json({ error: "This account is not a Regional Manager" });
    }

    const { zoneIds } = req.body;
    const zones = await prisma.zone.findMany({ where: { id: { in: zoneIds } } });
    if (zones.length !== zoneIds.length) {
      return res.status(400).json({ error: "One or more zones could not be found" });
    }

    const previousZones = await prisma.zone.findMany({ where: { managerId: userId }, select: { id: true } });

    await prisma.$transaction([
      prisma.zone.updateMany({ where: { managerId: userId, id: { notIn: zoneIds } }, data: { managerId: null } }),
      prisma.zone.updateMany({ where: { id: { in: zoneIds } }, data: { managerId: userId } }),
    ]);

    const updatedZones = await prisma.zone.findMany({ where: { managerId: userId }, select: { id: true, number: true } });

    await recordAudit({
      actorUserId: req.user.userId, action: "ZONE_ASSIGNMENT_CHANGED", targetType: "User", targetId: String(userId),
      previousValue: { zoneIds: previousZones.map((z) => z.id) }, newValue: { zoneIds: updatedZones.map((z) => z.id) },
    });

    res.json({ zones: updatedZones });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// Promote / demote — the account-type-crossing transitions. See the
// file's own top comment for why these create a linked new row rather
// than mutating role in place.
// ---------------------------------------------------------------------
export async function promoteEmployeeToStaff(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (employee.accountStatus !== "ACTIVE") {
      return res.status(400).json({ error: "Only an active employee can be promoted" });
    }

    const { role, email, password, marketId, zoneIds, loginId } = req.body;

    if ((role === "SUPERVISOR" || role === "OVERLOOKING_SUPERVISOR") && !marketId) {
      return res.status(400).json({ error: "marketId is required for this role" });
    }
    if (role === "REGIONAL_MANAGER" && (!zoneIds || zoneIds.length === 0)) {
      return res.status(400).json({ error: "At least one zone is required for this role" });
    }
    if (marketId && !(await prisma.market.findUnique({ where: { id: marketId } }))) {
      return res.status(404).json({ error: "Market not found" });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) return res.status(409).json({ error: "An account with that email already exists" });
    if (loginId && (await userIdTaken(loginId))) {
      return res.status(409).json({ error: "This User ID is already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: employee.name,
          email,
          passwordHash,
          role,
          loginId: loginId || null,
          promotedFromEmployeeId: employee.id,
          ...(role === "SUPERVISOR" ? { managedMarket: { connect: { id: marketId } } } : {}),
          ...(role === "OVERLOOKING_SUPERVISOR" ? { managedOverlookingMarket: { connect: { id: marketId } } } : {}),
        },
      });
      if (role === "REGIONAL_MANAGER") {
        await tx.zone.updateMany({ where: { id: { in: zoneIds } }, data: { managerId: created.id } });
      }
      // Deactivate the old Employee login — "do not leave the old
      // account active accidentally" (spec §5/§6) — every historical
      // Activity/AttendanceRecord/Message row stays attached to
      // employee.id, untouched.
      await tx.employee.update({
        where: { id: employee.id },
        data: { accountStatus: "SUSPENDED", statusReason: `Promoted to ${role}`, tokenVersion: { increment: 1 } },
      });
      return created;
    });

    await recordAudit({
      actorUserId: req.user.userId, action: "EMPLOYEE_PROMOTED", targetType: "Employee", targetId: employee.id,
      marketId: marketId ?? null, previousValue: { role: employee.role }, newValue: { role, staffUserId: user.id },
    });

    await createNotification({
      employeeId: employee.id,
      type: "ROLE_CHANGED",
      title: "You've been promoted",
      body: `You've been promoted to ${role}. Log in with your new staff account.`,
    });

    res.status(201).json(shapeUserForAdmin(user));
  } catch (err) {
    next(err);
  }
}

export async function demoteStaffToEmployee(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Staff account not found" });
    if (user.role === "ADMIN") {
      return res.status(400).json({ error: "An Admin account cannot be demoted to an employee — change its role first if intended." });
    }

    const { role, marketId, password, shift, username } = req.body;

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (username && (await userIdTaken(username))) {
      return res.status(409).json({ error: "This User ID is already in use" });
    }

    const employeeCode = await generateUniqueEmployeeCode();
    const passwordHash = await bcrypt.hash(password, 10);

    const employee = await prisma.$transaction(async (tx) => {
      // Clean up every management relationship this User could have
      // held (same reasoning as changeStaffRole above).
      await tx.market.updateMany({ where: { supervisorId: userId }, data: { supervisorId: null } });
      await tx.market.updateMany({ where: { overlookingSupervisorId: userId }, data: { overlookingSupervisorId: null } });
      await tx.zone.updateMany({ where: { managerId: userId }, data: { managerId: null } });

      const created = await tx.employee.create({
        data: {
          name: user.name,
          position: role === "CASHIER" ? "Cashier" : "Worker",
          role,
          marketId,
          shift: role !== "CASHIER" ? shift ?? null : null,
          cashierShift: role === "CASHIER" ? shift ?? null : null,
          employeeCode,
          username: role === "CASHIER" ? username : null,
          passwordHash,
          demotedFromUserId: userId,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { accountStatus: "SUSPENDED", statusReason: `Demoted to ${role}`, tokenVersion: { increment: 1 } },
      });
      return created;
    });

    await recordAudit({
      actorUserId: req.user.userId, action: "STAFF_DEMOTED", targetType: "User", targetId: String(userId),
      marketId, previousValue: { role: user.role }, newValue: { role, employeeId: employee.id },
    });

    await createNotificationForUser({
      userId,
      type: "ROLE_CHANGED",
      title: "Your role has changed",
      body: `Your account role changed to ${role}. Log in with your new employee credentials.`,
    });

    res.status(201).json(shapeEmployeeForAdmin(employee));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// Password reset — never returns or logs the plaintext password. Always
// bumps tokenVersion so any already-issued token for this account stops
// working immediately (§14/§19).
// ---------------------------------------------------------------------
export async function resetEmployeePassword(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    await prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    // "PASSWORD_RESET" only — never the password itself (spec §10).
    await recordAudit({ actorUserId: req.user.userId, action: "PASSWORD_RESET", targetType: "Employee", targetId: employee.id });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function resetStaffPassword(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    await recordAudit({ actorUserId: req.user.userId, action: "PASSWORD_RESET", targetType: "User", targetId: String(userId) });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// Account status — suspend / ban / reactivate (§15-18). Same endpoint
// handles all three (status is the only thing that differs); two-admin
// safety applies whenever the target is an ACTIVE Admin moving away from
// ACTIVE.
// ---------------------------------------------------------------------
export async function setEmployeeAccountStatus(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const { status, reason } = req.body;
    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: { accountStatus: status, statusReason: reason ?? null, tokenVersion: { increment: 1 } },
    });

    await recordAudit({
      actorUserId: req.user.userId, action: STATUS_AUDIT_ACTION[status], targetType: "Employee", targetId: employee.id,
      reason, previousValue: { accountStatus: employee.accountStatus }, newValue: { accountStatus: status },
    });

    await createNotification({
      employeeId: employee.id,
      type: "ACCOUNT_STATUS_CHANGED",
      title: `Your account is now ${status}`,
      body: reason ?? `An administrator changed your account status to ${status}.`,
    });

    res.json(shapeEmployeeForAdmin(updated));
  } catch (err) {
    next(err);
  }
}

export async function setStaffAccountStatus(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Staff account not found" });

    const { status, reason } = req.body;

    if (user.role === "ADMIN" && status !== "ACTIVE" && (await wouldLeaveZeroAdmins(userId))) {
      return res.status(400).json({ error: "Cannot change this account's status — it is the last remaining Admin account." });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { accountStatus: status, statusReason: reason ?? null, tokenVersion: { increment: 1 } },
    });

    await recordAudit({
      actorUserId: req.user.userId, action: STATUS_AUDIT_ACTION[status], targetType: "User", targetId: String(userId),
      reason, previousValue: { accountStatus: user.accountStatus }, newValue: { accountStatus: status },
    });

    await createNotificationForUser({
      userId,
      type: "ACCOUNT_STATUS_CHANGED",
      title: `Your account is now ${status}`,
      body: reason ?? `An administrator changed your account status to ${status}.`,
    });

    res.json(shapeUserForAdmin(updated));
  } catch (err) {
    next(err);
  }
}
