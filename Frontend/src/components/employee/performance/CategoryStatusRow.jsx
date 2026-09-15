import { useTranslation } from "react-i18next";
import { Award, ClipboardCheck, Clock3, ShieldCheck, TrendingUp } from "lucide-react";

// CategoryStatusRow.jsx — the compact, at-a-glance version of the five
// performance categories (reference: "Performance Ring — Final Design").
//
// This is a PRESENTATION-ONLY redesign. It reads the exact same
// `categories` object CategoryBreakdown.jsx already renders in full —
// same `points`/`max`/`applicable` fields the API already sends an
// employee, nothing new fetched, nothing recalculated. It just shows a
// short status word instead of a bar and a number.
//
// Icon + color are FIXED per category (identical to CategoryBreakdown's
// own CATEGORY_META/TONES, reused verbatim so the compact row and the
// detailed view underneath always agree) and are explicitly NOT derived
// from the overall score — see scoreColorBands.js's own comment on why
// that system stays separate from this one.
//
// The status WORD (Excellent/Good/Average/Needs improvement) is a plain
// bucketing of the category's own already-visible points/max ratio — the
// same ratio the bar in CategoryBreakdown already visualizes, just named
// in words instead of drawn as a bar. Nothing about the underlying score
// changes; this only changes how it reads at a glance.
const CATEGORY_META = {
  quality: { icon: Award, tone: "orange", label: "emp.perfQualityShort" },
  completion: { icon: ClipboardCheck, tone: "sky", label: "emp.perfCompletionShort" },
  attendance: { icon: Clock3, tone: "violet", label: "emp.perfAttendanceShort" },
  reliability: { icon: ShieldCheck, tone: "emerald", label: "emp.perfReliabilityShort" },
  consistency: { icon: TrendingUp, tone: "amber", label: "emp.perfConsistencyShort" },
};

const ICON_TONES = {
  orange: "text-[#F9A03C] bg-[#F47A20]/[0.14]",
  sky: "text-sky-400 bg-sky-500/[0.14]",
  violet: "text-violet-400 bg-violet-500/[0.14]",
  emerald: "text-emerald-400 bg-emerald-500/[0.14]",
  amber: "text-amber-400 bg-amber-500/[0.14]",
};

// Independent of both the category icon colors above AND the score
// ring's band colors — a third, small, purely-semantic palette for
// "how good was this", the same way a traffic light doesn't need to
// match the color of the car.
const STATUS_TONES = {
  excellent: "text-sky-300 bg-sky-500/[0.16] border-sky-500/25",
  good: "text-emerald-300 bg-emerald-500/[0.16] border-emerald-500/25",
  average: "text-amber-300 bg-amber-500/[0.16] border-amber-500/25",
  needsImprovement: "text-[#FF8F87] bg-red-500/[0.16] border-red-500/25",
  notMeasured: "text-[#5C6479] bg-white/[0.04] border-white/[0.08]",
};

function statusFor(category, t) {
  if (!category?.applicable || category.max === 0) {
    return { key: "notMeasured", label: t("emp.perfNotMeasured") };
  }
  const ratio = category.points / category.max;
  if (ratio >= 0.9) return { key: "excellent", label: t("emp.perfExcellent") };
  if (ratio >= 0.75) return { key: "good", label: t("emp.perfGood") };
  if (ratio >= 0.5) return { key: "average", label: t("emp.perfAverage") };
  return { key: "needsImprovement", label: t("emp.perfNeedsImprovement") };
}

const ORDER = ["quality", "completion", "attendance", "reliability", "consistency"];

export default function CategoryStatusRow({ categories, onOpenDetails }) {
  const { t } = useTranslation();
  if (!categories) return null;

  return (
    <div className="flex items-stretch gap-1.5 sm:gap-2" role="list" aria-label={t("emp.perfBreakdownTitle")}>
      {ORDER.map((key) => {
        const meta = CATEGORY_META[key];
        if (!meta) return null;
        const Icon = meta.icon;
        const status = statusFor(categories[key], t);

        return (
          <button
            key={key}
            type="button"
            role="listitem"
            onClick={onOpenDetails}
            className="flex-1 min-w-0 flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 bg-[#0D1223]/60 border border-white/[0.06] active:scale-[0.97] transition-transform"
          >
            <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${ICON_TONES[meta.tone]}`}>
              <Icon size={16} strokeWidth={2.2} />
            </span>
            {/* Two lines rather than truncating — "Productivity" and
                "Consistency" don't fit on one line at this card width on
                a 360-390px phone, and an ellipsis there reads as broken
                rather than compact. */}
            {/* min-h reserves room for a full two-line label so all five
                cards stay the same height whether their own label wraps
                or not — display:-webkit-box (the line-clamp mechanism)
                is set inline because it must win over any conflicting
                Tailwind display utility, so none is applied here. */}
            <span
              className="text-[9.5px] font-medium text-[#C7CDDB] text-center leading-[1.15] w-full min-h-[22px]"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {t(meta.label)}
            </span>
            <span
              className={`text-[9.5px] font-semibold px-1.5 py-[3px] rounded-full border leading-none whitespace-nowrap ${STATUS_TONES[status.key]}`}
            >
              {status.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
