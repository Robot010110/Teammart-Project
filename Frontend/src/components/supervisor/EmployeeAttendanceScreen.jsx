import { useMemo, useState } from "react";
import { ArrowLeft, Zap, Gauge, CalendarCheck, CalendarOff, Clock3, XCircle, Coffee, Home } from "lucide-react";
import AttendanceMonthGrid from "../employee/attendance/AttendanceMonthGrid";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import EmployeeIdentityStrip from "./EmployeeIdentityStrip";
import { getEmployeeAttendanceMonth } from "../../services/attendanceService";
import { useAsync } from "../../hooks/useAsync";

// Real per-status counts for this month, derived from the same `days`
// array the calendar itself renders — one source of truth, not a second
// backend call. DAY_OFF is split by its real dayOffType, matching how
// AttendanceMonthGrid's own legend already buckets it.
function monthlyCounts(days) {
  const c = { present: 0, late: 0, absent: 0, weeklyOff: 0, monthlyOff: 0, emergencyOff: 0 };
  for (const d of days ?? []) {
    if (d.status === "PRESENT" || d.status === "EARLY_LEAVE") c.present += 1;
    else if (d.status === "LATE") c.late += 1;
    else if (d.status === "ABSENT") c.absent += 1;
    else if (d.status === "DAY_OFF") {
      if (d.dayOffType === "WEEKLY") c.weeklyOff += 1;
      else if (d.dayOffType === "MONTHLY") c.monthlyOff += 1;
      else if (d.dayOffType === "EMERGENCY") c.emergencyOff += 1;
    }
  }
  return c;
}

// Each KPI is a full colored identity — icon + container + border +
// real outer glow via a layered box-shadow (an inline style, not just a
// tinted border) — the exact technique AdminKpiCard.jsx already
// established, applied here to stay one consistent visual language.
const KPI_TONE = {
  emerald: { icon: "text-emerald-300 bg-gradient-to-br from-emerald-400/40 to-emerald-400/10 ring-emerald-400/50", border: "border-emerald-400/35", glow: "0 0 30px -12px rgba(52,211,153,0.6)" },
  amber: { icon: "text-amber-300 bg-gradient-to-br from-amber-400/40 to-amber-400/10 ring-amber-400/50", border: "border-amber-400/35", glow: "0 0 30px -12px rgba(251,191,36,0.6)" },
  red: { icon: "text-red-300 bg-gradient-to-br from-red-400/40 to-red-400/10 ring-red-400/50", border: "border-red-400/35", glow: "0 0 30px -12px rgba(248,113,113,0.6)" },
  violet: { icon: "text-violet-300 bg-gradient-to-br from-violet-400/40 to-violet-400/10 ring-violet-400/50", border: "border-violet-400/35", glow: "0 0 30px -12px rgba(167,139,250,0.6)" },
  sky: { icon: "text-sky-300 bg-gradient-to-br from-sky-400/40 to-sky-400/10 ring-sky-400/50", border: "border-sky-400/35", glow: "0 0 30px -12px rgba(56,189,248,0.6)" },
};

function KpiTile({ icon: Icon, label, value, tone }) {
  const t = KPI_TONE[tone];
  return (
    <div
      style={{ boxShadow: `0 10px 24px -16px rgba(0,0,0,0.9), ${t.glow}` }}
      className={`rounded-2xl p-3 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border backdrop-blur-xl ${t.border}`}
    >
      <span className={`grid h-8 w-8 place-items-center rounded-xl ring-1 ring-inset ${t.icon}`}>
        <Icon size={14} />
      </span>
      <p className="mt-2 font-display text-[19px] font-bold leading-none text-white tabular-nums">{value}</p>
      <p className="mt-1 text-[10.5px] leading-tight text-[#8B93A8]">{label}</p>
    </div>
  );
}

