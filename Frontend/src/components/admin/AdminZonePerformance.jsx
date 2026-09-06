import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

const BAR_TONES = [
  { from: "#4C8DFF", to: "#7EA6FF", glow: "rgba(76,141,255,0.55)" },
  { from: "#F47A20", to: "#FFB35C", glow: "rgba(244,122,32,0.6)" },
  { from: "#22C08A", to: "#5BE6B4", glow: "rgba(34,192,138,0.55)" },
  { from: "#C08BFF", to: "#DDBBFF", glow: "rgba(192,139,255,0.5)" },
];

// AdminZonePerformance.jsx — one bar per real zone.
//
// The percentages come from computeZoneMetrics (see zoneMetrics.js) run
// per zone over that zone's own markets/problems/activities — the exact
// same calculation the Regional Manager's own Zone Performance card
// uses, so Admin and RM can never disagree about a zone's score. A zone
// with nothing to score yet shows "—" and an empty track rather than a
// zero that would read as failure.
export default function AdminZonePerformance({ zones, loading, onOpenZones }) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setGrown(true);
      return;
    }
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#111A2D]/90 to-[#0C1424]/90 p-4 backdrop-blur-xl shadow-[0_10px_36px_-18px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
          Zone Performance
        </h2>
        <button
          type="button"
          onClick={onOpenZones}
          className="flex shrink-0 items-center gap-0.5 text-[11.5px] font-medium text-[#F47A20] transition-colors hover:text-[#ff9a4d]"
        >
          View Details <ChevronRight size={13} />
        </button>
      </div>

      {loading ? (
        <div className="mt-5 flex h-[168px] items-end gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 animate-pulse rounded-t-lg bg-white/[0.05]" style={{ height: `${50 + i * 15}%` }} />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <p className="py-12 text-center text-[12.5px] text-[#8B93A8]">No zones to report on yet.</p>
      ) : (
        <div className="mt-4 flex h-[176px] items-end justify-around gap-3 px-1">
          {zones.map((z, i) => {
            const tone = BAR_TONES[i % BAR_TONES.length];
            const pct = z.overall == null ? 0 : Math.max(0, Math.min(100, z.overall));
            return (
              <div key={z.zoneId} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[12.5px] font-bold tabular-nums text-white">
                  {z.overall == null ? "—" : `${Math.round(z.overall)}%`}
                </span>
                <div className="flex w-full max-w-[64px] flex-1 items-end">
                  <div className="relative h-full w-full overflow-hidden rounded-lg bg-white/[0.04]">
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-lg"
                      style={{
                        height: `${grown ? pct : 0}%`,
                        background: `linear-gradient(to top, ${tone.from}, ${tone.to})`,
                        boxShadow: pct > 0 ? `0 0 16px -2px ${tone.glow}` : "none",
                        transition: "height 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    />
                  </div>
                </div>
                <span className="w-full truncate text-center text-[11px] text-[#8B93A8]">Zone {z.zoneNumber}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
