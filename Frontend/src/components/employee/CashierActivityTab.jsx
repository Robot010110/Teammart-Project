import { Sun, Moon, ClipboardList, CheckCircle2, Clock3, Lightbulb } from "lucide-react";
import CashierCleaningSection from "./CashierCleaningSection";
import PriceReportSection from "./PriceReportSection";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getProfile } from "../../services/profileService";
import { listSuddenTasks } from "../../services/suddenTaskService";
import { listPriceReports } from "../../services/priceReportService";
import { getTodayAttendance } from "../../services/attendanceService";
import { useAsync } from "../../hooks/useAsync";

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// Elapsed active time today: checkIn -> (checkOut or now), minus any
// break duration. A one-time snapshot computed on load (like the rest of
// this tile row), not a live ticking clock — AttendanceCheckInCard
// already owns the real-time check-in/out/break UI elsewhere; this is
// just a summary number, not a second attendance widget.
function activeTimeLabel(record) {
  if (!record?.checkIn) return "0h 0m";
  const start = new Date(record.checkIn).getTime();
  const end = record.checkOut ? new Date(record.checkOut).getTime() : Date.now();
  const breakMs =
    record.breakStart && record.breakEnd
      ? new Date(record.breakEnd).getTime() - new Date(record.breakStart).getTime()
      : record.breakStart && !record.breakEnd
        ? Date.now() - new Date(record.breakStart).getTime()
        : 0;
  const activeMs = Math.max(0, end - start - breakMs);
  const hours = Math.floor(activeMs / 3600000);
  const minutes = Math.floor((activeMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function SummaryTile({ icon: Icon, tone, value, label }) {
  return (
    <div className="rounded-2xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06] text-center">
      <span className={`mx-auto mb-2 grid place-items-center h-9 w-9 rounded-full ${tone}`}>
        <Icon size={16} />
      </span>
      <p className="text-lg font-display font-bold text-white">{value}</p>
      <p className="text-[11px] text-[#8B93A8] mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

// CashierActivityTab.jsx — Cashier Daily Activity Standardization: ONE
// standard activity set for every Cashier, regardless of shift/market/
// employee (see CashierCleaningSection.jsx's own comment on why removing
// the old MORNING-only gate needed no backend change — the checklist was
// never shift-restricted server-side to begin with). Price Lookup has
// been removed per that redesign (no route/service call for it remains);
// Price Report now comes before the Cleaning Checklist, matching the
// approved reference order. Today's Summary and the shift badge are the
// only new real-data reads this page adds — Tasks Completed Today
// (this cashier's own completed Sudden Tasks, today only), Price
// Reports Today (their own price reports, today only), and Active Time
// Today (today's real AttendanceRecord) — nothing here is invented.
export default function CashierActivityTab() {
  const { data: profile, error, loading, reload } = useAsync(getProfile, { deps: [] });
  const { data: completedTasks } = useAsync(() => listSuddenTasks({ status: "COMPLETED" }), { deps: [] });
  const { data: priceReports } = useAsync(listPriceReports, { deps: [] });
  const { data: attendance } = useAsync(getTodayAttendance, { deps: [] });

  const ShiftIcon = profile?.cashierShift === "EVENING" ? Moon : Sun;
  const shiftLabel = profile?.cashierShift === "EVENING" ? "Evening Shift" : "Morning Shift";

  const tasksToday = (completedTasks ?? []).filter((t) => isToday(t.completedAt ?? t.assignedAt)).length;
  const priceReportsToday = (priceReports ?? []).filter((r) => isToday(r.reportedAt)).length;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto animate-fade-up pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Daily Activity</h1>
          <p className="text-sm text-[#8B93A8] mt-0.5">Cashier Workspace</p>
        </div>
        <div className="shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 bg-[#171C2E]/80 border border-white/[0.06]">
          <ShiftIcon size={15} className="text-[#F47A20]" />
          <div className="leading-tight text-right">
            <p className="text-xs font-semibold text-white">{shiftLabel}</p>
            <p className="text-[10px] text-[#8B93A8]">{todayLabel()}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-5"><SkeletonCard className="h-[140px]" /></div>
      ) : error ? (
        <div className="mt-5"><ErrorBanner message={error} onRetry={reload} /></div>
      ) : (
        <>
          <section className="mt-5">
            <PriceReportSection />
          </section>

          <section className="mt-5">
            <CashierCleaningSection />
          </section>

          <section className="mt-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Today's Summary</h2>
            <div className="grid grid-cols-3 gap-2.5">
              <SummaryTile icon={ClipboardList} tone="bg-sky-500/10 text-sky-400" value={tasksToday} label="Tasks Completed Today" />
              <SummaryTile icon={CheckCircle2} tone="bg-emerald-500/10 text-emerald-400" value={priceReportsToday} label="Price Reports Today" />
              <SummaryTile icon={Clock3} tone="bg-violet-500/10 text-violet-400" value={activeTimeLabel(attendance)} label="Active Time Today" />
            </div>
          </section>

          <div className="mt-5 flex items-start gap-3 rounded-2xl px-4 py-3.5 bg-amber-500/[0.06] border border-amber-500/20">
            <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Reminder</p>
              <p className="text-xs text-[#9AA1B4] mt-0.5">Complete all cleaning tasks before the end of your shift.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
