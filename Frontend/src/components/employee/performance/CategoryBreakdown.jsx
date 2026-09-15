import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, ClipboardCheck, Clock3, ShieldCheck, TrendingUp, ChevronDown } from "lucide-react";

// CategoryBreakdown.jsx — the five categories that make up the score.
//
// This is the component that has to answer "why am I this score?", so
// every row shows three things: what the category is worth, what was
// earned, and the plain-language reason behind it. Expanding a row gives
// the real counts the backend used — absences, late days, penalty hours,
// how many items were approved or rejected.
//
// Everything rendered here comes from the API response as-is. Nothing is
// recomputed client-side, and a category the backend marked
// non-applicable is shown as such rather than as a zero — "not measured
// this period" and "measured and scored nothing" are different facts and
// must not look the same.

const CATEGORY_META = {
  quality: { icon: Award, tone: "orange", label: "emp.perfQuality", blurb: "emp.perfQualityBlurb" },
  completion: { icon: ClipboardCheck, tone: "sky", label: "emp.perfCompletion", blurb: "emp.perfCompletionBlurb" },
  attendance: { icon: Clock3, tone: "violet", label: "emp.perfAttendance", blurb: "emp.perfAttendanceBlurb" },
  reliability: { icon: ShieldCheck, tone: "emerald", label: "emp.perfReliability", blurb: "emp.perfReliabilityBlurb" },
  consistency: { icon: TrendingUp, tone: "amber", label: "emp.perfConsistency", blurb: "emp.perfConsistencyBlurb" },
};

const TONES = {
  orange: { text: "text-[#F9A03C]", bar: "bg-[#F47A20]", bg: "bg-[#F47A20]/[0.12]", border: "border-[#F47A20]/[0.22]" },
  sky: { text: "text-sky-400", bar: "bg-sky-400", bg: "bg-sky-500/[0.12]", border: "border-sky-500/[0.22]" },
  violet: { text: "text-violet-400", bar: "bg-violet-400", bg: "bg-violet-500/[0.12]", border: "border-violet-500/[0.22]" },
  emerald: { text: "text-emerald-400", bar: "bg-emerald-400", bg: "bg-emerald-500/[0.12]", border: "border-emerald-500/[0.22]" },
  amber: { text: "text-amber-400", bar: "bg-amber-400", bg: "bg-amber-500/[0.12]", border: "border-amber-500/[0.22]" },
};

// The plain-language facts behind each category. Only keys the backend
// actually sent are rendered — an absent key means that fact was not
// measured, and inventing a "0" for it would be a fabricated number.
function detailRows(key, detail, t) {
  const rows = [];
  const add = (label, value) => {
    if (value !== undefined && value !== null) rows.push({ label, value });
  };

  if (key === "quality") {
    add(t("emp.perfReviewedItems"), detail.reviewedItems);
    add(t("emp.approved"), detail.approved);
    add(t("emp.perfCorrected"), detail.corrected);
    add(t("emp.rejected"), detail.rejected);
  } else if (key === "completion") {
    add(t("emp.perfAssigned"), detail.eligibleAssigned);
    add(t("emp.perfCompleted"), detail.completed);
    if (detail.excused > 0) add(t("emp.perfExcused"), detail.excused);
    if (detail.timelinessApplies) add(t("emp.perfOnTime"), `${detail.completedOnTime}/${detail.completedWithDueDate}`);
  } else if (key === "attendance") {
    add(t("emp.perfWorkingDays"), detail.workingDays);
    if (detail.absentDays > 0) add(t("emp.perfAbsences"), detail.absentDays);
    if (detail.lateDays > 0) add(t("emp.perfLateDays"), detail.lateDays);
    if (detail.earlyLeaveDays > 0) add(t("emp.perfEarlyLeaves"), detail.earlyLeaveDays);
    if (detail.incompleteDays > 0) add(t("emp.perfMissingCheckouts"), detail.incompleteDays);
    if (detail.hoursApplies) add(t("emp.perfHours"), `${detail.workedHours}/${detail.requiredHours}`);
  } else if (key === "reliability") {
    // An employee is entitled to see exactly what was deducted and why —
    // a penalty they cannot see is one they cannot dispute.
    add(t("emp.perfPenaltyHours"), detail.punishmentHours);
    if (detail.penaltyEventCount > 0) add(t("emp.perfPenaltyEvents"), detail.penaltyEventCount);
    if (detail.totalDeduction > 0) add(t("emp.perfDeducted"), `−${detail.totalDeduction}`);
  } else if (key === "consistency") {
    add(t("emp.perfApprovalStreak"), detail.currentApprovalStreak);
    add(t("emp.perfBestStreak"), detail.bestApprovalStreak);
    if (detail.improvementApplies && detail.delta != null) {
      add(t("emp.perfVsLastPeriod"), `${detail.delta > 0 ? "+" : ""}${detail.delta}`);
    }
  }
  return rows;
}

