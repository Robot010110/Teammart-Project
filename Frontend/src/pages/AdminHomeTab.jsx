import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Store, Users2, ShieldCheck, Search, Loader2, ClipboardList, Building2, Megaphone } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ActivityStatusPill from "../components/common/ActivityStatusPill";
import { getCompanyOverview, globalSearch, listCompanyAttendance, listCompanyActivities } from "../services/adminService";
import NotificationsPreviewSection from "../components/common/NotificationsPreviewSection";

const CATEGORY_LABEL = {
  EXPIRED_ITEMS: "Expired Items", SHELF_CLEANING: "Shelf Cleaning", PRODUCT_CUSTOMIZATION: "Product Customization",
  DAILY_CLEANING: "Daily Cleaning", ITEM_COUNTING: "Item Counting", LABEL_CHECKING: "Label Issue",
  FACING: "Facing", REFILLING: "Refilling", DEPARTMENT_CLOSING: "Department Closing",
};

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// AdminHomeTab.jsx — Admin Phase 1 §7-8/§14: a real company-wide
// dashboard. Every number is a live query (getCompanyOverview,
// listCompanyAttendance, listCompanyActivities — see
// adminController.js/attendanceController.js/activitiesController.js's
// own comments), never a placeholder. Every tile is a real route
// (spec §8: "dashboard numbers should be actionable... not fragile
// state-only navigation").
export default function AdminHomeTab({ session }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 300);

  const { data: overview, error: overviewError, loading: overviewLoading, reload: reloadOverview } = useAsync(getCompanyOverview, { deps: [] });
  const { data: attendance, error: attendanceError, loading: attendanceLoading, reload: reloadAttendance } = useAsync(listCompanyAttendance, { deps: [] });
  const { data: recentActivities, loading: activitiesLoading } = useAsync(() => listCompanyActivities({ take: 6 }), { deps: [] });
  const { data: searchResults, loading: searchLoading } = useAsync(
    () => (debouncedQuery.trim().length >= 2 ? globalSearch(debouncedQuery.trim()) : Promise.resolve(null)),
    { deps: [debouncedQuery] }
  );

  const loading = overviewLoading || attendanceLoading;
  const error = overviewError || attendanceError;
  const hasSearch = debouncedQuery.trim().length >= 2;
  const totalStaff = overview
    ? overview.staffByRole.REGIONAL_MANAGER + overview.staffByRole.SUPERVISOR + overview.staffByRole.OVERLOOKING_SUPERVISOR + overview.staffByRole.ADMIN
    : 0;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto animate-fade-up">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-[#F47A20]/10 flex items-center justify-center shrink-0">
          <ShieldCheck size={20} className="text-[#F47A20]" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold text-white">{session.displayName}</h1>
          <p className="text-xs text-[#8B93A8] uppercase tracking-wide">Administrator</p>
        </div>
      </div>

      <div className="relative mt-5">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employees, markets, zones..."
          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] pl-11 pr-4 py-3 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
        />
        {searchLoading && <Loader2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4C5266] animate-spin" />}
      </div>

      {hasSearch ? (
        <div className="mt-4 space-y-4">
          {!searchLoading && searchResults && (
            <>
              {searchResults.employees.length === 0 && searchResults.markets.length === 0 && searchResults.zones.length === 0 ? (
                <p className="text-sm text-[#6B7284] text-center py-8">No authorized contacts found.</p>
              ) : (
                <>
                  {searchResults.employees.length > 0 && (
                    <SearchGroup title="Employees">
                      {searchResults.employees.map((e) => (
                        <SearchRow key={e.id} label={e.name} sub={`${e.employeeCode ?? e.role} · ${e.market?.name ?? "—"}`} onClick={() => navigate(`/admin/employees/${e.id}`)} />
                      ))}
                    </SearchGroup>
                  )}
                  {searchResults.markets.length > 0 && (
                    <SearchGroup title="Markets">
                      {searchResults.markets.map((m) => (
                        <SearchRow key={m.id} label={m.name} sub="Market" onClick={() => navigate("/admin/markets")} />
                      ))}
                    </SearchGroup>
                  )}
                  {searchResults.zones.length > 0 && (
                    <SearchGroup title="Zones">
                      {searchResults.zones.map((z) => (
                        <SearchRow key={z.id} label={`Zone ${z.number}`} sub="Zone" onClick={() => navigate("/admin/zones")} />
                      ))}
                    </SearchGroup>
                  )}
                </>
              )}
            </>
          )}
        </div>
      ) : loading ? (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[90px]" />)}
          </div>
        </div>
      ) : error ? (
        <div className="mt-6"><ErrorBanner message={error} onRetry={() => { reloadOverview(); reloadAttendance(); }} /></div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Company</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile icon={Layers} label="Zones" value={overview.zonesCount} onClick={() => navigate("/admin/zones")} />
              <StatTile icon={Store} label="Markets" value={overview.marketsCount} onClick={() => navigate("/admin/markets")} />
              <StatTile icon={Users2} label="Employees" value={overview.totalEmployees} onClick={() => navigate("/admin/employees")} />
              <StatTile icon={ShieldCheck} label="Staff Accounts" value={totalStaff} onClick={() => navigate("/admin/employees")} />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Attendance Today</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <StatTile label="Total" value={attendance.summary.total} onClick={() => navigate("/admin/attendance")} />
              <StatTile label="Working" value={attendance.summary.working} tone="emerald" onClick={() => navigate("/admin/attendance?state=WORKING")} />
              <StatTile label="On Break" value={attendance.summary.onBreak} tone="sky" onClick={() => navigate("/admin/attendance?state=ON_BREAK")} />
              <StatTile label="Checked Out" value={attendance.summary.checkedOut} onClick={() => navigate("/admin/attendance?state=CHECKED_OUT")} />
              <StatTile label="Missing" value={attendance.summary.missing} tone="red" onClick={() => navigate("/admin/attendance?state=MISSING")} />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Administration</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatTile icon={ShieldCheck} label="Audit Log" value="View" onClick={() => navigate("/admin/audit")} />
              <StatTile icon={ClipboardList} label="Reports" value="View" onClick={() => navigate("/admin/reports")} />
              <StatTile icon={Megaphone} label="Warnings & Notifications" value="View" onClick={() => navigate("/admin/communications")} />
            </div>
          </section>

          <section className="mt-6">
            <NotificationsPreviewSection basePath="/admin" />
          </section>

          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Recent Activity</h2>
              <button type="button" onClick={() => navigate("/admin/activities")} className="text-xs font-semibold text-[#F47A20] hover:text-[#ff8b36]">
                View All
              </button>
            </div>
            {activitiesLoading ? (
              <SkeletonCard className="h-40" />
            ) : recentActivities?.length ? (
              <div className="space-y-2">
                {recentActivities.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl p-3 bg-[#171C2E]/80 border border-white/[0.06]">
                    <div className="min-w-0 flex items-center gap-2">
                      <Building2 size={13} className="text-[#4C5266] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{CATEGORY_LABEL[a.category] ?? a.category}</p>
                        <p className="text-[11px] text-[#6B7284] truncate">{a.employee?.name ?? a.submittedByStaff?.name ?? "—"} · {a.market?.name ?? a.employee?.market?.name ?? "—"}</p>
                      </div>
                    </div>
                    <ActivityStatusPill status={a.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7284] text-center py-6">No recent activity.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone, onClick }) {
  const toneClass = tone === "emerald" ? "text-emerald-400" : tone === "sky" ? "text-sky-400" : tone === "red" ? "text-red-400" : "text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors backdrop-blur-xl"
    >
      {Icon && (
        <div className="h-8 w-8 rounded-lg bg-[#F47A20]/10 grid place-items-center mb-2">
          <Icon size={14} className="text-[#F47A20]" />
        </div>
      )}
      <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-[11px] text-[#9AA1B4] mt-0.5">{label}</p>
    </button>
  );
}

function SearchGroup({ title, children }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7284]">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SearchRow({ label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 rounded-xl p-3 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{label}</p>
        <p className="text-[11px] text-[#8B93A8] truncate">{sub}</p>
      </div>
    </button>
  );
}
