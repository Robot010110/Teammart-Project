// attendanceMath.js — pure attendance arithmetic, extracted so it can be
// shared without dragging a controller into a service.
//
// This lived as a private function inside attendanceController. The
// Performance engine's fact-gathering needs the identical calculation, and
// re-implementing it there would have created two definitions of "how many
// hours did this person work" that could silently drift apart. Importing
// the controller instead was not an option: attendanceController now calls
// into performanceService (to mark periods stale when a penalty changes),
// so a service importing the controller would be a genuine circular import.
//
// No Prisma, no I/O — it takes a record-shaped object and returns a number.

// Working hours for one day, computed from checkIn/checkOut/break — never
// stored, so there's no redundant derived value to drift out of sync with
// the underlying times. Returns null when the day is incomplete (no
// check-in or no check-out), which callers must treat as "unknown", not 0.
export function computeWorkingHours(record) {
  if (!record.checkIn || !record.checkOut) return null;
  let ms = record.checkOut.getTime() - record.checkIn.getTime();
  if (record.breakStart && record.breakEnd) {
    ms -= record.breakEnd.getTime() - record.breakStart.getTime();
  }
  return Math.max(ms / (1000 * 60 * 60), 0);
}