// Attendance Rate gets its own ring tile (matching the reference's
// circular gauge) rather than the plain icon tile the others use.
function RateTile({ rate }) {
  const pct = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const color = rate == null ? "#8B93A8" : rate >= 95 ? "#34D399" : rate >= 85 ? "#F9A03C" : "#FF5C5C";
  const r = 15, circ = 2 * Math.PI * r;
  return (
    <div
      style={{ boxShadow: `0 10px 24px -16px rgba(0,0,0,0.9), 0 0 30px -12px ${color}99`, borderColor: `${color}59` }}
      className="rounded-2xl p-3 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border backdrop-blur-xl flex items-center gap-2.5"
    >
      <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90 shrink-0">
        <circle cx="19" cy="19" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="19" cy="19" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
          style={{ filter: `drop-shadow(0 0 4px ${color}99)`, transition: "stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="min-w-0">
        <p className="font-display text-[17px] font-bold leading-none text-white tabular-nums">{rate == null ? "—" : `${rate.toFixed(0)}%`}</p>
        <p className="mt-1 text-[10.5px] leading-tight text-[#8B93A8]">Attendance Rate</p>
      </div>
    </div>
  );
}

// EmployeeAttendanceScreen.jsx — Supervisor's read-only view of one
// employee's attendance: real identity header, a colored KPI strip, the
// real MONTH CALENDAR (AttendanceMonthGrid — the same real grid the
// employee's own Attendance page uses, in `readOnly` mode so a
// Supervisor can never trigger that employee's own off-day self-request
// flow), and a Monthly Breakdown below it.
//
// "Adjust Required Hours" / "Set Punishment Hours" are deliberately NOT
// here — this pass explicitly removes them as UI on this screen (a
// visibility change only). Their real backend endpoints
// (createRequiredHoursAdjustment/setPunishmentHours) are completely
// untouched and still work; they simply have no caller on THIS screen
// any more. `employee` is pre-fetched by the parent route (it already
// loads it for the Info screen) so this page doesn't re-fetch identity
// that's already in hand.
export default function EmployeeAttendanceScreen({ employeeId, employee, marketName, onBack }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, error, loading, reload } = useAsync(
    () => getEmployeeAttendanceMonth(employeeId, { year, month }),
    { deps: [employeeId, year, month], fallbackError: "Could not load attendance." }
  );

  const counts = useMemo(() => monthlyCounts(data?.days), [data]);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back
      </button>

      <EmployeeIdentityStrip employee={employee} marketName={marketName} />

      {loading ? (
        <SkeletonCard className="h-[420px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <div className="space-y-3">
          {/* KPI strip — Attendance Rate + the same real per-status
              counts the calendar's own legend uses. */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            <RateTile rate={data.summary.attendanceRate} />
            <KpiTile icon={CalendarCheck} label="Present" value={counts.present} tone="emerald" />
            <KpiTile icon={Clock3} label="Late" value={counts.late} tone="amber" />
            <KpiTile icon={XCircle} label="Absent" value={counts.absent} tone="red" />
            <KpiTile icon={Coffee} label="Weekly Off" value={counts.weeklyOff} tone="violet" />
            <KpiTile icon={Home} label="Monthly Off" value={counts.monthlyOff} tone="sky" />
          </div>

          <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border border-white/[0.07] backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]">
            <AttendanceMonthGrid
              year={year}
              month={month}
              days={data.days}
              onChangeMonth={(y, m) => { setYear(y); setMonth(m); }}
              readOnly
            />
          </div>

          {/* Monthly Breakdown — the fuller category rollup below the
              calendar, per the same real per-status counts above. */}
          <div className="rounded-2xl p-4 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border border-white/[0.07] backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#8B93A8]">Monthly Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              <BreakdownTile icon={CalendarOff} label="Work Days" value={data.summary.totalWorkingDays} tone="text-[#F47A20] bg-[#F47A20]/12 ring-[#F47A20]/25" />
              <BreakdownTile icon={CalendarCheck} label="Present" value={counts.present} tone="text-emerald-400 bg-emerald-500/12 ring-emerald-500/25" />
              <BreakdownTile icon={Clock3} label="Late" value={counts.late} tone="text-amber-400 bg-amber-500/12 ring-amber-500/25" />
              <BreakdownTile icon={XCircle} label="Absent" value={counts.absent} tone="text-red-400 bg-red-500/12 ring-red-500/25" />
              <BreakdownTile icon={Coffee} label="Weekly Off" value={counts.weeklyOff} tone="text-violet-400 bg-violet-500/12 ring-violet-500/25" />
              <BreakdownTile icon={Home} label="Monthly Off" value={counts.monthlyOff} tone="text-sky-400 bg-sky-500/12 ring-sky-500/25" />
              <BreakdownTile icon={Zap} label="Extra Hours" value={`${Number(data.summary.extraHours ?? 0).toFixed(1)}h`} tone="text-emerald-400 bg-emerald-500/12 ring-emerald-500/25" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/[0.06]">
      <span className={`grid h-7 w-7 place-items-center rounded-lg ring-1 ring-inset ${tone}`}>
        <Icon size={12} />
      </span>
      <p className="mt-1.5 font-display text-[15px] font-bold leading-none text-white tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] leading-tight text-[#8B93A8]">{label}</p>
    </div>
  );
}
