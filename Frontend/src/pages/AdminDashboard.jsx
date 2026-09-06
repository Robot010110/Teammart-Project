import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Store, ShieldCheck, Users2, PackageX, AlertTriangle } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import AdminKpiCard from "../components/admin/AdminKpiCard";
import AdminZonePerformance from "../components/admin/AdminZonePerformance";
import AdminAttendanceDonut from "../components/admin/AdminAttendanceDonut";
import AdminAttentionRequired from "../components/admin/AdminAttentionRequired";
import AdminRecentActivity from "../components/admin/AdminRecentActivity";
import { computeZoneMetrics } from "../components/regionalManager/home/zoneMetrics";
import { getCompanyOverview, listCompanyAttendance, listCompanyActivities } from "../services/adminService";
import { listMarkets, listAccessibleSupervisors } from "../services/marketService";
import { listZones } from "../services/zoneService";
import { listMarketProblems } from "../services/marketProblemsService";
import { listZoneItemReports } from "../services/itemReportService";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// AdminDashboard.jsx — the organization-wide command center.
//
// Every figure is a live query against endpoints that already existed
// and are already ADMIN-gated server-side:
//   getCompanyOverview       zones/markets/employee + staff role counts
//   listCompanyAttendance    today's real attendance states
//   listCompanyActivities    the company activity feed
//   listMarkets / listZones  unscoped for ADMIN (see marketsController)
//   listMarketProblems       open issues, per market
//   listZoneItemReports      expired/wasted reports (unscoped for ADMIN)
//
// Nothing is hardcoded and nothing is extrapolated: where the backend
// has no figure, the UI shows "—" rather than inventing one. There is
// deliberately no "+N from yesterday" anywhere — this system stores no
// historical snapshot to compare against.
//
// Each section loads independently so one failing request degrades that
// card only, instead of blanking the whole dashboard.
export default function AdminDashboard({ session }) {
  const navigate = useNavigate();

  const { data: overview, error: overviewError, loading: overviewLoading, reload: reloadOverview } = useAsync(getCompanyOverview, { deps: [] });
  const { data: attendance, loading: attendanceLoading } = useAsync(() => listCompanyAttendance(), { deps: [] });
  const { data: activities, loading: activitiesLoading } = useAsync(() => listCompanyActivities({ take: 8 }), { deps: [] });
  const { data: markets, loading: marketsLoading } = useAsync(listMarkets, { deps: [] });
  const { data: zones, loading: zonesLoading } = useAsync(listZones, { deps: [] });
  const { data: expired, loading: expiredLoading } = useAsync(() => listZoneItemReports({ period: "today", pageSize: 1 }), { deps: [] });
  // Supervisors actually assigned to a market. Deliberately NOT
  // staffByRole.SUPERVISOR + OVERLOOKING: that counts every account
  // holding the role, including ones attached to no market at all, which
  // overstates how many supervisors the organization really runs.
  const { data: supervisors, loading: supervisorsLoading } = useAsync(listAccessibleSupervisors, { deps: [] });

  // Open problems across every market the Admin can see. Market problems
  // are queried per market (the endpoint is market- or zone-scoped), so
  // this fans out over the real market list rather than inventing a
  // company-wide problems endpoint.
  const { data: problems, loading: problemsLoading } = useAsync(
    async () => {
      if (!markets?.length) return [];
      const perMarket = await Promise.all(markets.map((m) => listMarketProblems(m.id, "active").catch(() => [])));
      return perMarket.flat();
    },
    { deps: [markets?.length ?? 0] }
  );

  // Per-zone score, using the same computeZoneMetrics the Regional
  // Manager's own Zone Performance card uses — grouped by zone here.
  const zonePerformance = useMemo(() => {
    if (!zones?.length || !markets) return [];
    return zones.map((z) => {
      const zoneNumericId = Number(String(z.id).replace("zone-", ""));
      const zoneMarkets = markets.filter((m) => m.zoneId === zoneNumericId);
      const marketIds = new Set(zoneMarkets.map((m) => m.id));
      const metrics = computeZoneMetrics({
        markets: zoneMarkets.length ? zoneMarkets : null,
        problems: (problems ?? []).filter((p) => marketIds.has(p.marketId ?? p.market?.id)),
        activities: (activities ?? []).filter((a) => marketIds.has(a.employee?.marketId ?? a.marketId)),
      });
      // "Market Health" alone is 100% for any zone with no open
      // issues — including a zone with no employees and nothing
      // happening. Reporting that as a perfect score would be
      // misleading, so a zone only gets a score once at least one
      // substantive metric (attendance, tasks or readiness) exists.
      const substantive = metrics.metrics.some((m) => m.key !== "health" && m.value != null);
      return { zoneId: z.id, zoneNumber: z.number, overall: substantive ? metrics.overall : null };
    });
  }, [zones, markets, problems, activities]);

  // Attention items, each derived from a real row.
  const attentionItems = useMemo(() => {
    const items = [];

    for (const p of problems ?? []) {
      items.push({
        id: `problem-${p.id}`,
        severity: "critical",
        title: `${p.market?.name ? `${p.market.name} — ` : ""}${p.problemType}`,
        context: p.location || p.description || "Open operational report",
        meta: p.status === "IN_PROGRESS" ? "In progress" : "Open",
        to: "/admin/markets",
      });
    }

    // A market that is staffed but has nobody checked in right now.
    for (const m of markets ?? []) {
      if (m.employeesCount > 0 && m.activeCount === 0) {
        items.push({
          id: `attendance-${m.id}`,
          severity: "warning",
          title: `${m.name} — nobody checked in`,
          context: `${m.employeesCount} employee${m.employeesCount === 1 ? "" : "s"} assigned, 0 on shift`,
          meta: "Now",
          to: "/admin/attendance",
        });
      }
      if (m.status !== "ACTIVE") {
        items.push({
          id: `status-${m.id}`,
          severity: "warning",
          title: `${m.name} is ${m.status === "MAINTENANCE" ? "under maintenance" : "inactive"}`,
          context: `Zone ${m.zoneNumber}`,
          meta: "Status",
          to: "/admin/markets",
        });
      }
    }

    if ((expired?.todayCount ?? 0) > 0) {
      items.push({
        id: "expired-today",
        severity: "info",
        title: `${expired.todayCount} expired/wasted item report${expired.todayCount === 1 ? "" : "s"} today`,
        context: "Filed across the organization",
        meta: "Today",
        to: "/admin/expired-items",
      });
    }

    const order = { critical: 0, warning: 1, info: 2 };
    return items.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [problems, markets, expired]);

  const supervisorCount = supervisors?.length ?? null;
  const attentionLoading = marketsLoading || problemsLoading || expiredLoading;

  return (
    <div className="mx-auto max-w-[1400px] animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-tight text-white">
            {greeting()}, {session?.displayName?.split(" ")[0] ?? "Admin"}
          </h1>
          <p className="mt-0.5 text-[13px] text-[#8B93A8]">Here's what's happening across TeamMart today.</p>
        </div>
        <p className="text-[12.5px] text-[#5C6479]">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {overviewError && (
        <div className="mt-4">
          <ErrorBanner message={overviewError} onRetry={reloadOverview} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <AdminKpiCard icon={Layers} tone="blue" value={overview?.zonesCount ?? "—"} label="Zones" loading={overviewLoading} onClick={() => navigate("/admin/zones")} />
        <AdminKpiCard icon={Store} tone="orange" value={overview?.marketsCount ?? "—"} label="Markets" loading={overviewLoading} onClick={() => navigate("/admin/markets")} />
        <AdminKpiCard
          icon={ShieldCheck}
          tone="purple"
          value={supervisorCount ?? "—"}
          label="Supervisors"
          hint="Assigned to a market"
          loading={supervisorsLoading}
          onClick={() => navigate("/admin/employees")}
        />
        <AdminKpiCard
          icon={Users2}
          tone="green"
          value={overview ? overview.totalEmployees.toLocaleString("en-US") : "—"}
          label="Employees"
          loading={overviewLoading}
          onClick={() => navigate("/admin/employees")}
        />
        <AdminKpiCard
          icon={PackageX}
          tone="amber"
          value={expired?.todayCount ?? "—"}
          label="Expired Items"
          hint="Reported today"
          loading={expiredLoading}
          onClick={() => navigate("/admin/expired-items")}
        />
        <AdminKpiCard
          icon={AlertTriangle}
          tone={(problems?.length ?? 0) > 0 ? "red" : "blue"}
          value={problems?.length ?? "—"}
          label="Open Issues"
          loading={problemsLoading}
          onClick={() => navigate("/admin/markets")}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AdminZonePerformance zones={zonePerformance} loading={zonesLoading || marketsLoading} onOpenZones={() => navigate("/admin/zones")} />
        <AdminAttendanceDonut summary={attendance?.summary} loading={attendanceLoading} onOpenAttendance={() => navigate("/admin/attendance")} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AdminRecentActivity activities={activities} loading={activitiesLoading} onViewAll={() => navigate("/admin/activities")} />
        <AdminAttentionRequired items={attentionItems} loading={attentionLoading} onOpen={(item) => navigate(item.to)} />
      </div>
    </div>
  );
}
