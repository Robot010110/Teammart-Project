import { CalendarDays, ClipboardList } from "lucide-react";
import { SkeletonCard } from "../common/SkeletonCard";
import ErrorBanner from "../common/ErrorBanner";
import { useEmployeeActivityFeed } from "../../hooks/useEmployeeActivityFeed";

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// EmployeeTodayActivity.jsx — the compact "Today's Activity" card on the
// Supervisor's Employee Profile, replacing the old "Quick Info" block.
// Real data only, scoped to exactly SELECTED EMPLOYEE + TODAY — never
// another employee, another market, or another day. Nothing here is a
// review queue (that's Recent Activity/Pending Tasks elsewhere); this is
// a plain chronological "what did this person do today" view.
//
// Built on useEmployeeActivityFeed (todayOnly) — the same real merge
// EmployeeActivityHistoryScreen.jsx uses for the full history, so this
// preview and that page can never show two different versions of the
// same underlying data.
export default function EmployeeTodayActivity({ employeeId, marketId }) {
  const { data, error, loading, reload } = useEmployeeActivityFeed({ employeeId, marketId, todayOnly: true });
  // The hook returns newest-first (what the full History page wants);
  // this card reads better in the order things actually happened.
  const ordered = data ? [...data].reverse() : data;

  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="rounded-2xl border border-emerald-500/[0.18] bg-gradient-to-b from-[#131D33]/90 to-[#0C1424]/90 backdrop-blur-xl overflow-hidden shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9),0_0_36px_-16px_rgba(52,211,153,0.35)]">
      <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-white/[0.06]">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
            <ClipboardList size={13} />
          </span>
          Today's Activity
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#8B93A8]">
          <CalendarDays size={12} /> {todayLabel}
        </span>
      </div>

      <div className="p-3">
        {loading ? (
          <SkeletonCard className="h-24" />
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : ordered.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#8B93A8]">No activity today</p>
        ) : (
          <div className="space-y-1.5">
            {ordered.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                  className="animate-fade-up flex items-start gap-3 rounded-xl px-2.5 py-2.5 hover:bg-white/[0.03] transition-colors"
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${item.tone}`}>
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-medium text-white">{item.title}</p>
                      <span className="shrink-0 text-[11px] tabular-nums text-[#5C6479]">{timeLabel(item.timestamp)}</span>
                    </div>
                    {item.subtitle && <p className="mt-0.5 text-[11.5px] text-[#8B93A8] truncate">{item.subtitle}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