function CategoryRow({ categoryKey, category, t }) {
  const [open, setOpen] = useState(false);
  const meta = CATEGORY_META[categoryKey];
  if (!meta) return null;
  const tone = TONES[meta.tone];
  const Icon = meta.icon;

  const applicable = category?.applicable;
  const points = category?.points ?? 0;
  const max = category?.max ?? 0;
  const pct = applicable && max > 0 ? Math.min(100, (points / max) * 100) : 0;
  const rows = applicable ? detailRows(categoryKey, category.detail ?? {}, t) : [];

  return (
    <div className={`rounded-[18px] border ${tone.border} bg-[#0D1223]/80 overflow-hidden`}>
      <button
        type="button"
        onClick={() => rows.length > 0 && setOpen((v) => !v)}
        className="w-full text-left p-3 flex items-start gap-3"
        aria-expanded={open}
      >
        <span className={`shrink-0 w-9 h-9 rounded-xl grid place-items-center ${tone.bg} ${tone.text}`}>
          <Icon size={16} strokeWidth={2.1} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold text-white truncate">{t(meta.label)}</p>
            {applicable ? (
              <p className={`shrink-0 font-display text-[15px] font-bold tabular-nums ${tone.text}`}>
                {points}
                <span className="text-[11px] font-medium text-[#5C6479]"> / {max}</span>
              </p>
            ) : (
              <p className="shrink-0 text-[11px] font-medium text-[#5C6479]">{t("emp.perfNotMeasured")}</p>
            )}
          </div>

          {/* The bar is the at-a-glance answer; the blurb says what the
              category actually measures, so the label is never a mystery. */}
          <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full ${tone.bar} transition-[width] duration-700 ease-out`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10.5px] leading-snug text-[#8B93A8]">{t(meta.blurb)}</p>
        </div>

        {rows.length > 0 && (
          <ChevronDown
            size={15}
            className={`shrink-0 mt-1 text-[#5C6479] transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && rows.length > 0 && (
        <dl className="px-3 pb-3 pt-0 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-white/[0.06] mt-0">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-2 pt-2">
              <dt className="text-[11px] text-[#8B93A8] truncate">{row.label}</dt>
              <dd className="text-[12px] font-semibold text-white tabular-nums shrink-0">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function CategoryBreakdown({ categories }) {
  const { t } = useTranslation();
  if (!categories) return null;

  // The title/hint now live on the caller (PerformancePanel's "View
  // details" toggle owns that heading) — this component used to render
  // its own copy of the exact same text directly above this one, which
  // read as a duplicated heading once it moved behind that toggle.
  return (
    <section>
      <div className="flex flex-col gap-2">
        {["quality", "completion", "attendance", "reliability", "consistency"].map((key) => (
          <CategoryRow key={key} categoryKey={key} category={categories[key]} t={t} />
        ))}
      </div>
    </section>
  );
}
