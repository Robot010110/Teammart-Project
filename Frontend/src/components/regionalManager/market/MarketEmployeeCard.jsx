import { ChevronRight, Coffee, LogOut, Store } from "lucide-react";
import { initialsOfName } from "./activityMeta";

function minutesSince(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

// Three real states, straight from the attendance record the backend
// already computes (see utils/employeeStatus.js): checked in, checked in
// but on a break, or not on shift.
export function employeeState(employee) {
  if (employee.onBreak) return "ON_BREAK";
  return employee.status === "ACTIVE" ? "ACTIVE" : "OFF_SHIFT";
}

const STATE = {
  ACTIVE: { label: "Active", chip: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/25", dot: "bg-emerald-400", icon: Store },
  ON_BREAK: { label: "On Break", chip: "bg-amber-500/12 text-amber-400 ring-amber-500/25", dot: "bg-amber-400", icon: Coffee },
  OFF_SHIFT: { label: "Off Shift", chip: "bg-white/[0.06] text-[#8B93A8] ring-white/10", dot: "bg-[#4C5266]", icon: LogOut },
};

// MarketEmployeeCard.jsx — one employee inside a market.
//
// The sub-line under the status is real, never decorative: an employee
// on a break shows how long they have actually been on it (breakStartedAt
// from today's AttendanceRecord — this app's breaks are open-ended, with
// no fixed length, so a countdown would have to be invented and is
// deliberately not shown); an active employee shows they are on shift;
// an off-shift employee shows whether their shift ended or never started
// today.
export default function MarketEmployeeCard({ employee, onOpen, index = 0 }) {
  const state = employeeState(employee);
  const cfg = STATE[state];
  const Icon = cfg.icon;

  const detail =
    state === "ON_BREAK"
      ? `Break · ${minutesSince(employee.breakStartedAt)}m so far`
      : state === "ACTIVE"
        ? "In store"
        : employee.checkOutAt
          ? "Shift ended"
          : "Not checked in";

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className="animate-fade-up group flex w-full items-center gap-3 rounded-[18px] border border-white/[0.07] bg-[#111A2D]/80 p-3 text-left backdrop-blur-xl
                 transition-all duration-200 hover:border-[#F47A20]/30 hover:bg-[#131E33]/90 active:scale-[0.985]"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[13px] font-bold text-white ring-1 ring-white/10">
        {initialsOfName(employee.name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">{employee.name}</p>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-medium ring-1 ring-inset ${cfg.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-[#8B93A8]">
          {employee.position}
          {employee.department ? ` · ${employee.department}` : ""}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-[#5C6479]">
          <Icon size={10} className="shrink-0" /> {detail}
        </p>
      </div>

      <ChevronRight size={16} className="shrink-0 text-[#4C5266] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#F47A20]" />
    </button>
  );
}
