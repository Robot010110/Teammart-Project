import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { staffCanAccessMarket, assertMarketAccess } from "../middleware/auth.js";
import { userIdTaken } from "../utils/accountIds.js";
import { ensureMarketDepartment } from "../services/departmentMonitoringService.js";
import { recordAudit } from "../utils/audit.js";
import { attachAttendanceState } from "../utils/employeeStatus.js";

function publicEmployee(e) {
  // Never send passwordHash back to the client.
  const { passwordHash, ...rest } = e;
  return rest;
}

// Generates a short, human-typeable employee code like "TM-4821".
// Collisions are extremely unlikely at this scale, but we still verify
// uniqueness before returning it.
// Exported for adminAccountController.js's demote-to-Employee workflow
// (Admin Phase 2 §8) — the exact same code-generation logic a new hire
// already gets, reused rather than duplicated.
export async function generateUniqueEmployeeCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `TM-${crypto.randomInt(1000, 9999)}`;
    const existing = await prisma.employee.findUnique({ where: { employeeCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique employee code, please try again");
}

// GET /api/employees?marketId=&role=&shift=&search= — scoped by role:
//   ADMIN             -> all employees (optionally filtered by marketId)
//   REGIONAL_MANAGER   -> only employees in their zone's markets (spec
//                          §3: up to ~60 employees across many markets —
//                          role/shift/search are the RM's filtering
//                          tools for that)
//   SUPERVISOR         -> only employees in their own market
//
// role filters on Employee.role (WORKER/CASHIER/BUTCHER); shift matches
// EITHER cashierShift (Cashiers) OR shift (Workers) — both the same
// canonical EmployeeShift enum (MORNING/AFTERNOON/NIGHT) since the Shift
// System Cleanup — so one query param works for both; search does a
// case-insensitive match on name or employeeCode.
export async function listEmployees(req, res, next) {
  try {
    const { marketId, role, shift, search } = req.query;

    let where = marketId ? { marketId: String(marketId) } : {};

    if (req.user.role === "SUPERVISOR") {
      where = { ...where, marketId: req.user.marketId };
    } else if (req.user.role === "REGIONAL_MANAGER") {
      where = { ...where, market: { zoneId: { in: req.user.zoneIds } } };
    }
    // ADMIN: no extra scoping.

    if (marketId) {
      await assertMarketAccess(req.user, String(marketId));
    }
    if (role) where.role = String(role);
    if (shift) where.OR = [{ cashierShift: String(shift) }, { shift: String(shift) }];
    if (search) {
      where.AND = [
        ...(where.AND ?? []),
        { OR: [{ name: { contains: String(search), mode: "insensitive" } }, { employeeCode: { contains: String(search), mode: "insensitive" } }] },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
    });

    // attendanceState (ACTIVE/BREAK/NOT_ACTIVE) is the real, computed
    // presence status — see utils/employeeStatus.js. This is the single
    // shared roster endpoint behind the Admin People page, the
    // Supervisor Employees list and the Regional Manager Employees page,
    // so fixing it here fixes "Active" everywhere this list is rendered
    // instead of patching each screen separately.
    const withAttendance = await attachAttendanceState(employees.map(publicEmployee));
    res.json(withAttendance);
  } catch (err) {
    next(err);
  }
}

// GET /api/employees/:id
export async function getEmployee(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    let additionalDepartments;
    if (req.user.kind === "staff") {
      await assertMarketAccess(req.user, employee.marketId);
      // Night Shift §5 — management sees the FULL assignment (Main +
      // Additional); an employee viewing their own record (below) never
      // gets this extra detail — "keep the UI simple" for the employee
      // side is enforced here, not just by the frontend not asking.
      additionalDepartments = (await getCurrentDepartments(employee.id)).additional;
    } else if (req.user.kind === "employee" && req.user.employeeId !== employee.id) {
      return res.status(403).json({ error: "You do not have access to this employee" });
    }

    res.json({ ...publicEmployee(employee), ...(additionalDepartments ? { additionalDepartments } : {}) });
  } catch (err) {
    next(err);
  }
}

// POST /api/employees — ADMIN, or REGIONAL_MANAGER/SUPERVISOR scoped to
// their own zone/market. Returns the generated temp password ONCE — it is
// never retrievable again after this response (only its hash is stored).
export async function createEmployee(req, res, next) {
  try {
    const { name, position, secondaryRole, shift, marketId, password } = req.body;

    const allowed = await staffCanAccessMarket(req.user, marketId);
    if (allowed === "not-found") return res.status(400).json({ error: "marketId does not refer to an existing market" });
    if (!allowed) return res.status(403).json({ error: "You do not have access to this market" });

    const employeeCode = await generateUniqueEmployeeCode();
    const plainPassword = password ?? crypto.randomBytes(4).toString("hex");
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const employee = await prisma.employee.create({
      data: { name, position, secondaryRole, shift, marketId, employeeCode, passwordHash },
    });

    res.status(201).json({
      ...publicEmployee(employee),
      // Only returned on creation — write this down, it can't be shown again.
      temporaryPassword: plainPassword,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/employees/:id — also how a staff member activates a
// "pending" hire (spec §4: an employee row created without an
// employeeCode/username/password yet — see the Employee model's own
// comment). employeeCode/username go through the same case-insensitive,
// cross-table uniqueness check as the self-service User-ID change
// (userIdTaken); `password`, if present, is hashed here and never
// echoed back — same as createEmployee's temp-password handling.
export async function updateEmployee(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    await assertMarketAccess(req.user, employee.marketId);

    const isMarketChange = !!req.body.marketId && req.body.marketId !== employee.marketId;

    // If moving the employee to a different market, the caller must also
    // have access to the DESTINATION market.
    if (isMarketChange) {
      await assertMarketAccess(req.user, req.body.marketId);
    }

    // Night Shift — a Cashier's operationalShift (the Night Shift TASK
    // system's eligibility field — see its own schema comment) can never
    // be NIGHT, by existing, intentional design. This is unrelated to
    // the Shift System Cleanup: a Cashier's own profile `cashierShift`
    // display value CAN be NIGHT now (see that field's schema comment) —
    // being scheduled to display "Night" on a profile card is a
    // different fact from being enrolled in the automated Night Shift
    // task-generation workflow, which stays WORKER/BUTCHER-only.
    if (req.body.operationalShift === "NIGHT") {
      const targetRole = req.body.role ?? employee.role;
      if (targetRole === "CASHIER") {
        return res.status(400).json({ error: "Cashiers cannot be assigned Night Shift" });
      }
    }

    const { password, employeeCode, username, ...rest } = req.body;
    const data = { ...rest };

    for (const [field, value] of [["employeeCode", employeeCode], ["username", username]]) {
      if (value === undefined) continue;
      if (value !== null) {
        const taken = await userIdTaken(value, { excludeEmployeeId: employee.id });
        if (taken) return res.status(409).json({ error: "This User ID is already in use" });
      }
      data[field] = value;
    }
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
      // Admin Phase 2 §19 — any password change invalidates existing
      // sessions, not just the dedicated Reset Password action.
      data.tokenVersion = { increment: 1 };
    }

    // Admin Actions Verification — a market transfer bundles three
    // things that must succeed or fail together: the Employee row
    // itself (marketId, plus clearing the now-stale department cache
    // and bumping tokenVersion so the employee's already-issued JWT
    // stops being trusted for the old market — every other sensitive
    // mutation in this app already does this, market reassignment was
    // the one gap), the audit trail, and ending the employee's
    // currently-open DepartmentAssignment row rather than leaving it
    // reading as still-ongoing against a department that belonged to
    // the old market (verified against assignDepartment's own
    // established pattern below — see updateEmployee's own history for
    // the reasoning). This mirrors assignMarketSupervisor's existing
    // transaction shape exactly, no new pattern.
    if (isMarketChange) {
      data.department = null;
      data.tokenVersion = { increment: 1 };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id: req.params.id },
        data,
      });

      if (isMarketChange) {
        // First half only of assignDepartment's own pattern (the
        // "close out the open row" half) — never the second half
        // (creating a new DepartmentAssignment row), since the new
        // market's department is unknown at transfer time and picking
        // one is a deliberate, separate assignDepartment call once
        // someone actually chooses it.
        await tx.departmentAssignment.updateMany({
          where: { employeeId: employee.id, role: "MAIN", endDate: null },
          data: { endDate: new Date() },
        });

        // Widened scope (confirmed during plan review): a market move
        // is audited regardless of actor role — Admin, Regional
        // Manager, or Supervisor — since it's materially more
        // consequential than the routine SHIFT_CHANGED/
        // EMPLOYEE_ID_CHANGED edits below, which stay ADMIN-only as
        // before. This endpoint is staff-only (requireStaffRole above),
        // so req.user.userId is always a valid actor here.
        await recordAudit({
          tx,
          actorUserId: req.user.userId, action: "MARKET_ASSIGNMENT_CHANGED", targetType: "Employee", targetId: employee.id,
          marketId: req.body.marketId, previousMarketId: employee.marketId,
          previousValue: { marketId: employee.marketId }, newValue: { marketId: req.body.marketId },
        });
      }

      // Admin Phase 3 §11 — only audited when the actor is ADMIN (this
      // endpoint is also used routinely by Supervisor/RM for ordinary
      // employee edits, which aren't administrative-audit-worthy events —
      // see recordAudit's own "don't flood the log" note). Unlike
      // MARKET_ASSIGNMENT_CHANGED above, this scope is unchanged.
      if (req.user.role === "ADMIN") {
        if (req.body.shift !== undefined && req.body.shift !== employee.shift) {
          await recordAudit({
            tx,
            actorUserId: req.user.userId, action: "SHIFT_CHANGED", targetType: "Employee", targetId: employee.id,
            marketId: employee.marketId, previousValue: { shift: employee.shift }, newValue: { shift: req.body.shift },
          });
        }
        if ((employeeCode !== undefined && employeeCode !== employee.employeeCode) || (username !== undefined && username !== employee.username)) {
          await recordAudit({
            tx,
            actorUserId: req.user.userId, action: "EMPLOYEE_ID_CHANGED", targetType: "Employee", targetId: employee.id,
            marketId: employee.marketId,
            previousValue: { employeeCode: employee.employeeCode, username: employee.username },
            newValue: { employeeCode: employeeCode ?? employee.employeeCode, username: username ?? employee.username },
          });
        }
      }

      return result;
    });

    res.json(publicEmployee(updated));
  } catch (err) {
    next(err);
  }
}

