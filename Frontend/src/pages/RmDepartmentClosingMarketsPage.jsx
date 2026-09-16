import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight, RotateCw, DoorClosed } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import PeriodSelector from "../components/employee/performance/PeriodSelector";
import { listDepartmentClosingMarkets } from "../services/zoneActivitiesService";

const PERIOD_OPTIONS = [
  { key: "today", label: "common.today" },
  { key: "week", label: "emp.thisWeek" },
  { key: "month", label: "emp.thisMonth" },
];

// RmDepartmentClosingMarketsPage.jsx — Page 2: EVERY authorized market in
// the Regional Manager's zone(s), each with its real Completed/Expected
// shift count (normally X/3 for Day). A market with zero completed shifts
// is still shown as 0/N here — it is never hidden, per spec. Zone scoping
// is entirely server-side (see zoneActivitiesController.getDepartmentClosingMarkets
// -> resolveZoneScope); no zoneId is ever sent from here.
export default function RmDepartmentClosingMarketsPage({ initialPeriod = "today", onBack, onOpenMarket }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(initialPeriod);

  const { data, error, loading, reload } = useAsync(
    () => listDepartmentClosingMarkets({ period }),
    { deps: [period], fallbackError: t("rm.zaCouldNotLoadRecords") }
  );

  const markets = data?.markets ?? [];

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-4 pt-4 sm:max-w-3xl sm:px-6">
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
          <h1 className="truncate font-display text-[22px] font-bold leading-tight text-white">{t("rm.zaDepartmentClosing")}</h1>
          <p className="text-[12px] text-[#8B93A8]">{t("rm.zaDepartmentClosingSubtitle")}</p>
        </div>
      </div>

      <div className="mt-4">
        <PeriodSelector value={period} onChange={setPeriod} options={PERIOD_OPTIONS.map((p) => ({ key: p.key, label: t(p.label) }))} />
      </div>

      <div className="mt-3.5 space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[60px] animate-pulse rounded-[16px] border border-white/[0.06] bg-[#111A2D]/60" />
          ))
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
        ) : markets.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/70 px-6 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#C08BFF]/10 text-[#C08BFF]">
              <DoorClosed size={20} />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-white">{t("rm.zaNoActivityFound")}</p>
          </div>
        ) : (
          markets.map((m, i) => (
            <button
              key={m.marketId}
              type="button"
              onClick={() => onOpenMarket(m.marketId, period)}
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
              className="animate-fade-up flex w-full items-center justify-between rounded-[16px] border border-white/[0.07] bg-[#111A2D]/80 px-4 py-3.5 text-start backdrop-blur-xl transition-colors hover:bg-[#111A2D] active:scale-[0.99]"
            >
              <span className="min-w-0 truncate text-[13.5px] font-semibold text-white">{m.marketName}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-[12.5px] font-semibold tabular-nums ${
                    m.completedShifts > 0 ? "text-emerald-400" : "text-[#8B93A8]"
                  }`}
                >
                  {m.completedShifts} / {m.totalShifts}
                </span>
                <ChevronRight size={15} className="rtl-flip text-[#5C6479]" />
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
