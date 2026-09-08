import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, ChevronDown, History } from "lucide-react";
import { SkeletonCard } from "../common/SkeletonCard";
import ErrorBanner from "../common/ErrorBanner";
import EmployeeIdentityStrip from "./EmployeeIdentityStrip";
import { useEmployeeActivityFeed, ACTIVITY_FILTERS } from "../../hooks/useEmployeeActivityFeed";

const STATUS_META = {
  APPROVED: { label: "Approved", tone: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/25" },
  COMPLETED: { label: "Approved", tone: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/25" },
  REJECTED: { label: "Rejected", tone: "text-red-400 bg-red-500/10 ring-red-500/25" },
  PENDING: { label: "Pending", tone: "text-amber-400 bg-amber-500/10 ring-amber-500/25" },
  DRAFT: { label: "Draft", tone: "text-amber-400 bg-amber-500/10 ring-amber-500/25" },
  SYSTEM: { label: "System", tone: "text-[#9AA1B4] bg-white/[0.06] ring-white/10" },
};

function dateTimeLabel(iso) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

// EmployeeActivityHistoryScreen.jsx — the employee's real historical
// activity record: "what did this employee actually do", as distinct
// from Tasks ("what work has been assigned" — EmployeeTasksSection.jsx).
// A single chronological, filterable feed (replacing the previous
// category-picker-into-a-separate-calendar-per-category flow), built on
// the same real merge useEmployeeActivityFeed.js already provides for
// the Profile page's "Today's Activity" preview — same data, just the
// full history instead of today only.
//
// Nothing here is ever deleted or hidden by status: Approved, Rejected,
// Pending, and System rows all remain visible and available — only the
// Supervisor Home/Recent Activity screens prioritize Pending above
// already-reviewed items; this page is deliberately the plain
// historical record, always in one chronological order.
export default function EmployeeActivityHistoryScreen({ employeeId, employee, marketName, onBack }) {
  const { data, error, loading, reload } = useEmployeeActivityFeed({ employeeId, marketId: employee?.marketId, todayOnly: false });
  const [filter, setFilter] = useState("ALL");
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filter === "ALL" ? data : data.filter((i) => i.filterKey === filter);
  }, [data, filter]);

  const filterLabel = ACTIVITY_FILTERS.find((f) => f.key === filter)?.label ?? "All Activities";

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-1 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back to Employee
      </button>

      <EmployeeIdentityStrip employee={employee} marketName={marketName} />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[18px] font-bold text-white">Activity History</h1>
          <p className="mt-0.5 text-[12.5px] text-[#8B93A8]">View all activities performed by this employee</p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-white bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border border-white/[0.08] backdrop-blur-xl transition-colors hover:border-[#F47A20]/35"
          >
            {filterLabel} <ChevronDown size={14} className={`text-[#8B93A8] transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </button>
          {filterOpen && (
            <>
              <button type="button" aria-label="Close filter" onClick={() => setFilterOpen(false)} className="fixed inset-0 z-10 cursor-default" />
              <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-xl border border-white/[0.08] bg-[#151B2E] p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]">
                {ACTIVITY_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => { setFilter(f.key); setFilterOpen(false); }}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-[12.5px] transition-colors ${
                      filter === f.key ? "text-[#F47A20] bg-[#F47A20]/10" : "text-[#C4C9D6] hover:bg-white/[0.06]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} className="h-[68px]" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState message="No activity history yet" />
      ) : filtered.length === 0 ? (
        <EmptyState message="No matching activities found" />
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)] divide-y divide-white/[0.05] overflow-hidden">
          {filtered.map((item, i) => {
            const Icon = item.icon;
            const status = STATUS_META[item.status] ?? STATUS_META.SYSTEM;
            const { date, time } = dateTimeLabel(item.timestamp);
            return (
              <div
                key={item.id}
                style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                className="animate-fade-up flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${item.tone}`}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] font-semibold text-white">{item.title}</p>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>
                  {(item.subtitle || marketName) && (
                    <p className="mt-0.5 truncate text-[11.5px] text-[#8B93A8]">
                      {item.subtitle}{item.subtitle && marketName ? " · " : ""}{marketName}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] tabular-nums text-[#5C6479]">{date} · {time}</p>
                </div>
                <ChevronRight size={15} className="mt-2 shrink-0 text-[#4C5266]" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl p-8 bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 border border-white/[0.07] backdrop-blur-xl text-center">
      <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.05] text-[#5C6479] ring-1 ring-inset ring-white/10">
        <History size={24} />
      </span>
      <p className="text-[15px] font-semibold text-white">{message}</p>
    </div>
  );
}
