-- Shift System Cleanup & Standardization
--
-- Consolidates every EMPLOYEE-PROFILE-facing shift value (Worker's free-
-- text `Employee.shift`, `Employee.cashierShift`, and "the cashier's
-- shift at the time of reporting" on `PriceReport.shift`) onto ONE new
-- canonical enum, EmployeeShift: MORNING / AFTERNOON / NIGHT. There is no
-- EVENING anymore.
--
-- Deliberately NOT touched: the separate `Shift` enum (MORNING/EVENING/
-- NIGHT, 8-hour clock blocks) used by AttendanceRecord.shift,
-- NightShiftTaskDefinition.shift, DepartmentReport.shift, and
-- Employee.operationalShift — that is the Night Shift TASK system's own,
-- independent concept (attendance/task-assignment logic), out of scope
-- for this display-layer cleanup.
--
-- Known data at migration time (verified by direct query beforehand):
--   Employee.shift (free text): 'Morning Shift', 'Morning', 'Moring Shift'
--     (typo), 'Night', 'Evening' x2, NULL x4
--   Employee.cashierShift: MORNING x2, EVENING x2, NULL x6
--   PriceReport.shift: MORNING x2
-- Every one of those is handled explicitly below; nothing is silently
-- dropped. Per the shift-cleanup spec, existing "Evening"/EVENING values
-- become NIGHT (not AFTERNOON) — AFTERNOON is a new value with no legacy
-- data mapping to it.

CREATE TYPE "EmployeeShift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- Employee.shift: String? -> EmployeeShift?, normalizing legacy free text
-- (case/whitespace-insensitive) to the canonical three values. Any value
-- that doesn't match a known legacy spelling is left NULL rather than
-- guessed at — "no shift recorded" is honest, a fabricated one is not.
ALTER TABLE "Employee"
  ALTER COLUMN "shift" TYPE "EmployeeShift" USING (
    CASE lower(trim("shift"))
      WHEN 'morning' THEN 'MORNING'::"EmployeeShift"
      WHEN 'morning shift' THEN 'MORNING'::"EmployeeShift"
      WHEN 'moring shift' THEN 'MORNING'::"EmployeeShift"
      WHEN 'afternoon' THEN 'AFTERNOON'::"EmployeeShift"
      WHEN 'afternoon shift' THEN 'AFTERNOON'::"EmployeeShift"
      WHEN 'night' THEN 'NIGHT'::"EmployeeShift"
      WHEN 'night shift' THEN 'NIGHT'::"EmployeeShift"
      WHEN 'evening' THEN 'NIGHT'::"EmployeeShift"
      WHEN 'evening shift' THEN 'NIGHT'::"EmployeeShift"
      ELSE NULL
    END
  );

-- Employee.cashierShift: CashierShift? (MORNING/EVENING) -> EmployeeShift?
-- (MORNING/AFTERNOON/NIGHT). EVENING -> NIGHT, same rule as above — a
-- Cashier's own profile shift label can now be any of the three (see
-- schema comment); this is a display field only and has no bearing on
-- Night Shift TASK eligibility (Employee.operationalShift, untouched).
ALTER TABLE "Employee"
  ALTER COLUMN "cashierShift" TYPE "EmployeeShift" USING (
    CASE "cashierShift"::text
      WHEN 'MORNING' THEN 'MORNING'::"EmployeeShift"
      WHEN 'EVENING' THEN 'NIGHT'::"EmployeeShift"
      ELSE NULL
    END
  );

-- PriceReport.shift: same CashierShift -> EmployeeShift migration.
ALTER TABLE "PriceReport"
  ALTER COLUMN "shift" TYPE "EmployeeShift" USING (
    CASE "shift"::text
      WHEN 'MORNING' THEN 'MORNING'::"EmployeeShift"
      WHEN 'EVENING' THEN 'NIGHT'::"EmployeeShift"
      ELSE NULL
    END
  );

-- The old two-value enum has no remaining columns using it.
DROP TYPE "CashierShift";
