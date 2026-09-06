import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import RmHomeHeader from "../components/regionalManager/home/RmHomeHeader";
import ZoneOverviewCard from "../components/regionalManager/home/ZoneOverviewCard";
import ZonePerformanceCard from "../components/regionalManager/home/ZonePerformanceCard";
import ZoneStatsRow from "../components/regionalManager/home/ZoneStatsRow";
import ExpiredItemsCard from "../components/regionalManager/home/ExpiredItemsCard";
import AttentionSection from "../components/regionalManager/home/AttentionSection";
import RecentActivityPreview from "../components/regionalManager/home/RecentActivityPreview";
import { computeZoneMetrics } from "../components/regionalManager/home/zoneMetrics";
import { listMarkets } from "../services/marketService";
import { listZones } from "../services/zoneService";
import { listZoneMarketProblems } from "../services/marketProblemsService";
import { listZoneActivities } from "../services/activityService";

const BASE_PATH = "/rm";

// RegionalManagerHome.jsx — the Regional Manager's command center.
//
// Six questions, answered top to bottom, then it stops:
//   who am I / which zone      RmHomeHeader + ZoneOverviewCard
//   how is the zone doing      ZonePerformanceCard (the hero)
//   how big is it              ZoneStatsRow
//   does anything need me      AttentionSection
//   what just happened         RecentActivityPreview (2 rows, capped)
//
// Everything below Home is a real existing page, reached by tapping —
// no full lists live here. All four requests are the same real,
// server-scoped endpoints the rest of the RM app already uses; a
// Regional Manager token can only ever see their own zones (enforced in
// backend/src/middleware/auth.js, never by anything here).
//
// The four loads are separate on purpose rather than one Promise.all:
// the zone header, the hero and the two lists can each render (or show
// their own error) as soon as their own data lands, instead of the
// whole page waiting on the slowest call.
export default function RegionalManagerHome({ session }) {
  const navigate = useNavigate();
  const zoneIds = useMemo(() => session.zoneIds ?? [], [session.zoneIds]);

  const { data: zones, error: zonesError, loading: zonesLoading, reload: reloadZones } = useAsync(listZones, { deps: [] });
  const { data: markets, error: marketsError, loading: marketsLoading, reload: reloadMarkets } = useAsync(listMarkets, { deps: [] });

  const { data: problems, loading: problemsLoading } = useAsync(
    async () => {
      if (!zoneIds.length) return [];
      const perZone = await Promise.all(zoneIds.map((zoneId) => listZoneMarketProblems(zoneId, "active")));
      return perZone.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    { deps: [zoneIds.join(",")] }
  );

  const { data: activities, loading: activitiesLoading } = useAsync(() => listZoneActivities({ take: 30 }), { deps: [] });

  const metrics = useMemo(() => computeZoneMetrics({ markets, problems, activities }), [markets, problems, activities]);

  // A Regional Manager can hold more than one zone. The reference design
  // assumes a single zone, so a single zone reads exactly like it — and
  // several zones collapse honestly into a combined label rather than
  // silently showing only the first one's numbers.
  const zoneLabel = useMemo(() => {
    if (!zones?.length) return null;
    if (zones.length === 1) return `Zone ${zones[0].number}`;
    return `${zones.length} Zones`;
  }, [zones]);

  const zoneMarketCount = zones?.reduce((sum, z) => sum + z.marketsCount, 0) ?? 0;
  const zoneEmployeeCount = zones?.reduce((sum, z) => sum + z.employeesCount, 0) ?? 0;

  const problemMarketIds = useMemo(
    () => new Set((problems ?? []).map((p) => p.marketId ?? p.market?.id).filter(Boolean)),
    [problems]
  );
  const offlineCount = (markets ?? []).filter((m) => m.status !== "ACTIVE").length;

  const headLoading = zonesLoading || marketsLoading;

  return (
    <div className="mx-auto max-w-lg animate-fade-up space-y-4 px-4 pb-4 pt-5 sm:max-w-2xl sm:px-6">
      <RmHomeHeader session={session} zoneLabel={zoneLabel} basePath={BASE_PATH} />

      {(zonesError || marketsError) && (
        <ErrorBanner
          message={zonesError || marketsError}
          onRetry={() => {
            if (zonesError) reloadZones();
            if (marketsError) reloadMarkets();
          }}
        />
      )}

      <ZoneOverviewCard
        zoneLabel={zoneLabel ?? "No zone assigned"}
        marketCount={zoneMarketCount}
        employeeCount={zoneEmployeeCount}
        markets={markets}
        problemMarketIds={problemMarketIds}
        openProblemCount={problems?.length ?? 0}
        offlineCount={offlineCount}
        loading={headLoading}
        onOpen={() => navigate(`${BASE_PATH}/markets`)}
      />

      <ZonePerformanceCard
        overall={metrics.overall}
        metrics={metrics.metrics}
        marketCount={metrics.marketCount}
        loading={headLoading}
        onOpenDetails={() => navigate(`${BASE_PATH}/activities`)}
      />

      <ZoneStatsRow
        employees={metrics.totalEmployees}
        supervisors={metrics.supervisorCount}
        markets={metrics.marketCount}
        basePath={BASE_PATH}
        navigate={navigate}
        loading={marketsLoading}
      />

      <ExpiredItemsCard onOpen={() => navigate(`${BASE_PATH}/expired-items`)} />

      <AttentionSection
        problems={problems}
        loading={problemsLoading}
        onViewAll={() => navigate(`${BASE_PATH}/attention`)}
        onOpen={() => navigate(`${BASE_PATH}/attention`)}
      />

      <RecentActivityPreview
        activities={activities}
        loading={activitiesLoading}
        onViewAll={() => navigate(`${BASE_PATH}/activities`)}
      />
    </div>
  );
}
