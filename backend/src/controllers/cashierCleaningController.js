import { prisma } from "../lib/prisma.js";

// cashierCleaningController.js — the cashier station-cleaning checklist.
// Always means "clean the cashier station" — never shelf/aisle/department
// cleaning (that's Activity's SHELF_CLEANING/DAILY_CLEANING categories,
// which Cashiers never see). One log per cashier per day, same
// idempotent-upsert idiom as attendanceController.js's AttendanceRecord.

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/cashier-cleaning/today — today's checklist state, or null if
// nothing has been submitted yet today.
export async function getTodayCleaningLog(req, res, next) {
  try {
    const log = await prisma.cashierCleaningLog.findUnique({
      where: { employeeId_date: { employeeId: req.user.employeeId, date: startOfDay(new Date()) } },
    });
    res.json(log);
  } catch (err) {
    next(err);
  }
}

// POST /api/cashier-cleaning — submits/updates today's checklist state.
// completedAt is set the moment every item is checked; re-submitting the
// same day (e.g. unchecking then rechecking) upserts in place rather than
// creating a second row for the day.
export async function submitCleaningLog(req, res, next) {
  try {
    const { items } = req.body;
    const date = startOfDay(new Date());
    const allChecked = items.every((item) => item.checked);

    const log = await prisma.cashierCleaningLog.upsert({
      where: { employeeId_date: { employeeId: req.user.employeeId, date } },
      update: { items, completedAt: allChecked ? new Date() : null },
      create: { employeeId: req.user.employeeId, date, items, completedAt: allChecked ? new Date() : null },
    });

    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
}
