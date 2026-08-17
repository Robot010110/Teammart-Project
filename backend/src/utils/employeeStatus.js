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
    return { ...e, status: active ? "ACTIVE" : "OFF_SHIFT" };
  });
}
