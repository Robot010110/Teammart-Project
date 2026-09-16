import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import ZoneActivityPeriodControl from "../components/regionalManager/zoneActivities/ZoneActivityPeriodControl";
import ZoneActivityTotalCard from "../components/regionalManager/zoneActivities/ZoneActivityTotalCard";
import ZoneActivityCategoryCard from "../components/regionalManager/zoneActivities/ZoneActivityCategoryCard";
import {
  ZONE_ACTIVITY_TILE_ORDER, ZONE_ACTIVITY_EMPTY_PERIOD_KEY, zoneActivityCategoryMeta,
} from "../components/regionalManager/zoneActivities/zoneActivityMeta";
import { getZoneActivityCounts } from "../services/zoneActivitiesService";

const PERIOD_OPTIONS = [
  { key: "today", label: "rm.zaDay" },
  { key: "week", label: "emp.thisWeek" },
  { key: "month", label: "emp.thisMonth" },
];

// RmZoneActivitiesPage.jsx — Zone Activities: a read-only, zone-wide
// rollup of operational work already being tracked elsewhere in the app
// (Report Expired, Label Checking, Shelf Cleaning, Waste, Maintenance,
// etc.). This page creates no new activity — every card's count and every
// record behind it is the same real data the employee's own submission
// flow and their Supervisor's review queue already produce; see
// backend/src/services/zoneActivitiesService.js for the exact mapping.
//
// This is a presentation-only redesign (premium dark operational
// dashboard, reference-driven) — the data layer underneath is completely
// unchanged: same single GET /api/zone-activities/counts call, same
// period state, same category meta, same navigation callbacks. Day/Week/
// Month controls BOTH the counts below AND whichever category detail
// page is opened from here (period is passed through the route, see
// RegionalManagerWorkspace.jsx's RmZoneActivityCategoryRoute) — the
// backend computes both from the exact same date boundary per request,
// so they can never disagree (see the backend's own periodStart()).
export default function RmZoneActivitiesPage({ onBack, onOpenCategory, onOpenDepartmentClosing }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState("today");

  const { data, error, loading, reload } = useAsync(
    () => getZoneActivityCounts({ period }),
    { deps: [period], fallbackError: t("rm.zaCouldNotLoadZoneActivities") }
  );

  const countByKey = Object.fromEntries((data?.categories ?? []).map((c) => [c.key, c.count]));
  // Total Activities — a plain client-side sum of the real per-category
  // counts already in `data`, excluding department-closing (its count is
  // "unique markets", not "activities" — see ZoneActivityTotalCard.jsx).
  const totalActivities = (data?.categories ?? [])
    .filter((c) => c.key !== "department-closing")
    .reduce((sum, c) => sum + (c.count ?? 0), 0);

  function openTile(key) {
    const meta = zoneActivityCategoryMeta(key);
    if (!meta) return;
    // Department Closing has its own dedicated Market -> Shift ->
    // Department -> Photo drill-down, not the generic flat record list
    // every other tile opens.
    if (key === "department-closing") {
      onOpenDepartmentClosing(period);
      return;
    }
    onOpenCategory(key, period);
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-6 pt-4 sm:max-w-3xl sm:px-6 lg:max-w-6xl">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("emp.backToHome")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/10 active:scale-95"
          >
            <ArrowLeft size={16} className="rtl-flip" />
          </button>
        )}
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#8B93A8]">{t("rm.zaEyebrow")}</p>
          <h1 className="truncate font-display text-[26px] font-bold leading-tight sm:text-[30px]">
            <span className="text-white">{t("rm.zaTitleZone")}</span>{" "}
            <span className="bg-gradient-to-r from-amber-300 to-[#F47A20] bg-clip-text text-transparent">
              {t("rm.zaTitleActivities")}
            </span>
          </h1>
          <p className="mt-0.5 max-w-md text-[12.5px] text-[#8B93A8]">{t("rm.zaSubtitle")}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ZoneActivityPeriodControl
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS.map((p) => ({ key: p.key, label: t(p.label) }))}
        />
        <ZoneActivityTotalCard
          total={totalActivities}
          loading={loading}
          periodLabel={t("rm.zaAcrossZone", {
            period: t(ZONE_ACTIVITY_EMPTY_PERIOD_KEY[period] ?? "common.today").toLowerCase(),
          })}
        />
      </div>

      {error ? (
        <div className="mt-5">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      ) : loading ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: ZONE_ACTIVITY_TILE_ORDER.length }).map((_, i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-2xl border border-white/[0.06] bg-[#111A2D]/60" />
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ZONE_ACTIVITY_TILE_ORDER.map((key, i) => {
            const meta = zoneActivityCategoryMeta(key);
            if (!meta) return null;
            const count = countByKey[key] ?? 0;
            return (
              <ZoneActivityCategoryCard
                key={key}
                icon={meta.icon}
                count={count}
                label={t(meta.label)}
                description={meta.desc ? t(meta.desc) : undefined}
                tone={meta.tone}
                index={i}
                onClick={() => openTile(key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
