import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma.js";
import { assertMarketAccess, assertZoneAccess, requireAccessibleEmployee, HttpError } from "../middleware/auth.js";
import { createNotification, createNotificationForUser } from "../utils/notifications.js";
import { UPLOADS_DIR } from "../utils/fileStorage.js";
import { ensureMarketDepartment } from "../services/departmentMonitoringService.js";
import { notifyNightShiftCompletion } from "../services/nightShiftService.js";

// Department Closing photos expire 16 hours after submission (Phase 1
// spec §15) — every other Activity category's images stay permanent
// (see ActivityImage.expiresAt's own schema comment).
const DEPARTMENT_CLOSING_PHOTO_RETENTION_MS = 16 * 60 * 60 * 1000;

// Cleanup Phase §12 — every OTHER Activity category's evidence photo
// previously never expired at all (expiresAt stayed null forever).
// Department Closing keeps its own much shorter, deliberately-different
// 16h window (a same-shift verification photo, not general evidence) —
// untouched. Everything else now gets the general 1-month retention
// policy; runDepartmentPhotoExpirySweep (maintenanceScheduler.js) is
// already fully generic (WHERE expiresAt <= now), so this is the only
// change needed — no new sweep, no duplicated storage mechanism. The
// Activity row itself is never touched by this — only its ActivityImage
// rows' underlying files get deleted once expired (see
// runDepartmentPhotoExpirySweep's own comment), preserving History for
// performance calculations exactly as before.
const GENERAL_PHOTO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function expiresAtFor(category) {
  if (category === "DEPARTMENT_CLOSING") return new Date(Date.now() + DEPARTMENT_CLOSING_PHOTO_RETENTION_MS);
  return new Date(Date.now() + GENERAL_PHOTO_RETENTION_MS);
}

// Deletes the physical file + its UploadedFile metadata row for a URL
// this app's own upload endpoint produced (see
// utils/fileStorage.js/controllers/uploadsController.js) — a no-op for
// anything else (a legacy base64 data: URL, or any URL that isn't ours),
// so this is always safe to call speculatively. Used wherever an
// ActivityImage is deleted/replaced, so removing/replacing a photo never
// leaves an orphaned file on disk (Phase 1 spec §17).
async function deleteUnderlyingFileIfOwned(url) {
  const match = /\/api\/uploads\/([0-9a-f-]{36}\.[a-z0-9]{1,10})$/i.exec(url ?? "");
  if (!match) return;
  const filename = match[1];
  await prisma.uploadedFile.delete({ where: { filename } }).catch(() => {});
  await unlink(path.join(UPLOADS_DIR, filename)).catch(() => {});
}

// activitiesController.js — Phase 1, Step 3/4/5: an Employee's own daily
// activity log (EXPIRED_ITEMS, SHELF_CLEANING, etc.), separate from the
// existing Task model (which is for supervisor-assigned work — untouched
// by this file). Every endpoint here is employee-only and always scoped
// to req.user.employeeId, so one employee can never read or edit another
// employee's activities.

// Once an activity has been reviewed, it should no longer be editable by
// the employee. No review endpoint exists yet, so in practice this only
// ever guards DRAFT/PENDING today — it's here so nothing breaks once a
// Supervisor review feature is added later.
const EDITABLE_STATUSES = ["DRAFT", "PENDING"];

// Performance = approved reviewed work / all reviewed work. "Reviewed"
// means APPROVED or REJECTED only — a DRAFT or PENDING activity hasn't
// been judged yet and must not count either way (an employee who's just
// been busy submitting drafts shouldn't see their rate swing on unreviewed
// volume). Deterministic, documented, and computed in this one place so
// the "current" figure and every history bucket use the exact same rule.
function computeActivityPerformance(activities) {
  const approved = activities.filter((a) => a.status === "APPROVED").length;
  const rejected = activities.filter((a) => a.status === "REJECTED").length;
  const pending = activities.filter((a) => a.status === "PENDING").length;
  const totalReviewed = approved + rejected;
  const rate = totalReviewed > 0 ? (approved / totalReviewed) * 100 : null;
  return { approved, rejected, pending, totalReviewed, rate };
}

