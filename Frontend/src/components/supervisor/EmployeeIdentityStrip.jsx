import { useTranslation } from "react-i18next";
import { HardHat, Wallet, Beef, ShieldCheck, Store, Clock3 } from "lucide-react";
import { initialsOf } from "../../utils/initials";

const ROLE_META = {
  WORKER: { label: "roles.worker", icon: HardHat, tone: "text-[#7EA6FF] bg-[#7EA6FF]/10 ring-[#7EA6FF]/20" },
  CASHIER: { label: "roles.cashier", icon: Wallet, tone: "text-[#C08BFF] bg-[#C08BFF]/10 ring-[#C08BFF]/20" },
  BUTCHER: { label: "sup.butcher", icon: Beef, tone: "text-amber-400 bg-amber-500/10 ring-amber-500/20" },
};

// EmployeeIdentityStrip.jsx — the same compact employee identity row
// used across every Supervisor -> Employee -> * screen (Attendance,
// Tasks, Activity History): avatar, name, real Active status, employee
// code, role badge, market, shift. Extracted here so all three stay
// visually identical instead of drifting — first built for the
// Attendance redesign, now shared rather than copy-pasted again.
//
// The badge shows `employee.attendanceState` (ACTIVE/BREAK/NOT_ACTIVE,
// from GET /api/employees/:id — see employeesController.getEmployee /
// utils/employeeStatus.js attachAttendanceState), never employmentStatus
// — that HR flag is ACTIVE for virtually every employed person
// regardless of whether they checked in today, which used to make this
// strip claim "Active" for employees who hadn't checked in at all.
const ATTENDANCE_META = {
  ACTIVE: { label: "status.active", tone: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/25", dot: "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.8)]" },
  BREAK: { label: "status.onBreak", tone: "text-violet-400 bg-violet-500/10 ring-violet-500/25", dot: "bg-violet-400 shadow-[0_0_6px_1px_rgba(167,139,250,0.8)]" },
};

export default function EmployeeIdentityStrip({ employee, marketName }) {
  const { t } = useTranslation();
  if (!employee) return null;
  const roleMeta = ROLE_META[employee.role];
  const RoleIcon = roleMeta?.icon ?? ShieldCheck;
  const shiftLabel = employee.shift || employee.cashierShift || employee.operationalShift;
  // NOT_ACTIVE (never checked in / already checked out) shows no badge
  // here at all, same as this strip's previous "only show if Active"
  // convention — a red "Not Active" chip on every single closed profile
  // would be noise; ACTIVE/BREAK are the states worth calling out inline.
  const attendanceMeta = ATTENDANCE_META[employee.attendanceState];

  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[13px] font-bold text-white ring-2 ring-[#F47A20]/30 shadow-[0_0_16px_-4px_rgba(244,122,32,0.6)]">
        {initialsOf(employee.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[16px] font-bold text-white truncate">{employee.name}</h1>
          {attendanceMeta && (
            <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${attendanceMeta.tone}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${attendanceMeta.dot}`} /> {t(attendanceMeta.label)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[#8B93A8]">
          {employee.employeeCode && <span className="tabular-nums">{employee.employeeCode}</span>}
          {roleMeta && (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ring-inset ${roleMeta.tone}`}>
              <RoleIcon size={10} /> {t(roleMeta.label)}
            </span>
          )}
          {marketName && <span className="flex items-center gap-1"><Store size={11} /> {marketName}</span>}
        </div>
        {shiftLabel && (
          <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[#8B93A8]"><Clock3 size={11} /> {shiftLabel}</p>
        )}
      </div>
    </div>
  );
}
