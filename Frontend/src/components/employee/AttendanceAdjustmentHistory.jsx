import { Gift, TrendingUp, ShieldAlert } from "lucide-react";

// AttendanceAdjustmentHistory.jsx — a compact, scannable list of every
// reward/extra/penalty adjustment this month (the per-day detail already
// shows up inline in AttendanceCalendar.jsx — this is the "just the
// adjustments" view for a quick scan of what happened and why).

const TYPE_STYLE = {
  REWARD: { icon: Gift, tone: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20", label: "Reward" },
  EXTRA: { icon: TrendingUp, tone: "bg-amber-500/10 text-amber-400 ring-amber-500/20", label: "Extra" },
  PENALTY: { icon: ShieldAlert, tone: "bg-red-500/10 text-red-400 ring-red-500/20", label: "Penalty" },
};

const dateLabel = (isoString) =>
  new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function AttendanceAdjustmentHistory({ adjustments }) {
  if (adjustments.length === 0) {
    return (
      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <p className="text-sm text-[#4C5266] text-center py-4">No reward, extra, or penalty hours this month.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
        {adjustments.map((adj) => {
          const { icon: Icon, tone, label } = TYPE_STYLE[adj.type] || TYPE_STYLE.EXTRA;
          return (
            <div key={adj.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tone}`}
                >
                  <Icon size={10} />
                  {label} · {adj.hours} hour{adj.hours === 1 ? "" : "s"}
                </span>
                <span className="text-[11px] text-[#9AA1B4]">{dateLabel(adj.date)}</span>
              </div>
              <p className="mt-1.5 text-xs text-[#8B93A8]">{adj.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
