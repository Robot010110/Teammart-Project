import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import PerformanceScoreRing from "./PerformanceScoreRing";
import PerformanceStatusCard from "./PerformanceStatusCard";
import HeroTexture from "./HeroTexture";

// PerformanceHero.jsx — the Overall Score centrepiece.
//
// Layout follows the reference: the ring sits on the LEFT with its trend
// pill tucked beneath the value, and the three status rows stack on the
// RIGHT. On a 360px phone the two columns stay side by side (the ring
// scales down rather than wrapping) because wrapping them turns the hero
// into two tall blocks and pushes everything below the fold.
//
// The trend pill is only rendered when BOTH this week's and last week's
// rates are real numbers — a week with nothing reviewed has rate === null.
// No comparison is fabricated when there is nothing to compare against.
export default function PerformanceHero({ summary, weekly, onStatusSelect }) {
  const thisWeek = weekly?.[0]?.rate;
  const lastWeek = weekly?.[1]?.rate;
  const hasTrend = thisWeek != null && lastWeek != null;
  const delta = hasTrend ? Math.round(thisWeek - lastWeek) : null;

  return (
    <section className="relative overflow-hidden rounded-[22px] p-3.5 sm:p-5 bg-[#0D1223]/80 border border-white/[0.07] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.8)]">
      <HeroTexture />

      <div className="relative flex items-center gap-2.5 sm:gap-5">
        {/* Left — ring + trend pill.
            The column is given an EXPLICIT width matching its ring at each
            breakpoint. Without that, a long caption underneath widened
            this shrink-0 column and squeezed the status rows on the right
            until their labels truncated to "Appro…"/"Reject…". Everything
            inside is w-full so no child can push the column wider. */}
        <div className="shrink-0 w-[136px] min-[390px]:w-[152px] min-[430px]:w-[172px] flex flex-col items-center">
          <div className="hidden min-[430px]:block">
            <PerformanceScoreRing rate={summary?.rate ?? null} size={172} />
          </div>
          <div className="hidden min-[390px]:block min-[430px]:hidden">
            <PerformanceScoreRing rate={summary?.rate ?? null} size={152} />
          </div>
          <div className="min-[390px]:hidden">
            <PerformanceScoreRing rate={summary?.rate ?? null} size={136} />
          </div>

          {hasTrend ? (
            <div
              className={`-mt-2.5 relative z-10 inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[10.5px] font-semibold border backdrop-blur-sm whitespace-nowrap ${
                delta > 0
                  ? "text-emerald-400 bg-emerald-500/[0.12] border-emerald-500/30"
                  : delta < 0
                    ? "text-[#FF5C5C] bg-red-500/[0.12] border-red-500/30"
                    : "text-[#8B93A8] bg-white/[0.05] border-white/[0.10]"
              }`}
            >
              {delta > 0 ? <ArrowUpRight size={11} /> : delta < 0 ? <ArrowDownRight size={11} /> : null}
              {delta > 0 ? "+" : ""}
              {delta}% <span className="font-normal opacity-80">vs last week</span>
            </div>
          ) : (
            summary?.totalReviewed === 0 && (
              <p className="-mt-1 w-full text-center text-[10.5px] leading-snug text-[#5C6479]">
                Not reviewed yet
              </p>
            )
          )}
        </div>

        {/* Right — status stack */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 sm:gap-2.5">
          <PerformanceStatusCard
            tone="approved"
            count={summary?.approved ?? 0}
            onClick={onStatusSelect ? () => onStatusSelect("Approved") : undefined}
          />
          <PerformanceStatusCard
            tone="pending"
            count={summary?.pending ?? 0}
            onClick={onStatusSelect ? () => onStatusSelect("Pending") : undefined}
          />
          <PerformanceStatusCard
            tone="rejected"
            count={summary?.rejected ?? 0}
            onClick={onStatusSelect ? () => onStatusSelect("Rejected") : undefined}
          />
        </div>
      </div>
    </section>
  );
}