// Admin Actions Verification — every Prisma model with an employeeId
// relation to Employee (the same 16 named in the plan's complete
// transfer data matrix, minus the 8 that don't carry employeeId at
// all). Required-FK models (Task, ItemReport, etc.) default to
// Restrict and would throw P2003 on delete; optional-FK models
// (AttendanceRecord, Activity, FingerprintEvent, AttendanceAuditLog,
// Break) default to SetNull and would throw NOTHING — Postgres just
// silently blanks employeeId on every one of those rows and lets the
// delete succeed, permanently losing the "who" on that history. A
// try/catch around P2003 alone only guards the first group, so this
// checks both groups up front and refuses the delete before it can
// ever reach either failure mode.
const EMPLOYEE_HISTORY_MODELS = [
  "task", "suddenTask", "itemReport", "priceReport", "wastedOverallReport",
  "leaveRequest", "requiredHoursAdjustment", "departmentAssignment",
  "countingAssignment", "cashierCleaningLog", "attendanceAdjustmentRequest",
  "kochOperation", "attendanceRecord", "activity", "fingerprintEvent",
  "attendanceAuditLog", "break",
];

// DELETE /api/employees/:id — only ever succeeds for an employee with
// genuinely zero rows across EMPLOYEE_HISTORY_MODELS (e.g. a
// just-created, never-active account). Anyone with real history must
// be suspended or banned instead — this mirrors the app's existing
// suspend/ban-is-the-real-mechanism philosophy rather than
// introducing a new one.
export async function deleteEmployee(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    await assertMarketAccess(req.user, employee.marketId);

    const counts = await Promise.all(
      EMPLOYEE_HISTORY_MODELS.map((model) => prisma[model].count({ where: { employeeId: req.params.id } }))
    );
    if (counts.some((c) => c > 0)) {
      return res.status(409).json({
        error: "This employee has historical records and cannot be deleted. Suspend or ban the account instead.",
      });
    }

    try {
      await prisma.employee.delete({ where: { id: req.params.id } });
    } catch (err) {
      // Defensive fallback only, e.g. a row inserted in the gap between
      // the count check above and this delete — not the primary guard.
      if (err.code === "P2003") {
        return res.status(409).json({
          error: "This employee has historical records and cannot be deleted. Suspend or ban the account instead.",
        });
      }
      throw err;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// POST /api/employees/:id/department — staff-only. Assigns the
// employee's MAIN department (Night Shift §3: "exactly one Main
// Department"). Department assignment is management-controlled (spec
// §3: "Employees must not be able to modify their own department") —
// there is no employee-facing write path to this at all, only the read
// (GET /api/profile already returns employee.department). Closes out
// only the previous MAIN DepartmentAssignment's endDate (any open
// ADDITIONAL rows are untouched — see addAdditionalDepartment/
// removeAdditionalDepartment below) and creates a new open-ended MAIN
// one, then syncs the denormalized Employee.department cache (which has
// always meant "current MAIN department") in the same transaction.
export async function assignDepartment(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    await assertMarketAccess(req.user, employee.marketId);

    const { department } = req.body;
    const now = new Date();

    const [, assignment] = await prisma.$transaction([
      prisma.departmentAssignment.updateMany({
        where: { employeeId: employee.id, role: "MAIN", endDate: null },
        data: { endDate: now },
      }),
      prisma.departmentAssignment.create({
        data: { employeeId: employee.id, department, role: "MAIN", assignedById: req.user.userId, startDate: now },
      }),
      prisma.employee.update({ where: { id: employee.id }, data: { department } }),
    ]);

    // Registers this department in the market's catalog if it's the
    // first time it's been used there — see MarketDepartment's own
    // schema comment (Phase 2). Outside the transaction above since it's
    // an idempotent upsert-style operation, not something that needs to
    // roll back with the assignment.
    await ensureMarketDepartment(employee.marketId, department, req.user.userId);

    if (req.user.kind === "staff" && req.user.role === "ADMIN") {
      await recordAudit({
        actorUserId: req.user.userId, action: "DEPARTMENT_ASSIGNMENT_CHANGED", targetType: "Employee", targetId: employee.id,
        marketId: employee.marketId, previousValue: { department: employee.department }, newValue: { department },
      });
    }

    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
}

// GET /api/employees/:id/department-history — staff-only. Newest first;
// the row with endDate = null (if any) is the current assignment.
export async function getDepartmentHistory(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    await assertMarketAccess(req.user, employee.marketId);

    const history = await prisma.departmentAssignment.findMany({
      where: { employeeId: employee.id },
      include: { assignedBy: { select: { id: true, name: true } } },
      orderBy: { startDate: "desc" },
    });

    res.json(history);
  } catch (err) {
    next(err);
  }
}

// Night Shift §3-5/§27 — resolves an employee's full current
// responsibility set: exactly one MAIN department (falls back to the
// denormalized Employee.department cache if no DepartmentAssignment row
// exists yet — matches how every other MAIN-department reader in this
// app already behaves) plus zero-or-more open ADDITIONAL rows. Exported
// for nightShiftController.js's task-generation eligibility check and
// the profile-visibility endpoints below, so there is exactly one place
// this "what is this employee responsible for right now" logic lives.
export async function getCurrentDepartments(employeeId) {
  const openRows = await prisma.departmentAssignment.findMany({
    where: { employeeId, endDate: null },
    orderBy: { startDate: "desc" },
  });
  const mainRow = openRows.find((r) => r.role === "MAIN");
  const additional = openRows.filter((r) => r.role === "ADDITIONAL").map((r) => r.department);
  return { main: mainRow?.department ?? null, additional };
}

// POST /api/employees/:id/additional-departments — staff-only. Adds ONE
// additional-responsibility department (Night Shift §3-4) without
// touching the employee's MAIN department or any other open ADDITIONAL
// row. Idempotent — adding the same department twice is a no-op rather
// than creating a duplicate open row (upsert-style: only create if no
// open row already exists for this exact department).
export async function addAdditionalDepartment(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    await assertMarketAccess(req.user, employee.marketId);

    const { department } = req.body;
    const existing = await prisma.departmentAssignment.findFirst({
      where: { employeeId: employee.id, role: "ADDITIONAL", department, endDate: null },
    });
    if (existing) return res.status(200).json(existing);

    const created = await prisma.departmentAssignment.create({
      data: { employeeId: employee.id, department, role: "ADDITIONAL", assignedById: req.user.userId },
    });
    await ensureMarketDepartment(employee.marketId, department, req.user.userId);

    if (req.user.kind === "staff" && req.user.role === "ADMIN") {
      await recordAudit({
        actorUserId: req.user.userId, action: "DEPARTMENT_ASSIGNMENT_CHANGED", targetType: "Employee", targetId: employee.id,
        marketId: employee.marketId, newValue: { additionalDepartmentAdded: department },
      });
    }

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/employees/:id/additional-departments/:department —
// staff-only. Closes the open ADDITIONAL row for this specific
// department, same "close, never delete" history convention as MAIN
// (spec §26: preserve historical assignment data). A no-op (200, not an
// error) if no such open row exists — deleting something that isn't
// there isn't a client error worth surfacing.
export async function removeAdditionalDepartment(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    await assertMarketAccess(req.user, employee.marketId);

    await prisma.departmentAssignment.updateMany({
      where: { employeeId: employee.id, role: "ADDITIONAL", department: req.params.department, endDate: null },
      data: { endDate: new Date() },
    });

    if (req.user.kind === "staff" && req.user.role === "ADMIN") {
      await recordAudit({
        actorUserId: req.user.userId, action: "DEPARTMENT_ASSIGNMENT_CHANGED", targetType: "Employee", targetId: employee.id,
        marketId: employee.marketId, newValue: { additionalDepartmentRemoved: req.params.department },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
