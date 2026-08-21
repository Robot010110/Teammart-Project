import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, requireAccessibleEmployee } from "../middleware/auth.js";
import { createNotificationForUser } from "../utils/notifications.js";

// countingAssignmentsController.js — Inventory Counting spec §1-3: which
// department/area an employee currently counts. "Current" is always the
// most recent CountingAssignment row for that employee (append-only
// history, same convention as DepartmentAssignment) — no row at all just
// means "use their plain department, no specific area yet".

function shapeAssignment(a) {
  if (!a) return null;
  return {
    id: a.id,
    originalDepartment: a.originalDepartment,
    assignedDepartment: a.assignedDepartment,
    countingArea: a.countingArea,
    assignedBy: a.assignedBy ? { id: a.assignedBy.id, name: a.assignedBy.name } : null,
    verifiedBy: a.verifiedBy ? { id: a.verifiedBy.id, name: a.verifiedBy.name } : null,
    verifiedAt: a.verifiedAt,
    // Derived, not stored — a same-department assignment (just a more
    // specific area within the employee's own department) never needs
    // Regional/Zone Manager sign-off (spec §3 is explicit that it's the
    // CROSS-department case that requires it).
    needsVerification: a.originalDepartment != null && a.originalDepartment !== a.assignedDepartment,
    createdAt: a.createdAt,
  };
}

const ASSIGNMENT_INCLUDE = {
  assignedBy: { select: { id: true, name: true } },
  verifiedBy: { select: { id: true, name: true } },
};

// GET /api/counting-assignments/mine — employee-only. Falls back to a
// synthesized "default" (their plain department, no specific area, no
// verification concept) when no explicit assignment has ever been made —
// spec §1: "every worker should have a default inventory-counting
// assignment based on their department."
export async function getMyAssignment(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.user.employeeId }, select: { department: true } });
    const latest = await prisma.countingAssignment.findFirst({
      where: { employeeId: req.user.employeeId },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    if (latest) return res.json(shapeAssignment(latest));

    res.json({
      id: null,
      originalDepartment: employee?.department ?? null,
      assignedDepartment: employee?.department ?? null,
      countingArea: null,
      assignedBy: null,
      verifiedBy: null,
      verifiedAt: null,
      needsVerification: false,
      createdAt: null,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/counting-assignments — Supervisor/Admin/Regional-Manager
// only (spec §1: "a supervisor may assign the employee..."). Body:
// { employeeId, assignedDepartment, countingArea? }. Snapshots the
// employee's CURRENT department as originalDepartment — this is what
// makes a cross-department assignment structurally detectable later.
// When it IS cross-department, notifies the market's zone Regional/Zone
// Manager that verification is needed (spec §3).
export async function createCountingAssignment(req, res, next) {
  try {
    if (req.user.kind !== "staff" || !["SUPERVISOR", "ADMIN", "REGIONAL_MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized to assign inventory counting" });
    }
    const { employeeId, assignedDepartment, countingArea } = req.body;

    const employee = await requireAccessibleEmployee(req.user, employeeId);

    const assignment = await prisma.countingAssignment.create({
      data: {
        employeeId: employee.id,
        originalDepartment: employee.department,
        assignedDepartment,
        countingArea: countingArea || null,
        assignedById: req.user.userId,
      },
      include: ASSIGNMENT_INCLUDE,
    });

    if (employee.department && employee.department !== assignedDepartment) {
      const market = await prisma.market.findUnique({
        where: { id: employee.marketId },
        select: { name: true, zone: { select: { managerId: true } } },
      });
      if (market?.zone?.managerId) {
        await createNotificationForUser({
          userId: market.zone.managerId,
          type: "COUNTING_ASSIGNMENT_VERIFICATION_NEEDED",
          title: "Counting Assignment Needs Verification",
          body: `${employee.name} (${market.name}) was assigned to count ${assignedDepartment} instead of their usual ${employee.department}. Please review.`,
          linkType: "COUNTING_ASSIGNMENT",
          linkId: assignment.id,
        });
      }
    }

    res.status(201).json(shapeAssignment(assignment));
  } catch (err) {
    next(err);
  }
}

// POST /api/counting-assignments/:id/verify — Regional-Manager/Admin
// only. Only meaningful for a cross-department assignment, but not
// blocked for a same-department one either (harmless no-op-ish
// confirmation) — the frontend only ever surfaces this action for
// assignments that actually need it.
export async function verifyCountingAssignment(req, res, next) {
  try {
    if (req.user.kind !== "staff" || (req.user.role !== "REGIONAL_MANAGER" && req.user.role !== "ADMIN")) {
      return res.status(403).json({ error: "Only a Regional Manager or Admin account can verify a counting assignment" });
    }
    const assignment = await prisma.countingAssignment.findUnique({
      where: { id: req.params.id },
      include: { employee: { select: { marketId: true, name: true } } },
    });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    await assertMarketAccess(req.user, assignment.employee.marketId);

    const updated = await prisma.countingAssignment.update({
      where: { id: assignment.id },
      data: { verifiedById: req.user.userId, verifiedAt: new Date() },
      include: ASSIGNMENT_INCLUDE,
    });

    if (updated.assignedBy) {
      await createNotificationForUser({
        userId: updated.assignedBy.id,
        type: "COUNTING_ASSIGNMENT_VERIFIED",
        title: "Counting Assignment Verified",
        body: `${assignment.employee.name}'s assignment to count ${updated.assignedDepartment} was verified.`,
        linkType: "COUNTING_ASSIGNMENT",
        linkId: updated.id,
      });
    }

    res.json(shapeAssignment(updated));
  } catch (err) {
    next(err);
  }
}

// GET /api/counting-assignments/market?marketId=&pending=true&employeeId=
// — staff-only. `pending=true` narrows to cross-department assignments
// still awaiting verification — the Regional/Zone Manager's review
// queue. `employeeId` narrows to one employee's own assignment history —
// spec §10's audit trail (RmEmployeeProfile.jsx).
export async function listCountingAssignmentsForMarket(req, res, next) {
  try {
    const { pending, employeeId } = req.query;
    const marketId = req.query.marketId ?? req.user.marketId;
    if (!marketId) return res.status(400).json({ error: "marketId is required" });
    await assertMarketAccess(req.user, marketId);

    const where = { employee: { marketId } };
    if (employeeId) where.employeeId = employeeId;
    if (pending === "true") where.verifiedAt = null;

    const assignments = await prisma.countingAssignment.findMany({
      where,
      include: { ...ASSIGNMENT_INCLUDE, employee: { select: { id: true, name: true, employeeCode: true, department: true } } },
      orderBy: { createdAt: "desc" },
    });

    // needsVerification (cross-department vs. same-department) is
    // derived, not a DB column — filtered here rather than in the query
    // itself; this table stays small (one row per reassignment, not per
    // day), so this is cheap.
    const shaped = assignments
      .map((a) => ({ ...shapeAssignment(a), employee: a.employee }))
      .filter((a) => pending !== "true" || a.needsVerification);

    res.json(shaped);
  } catch (err) {
    next(err);
  }
}
