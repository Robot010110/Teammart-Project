import { useEffect, useId, useState } from "react";
import { ChevronRight } from "lucide-react";

// The real states listCompanyAttendance reports (see
// attendanceController.deriveAttendanceState) — not the generic
// present/absent/late trio, because this system genuinely distinguishes
// "on break" and "checked out" from "never checked in", and collapsing
// them would misreport who is actually in a store right now.
const SLICES = [
  { key: "working", label: "Working", color: "#22C08A" },
  { key: "onBreak", label: "On Break", color: "#F5B23D" },
  { key: "checkedOut", label: "Checked Out", color: "#7EA6FF" },
  { key: "missing", label: "Not Checked In", color: "#E05561" },
];

export default function AdminAttendanceDonut({ summary, loading, onOpenAttendance }) {
  const uid = useId();
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(true);
      return;
    }
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = summary?.total ?? 0;
  // "Present" = physically on shift right now (working or on a break),
  // which is what the headline percentage means here.
  const present = (summary?.working ?? 0) + (summary?.onBreak ?? 0);
  const rate = total > 0 ? (present / total) * 100 : null;

  const size = 168;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offsetAccum = 0;
  const arcs = SLICES.map((s) => {
    const value = summary?.[s.key] ?? 0;
    const fraction = total > 0 ? value / total : 0;
    const arc = { ...s, value, dash: circumference * fraction, offset: -circumference * offsetAccum };
    offsetAccum += fraction;
    return arc;
  });

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#111A2D]/90 to-[#0C1424]/90 p-4 backdrop-blur-xl shadow-[0_10px_36px_-18px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
          Today's Attendance
        </h2>
        <button
          type="button"
          onClick={onOpenAttendance}
          className="flex shrink-0 items-center gap-0.5 text-[11.5px] font-medium text-[#F47A20] transition-colors hover:text-[#ff9a4d]"
        >
          View Details <ChevronRight size={13} />
        </button>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-5">
          <div className="h-[168px] w-[168px] shrink-0 animate-pulse rounded-full bg-white/[0.05]" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 animate-pulse rounded bg-white/[0.05]" />)}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={rate == null ? "No attendance recorded today" : `${Math.round(rate)} percent on shift`}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
              {total > 0 &&
                arcs.map((a) => (
                  <circle
                    key={a.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${drawn ? a.dash : 0} ${circumference}`}
                    strokeDashoffset={a.offset}
                    style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
                  />
                ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[26px] font-extrabold tabular-nums text-white">
                {rate == null ? "—" : `${Math.round(rate)}%`}
              </span>
              <span className="text-[10.5px] text-[#8B93A8]">On shift</span>
            </div>
          </div>

          <div className="w-full flex-1 space-y-2">
            {arcs.map((a) => (
              <div key={a.key} className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#9AA1B4]">{a.label}</span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white">{a.value}</span>
              </div>
            ))}
            <div className="!mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
              <span className="text-[11.5px] text-[#5C6479]">Tracked today</span>
              <span className="text-[12.5px] font-semibold tabular-nums text-[#C4C9D6]">{total}</span>
            </div>
            {(summary?.late ?? 0) > 0 && (
              <p className="text-[11px] text-amber-400">{summary.late} marked late today</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
