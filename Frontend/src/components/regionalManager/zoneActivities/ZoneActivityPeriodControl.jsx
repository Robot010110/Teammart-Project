import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

// ZoneActivityPeriodControl.jsx — a compact DAY/WEEK/MONTH segmented
// control for Zone Activities only (a presentational sibling of the
// shared PeriodSelector.jsx used on the Performance page — that one
// stays untouched so this redesign never affects it). Purely visual:
// `value`/`onChange` drive the exact same real period state the page
// already passed into getZoneActivityCounts()/listZoneActivityCategory()
// before this redesign — no frontend-only filtering is introduced here.
export default function ZoneActivityPeriodControl({ value, onChange, options }) {
  const { t } = useTranslation();

  return (
    <div
      role="tablist"
      aria-label={t("rm.zaSubtitle")}
      className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#0C1424]/80 p-1 backdrop-blur-xl"
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-all duration-200 ${
              active
                ? "bg-gradient-to-b from-amber-400 to-[#F47A20] text-[#241503] shadow-[0_4px_16px_-4px_rgba(244,122,32,0.65)]"
                : "text-[#8B93A8] hover:text-white"
            }`}
          >
            <Calendar size={13} className={active ? "opacity-90" : "opacity-60"} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
