import { useEffect, useState } from "react";
import { CalendarCheck, CheckSquare, Store, ShieldCheck, ChevronRight } from "lucide-react";
import PerformanceScoreRing from "../../employee/performance/PerformanceScoreRing";

const ICONS = {
  attendance: CalendarCheck,
  tasks: CheckSquare,
  readiness: Store,
  health: ShieldCheck,
};

// A metric's bar fills from 0 on mount, matching the ring's own reveal
// (PerformanceScoreRing does the same one-frame trick) so the card reads
// as one coordinated motion instead of a ring that animates next to bars
// that just appear. Reduced motion skips straight to the real width.
function MetricRow({ metricKey, label, value }) {
  const Icon = ICONS[metricKey] ?? CheckSquare;
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setFilled(true);
      return;
    }
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const width = value == null ? 0 : Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="shrink-0 text-[#6B7488]" />
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#9AA1B4]">{label}</span>
        <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-white">
          {value == null ? "—" : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#F47A20] to-[#FFB35C]"
          style={{
            width: `${filled ? width : 0}%`,
            transition: "width 1.4s cubic-bezier(0.22, 1, 0.36, 1)",
            boxShadow: width > 0 ? "0 0 10px -1px rgba(244,122,32,0.65)" : "none",
          }}
        />
      </div>
    </div>
  );
}

// ZonePerformanceCard.jsx — the page's hero.
//
// The score is not a stored "performance" column anywhere; it is the
// live average of the four real metrics beside it (see zoneMetrics.js
// for each one's exact backend source). A metric with no rows yet shows
// "—" and is left out of the average rather than counted as zero, so a
// zone that has simply never been rated cannot drag the ring down to a
// number that looks like a failing score.
// `title`, `footnote` and `onOpenDetails` are optional so this same card
// can also present ONE market (the Regional Manager's supervisor
// profile shows "Market Performance" with it). Their defaults reproduce
// the zone version exactly, so the Home page is unaffected; omitting
// onOpenDetails simply hides the "View Details" link, since a caller
// with nowhere to send the user shouldn't render a dead button.
export default function ZonePerformanceCard({
  overall,
  metrics,
  marketCount,
  onOpenDetails,
  loading,
  title = "Zone Performance",
  footnote,
}) {
  const defaultFootnote = `Across ${marketCount} market${marketCount === 1 ? "" : "s"}`;

  return (
    <section className="rounded-[20px] border border-white/[0.07] bg-gradient-to-b from-[#111A2D]/90 to-[#0C1424]/90 p-4 backdrop-blur-xl shadow-[0_10px_36px_-18px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
          {title}
        </h2>
        {onOpenDetails && (
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex shrink-0 items-center gap-0.5 text-[11.5px] font-medium text-[#F47A20] transition-colors hover:text-[#ff9a4d]"
          >
            View Details <ChevronRight size={13} />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="shrink-0">
          <PerformanceScoreRing rate={loading ? null : overall} size={112} label={"Overall\nPerformance"} />
          <p className="mt-1 text-center text-[10.5px] text-[#5C6479]">
            {loading ? "Loading…" : (footnote ?? defaultFootnote)}
          </p>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          {metrics.map((m) => (
            <MetricRow key={m.key} metricKey={m.key} label={m.label} value={loading ? null : m.value} />
          ))}
        </div>
      </div>
    </section>
  );
}
