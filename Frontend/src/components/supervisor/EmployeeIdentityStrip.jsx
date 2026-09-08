import { HardHat, Wallet, Beef, ShieldCheck, Store, Clock3 } from "lucide-react";
import { initialsOf } from "../../utils/initials";

const ROLE_META = {
  WORKER: { label: "Worker", icon: HardHat, tone: "text-[#7EA6FF] bg-[#7EA6FF]/10 ring-[#7EA6FF]/20" },
  CASHIER: { label: "Cashier", icon: Wallet, tone: "text-[#C08BFF] bg-[#C08BFF]/10 ring-[#C08BFF]/20" },
  BUTCHER: { label: "Butcher", icon: Beef, tone: "text-amber-400 bg-amber-500/10 ring-amber-500/20" },
};

// EmployeeIdentityStrip.jsx — the same compact employee identity row
// used across every Supervisor -> Employee -> * screen (Attendance,
// Tasks, Activity History): avatar, name, real Active status, employee
// code, role badge, market, shift. Extracted here so all three stay
// visually identical instead of drifting — first built for the
// Attendance redesign, now shared rather than copy-pasted again.
export default function EmployeeIdentityStrip({ employee, marketName }) {
  if (!employee) return null;
  const roleMeta = ROLE_META[employee.role];
  const RoleIcon = roleMeta?.icon ?? ShieldCheck;
  const shiftLabel = employee.shift || employee.cashierShift || employee.operationalShift;

  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[13px] font-bold text-white ring-2 ring-[#F47A20]/30 shadow-[0_0_16px_-4px_rgba(244,122,32,0.6)]">
        {initialsOf(employee.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[16px] font-bold text-white truncate">{employee.name}</h1>
          {employee.employmentStatus === "ACTIVE" && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/25">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.8)]" /> Active
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[#8B93A8]">
          {employee.employeeCode && <span className="tabular-nums">{employee.employeeCode}</span>}
          {roleMeta && (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ring-inset ${roleMeta.tone}`}>
              <RoleIcon size={10} /> {roleMeta.label}
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
