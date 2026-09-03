import { CheckCircle2, Clock3, XCircle, ChevronRight } from "lucide-react";
import AnimatedNumber from "../../common/AnimatedNumber";

// PerformanceStatusCard.jsx — one Approved / Pending / Rejected row in
// the hero's right-hand stack.
//
// Laid out as a wide row (icon · label · count · chevron) rather than a
// square tile, matching the reference: the hero pairs a large ring on the
// left with three stacked rows on the right, which reads far better on a
// 360px phone than three cramped columns under the ring.
//
// Counts come from GET /api/activities/performance — real numbers, with
// AnimatedNumber counting up to them rather than animating over anything
// fabricated. The chevron only renders when the caller actually passes a
// destination, so there is never an arrow that does nothing.
const TONES = {
  approved: {
    label: "Approved",
    Icon: CheckCircle2,
    text: "text-emerald-400",
    ringGlow: "shadow-[0_0_12px_1px_rgba(52,211,153,0.35)]",
    border: "border-emerald-500/[0.18]",
  },
  pending: {
    label: "Pending",
    Icon: Clock3,
    text: "text-[#F9A03C]",
    ringGlow: "shadow-[0_0_12px_1px_rgba(249,160,60,0.35)]",
    border: "border-[#F9A03C]/[0.18]",
  },
  rejected: {
    label: "Rejected",
    Icon: XCircle,
    text: "text-[#FF5C5C]",
    ringGlow: "shadow-[0_0_12px_1px_rgba(255,92,92,0.35)]",
    border: "border-[#FF5C5C]/[0.18]",
  },
};

export default function PerformanceStatusCard({ tone, count, onClick }) {
  const t = TONES[tone];
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      {...(onClick ? { type: "button", onClick, "aria-label": `${count} ${t.label}. View details.` } : {})}
      className={`w-full rounded-2xl pl-2.5 pr-1.5 py-2.5 bg-[#12172A]/70 border ${t.border} flex items-center gap-2 transition-all duration-150 ${
        onClick ? "active:scale-[0.98] hover:bg-[#182034]/80" : ""
      }`}
    >
      <span className={`shrink-0 w-[26px] h-[26px] rounded-full grid place-items-center ${t.text} ${t.ringGlow} bg-white/[0.03]`}>
        <t.Icon size={14} strokeWidth={2.2} />
      </span>

      {/* whitespace-nowrap + shrink-0: these three labels are short and
          fixed, so they should never ellipsize — if space is tight the
          card's own width is what needs to change, not the word. */}
      <span className="flex-1 min-w-0 text-left text-[12.5px] font-semibold text-white whitespace-nowrap">
        {t.label}
      </span>

      <span className={`shrink-0 font-display text-[17px] font-bold tabular-nums leading-none ${t.text}`}>
        <AnimatedNumber value={count} />
      </span>

      {onClick && <ChevronRight size={14} className="shrink-0 text-[#5C6479]" />}
    </Wrapper>
  );
}
