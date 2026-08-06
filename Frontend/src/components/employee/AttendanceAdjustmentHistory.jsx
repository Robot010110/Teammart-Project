import { SlidersHorizontal } from "lucide-react";

// AttendanceAdjustmentHistory.jsx — a compact, scannable list of every
// required-hours adjustment this month (the per-day detail already shows
// up inline in AttendanceCalendar.jsx — this is the "just the
// adjustments" view for a quick scan of what happened and why). One
// informational tone (not reward/penalty-colored) since a
// RequiredHoursAdjustment is a direct override, not a +/- delta.

const dateLabel = (isoString) =>
  new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function AttendanceAdjustmentHistory({ adjustments }) {
  if (adjustments.length === 0) {
    return (
      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <p className="text-sm text-[#4C5266] text-center py-4">No required-hours adjustments this month.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
        {adjustments.map((adj) => (
          <div key={adj.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset bg-[#F47A20]/10 text-[#F47A20] ring-[#F47A20]/20">
                <SlidersHorizontal size={10} />
                {adj.previousRequiredHours}h → {adj.newRequiredHours}h
              </span>
              <span className="text-[11px] text-[#9AA1B4]">{dateLabel(adj.date)}</span>
            </div>
            <p className="mt-1.5 text-xs text-[#8B93A8]">{adj.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
