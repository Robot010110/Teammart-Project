import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, Circle, RotateCw, ListChecks } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import PeriodSelector from "../components/employee/performance/PeriodSelector";
import ShiftBadge from "../components/common/ShiftBadge";
import DepartmentClosingShiftModal from "../components/regionalManager/zoneActivities/DepartmentClosingShiftModal";
import { getDepartmentClosingMarket } from "../services/zoneActivitiesService";

const PERIOD_OPTIONS = [
  { key: "today", label: "common.today" },
  { key: "week", label: "emp.thisWeek" },
  { key: "month", label: "emp.thisMonth" },
];

function formatDayLabel(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// RmDepartmentClosingMarketPage.jsx — Page 3: one market's Department
// Closing completion, day by day, shift by shift. Every shift row here
// comes straight from the backend's own Market/Day/Shift grouping
// (departmentClosingZoneService.js's getDepartmentClosingMarketDetail) —
// never hardcoded, and records from different dates/shifts are never
// merged (each day in `data.days` keeps its own three independent shift
// entries). Tapping a shift (Completed or Not Completed) opens Page 4 —
// the exact department-by-department breakdown for that one date+shift —
// which doubles as the "Show All" action the spec asks for, since it
// already shows every department at once in canonical order.
export default function RmDepartmentClosingMarketPage({ marketId, initialPeriod = "today", onBack }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(initialPeriod);
  const [openShift, setOpenShift] = useState(null); // { date, shift } | null

  const { data, error, loading, reload } = useAsync(
    () => getDepartmentClosingMarket(marketId, { period }),
    { deps: [marketId, period], fallbackError: t("rm.zaCouldNotLoadRecords") }
  );

  const days = data?.days ?? [];
  const hasAnyCompleted = (data?.completedShifts ?? 0) > 0;

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-6 pt-4 sm:max-w-3xl sm:px-6">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("rm.zaBackToZoneActivities")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/10 active:scale-95"
          >
            <ArrowLeft size={16} className="rtl-flip" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-[20px] font-bold leading-tight text-white">
            {data?.marketName ?? " "}
          </h1>
          <p className="text-[12.5px] text-[#8B93A8]">
            {loading
              ? t("rm.loadingReports")
              : t("rm.zaShiftsCompleted", { count: data?.completedShifts ?? 0, total: data?.totalShifts ?? 0 })}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <PeriodSelector value={period} onChange={setPeriod} options={PERIOD_OPTIONS.map((p) => ({ key: p.key, label: t(p.label) }))} />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-[160px] animate-pulse rounded-[18px] border border-white/[0.06] bg-[#111A2D]/60" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6 text-center">
            <p className="text-[13.5px] font-semibold text-white">{t("rm.zaCouldNotLoadRecords")}</p>
            <p className="mt-1 text-[12px] text-[#9AA1B4]">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/[0.1]"
            >
              <RotateCw size={13} /> {t("rm.tryAgain")}
            </button>
          </div>
        ) : days.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/70 px-6 py-10 text-center">
            <p className="text-[14px] font-semibold text-white">{t("rm.zaNoActivityFound")}</p>
          </div>
        ) : (
          <>
            {!hasAnyCompleted && (
              <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-center text-[12.5px] text-[#8B93A8]">
                {t("rm.zaNoCompletedShifts")}
              </div>
            )}
            <div className="space-y-3">
              {days.map((day) => (
                <div
                  key={day.date}
                  className="rounded-[18px] border border-white/[0.07] bg-[#111A2D]/80 p-3.5 backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-white">{formatDayLabel(day.date)}</p>
                    <span className="text-[11.5px] text-[#8B93A8]">
                      {day.completedShifts} / {day.totalShifts}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {day.shifts.map((s) => (
                      <button
                        key={s.shift}
                        type="button"
                        onClick={() => setOpenShift({ date: day.date, shift: s.shift })}
                        className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-start transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
                      >
                        <ShiftBadge shift={s.shift} size={14} className="text-[13px] font-medium text-white" />
                        <span
                          className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${
                            s.completed ? "text-emerald-400" : "text-[#8B93A8]"
                          }`}
                        >
                          {s.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                          {s.completed ? t("rm.zaCompleted") : t("rm.zaNotCompleted")}
                          {s.completed && <ListChecks size={13} className="ms-1 text-[#8B93A8]" />}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {openShift && (
        <DepartmentClosingShiftModal
          marketId={marketId}
          date={openShift.date}
          shift={openShift.shift}
          onClose={() => setOpenShift(null)}
        />
      )}
    </div>
  );
}
