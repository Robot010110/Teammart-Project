import { ChevronRight } from "lucide-react";
import { activityMeta, initialsOfName } from "../regionalManager/market/activityMeta";

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// AdminRecentActivity.jsx — a short teaser of the company-wide feed
// (GET /api/activities/company). Reuses the same activityMeta icon and
// label vocabulary the Regional Manager screens use, so one activity
// never reads as two different things depending on who is looking.
// Capped here on purpose; the full history lives on the Activities page
// behind "See All".
export default function AdminRecentActivity({ activities, loading, onViewAll }) {
  const rows = (activities ?? []).slice(0, 5);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#111A2D]/90 to-[#0C1424]/90 p-4 backdrop-blur-xl shadow-[0_10px_36px_-18px_rgba(0,0,0,0.9)]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
          Recent Activity
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="flex shrink-0 items-center gap-0.5 text-[11.5px] font-medium text-[#F47A20] transition-colors hover:text-[#ff9a4d]"
        >
          See All <ChevronRight size={13} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 py-1">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-white/[0.05]" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-[12.5px] text-[#8B93A8]">No recent activity yet.</p>
      ) : (
        <div>
          {rows.map((a, i) => {
            const meta = activityMeta(a);
            const Icon = meta.icon;
            const who = a.employee?.name ?? a.submittedByStaff?.name ?? "Someone";
            const market = a.employee?.market?.name ?? a.market?.name;
            return (
              <div key={a.id} className={`flex items-center gap-2.5 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${meta.tone}`}>
                  <Icon size={14} />
                </span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[10px] font-bold text-[#C4C9D6] ring-1 ring-white/10">
                  {initialsOfName(who)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-white">
                    {who} <span className="font-normal text-[#9AA1B4]">— {meta.label.toLowerCase()}</span>
                  </p>
                  {market && <p className="truncate text-[11px] text-[#5C6479]">{market}</p>}
                </div>
                <span className="shrink-0 text-[10.5px] text-[#5C6479]">{timeAgo(a.date)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
