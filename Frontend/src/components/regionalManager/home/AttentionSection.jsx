import { AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// AttentionSection.jsx — only what actually needs the Regional Manager
// right now, capped at two rows. These are real open MarketProblem rows
// from the RM's own zones (GET /api/market-problems?zoneId=), the same
// records the full Reports view acts on — not a separate alert system,
// and not every warning in the app dumped onto Home.
export default function AttentionSection({ problems, onViewAll, onOpen, loading }) {
  const items = (problems ?? []).slice(0, 2);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
          Attention
        </h2>
        {(problems?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-0.5 text-[11.5px] font-medium text-[#F47A20] transition-colors hover:text-[#ff9a4d]"
          >
            View All <ChevronRight size={13} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-[62px] animate-pulse rounded-2xl border border-white/[0.06] bg-[#111A2D]/70" />
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] px-3.5 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">Nothing needs attention</p>
            <p className="text-[11.5px] text-[#8B93A8]">No open reports across your markets</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={onOpen}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-red-500/15 bg-red-500/[0.05] px-3.5 py-3 text-left transition-colors hover:border-red-500/30"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400">
                <AlertTriangle size={15} />
              </span>
              <div className="min-w-0 flex-1">
                {/* problemType is already human-readable free text
                    ("Freezer not working"), written by the reporting
                    Supervisor — shown verbatim, exactly as the full
                    Reports views do. */}
                <p className="truncate text-[13px] font-semibold text-white">
                  {p.market?.name ? `${p.market.name} — ` : ""}
                  {p.problemType}
                </p>
                <p className="truncate text-[11.5px] text-[#9AA1B4]">{p.location || p.description || "Open report"}</p>
              </div>
              <span className="shrink-0 text-[10.5px] text-[#5C6479]">{timeAgo(p.createdAt)}</span>
              <ChevronRight size={14} className="shrink-0 text-[#4C5266]" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
