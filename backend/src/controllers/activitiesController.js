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
    const { category, date, time, notes, status, imageUrls } = req.body;

    const activity = await prisma.activity.create({
      data: {
        category,
        date,
        time,
        notes,
        status,
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
