import { useMemo } from "react";

// ConsistencyChart.jsx — "Activity Consistency": how much the employee
// actually submitted on each day of the current week.
//
// Real data, derived rather than invented: it buckets the employee's own
// activities (GET /api/activities, already loaded by this page for
// Recent Reviews) into Mon-Sun. No new endpoint.
//
// Bar tone is semantic and driven by what actually happened that day:
//   green   submitted, all reviewed work approved
//   orange  submitted, still awaiting review
//   red     something that day was rejected
// A day with nothing submitted renders as a flat track, never a fake bar.
//
// Each bar is a gradient with a brighter cap and a real coloured
// box-shadow, so the bars are genuinely luminous rather than just
// saturated — matching the reference's glowing columns.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(date) {
  // Monday-start, matching the backend's own startOfWeek in
  // activitiesController.js so this and the weekly trend agree.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  return d;
}

const TONES = {
  approved: { from: "#34D399", to: "#0F766E", glow: "rgba(52,211,153,0.55)", cap: "#6EE7B7" },
  pending: { from: "#FBA94C", to: "#C2410C", glow: "rgba(244,122,32,0.55)", cap: "#FFC98A" },
  rejected: { from: "#FF6B6B", to: "#991B1B", glow: "rgba(248,113,113,0.55)", cap: "#FCA5A5" },
};

export default function ConsistencyChart({ activities }) {
  const { days, max, activeDays } = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const buckets = DAYS.map(() => ({ count: 0, rejected: 0, pending: 0, approved: 0 }));

    for (const a of activities ?? []) {
      const d = new Date(a.date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diff = Math.round((dayStart - weekStart) / 86400000);
      if (diff < 0 || diff > 6) continue;
      const b = buckets[diff];
      b.count += 1;
      if (a.status === "REJECTED") b.rejected += 1;
      else if (a.status === "APPROVED") b.approved += 1;
      else b.pending += 1;
    }

    return {
      days: buckets,
      max: Math.max(1, ...buckets.map((b) => b.count)),
      activeDays: buckets.filter((b) => b.count > 0).length,
    };
  }, [activities]);

  const todayIndex = (() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  })();

  return (
    <section className="rounded-[22px] p-4 bg-[#0D1223]/80 border border-white/[0.07] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-white">Activity Consistency</h2>
        <span className="text-[12px] text-[#8B93A8]">
          <span className="text-white font-semibold">{activeDays}</span>/7 days
        </span>
      </div>

      {/* Capped to match PerformanceTrendChart's plot width so the two
          cards' charts stay visually aligned on wide screens. */}
      <div className="mt-4 mx-auto w-full max-w-[560px] flex gap-2">
        {/* Y axis — matches the trend chart's gutter so the two cards line up. */}
        <div className="w-[26px] shrink-0 relative h-[112px]">
          {[100, 50, 0].map((v) => (
            <span
              key={v}
              className="absolute right-0 -translate-y-1/2 text-[8.5px] text-[#5C6479]"
              style={{ top: `${100 - v}%` }}
            >
              {v}%
            </span>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative h-[112px] flex items-end justify-between gap-1.5">
            {/* Gridlines behind the bars. */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              {[0, 50, 100].map((v) => (
                <div
                  key={v}
                  className="absolute inset-x-0 border-t border-white/[0.05]"
                  style={{ top: `${100 - v}%` }}
                />
              ))}
            </div>

            {days.map((b, i) => {
              const tone = b.rejected > 0 ? TONES.rejected : b.pending > 0 ? TONES.pending : TONES.approved;
              const heightPct = b.count === 0 ? 0 : Math.max(16, (b.count / max) * 100);

              return (
                <div key={DAYS[i]} className="relative flex-1 min-w-0 h-full flex items-end justify-center">
                  {b.count === 0 ? (
                    <div className="w-full max-w-[30px] h-1 rounded-full bg-white/[0.07]" />
                  ) : (
                    <div
                      className="relative w-full max-w-[30px] rounded-t-lg rounded-b-sm animate-grow-bar"
                      style={{
                        height: `${heightPct}%`,
                        backgroundImage: `linear-gradient(to top, ${tone.to}, ${tone.from})`,
                        boxShadow: `0 0 16px 1px ${tone.glow}, 0 0 34px 6px ${tone.glow.replace("0.55", "0.18")}`,
                        animationDelay: `${i * 70}ms`,
                      }}
                      title={`${DAYS[i]}: ${b.count} ${b.count === 1 ? "activity" : "activities"}`}
                    >
                      {/* Bright cap — the hot top edge in the reference. */}
                      <span
                        className="absolute inset-x-0 top-0 h-[3px] rounded-t-lg"
                        style={{ background: tone.cap, boxShadow: `0 0 10px 2px ${tone.glow}` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex justify-between gap-1.5">
            {DAYS.map((d, i) => (
              <span
                key={d}
                className={`flex-1 text-center text-[10px] font-medium ${
                  i === todayIndex ? "text-white" : "text-[#5C6479]"
                }`}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      {activeDays === 0 && (
        <p className="mt-3 text-center text-xs text-[#4C5266]">No activity submitted yet this week.</p>
      )}
    </section>
  );
}
