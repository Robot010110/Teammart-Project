import { AlertTriangle, TrendingDown, PackageX, ShieldCheck, ChevronRight } from "lucide-react";

const SEVERITY = {
  critical: { icon: AlertTriangle, chip: "bg-red-500/10 text-red-400 ring-red-500/20", border: "border-red-500/15 bg-red-500/[0.04]" },
  warning: { icon: TrendingDown, chip: "bg-amber-500/10 text-amber-400 ring-amber-500/20", border: "border-amber-500/15 bg-amber-500/[0.04]" },
  info: { icon: PackageX, chip: "bg-[#7EA6FF]/10 text-[#7EA6FF] ring-[#7EA6FF]/20", border: "border-[#7EA6FF]/15 bg-[#7EA6FF]/[0.04]" },
};

// AdminAttentionRequired.jsx — only genuinely derived problems, never a
// blanket "everything is red" list. The caller builds these items from
// real rows (open market problems, markets with nobody checked in,
// today's expired-item reports); severity is assigned by what the item
// actually is, so critical stays meaningful.
export default function AdminAttentionRequired({ items, loading, onOpen }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#111A2D]/90 to-[#0C1424]/90 p-4 backdrop-blur-xl shadow-[0_10px_36px_-18px_rgba(0,0,0,0.9)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
          Attention Required
        </h2>
        {items.length > 0 && (
          <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-[#C4C9D6]">{items.length}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[58px] animate-pulse rounded-xl bg-white/[0.05]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] px-3.5 py-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">Nothing needs attention</p>
            <p className="text-[11.5px] text-[#8B93A8]">No open issues across the organization.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => {
            const cfg = SEVERITY[item.severity] ?? SEVERITY.info;
            const Icon = cfg.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-white/20 ${cfg.border}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${cfg.chip}`}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">{item.title}</p>
                  <p className="truncate text-[11.5px] text-[#9AA1B4]">{item.context}</p>
                </div>
                {item.meta && <span className="shrink-0 text-[10.5px] text-[#5C6479]">{item.meta}</span>}
                <ChevronRight size={14} className="shrink-0 text-[#4C5266]" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
