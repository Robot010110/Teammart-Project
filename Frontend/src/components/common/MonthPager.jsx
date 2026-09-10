import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

// MonthPager.jsx — the prev/current-month/next control duplicated in
// AttendanceSection.jsx and ItemReportSection.jsx (identical
// changeMonth(delta) logic and markup in both). Also fixes both copies'
// undersized h-6 w-6 (24px) tap targets in one place — 40px is
// comfortable for a thumb on a phone — and adds the aria-labels neither
// original had.
//
// `year`/`month` (1-12) + `onChange(year, month)` — the parent owns the
// state, this component is just the control.
//
// Month name is built from the same emp.january..december translation
// keys AttendanceMonthGrid.jsx's MONTHS array uses, rather than
// toLocaleDateString("en-US", ...), which hardcoded English regardless
// of the active language.
const MONTH_KEYS = [
  "emp.january", "emp.february", "emp.march", "emp.april", "emp.may", "emp.june",
  "emp.july", "emp.august", "emp.september", "emp.october", "emp.november", "emp.december",
];

export default function MonthPager({ year, month, onChange }) {
  const { t } = useTranslation();
  const label = `${t(MONTH_KEYS[month - 1])} ${year}`;

  const changeMonth = (delta) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    onChange(newYear, newMonth);
  };

  return (
    <div className="flex items-center gap-1 text-xs text-[#9AA1B4]">
      <button
        onClick={() => changeMonth(-1)}
        aria-label={t("emp.previousMonth")}
        className="h-10 w-10 grid place-items-center rounded-md hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors duration-150"
      >
        <ChevronLeft size={15} className="rtl-flip" />
      </button>
      <span className="min-w-[110px] text-center">{label}</span>
      <button
        onClick={() => changeMonth(1)}
        aria-label={t("emp.nextMonth")}
        className="h-10 w-10 grid place-items-center rounded-md hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors duration-150"
      >
        <ChevronRight size={15} className="rtl-flip" />
      </button>
    </div>
  );
}
