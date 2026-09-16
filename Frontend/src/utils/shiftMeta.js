import { Sunrise, Sun, Moon } from "lucide-react";

// shiftMeta.js — the ONE canonical mapping for an employee's own
// displayed shift (Worker.shift / Employee.cashierShift, both the
// backend's EmployeeShift enum since the Shift System Cleanup). Exactly
// three values, one icon and one label each, everywhere:
//
//   MORNING   -> sunrise icon -> "Morning"
//   AFTERNOON -> full/midday sun icon -> "Afternoon"
//   NIGHT     -> moon icon -> "Night"
//
// There is no "Evening" in this concept anymore. Every component that
// shows an employee's shift must import SHIFT_META from here rather than
// defining its own icon/label mapping — see ShiftBadge.jsx for the
// shared presentational component built on top of this.
//
// NOT for the separate, unrelated `Shift` enum used by the Night Shift
// TASK system / AttendanceRecord / DepartmentReport (MORNING/EVENING/
// NIGHT, 8-hour clock blocks — a genuinely different, untouched concept;
// see backend prisma/schema.prisma's EmployeeShift enum comment).
export const EMPLOYEE_SHIFT_VALUES = ["MORNING", "AFTERNOON", "NIGHT"];

export const SHIFT_META = {
  MORNING: { icon: Sunrise, labelKey: "emp.morning" },
  AFTERNOON: { icon: Sun, labelKey: "emp.afternoon" },
  NIGHT: { icon: Moon, labelKey: "emp.night" },
};
