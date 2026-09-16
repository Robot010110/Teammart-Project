import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight, RotateCw } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ZoneActivityRow from "../components/regionalManager/zoneActivities/ZoneActivityRow";
import ZoneActivityPhotoViewer from "../components/regionalManager/zoneActivities/ZoneActivityPhotoViewer";
import PeriodSelector from "../components/employee/performance/PeriodSelector";
import { zoneActivityCategoryMeta, ZONE_ACTIVITY_EMPTY_PERIOD_KEY } from "../components/regionalManager/zoneActivities/zoneActivityMeta";
import { listZoneActivityCategory } from "../services/zoneActivitiesService";

const PERIOD_OPTIONS = [
  { key: "today", label: "common.today" },
  { key: "week", label: "emp.thisWeek" },
  { key: "month", label: "emp.thisMonth" },
];

const PAGE_SIZE = 25;

// RmZoneActivityCategoryPage.jsx — the record list behind one Zone
// Activities tile. Server-side filtered and paginated (period + page —
// never the whole zone's history downloaded to the browser), mirroring
// RmExpiredItemsPage.jsx's own structure exactly, generalized to
// whichever real category was opened.
export default function RmZoneActivityCategoryPage({ category, initialPeriod = "today", onBack }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(initialPeriod);
  const [page, setPage] = useState(1);
  const [viewer, setViewer] = useState(null); // { photos, startIndex } | null

  const meta = zoneActivityCategoryMeta(category);

  const { data, error, loading, reload } = useAsync(
    () => listZoneActivityCategory(category, { period, page, pageSize: PAGE_SIZE }),
    { deps: [category, period, page], fallbackError: t("rm.zaCouldNotLoadRecords") }
  );

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function choosePeriod(key) {
    setPeriod(key);
    setPage(1);
  }

  if (!meta) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-[#8B93A8]">
        {t("rm.zaUnknownCategory")}
      </div>
    );
  }

  const Icon = meta.icon;
  const emptyMessage = t("rm.zaEmptyState", {
    subject: t(meta.empty),
    period: t(ZONE_ACTIVITY_EMPTY_PERIOD_KEY[period] ?? "common.today").toLowerCase(),
  });

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
          <h1 className="truncate font-display text-[22px] font-bold leading-tight text-white">{t(meta.label)}</h1>
          <p className="text-[12px] text-[#8B93A8]">
            {loading ? t("rm.loadingReports") : t("rm.reportsCount", { count: total })}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <PeriodSelector value={period} onChange={choosePeriod} options={PERIOD_OPTIONS.map((p) => ({ key: p.key, label: t(p.label) }))} />
      </div>

      <div className="mt-3.5 space-y-2.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-[18px] border border-white/[0.06] bg-[#111A2D]/60" />
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
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/70 px-6 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F47A20]/10 text-[#F47A20]">
              <Icon size={20} />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-white">{emptyMessage}</p>
          </div>
        ) : (
          records.map((record, i) => (
            <ZoneActivityRow
              key={record.id}
              record={record}
              icon={Icon}
              tone={meta.tone}
              index={i}
              onOpenPhotos={(r) => setViewer({ photos: r.photos, startIndex: 0 })}
            />
          ))
        )}
      </div>

      {!loading && !error && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-[#111A2D]/80 px-3 py-2 text-[12.5px] font-medium text-white transition-colors hover:border-white/[0.16] disabled:opacity-40"
          >
            <ChevronRight size={14} className="rotate-180 rtl-flip" /> {t("rm.previous")}
          </button>
          <span className="text-[12px] text-[#8B93A8]">{t("rm.pageOfTotal", { page, total: totalPages })}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-[#111A2D]/80 px-3 py-2 text-[12.5px] font-medium text-white transition-colors hover:border-white/[0.16] disabled:opacity-40"
          >
            {t("common.next")} <ChevronRight size={14} className="rtl-flip" />
          </button>
        </div>
      )}

      {viewer && (
        <ZoneActivityPhotoViewer photos={viewer.photos} startIndex={viewer.startIndex} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
