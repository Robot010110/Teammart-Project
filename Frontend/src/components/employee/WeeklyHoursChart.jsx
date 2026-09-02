import { useEffect, useState } from "react";

const DAY_LABEL = ["S", "M", "T", "W", "T", "F", "S"];

// WeeklyHoursChart.jsx — TeamMart visual system: a real animated bar
// chart of the last 7 days' worked hours, built entirely from
// GET /attendance/month's own real days[] (already fetched by
// HomeTab.jsx for the Activity Overview period toggle — this reuses the
// exact same data, no second endpoint). A day with no real
// AttendanceRecord (nothing worked, or a day not yet reached) renders as
// an empty/zero bar — never a fabricated placeholder value. Bars animate
// in on mount (height 0 -> real value); disabled under
// prefers-reduced-motion via the same check AnimatedNumber.jsx uses.
export default function WeeklyHoursChart({ days }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setGrown(true);
      return;
    }
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const match = (days ?? []).find((day) => {
      const dd = new Date(day.date);
      return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() && dd.getDate() === d.getDate();
    });
    return { date: d, hours: match?.workingHours ?? 0, isToday: d.toDateString() === today.toDateString() };
  });

  const maxHours = Math.max(...last7.map((d) => d.hours), 1);

  return (
    <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <p className="text-xs font-semibold text-white mb-4">Hours Worked — Last 7 Days</p>
      <div className="flex items-end justify-between gap-2 h-28">
        {last7.map((d, i) => {
          const pct = d.hours > 0 ? Math.max((d.hours / maxHours) * 100, 6) : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full h-full flex items-end justify-center">
                <div
                  className={`w-full max-w-[22px] rounded-t-md transition-[height] ease-out ${
                    d.isToday ? "bg-[#F47A20] glow-orange" : "bg-sky-500/40"
                  }`}
                  style={{ height: `${grown ? pct : 0}%`, transitionDuration: "700ms", transitionDelay: `${i * 60}ms` }}
                />
              </div>
              <span className={`text-[10px] ${d.isToday ? "text-[#F47A20] font-semibold" : "text-[#4C5266]"}`}>{DAY_LABEL[d.date.getDay()]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
