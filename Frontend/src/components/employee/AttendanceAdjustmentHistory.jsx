import { Plus, Minus } from "lucide-react";

// AttendanceAdjustmentHistory.jsx — a supervisor's +/- hour corrections
// with a reason, newest first. Same row-card shell as the activity rows
// in TaskStatusTabs.jsx, with a pill styled after StatusPill/PriorityPill
// (colored dot + ring) rather than a new visual language.

const dateLabel = (isoString) =>
  new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function AttendanceAdjustmentHistory({ adjustments }) {
  if (adjustments.length === 0) {
    return (
      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <p className="text-sm text-[#4C5266] text-center py-4">No attendance adjustments yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
        {adjustments.map((adj) => {
          const positive = adj.hours > 0;
          const Icon = positive ? Plus : Minus;
          const tone = positive
            ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
            : "bg-red-500/10 text-red-400 ring-red-500/20";

          return (
            <div key={adj.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tone}`}
                >
                  <Icon size={10} />
                  {Math.abs(adj.hours)} hour{Math.abs(adj.hours) === 1 ? "" : "s"}
                </span>
                <span className="text-[11px] text-[#9AA1B4]">{dateLabel(adj.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-xs text-[#8B93A8]">{adj.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
