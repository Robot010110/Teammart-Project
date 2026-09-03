import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAsync } from "../../../hooks/useAsync";
import { SkeletonCard } from "../../common/SkeletonCard";
import ErrorBanner from "../../common/ErrorBanner";
import { getMarketAttendanceToday } from "../../../services/attendanceService";

// TeamStatusChart.jsx — a compact donut over real GET
// /attendance/market/today counts (see attendanceController.
// getMarketAttendanceToday's own comment for the exact bucketing rule).
//
// Colour vs. label are deliberately separate decisions here: the fourth
// bucket is coloured with the same "needs attention" warmth the brief's
// reference asks for (an employee not yet checked in during their shift
// IS worth a glance), but it is labelled "Not Checked In", never
// "Absent" — this system has no end-of-day sweep that could honestly
// assert someone is absent for the whole day (that only ever happens
// retrospectively via the Excel import), so claiming it in real time
// would be presenting a guess as a fact.
const BUCKETS = [
  { key: "present", label: "Present", color: "#34D399", glow: "rgba(52,211,153,0.8)" },
  { key: "late", label: "Late", color: "#F9A03C", glow: "rgba(249,160,60,0.8)" },
  { key: "notCheckedIn", label: "Not Checked In", color: "#FF5C5C", glow: "rgba(255,92,92,0.8)" },
  { key: "offLeave", label: "Off / Leave", color: "#8B93A8", glow: "rgba(139,147,168,0.6)" },
];

const SIZE = 108;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function TeamStatusChart({ session, basePath }) {
  const navigate = useNavigate();
  const uid = useId();
  const { data, error, loading, reload } = useAsync(() => getMarketAttendanceToday(session.marketId), {
    deps: [session.marketId],
    fallbackError: "Could not load team status.",
  });

  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!data) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFilled(true);
      return;
    }
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, [data]);

  if (loading) return <SkeletonCard className="h-[168px] rounded-2xl" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!data) return null;

  const total = data.total || 1;
  let cursor = 0;
  const segments = BUCKETS.map((b) => {
    const count = data.counts[b.key] ?? 0;
    const fraction = count / total;
    const dash = filled ? fraction * CIRC : 0;
    const offset = -cursor * CIRC;
    cursor += fraction;
    return { ...b, count, dash, offset };
  });

  return (
    <section className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-white">Team Status</h2>
        <button
          type="button"
          onClick={() => navigate(`${basePath}/team-attendance`)}
          className="flex items-center gap-0.5 text-[11.5px] font-semibold text-[#F47A20] hover:text-[#ff8b36]"
        >
          View Team Attendance <ChevronRight size={13} />
        </button>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
            {segments.map(
              (s) =>
                s.count > 0 && (
                  <circle
                    key={s.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${s.dash} ${CIRC - s.dash}`}
                    strokeDashoffset={s.offset}
                    style={{
                      transition: "stroke-dasharray 1s cubic-bezier(0.22, 1, 0.36, 1)",
                      filter: `drop-shadow(0 0 3px ${s.glow})`,
                    }}
                  />
                )
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-display text-xl font-bold text-white tabular-nums">{data.total}</span>
            <span className="text-[9.5px] text-[#8B93A8]">team</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="flex items-center gap-1.5 text-[#9AA1B4] truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color, boxShadow: `0 0 5px 0.5px ${s.glow}` }} />
                {s.label}
              </span>
              <span className="font-semibold text-white tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
