// shiftSchedule.js — Attendance + Shift Timing: the official shift clock
// (start/end hour) for AION's three EmployeeShift values, plus the pure
// classification math that turns one AttendanceRecord's real
// checkIn/checkOut/breakStart/breakEnd/punishmentHours into the separate,
// distinguishable facts the spec asks for (late time, early work,
// post-shift work, penalty recovery, break overrun). No Prisma, no I/O —
// same "pure arithmetic, shared utility" shape as attendanceMath.js,
// which this file complements rather than duplicates: computeWorkingHours
// there is still the ONE place "how many hours did this person work" is
// computed, and everything below is built on top of that same number,
// never a second working-hours calculation.
//
// Reuses the EXISTING EmployeeShift enum (MORNING/AFTERNOON/NIGHT, no
// "Evening" — see prisma/schema.prisma's own comment) — this is not a
// second shift system, just the clock-time companion the enum never
// needed until now. Deliberately NOT the older `Shift` enum
// (MORNING/EVENING/NIGHT), which drives the unrelated Night Shift task /
// DepartmentReport system.
export const SHIFT_CLOCK = {
  MORNING: { startHour: 8, endHour: 16 },
  AFTERNOON: { startHour: 16, endHour: 24 }, // 24 = midnight, i.e. the NEXT calendar day
  NIGHT: { startHour: 0, endHour: 8 },
};

// An employee's assigned shift for classification purposes is their own
// CURRENT profile shift (Worker.shift / Cashier.cashierShift) — the same
// field, and the same "current assignment, not a historical snapshot"
// limitation, already used for exactly this purpose by
// departmentClosingZoneService.js's shiftOf(). Duplicating that one-line
// lookup here (rather than importing across an unrelated feature
// boundary) is deliberate: it is a null-coalescing field read, not a
// calculation, so there is nothing to drift out of sync.
export function resolveEmployeeShift(employee) {
  return employee?.shift ?? employee?.cashierShift ?? null;
}

// The real Date instants a shift's start/end fall on for one specific
// AttendanceRecord date. `recordDate` is local midnight for that day
// (AttendanceRecord.date's own convention — time part ignored). Handles
// the one shift that genuinely crosses midnight (Afternoon, 16:00 -> the
// NEXT day's 00:00) by adding a day to `end` rather than naively
// constructing "00:00 same date", which would put end before start.
// Morning and Night are both fully inside `recordDate` and never need
// the extra day.
export function getShiftWindow(shift, recordDate) {
  const clock = SHIFT_CLOCK[shift];
  if (!clock) return null;

  const start = new Date(recordDate);
  start.setHours(clock.startHour, 0, 0, 0);

  const end = new Date(recordDate);
  if (clock.endHour >= 24) {
    end.setDate(end.getDate() + 1);
    end.setHours(clock.endHour - 24, 0, 0, 0);
  } else {
    end.setHours(clock.endHour, 0, 0, 0);
  }

  return { start, end };
}

// The one normal break's maximum duration (spec §6/§7) — the same 60
// minutes breakService.js's fingerprint-triggered Break model already
// uses for its own (separate) confirm/auto-complete cycle; kept as its
// own constant here rather than importing that unrelated model's
// constant, since the two break mechanisms are intentionally independent
// (see attendanceController.startBreak's own comment on why).
export const BREAK_MAX_MINUTES = 60;

function msToHours(ms) {
  return Math.max(ms, 0) / (1000 * 60 * 60);
}

// classifyAttendanceTiming — the one function that turns a record's real
// timestamps into every separate fact the spec asks for. The
// shift-dependent fields (lateMinutes/earlyWorkHours/postShiftHours/
// penaltyRecoveryHours/postShiftExtraHours) are `null` — never a
// fabricated 0 — whenever there is no assigned shift to compare against
// (same "unknown stays unknown" convention as computeWorkingHours); they
// only ever become real numbers once a real EmployeeShift is resolved.
// breakOverrunMinutes doesn't depend on a shift at all, so it's always a
// real number (0 when there's no break, or no overrun yet).
//
// Deliberately does NOT recompute "Extra Hours" here — that stays
// attendanceController's own computeExtraHours (the one place Extra
// Hours has ever been calculated), now fixed to net the record's real
// punishmentHours. earlyWorkHours/postShiftHours/penaltyRecoveryHours
// below are additional, separately-visible breakdowns of the exact same
// underlying checkIn/checkOut/punishmentHours — not a second Extra Hours
// formula that could drift from the first.
export function classifyAttendanceTiming(record, shift) {
  const result = {
    scheduledShift: shift,
    scheduledStart: null,
    scheduledEnd: null,
    lateMinutes: null,
    earlyWorkHours: null,
    postShiftHours: null,
    penaltyRecoveryHours: null,
    postShiftExtraHours: null,
    breakOverrunMinutes: 0,
  };

  const window = shift ? getShiftWindow(shift, record.date) : null;
  if (window) {
    result.scheduledStart = window.start;
    result.scheduledEnd = window.end;
    result.lateMinutes = 0;
    result.earlyWorkHours = 0;
    result.postShiftHours = 0;
    result.penaltyRecoveryHours = 0;
    result.postShiftExtraHours = 0;

    if (record.checkIn) {
      const diffMs = record.checkIn.getTime() - window.start.getTime();
      if (diffMs > 0) {
        result.lateMinutes = Math.round(diffMs / 60000);
      } else if (diffMs < 0) {
        result.earlyWorkHours = msToHours(-diffMs);
      }
    }

    if (record.checkOut) {
      const overMs = record.checkOut.getTime() - window.end.getTime();
      if (overMs > 0) {
        result.postShiftHours = msToHours(overMs);
        const punishmentHours = record.punishmentHours ?? 0;
        result.penaltyRecoveryHours = Math.min(result.postShiftHours, punishmentHours);
        result.postShiftExtraHours = Math.max(result.postShiftHours - result.penaltyRecoveryHours, 0);
      }
    }
  }

  // Break overrun is independent of the shift being known — it only
  // needs the break's own two timestamps. `breakEnd ?? now` so a break
  // still in progress shows its overrun-so-far rather than nothing.
  if (record.breakStart) {
    const breakEnd = record.breakEnd ?? new Date();
    const breakMinutes = (breakEnd.getTime() - record.breakStart.getTime()) / 60000;
    result.breakOverrunMinutes = Math.max(Math.round(breakMinutes - BREAK_MAX_MINUTES), 0);
  }

  return result;
}
