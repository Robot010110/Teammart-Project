import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import MonthPager from "../common/MonthPager";
import Modal from "../common/Modal";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
function firstWeekdayOffset(year, month) {
  const day = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  return day === 0 ? 6 : day - 1; // Monday-first
}

// ActivityCalendarScreen.jsx — ONE reusable monthly calendar reused for
// every activity category (spec §6/§12: "do not create a completely
// different UI for every activity type"). The caller supplies:
//   fetchMonth(year, month) -> Promise<Array<{ date: ISOstring, note?: string, ...raw }>>
//   renderDetail(item) -> JSX, shown in a modal when a day is tapped
// Day color: green = an item exists that day, gray = nothing, yellow =
// an item exists AND carries a `note` (spec: "note or special
// information").
export default function ActivityCalendarScreen({ title, onBack, fetchMonth, renderDetail }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState(null);

  const { data: items, error, loading, reload } = useAsync(() => fetchMonth(year, month), {
    deps: [year, month],
    fallbackError: "Could not load this activity history.",
  });

  const itemsByDay = new Map();
  (items ?? []).forEach((item) => {
    const day = new Date(item.date).getDate();
    if (!itemsByDay.has(day)) itemsByDay.set(day, item);
  });

  const totalDays = daysInMonth(year, month);
  const offset = firstWeekdayOffset(year, month);
  const cells = [...Array(offset).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <MonthPager year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {loading ? (
        <SkeletonCard className="h-[320px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {WEEKDAY_LABELS.map((d, i) => (
                <span key={i} className="text-center text-[10px] font-medium text-[#4C5266]">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((day, i) => {
                if (day == null) return <span key={`empty-${i}`} />;
                const item = itemsByDay.get(day);
                const tone = !item
                  ? "bg-white/[0.04] text-[#4C5266]"
                  : item.note
                  ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30";
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!item}
                    onClick={() => item && setSelected(item)}
                    className={`aspect-square rounded-lg text-xs font-medium transition-colors ${tone} ${item ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 text-[11px] text-[#8B93A8]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60" /> Has note</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-white/10" /> No activity</span>
          </div>
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? new Date(selected.date).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : ""}
      >
        {selected && renderDetail(selected)}
      </Modal>
    </div>
  );
}
