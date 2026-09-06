import { prisma } from "../lib/prisma.js";

// employeeStatus.js — a real, computed "is this employee currently
// working" status, derived from today's AttendanceRecord rather than any
// manually-set field (spec: "The active status should be calculated from
// the attendance/shift system rather than manually entered"). Two honest
// states only:
//   ACTIVE    -> checked in today, not checked out yet, not on a day off/
//                approved leave.
//   OFF_SHIFT -> everything else (no record yet, already checked out,
//                absent, on a day off/leave). A single "off shift" state
//                is used rather than inventing a separate "Inactive" with
//                no clearly distinct real-data meaning from "off shift".
//
// Break state is reported ALONGSIDE that, as `onBreak` + `breakStartedAt`,
// rather than as a third value of `status`. Deliberate: someone on a
// break is still checked in and still counts as working, and several
// callers already treat `status === "ACTIVE"` as exactly that (e.g.
// getMarketOverview's activeCount). Folding break into `status` would
// silently change those counts; adding fields does not change any
// existing behaviour, and lets a UI that cares show "On Break".
// Both come from breakStart/breakEnd on the very AttendanceRecord this
// function already loads — no extra query, no new source of truth.
export async function attachEmployeeStatuses(employees) {
  if (employees.length === 0) return [];

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const records = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) }, date: { gte: start, lt: end } },
  });
  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));

  return employees.map((e) => {
    const r = byEmployee.get(e.id);
    const active = !!(r && r.checkIn && !r.checkOut && r.status !== "DAY_OFF" && r.status !== "APPROVED_LEAVE");
    const onBreak = !!(active && r.breakStart && !r.breakEnd);
    return {
      ...e,
      status: active ? "ACTIVE" : "OFF_SHIFT",
      onBreak,
      breakStartedAt: onBreak ? r.breakStart : null,
      checkInAt: r?.checkIn ?? null,
      checkOutAt: r?.checkOut ?? null,
    };
  });
}