function startOfWeek(date) {
  // Monday-start week, matching how most of this app's date logic treats
  // a "week" elsewhere (attendance calendars render Mon-first rows).
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// GET /api/activities/performance — the current employee's lifetime
// Performance figure (spec: a real number from real reviewed-activity
// data, never a hardcoded percentage; a graceful "no data yet" state
// when there's nothing reviewed).
export async function getPerformanceSummary(req, res, next) {
  try {
    const activities = await prisma.activity.findMany({
      where: { employeeId: req.user.employeeId },
      select: { status: true },
    });
    res.json(computeActivityPerformance(activities));
  } catch (err) {
    next(err);
  }
}

// GET /api/activities/performance-history?weeks=4&months=6 — Performance
// per recent calendar week and per recent calendar month, current
// (in-progress) period included and labeled as such — unlike Attendance
// Rate, which explicitly never shows the current month as final, this
// screen's own spec explicitly asks for a live "This Week"/current-month
// figure alongside history, so it's included rather than withheld.
export async function getActivityPerformanceHistory(req, res, next) {
  try {
    const weeks = Math.min(Number(req.query.weeks) || 4, 12);
    const months = Math.min(Number(req.query.months) || 6, 24);
    const now = new Date();

    const activities = await prisma.activity.findMany({
      where: { employeeId: req.user.employeeId },
      select: { status: true, date: true },
    });

    const weekly = [];
    for (let i = 0; i < weeks; i += 1) {
      const weekStart = new Date(startOfWeek(now));
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const inWeek = activities.filter((a) => a.date >= weekStart && a.date < weekEnd);
      weekly.push({ weekStart, weekEnd, ...computeActivityPerformance(inWeek) });
    }

    const monthly = [];
    for (let i = 0; i < months; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const inMonth = activities.filter((a) => a.date >= monthStart && a.date < monthEnd);
      monthly.push({ year: d.getFullYear(), month: d.getMonth() + 1, ...computeActivityPerformance(inMonth) });
    }

    res.json({ weekly, monthly });
  } catch (err) {
    next(err);
  }
}

// GET /api/activities?category=&status= — the current employee's own
// activity log only.
export async function listActivities(req, res, next) {
  try {
    const { category, status } = req.query;
    const where = { employeeId: req.user.employeeId };
    if (category) where.category = category;
    if (status) where.status = status;

    const activities = await prisma.activity.findMany({
      where,
      // nightShiftTaskDefinition — purely additive; null for every
      // non-Night-Shift category, so this doesn't change the shape of
      // any existing caller's data, only adds a field Night Shift's own
      // completion history (NightShiftDashboardScreen.jsx) reads.
      include: { images: true, countingAssignment: true, nightShiftTaskDefinition: true },
      orderBy: { date: "desc" },
    });

    res.json(activities);
  } catch (err) {
    next(err);
  }
}

// GET /api/activities/market?marketId=&employeeId=&category=&status= —
// staff-only, scoped to a market they can access (Supervisor: only their
// own market). Powers Supervisor Mode's "Today's Activity" feed and an
// employee's Activity History — mirrors the exact pattern already used
// for wasted-overall/market, price-reports/market, item-reports/market.
export async function listActivitiesForMarket(req, res, next) {
  try {
    const { employeeId, category, status } = req.query;
    const marketId = req.query.marketId ?? req.user.marketId;
    if (!marketId) {
      return res.status(400).json({ error: "marketId is required" });
    }
    await assertMarketAccess(req.user, marketId);

    // OR'd across both ownership shapes (see Activity.employeeId's own
    // schema comment) so an unassigned-department Department Closing —
    // employeeId: null, marketId set directly — still shows up here,
    // same reasoning as departmentMonitoringService's submissions query.
    // employeeId, when given, narrows WITHIN that market scope — it does
    // not replace it, so a Supervisor still can't reach an employee
    // outside their own market just by passing that employee's id.
    const where = { OR: [{ employee: { marketId } }, { marketId }] };
    if (employeeId) where.employeeId = employeeId;
    if (category) where.category = category;
    if (status) where.status = status;

    const activities = await prisma.activity.findMany({
      where,
      include: {
        images: true,
        countingAssignment: true,
        employee: { select: { id: true, name: true, employeeCode: true } },
        submittedByStaff: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    res.json(activities);
  } catch (err) {
    next(err);
  }
}

// GET /api/activities/company?marketId=&zoneId=&category=&status=&employeeId=&take=
// — Admin Phase 1 §17: a company-wide activity feed, no market scoping
// (unlike listActivitiesForMarket above, which always requires and
// enforces one market). Reuses the exact same Activity table/shape —
// capped at `take` (default 100) most-recent-first so this never pulls
// the entire company's activity history into one response.
//
// Market Activities §5 (Regional Manager's "Today's Zone Activity" feed)
// reuses this same endpoint rather than a near-duplicate one — the only
// difference is scope: ADMIN sees everything (unchanged); a
// REGIONAL_MANAGER is confined to their own zone(s) no matter what
// marketId/zoneId they pass (assertMarketAccess/assertZoneAccess below),
// and defaults to all of their zones when neither is given, instead of
// ADMIN's "everything" default.
export async function listCompanyActivities(req, res, next) {
  try {
    if (req.user.kind !== "staff" || (req.user.role !== "ADMIN" && req.user.role !== "REGIONAL_MANAGER")) {
      return res.status(403).json({ error: "Only an Admin or Regional Manager account can view this activity feed" });
    }

    let { marketId, zoneId, category, status, employeeId, take } = req.query;

    if (req.user.role === "REGIONAL_MANAGER") {
      if (marketId) {
        await assertMarketAccess(req.user, marketId);
      } else if (zoneId) {
        await assertZoneAccess(req.user, zoneId);
      } else {
        zoneId = { in: req.user.zoneIds };
      }
    }

    const where = {};
    if (marketId) {
      where.OR = [{ employee: { marketId } }, { marketId }];
    } else if (zoneId) {
      where.OR = [{ employee: { market: { zoneId } } }, { market: { zoneId } }];
    }
    if (employeeId) where.employeeId = employeeId;
    if (category) where.category = category;
    if (status) where.status = status;

    const activities = await prisma.activity.findMany({
      where,
      include: {
        images: true,
        employee: { select: { id: true, name: true, employeeCode: true, marketId: true, market: { select: { name: true, zoneId: true } } } },
        submittedByStaff: { select: { id: true, name: true } },
        market: { select: { name: true, zoneId: true } },
      },
      orderBy: { date: "desc" },
      take: take ?? 100,
    });

    res.json(activities);
  } catch (err) {
    next(err);
  }
}

// POST /api/activities/:id/review — staff-only. Approve or reject a
// PENDING activity. Access is scoped via the activity's OWN employee's
// market — assertMarketAccess runs against activity.employee.marketId,
// which is looked up fresh from the database, never trusted from the
// request — so a Supervisor cannot approve/reject an activity outside
// their market just by changing the :id in the URL (Regional Manager:
// scoped to their zone; Admin: any, same as every other staff-scoped
// endpoint in this app).
export async function reviewActivity(req, res, next) {
  try {
    const { status, rejectionReason } = req.body;
    const activity = await prisma.activity.findUnique({
      where: { id: req.params.id },
      include: { employee: { select: { id: true, marketId: true } } },
    });
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    await assertMarketAccess(req.user, activity.employee.marketId);

    if (activity.status !== "PENDING") {
      return res.status(400).json({ error: `This activity is ${activity.status.toLowerCase()}, not pending review` });
    }

    const updated = await prisma.activity.update({
      where: { id: activity.id },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
        reviewedById: req.user.userId,
        reviewedAt: new Date(),
      },
      include: { images: true },
    });

    const categoryLabel = activity.category.toLowerCase().replace(/_/g, " ");
    await createNotification({
      employeeId: activity.employee.id,
      type: "SUBMISSION_REVIEWED",
      title: status === "APPROVED" ? "Activity Approved" : "Activity Rejected",
      body:
        status === "APPROVED"
          ? `Your ${categoryLabel} activity was approved.`
          : `Your ${categoryLabel} activity was rejected${rejectionReason ? `: ${rejectionReason}` : "."}`,
      linkType: "ACTIVITY",
      linkId: activity.id,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/activities/:id
export async function getActivity(req, res, next) {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: req.params.id },
      include: { images: true },
    });
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if (activity.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: "You do not have access to this activity" });
    }

    res.json(activity);
  } catch (err) {
    next(err);
  }
}

// Shared by createActivity (employee, below), createDepartmentClosingForEmployee,
// and createDepartmentClosingForUnassignedDepartment (staff-on-behalf-of,
// further down) — ONE place that actually inserts an Activity row, so a
// Department Closing submitted by an employee and one submitted by their
// Supervisor (whether for an assigned employee or a genuinely unassigned
// department) are the exact same kind of record (spec §13: "one source
// of truth"), distinguished only by which of employeeId/submittedByStaffId
// is set.
async function createActivityRecord({
  category, date, time, notes, status, productId, labelIssueType, countingAssignmentId, department,
  employeeId, marketId, submittedByStaffId, imageUrls,
}) {
  const imageExpiresAt = expiresAtFor(category);
  return prisma.activity.create({
    data: {
      category,
      date,
      time,
      notes,
      status,
      productId,
      labelIssueType,
      countingAssignmentId,
      department,
      employeeId: employeeId ?? null,
      marketId: marketId ?? null,
      submittedByStaffId: submittedByStaffId ?? null,
      images: imageUrls?.length ? { create: imageUrls.map((url) => ({ url, expiresAt: imageExpiresAt })) } : undefined,
    },
    include: { images: true, countingAssignment: true },
  });
}

// Notifies a market's Supervisor AND Overlooking account (whichever
// exist) that a Department Closing was submitted (Phase 2 §11) — never
// an unrelated market, since marketId always comes from a value the
// caller already verified access to, never from raw client input.
async function notifyDepartmentClosingSubmitted(activity, marketId, submitterName) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { supervisorId: true, overlookingSupervisorId: true },
  });
  const recipientIds = [market?.supervisorId, market?.overlookingSupervisorId].filter(Boolean);
  await Promise.all(
    recipientIds.map((userId) =>
      createNotificationForUser({
        userId,
        type: "DEPARTMENT_CLOSING_SUBMITTED",
        title: "Department Closing Submitted",
        body: `${submitterName} completed the closing check for ${activity.department}.`,
        linkType: "DEPARTMENT_CLOSING",
        linkId: activity.id,
      })
    )
  );
}

