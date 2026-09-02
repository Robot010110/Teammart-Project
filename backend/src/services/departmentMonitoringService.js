import { prisma } from "../lib/prisma.js";

// departmentMonitoringService.js — the read/derive logic behind Phase
// 2's Market Department Monitoring page and completion tracking. Talks
// only to the models Phase 1/2 already established (MarketDepartment,
// DepartmentAssignment, Activity/ActivityImage) — no new source of
// truth, no data duplicated for display purposes (spec §13: "one source
// of truth").

function dayOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Auto-registers a department name in a market's catalog the first time
// it's actually used (a DepartmentAssignment, or a Department Closing
// submission) — see MarketDepartment's own schema comment for why this
// table exists at all. Safe to call repeatedly: findFirst-then-create,
// same idempotent-registration pattern used elsewhere in this app
// (e.g. seed.js's findOrCreateMarket).
export async function ensureMarketDepartment(marketId, name, createdById = null) {
  const existing = await prisma.marketDepartment.findFirst({ where: { marketId, name } });
  if (existing) return existing;
  return prisma.marketDepartment.create({ data: { marketId, name, createdById } });
}

// The core per-department status computation for one market/day. Not a
// stored value anywhere — always derived fresh from MarketDepartment +
// current DepartmentAssignment + today's DEPARTMENT_CLOSING Activity, so
// there's nothing to keep in sync ("last touched" in the UI is just
// whichever submission has the latest createdAt, not a separate field).
export async function getMarketDepartmentStatus(marketId, { date = new Date() } = {}) {
  const dayStart = dayOnly(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [departments, employees, submissions] = await Promise.all([
    prisma.marketDepartment.findMany({ where: { marketId, active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { marketId, department: { not: null } }, select: { id: true, name: true, department: true } }),
    // Two ownership shapes can belong to this market: the normal
    // employee-owned submission (employee.marketId), and a Supervisor's
    // submission for a genuinely unassigned department, which has no
    // employee at all and carries marketId directly instead (see
    // Activity.employeeId's own schema comment) — both must be included
    // here or an unassigned-department submission would silently never
    // appear as "Completed" on this market's monitoring view.
    prisma.activity.findMany({
      where: {
        category: "DEPARTMENT_CLOSING",
        date: { gte: dayStart, lt: dayEnd },
        OR: [{ employee: { marketId } }, { marketId }],
      },
      include: {
        images: true,
        employee: { select: { id: true, name: true } },
        submittedByStaff: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const employeesByDepartment = new Map();
  for (const emp of employees) {
    const list = employeesByDepartment.get(emp.department) ?? [];
    list.push(emp);
    employeesByDepartment.set(emp.department, list);
  }

  // Most recent submission per department name — submissions is already
  // newest-first, so the first match per department wins.
  const latestSubmissionByDepartment = new Map();
  for (const sub of submissions) {
    if (!latestSubmissionByDepartment.has(sub.department)) {
      latestSubmissionByDepartment.set(sub.department, sub);
    }
  }

  return departments.map((dept) => {
    const assignedEmployees = employeesByDepartment.get(dept.name) ?? [];
    const submission = latestSubmissionByDepartment.get(dept.name) ?? null;

    // PENDING/APPROVED both count as a real completed submission for
    // today; DRAFT means the employee started but never finished
    // submitting (not completed); REJECTED means a supervisor sent it
    // back (needs resubmission — not completed either).
    const isCompleted = submission && ["PENDING", "APPROVED"].includes(submission.status);

    let state;
    if (isCompleted) state = "COMPLETED";
    else if (assignedEmployees.length === 0) state = "UNASSIGNED";
    else state = "MISSING";

    const image = submission?.images?.[0] ?? null;

    return {
      department: dept.name,
      marketDepartmentId: dept.id,
      assignedEmployees: assignedEmployees.map((e) => ({ id: e.id, name: e.name })),
      state,
      submission: submission
        ? {
            activityId: submission.id,
            status: submission.status,
            submittedAt: submission.createdAt,
            submittedBy: submission.submittedByStaff
              ? { kind: "staff", id: submission.submittedByStaff.id, name: submission.submittedByStaff.name }
              : { kind: "employee", id: submission.employee.id, name: submission.employee.name },
            photoAvailable: !!image && !image.expiredAt,
            photoExpired: !!image && !!image.expiredAt,
            // Market Activities' department-review workflow (Supervisor
            // Market page redesign) needs every photo + the employee's own
            // notes to actually review a submission, not just the
            // first-image booleans above (kept for existing callers).
            // expiredAt-flagged images still appear here — the frontend
            // renders them as expired placeholders rather than dropping
            // them, so the supervisor can see a photo WAS attached.
            notes: submission.notes,
            images: submission.images.map((img) => ({ id: img.id, url: img.expiredAt ? null : img.url, expired: !!img.expiredAt })),
            rejectionReason: submission.rejectionReason,
          }
        : null,
    };
  });
}

// Backend-authoritative completion count for a market/day — never trust
// a frontend-computed count (spec §17-19). Returns which departments are
// still missing by name, not just a number, so the UI can list them
// exactly as the spec's own example does.
export async function getMarketDepartmentCompletion(marketId, { date = new Date() } = {}) {
  const statuses = await getMarketDepartmentStatus(marketId, { date });
  const requiredCount = statuses.length;
  const completed = statuses.filter((s) => s.state === "COMPLETED");
  const missing = statuses.filter((s) => s.state !== "COMPLETED");
  const completedByStaff = completed.filter((s) => s.submission?.submittedBy?.kind === "staff");

  return {
    requiredCount,
    completedCount: completed.length,
    isComplete: requiredCount > 0 && completed.length === requiredCount,
    missing: missing.map((s) => ({ department: s.department, state: s.state })),
    completedByStaff: completedByStaff.map((s) => s.department),
    statuses,
  };
}
