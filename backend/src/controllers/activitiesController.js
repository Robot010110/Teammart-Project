import { prisma } from "../lib/prisma.js";

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
      include: { images: true },
      orderBy: { date: "desc" },
    });

    res.json(activities);
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

// POST /api/activities — an employee logs a new daily activity. Defaults
// to DRAFT (not submitted yet) unless the caller explicitly sets PENDING.
export async function createActivity(req, res, next) {
  try {
    const { category, date, time, notes, status, imageUrls, productId, labelIssueType } = req.body;

    const activity = await prisma.activity.create({
      data: {
        category,
        date,
        time,
        notes,
        status,
        productId,
        labelIssueType,
        employeeId: req.user.employeeId,
        images: imageUrls?.length ? { create: imageUrls.map((url) => ({ url })) } : undefined,
      },
      include: { images: true },
    });

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

    const updated = await prisma.activity.update({
      where: { id: req.params.id },
      data: req.body,
      include: { images: true },
    });

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
      data: { url: req.body.url, activityId: activity.id },
    });

    res.status(201).json(image);
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
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
