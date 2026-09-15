import { useTranslation } from "react-i18next";

// PeriodSelector.jsx — which period the Performance page is showing.
//
// The current WEEK lives here rather than on the home screen: the
// homepage deliberately shows the month (a week is too short a window to
// judge anyone on at a glance), but an employee should still be able to
// look at the week they are actually in.
//
// Horizontally scrollable rather than wrapped, so the row stays one line
// on a 360px phone instead of becoming a two-row block that pushes the
// score below the fold.
export default function PeriodSelector({ value, onChange, options }) {
  const { t } = useTranslation();

  return (
    <div
      className="-mx-1 px-1 flex gap-1.5 overflow-x-auto snap-x scrollbar-none"
      role="tablist"
      aria-label={t("emp.perfPeriodSelector")}
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
            className={`snap-start shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold border transition-colors ${
              active
                ? "bg-[#F47A20] border-[#F47A20] text-white"
                : "bg-white/[0.04] border-white/[0.08] text-[#8B93A8] hover:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