// POST /api/activities — an employee logs a new daily activity. Defaults
// to DRAFT (not submitted yet) unless the caller explicitly sets PENDING.
export async function createActivity(req, res, next) {
  try {
    const { category, date, time, notes, status, imageUrls, productId, labelIssueType, countingAssignmentId } = req.body;

    // A submitted countingAssignmentId must actually belong to the
    // submitting employee — never trust a client-supplied id blindly
    // (same reasoning as every other cross-record reference in this app).
    if (countingAssignmentId) {
      const assignment = await prisma.countingAssignment.findUnique({ where: { id: countingAssignmentId } });
      if (!assignment || assignment.employeeId !== req.user.employeeId) {
        return res.status(400).json({ error: "This counting assignment does not belong to you" });
      }
    }

    // Department Closing (Phase 2 §6): the department is ALWAYS the
    // employee's own real, currently-assigned department, looked up
    // fresh from the database — never accepted from the client. This is
    // what makes "employeeId=A, department=B" (an unauthorized
    // department) impossible: there is no `department` field in the
    // request body this branch ever reads.
    let department;
    if (category === "DEPARTMENT_CLOSING") {
      const employee = await prisma.employee.findUnique({ where: { id: req.user.employeeId }, select: { department: true } });
      if (!employee?.department) {
        return res.status(400).json({ error: "You have no department assigned yet — ask your Supervisor to assign one first." });
      }
      department = employee.department;
    }

    const activity = await createActivityRecord({
      category, date, time, notes, status, productId, labelIssueType, countingAssignmentId, department, imageUrls,
      employeeId: req.user.employeeId,
    });

    if (category === "DEPARTMENT_CLOSING" && ["PENDING", "APPROVED"].includes(activity.status)) {
      const employee = await prisma.employee.findUnique({ where: { id: req.user.employeeId }, select: { name: true, marketId: true } });
      await notifyDepartmentClosingSubmitted(activity, employee.marketId, employee.name);
    }

    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
}

// POST /api/activities/department-closing/:employeeId — staff-only:
// "authorized supervisor" submitting a Department Closing on an
// ASSIGNED employee's behalf (spec §12). Authorization is the exact same
// assertMarketAccess/requireAccessibleEmployee every other staff-on-
// behalf-of-an-employee endpoint in this app already uses (e.g.
// tasksController.assignTask) — the employee is looked up fresh from
// the database, so a Supervisor can never target an employee outside
// their own market/zone just by changing :employeeId in the URL. Same
// server-authoritative department rule as createActivity above: the
// request body has no `department` field for this reason either — the
// department submitted is always this employee's own real one.
export async function createDepartmentClosingForEmployee(req, res, next) {
  try {
    const employee = await requireAccessibleEmployee(req.user, req.params.employeeId);
    if (!employee.department) {
      return res.status(400).json({ error: "This employee has no department assigned yet." });
    }
    const { date, time, notes, status, imageUrls } = req.body;

    const activity = await createActivityRecord({
      category: "DEPARTMENT_CLOSING", date, time, notes, status, department: employee.department, imageUrls,
      employeeId: employee.id,
      submittedByStaffId: req.user.userId,
    });

    if (["PENDING", "APPROVED"].includes(activity.status)) {
      await notifyDepartmentClosingSubmitted(activity, employee.marketId, `Supervisor (for ${employee.name})`);
    }

    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
}

// POST /api/activities/department-closing/market/:marketId — staff-only:
// a Supervisor/Overlooking completing a Department Closing for a
// genuinely UNASSIGNED department in their own market (spec §15-16) — no
// employee exists to attribute this to at all, so employeeId is null and
// marketId + submittedByStaffId are this record's sole owner (see
// Activity.employeeId's own schema comment). Rejects if the named
// department actually HAS an assigned employee right now — that case
// must go through createDepartmentClosingForEmployee above instead, so
// the two paths never produce ambiguous "who does this represent" data.
export async function createDepartmentClosingForUnassignedDepartment(req, res, next) {
  try {
    const marketId = req.params.marketId;
    await assertMarketAccess(req.user, marketId);

    const { date, time, notes, status, imageUrls, department } = req.body;

    const assignedEmployee = await prisma.employee.findFirst({ where: { marketId, department } });
    if (assignedEmployee) {
      return res.status(400).json({
        error: "This department has an assigned employee — submit through their own Department Closing instead of the unassigned-department path.",
      });
    }

    await ensureMarketDepartment(marketId, department, req.user.userId);

    const activity = await createActivityRecord({
      category: "DEPARTMENT_CLOSING", date, time, notes, status, department, imageUrls,
      marketId,
      submittedByStaffId: req.user.userId,
    });

    if (["PENDING", "APPROVED"].includes(activity.status)) {
      await notifyDepartmentClosingSubmitted(activity, marketId, "Supervisor");
    }

    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/activities/:id — edit an activity the employee hasn't been
// reviewed on yet (see EDITABLE_STATUSES).
export async function updateActivity(req, res, next) {
  try {
    const activity = await prisma.activity.findUnique({ where: { id: req.params.id } });
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if (activity.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: "You do not have access to this activity" });
    }
    if (!EDITABLE_STATUSES.includes(activity.status)) {
      return res.status(400).json({ error: `Activity is already ${activity.status.toLowerCase()} and can no longer be edited` });
    }

    // Night Shift §12-13/§16: submitting (DRAFT/PENDING -> PENDING) a
    // Night Shift task independently re-validates the evidence
    // requirement server-side — never trusts a frontend photo count
    // (spec §13: "the backend must independently validate that the
    // final submission contains at least N valid stored evidence
    // items"). Uses the REAL current ActivityImage count for this row,
    // not anything the client claims.
    if (activity.category === "NIGHT_SHIFT_TASK" && req.body.status === "PENDING" && activity.nightShiftTaskDefinitionId) {
      const definition = await prisma.nightShiftTaskDefinition.findUnique({ where: { id: activity.nightShiftTaskDefinitionId } });
      if (definition?.requiresEvidence) {
        const photoCount = await prisma.activityImage.count({ where: { activityId: activity.id } });
        if (photoCount < definition.minPhotos) {
          return res.status(400).json({ error: `At least ${definition.minPhotos} photos are required (currently ${photoCount}).` });
        }
      }
    }

    const updated = await prisma.activity.update({
      where: { id: req.params.id },
      data: req.body,
      include: { images: true },
    });

    // Fire-and-observe, never blocks/rolls back the completion that just
    // succeeded above (spec §19/§21) — notifyNightShiftCompletion itself
    // catches and logs every failure internally. Gated on the OLD status
    // being DRAFT (a genuinely new submission), not just the new status
    // being PENDING — an already-PENDING row can still be edited/re-saved
    // (still in EDITABLE_STATUSES, e.g. adding more photos before
    // review), and that must never re-fire a duplicate group post/
    // notification for the same completion (spec §16).
    if (updated.category === "NIGHT_SHIFT_TASK" && req.body.status === "PENDING" && activity.status === "DRAFT") {
      await notifyNightShiftCompletion(updated);
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/activities/:id — only while still a DRAFT. Once submitted
// (PENDING) it stays as a record even if never approved, so there is no
// silent gap in the employee's activity history.
export async function deleteActivity(req, res, next) {
  try {
    const activity = await prisma.activity.findUnique({ where: { id: req.params.id } });
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if (activity.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: "You do not have access to this activity" });
    }
    if (activity.status !== "DRAFT") {
      return res.status(400).json({ error: "Only a DRAFT activity can be deleted" });
    }

    await prisma.activity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// POST /api/activities/:id/images — attach one more image to an existing
// activity (the ActivityImage model from Step 5 — an activity can have
// any number of images instead of fixed photo1/photo2/photo3 columns).
export async function addActivityImage(req, res, next) {
  try {
    const activity = await prisma.activity.findUnique({ where: { id: req.params.id } });
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if (activity.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: "You do not have access to this activity" });
    }
    if (!EDITABLE_STATUSES.includes(activity.status)) {
      return res.status(400).json({ error: `Activity is already ${activity.status.toLowerCase()} and can no longer be edited` });
    }

    const image = await prisma.activityImage.create({
      data: { url: req.body.url, activityId: activity.id, expiresAt: expiresAtFor(activity.category) },
    });

    res.status(201).json(image);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/activities/:id/images/:imageId — replace an existing image
// in place (Phase 1 spec §17: take/preview/retake/replace before final
// submission). Ownership + editable-status are checked exactly like
// every other mutation on this activity; the OLD physical file is
// deleted (deleteUnderlyingFileIfOwned) so a replace never leaves an
// orphaned upload on disk, and expiresAt is recomputed fresh (so
// replacing a Department Closing photo close to its original deadline
// correctly restarts the 16-hour window from the replacement, not the
// original submission).
export async function replaceActivityImage(req, res, next) {
  try {
    const activity = await prisma.activity.findUnique({ where: { id: req.params.id } });
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if (activity.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: "You do not have access to this activity" });
    }
    if (!EDITABLE_STATUSES.includes(activity.status)) {
      return res.status(400).json({ error: `Activity is already ${activity.status.toLowerCase()} and can no longer be edited` });
    }

    const image = await prisma.activityImage.findUnique({ where: { id: req.params.imageId } });
    if (!image || image.activityId !== activity.id) {
      return res.status(404).json({ error: "Image not found on this activity" });
    }

    const oldUrl = image.url;
    const updated = await prisma.activityImage.update({
      where: { id: image.id },
      data: { url: req.body.url, expiresAt: expiresAtFor(activity.category) },
    });

    await deleteUnderlyingFileIfOwned(oldUrl);

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/activities/:id/images/:imageId
export async function deleteActivityImage(req, res, next) {
  try {
    const activity = await prisma.activity.findUnique({ where: { id: req.params.id } });
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    if (activity.employeeId !== req.user.employeeId) {
      return res.status(403).json({ error: "You do not have access to this activity" });
    }
    if (!EDITABLE_STATUSES.includes(activity.status)) {
      return res.status(400).json({ error: `Activity is already ${activity.status.toLowerCase()} and can no longer be edited` });
    }

    const image = await prisma.activityImage.findUnique({ where: { id: req.params.imageId } });
    if (!image || image.activityId !== activity.id) {
      return res.status(404).json({ error: "Image not found on this activity" });
    }

    await prisma.activityImage.delete({ where: { id: image.id } });
    await deleteUnderlyingFileIfOwned(image.url);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
