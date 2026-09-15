// performanceFacts.js — the ONLY place the Performance engine reads the
// database. Everything it produces is a plain object, which is then handed
// to the pure scoringEngine.
//
// Splitting it this way is what makes the scoring rules testable without a
// database, and what makes a stored snapshot replayable: the facts are the
// durable thing, the formula is not.
//
// Every query here is bounded by [periodStart, periodEnd) — half-open, so a
// record is counted by exactly one period and never two.

import { prisma } from "../../lib/prisma.js";
import { computeWorkingHours } from "../../utils/attendanceMath.js";

// Statuses that mean "this was not a working day", so they neither count
// toward attendance nor make an assignment falling on them the employee's
// fault.
const NON_WORKING_STATUSES = new Set(["DAY_OFF", "APPROVED_LEAVE"]);

// Task/SuddenTask/night-shift statuses that mean the employee did their
// part. A Task leaves ASSIGNED the moment it is submitted, whatever the
// supervisor later decides — completion measures DOING the work; whether
// it was any good is Quality's job, and counting a rejection twice would
// punish the same event in two categories.
const TASK_SUBMITTED = new Set(["PENDING", "APPROVED", "REJECTED"]);

function toDayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Gather every fact needed to score one employee for one period.
 *
 * @param {object} args
 * @param {string} args.employeeId
 * @param {Date}   args.periodStart inclusive
 * @param {Date}   args.periodEnd   exclusive
 * @param {{baseScore:number}|null} [args.prior] previous period's baseScore
 * @param {object} [args.client] Prisma client or transaction
 */
export async function collectFacts({ employeeId, periodStart, periodEnd, prior = null, client = prisma }) {
  const range = { gte: periodStart, lt: periodEnd };

  const [reviews, attendanceRecords, tasks, suddenTasks, nightShiftActivities] = await Promise.all([
    // Ordered by workDate so the streak/run mathematics sees the work in
    // the order it actually happened, not the order it was reviewed.
    client.workReview.findMany({
      where: { employeeId, workDate: range },
      orderBy: [{ workDate: "asc" }, { reviewedAt: "asc" }],
      select: { outcome: true, severity: true, qualityPoints: true, qualityMax: true, workDate: true, workCategory: true, targetType: true },
    }),
    client.attendanceRecord.findMany({
      where: { employeeId, date: range },
      select: {
        date: true, status: true, requiredHours: true, punishmentHours: true,
        checkIn: true, checkOut: true, breakStart: true, breakEnd: true,
      },
    }),
    client.task.findMany({
      where: { employeeId, createdAt: range },
      select: { status: true, createdAt: true, dueAt: true, submittedAt: true },
    }),
    client.suddenTask.findMany({
      where: { employeeId, assignedAt: range },
      select: { status: true, assignedAt: true, dueAt: true, completedAt: true },
    }),
    // Night-shift work is generated for every eligible employee whether or
    // not they do it, which makes it a genuine assigned/completed signal.
    client.activity.findMany({
      where: { employeeId, category: "NIGHT_SHIFT_TASK", operationalDate: range },
      select: { status: true, operationalDate: true },
    }),
  ]);

  // --- attendance -----------------------------------------------------
  const nonWorkingDays = new Set();
  let workingDays = 0, absentDays = 0, incompleteDays = 0, lateDays = 0, earlyLeaveDays = 0;
  let workedHours = 0, requiredHours = 0, punishmentHours = 0, penaltyEventCount = 0;

  for (const record of attendanceRecords) {
    // Penalties count regardless of whether the day was a working day —
    // a penalty is a disciplinary fact, not an attendance one.
    if (record.punishmentHours > 0) {
      punishmentHours += record.punishmentHours;
      penaltyEventCount += 1;
    }

    if (NON_WORKING_STATUSES.has(record.status)) {
      nonWorkingDays.add(toDayKey(record.date));
      continue;
    }

    workingDays += 1;
    requiredHours += record.requiredHours ?? 0;
    workedHours += computeWorkingHours(record) ?? 0;

    if (record.status === "ABSENT") absentDays += 1;
    else if (record.status === "INCOMPLETE") incompleteDays += 1;
    else if (record.status === "LATE") lateDays += 1;
    else if (record.status === "EARLY_LEAVE") earlyLeaveDays += 1;
  }

  // --- completion -----------------------------------------------------
  let assigned = 0, cancelled = 0, completed = 0;
  let assignedOnNonWorkingDays = 0, completedWithDueDate = 0, completedOnTime = 0;

  const countAssignment = ({ assignedAt, status, isCancelled, isCompleted, dueAt, completedAt }) => {
    assigned += 1;
    if (isCancelled) {
      cancelled += 1;
      return;
    }
    // Work handed to someone on a day they were legitimately off is not
    // their failure — it leaves the denominator entirely (spec §5).
    if (assignedAt && nonWorkingDays.has(toDayKey(assignedAt))) {
      assignedOnNonWorkingDays += 1;
      return;
    }
    if (!isCompleted) return;

    completed += 1;
    // Timeliness is only measurable where a deadline actually existed.
    if (dueAt) {
      completedWithDueDate += 1;
      // No completedAt (a Task, which records submittedAt instead) falls
      // back to that; with neither we cannot claim it was late.
      const finishedAt = completedAt ?? null;
      if (!finishedAt || finishedAt <= dueAt) completedOnTime += 1;
    }
  };

  for (const t of tasks) {
    countAssignment({
      assignedAt: t.createdAt,
      isCancelled: t.status === "CANCELLED",
      isCompleted: TASK_SUBMITTED.has(t.status),
      dueAt: t.dueAt,
      completedAt: t.submittedAt,
    });
  }
  for (const st of suddenTasks) {
    countAssignment({
      assignedAt: st.assignedAt,
      isCancelled: st.status === "CANCELLED",
      isCompleted: st.status === "COMPLETED",
      dueAt: st.dueAt,
      completedAt: st.completedAt,
    });
  }
  for (const a of nightShiftActivities) {
    countAssignment({
      assignedAt: a.operationalDate,
      isCancelled: false,
      // A generated night-shift row sits at DRAFT until the employee
      // submits it; anything past DRAFT means they did the work.
      isCompleted: a.status !== "DRAFT",
      dueAt: null,
      completedAt: null,
    });
  }

  return {
    reviews: reviews.map((r) => ({
      outcome: r.outcome,
      severity: r.severity,
      qualityPoints: r.qualityPoints,
      qualityMax: r.qualityMax,
    })),
    completion: { assigned, cancelled, assignedOnNonWorkingDays, completed, completedWithDueDate, completedOnTime },
    attendance: { workingDays, absentDays, incompleteDays, lateDays, earlyLeaveDays, workedHours, requiredHours },
    reliability: { punishmentHours, penaltyEventCount },
    prior,
  };
}
