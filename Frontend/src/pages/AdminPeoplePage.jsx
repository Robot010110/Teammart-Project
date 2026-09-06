import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Users, UserRound, ShieldCheck, Crown, HardHat, Wallet, Beef,
  Store, Layers, Sunrise, Sunset, Moon, MoreVertical, UserPlus,
  ChevronLeft, ChevronRight, Check, Loader2, KeyRound,
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import AdminKpiCard from "../components/admin/AdminKpiCard";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import Modal from "../components/common/Modal";
import AdminStaffActionsPanel from "./AdminStaffActionsPanel";
import { listEmployees, createEmployee } from "../services/staffEmployeeService";
import { listStaffAccounts, registerStaff } from "../services/authService";
import { listMarkets } from "../services/marketService";
import { ApiError } from "../services/apiClient";
import { initialsOf } from "../utils/initials";

const PAGE_SIZE = 10;

// Real role colors (spec's own hierarchy) — literal class strings so
// Tailwind's JIT can find them, same pattern as NotificationSettings.jsx
// and AdminAttendancePage.jsx's ROLE_META.
// Each tone now carries its own glow shadow, not just a tint — a badge
// should read as having a color identity at a glance, not just a
// slightly-different gray pill (visual pass; the roles/colors themselves
// are unchanged).
const ROLE_META = {
  WORKER: { label: "Worker", icon: HardHat, tone: "text-[#7EA6FF] bg-[#7EA6FF]/12 ring-[#7EA6FF]/30 shadow-[0_0_10px_-3px_rgba(126,166,255,0.65)]" },
  CASHIER: { label: "Cashier", icon: Wallet, tone: "text-[#C08BFF] bg-[#C08BFF]/12 ring-[#C08BFF]/30 shadow-[0_0_10px_-3px_rgba(192,139,255,0.65)]" },
  BUTCHER: { label: "Butcher", icon: Beef, tone: "text-amber-400 bg-amber-500/12 ring-amber-500/30 shadow-[0_0_10px_-3px_rgba(251,191,36,0.65)]" },
  SUPERVISOR: { label: "Supervisor", icon: ShieldCheck, tone: "text-[#A5B4FC] bg-[#818CF8]/15 ring-[#818CF8]/35 shadow-[0_0_10px_-3px_rgba(129,140,248,0.7)]" },
  OVERLOOKING_SUPERVISOR: { label: "Overlooking Sup.", icon: ShieldCheck, tone: "text-[#A5B4FC] bg-[#818CF8]/15 ring-[#818CF8]/35 shadow-[0_0_10px_-3px_rgba(129,140,248,0.7)]" },
  REGIONAL_MANAGER: { label: "Regional Manager", icon: Crown, tone: "text-[#FBBF24] bg-[#FBBF24]/15 ring-[#FBBF24]/35 shadow-[0_0_10px_-3px_rgba(251,191,36,0.7)]" },
};

const EMPLOYMENT_STATUS_META = {
  ACTIVE: { label: "Active", tone: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/30 shadow-[0_0_10px_-3px_rgba(52,211,153,0.6)]" },
  ON_LEAVE: { label: "On Leave", tone: "bg-amber-500/12 text-amber-400 ring-amber-500/30 shadow-[0_0_10px_-3px_rgba(251,191,36,0.6)]" },
  INACTIVE: { label: "Inactive", tone: "bg-red-500/12 text-red-400 ring-red-500/30 shadow-[0_0_10px_-3px_rgba(248,113,113,0.6)]" },
};
// Users don't share Employee's employmentStatus enum — accountStatus is
// a different, real enum (ACTIVE/SUSPENDED/BANNED). Shown with the same
// visual language rather than invented as a fake "On Leave" for staff.
const ACCOUNT_STATUS_META = {
  ACTIVE: { label: "Active", tone: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/30 shadow-[0_0_10px_-3px_rgba(52,211,153,0.6)]" },
  SUSPENDED: { label: "Suspended", tone: "bg-amber-500/12 text-amber-400 ring-amber-500/30 shadow-[0_0_10px_-3px_rgba(251,191,36,0.6)]" },
  BANNED: { label: "Banned", tone: "bg-red-500/12 text-red-400 ring-red-500/30 shadow-[0_0_10px_-3px_rgba(248,113,113,0.6)]" },
};

const SHIFT_META = {
  MORNING: { label: "Morning", icon: Sunrise },
  EVENING: { label: "Evening", icon: Sunset },
  NIGHT: { label: "Night", icon: Moon },
};

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// Normalizes an Employee row and a staff User row into one shape the
// table renders identically — the two real, distinct backend models this
// app has always used (never merged into a new "Person" table; see this
// file's own header comment on why).
function shapeEmployee(e, marketById) {
  const shift = e.cashierShift ?? e.shift ?? null; // same precedence AdminEmployeesPage already used
  return {
    key: `emp-${e.id}`,
    kind: "employee",
    id: e.id,
    name: e.name,
    code: e.employeeCode,
    photoUrl: e.profilePictureUrl,
    role: e.role,
    marketId: e.marketId,
    marketLabel: marketById.get(e.marketId)?.name ?? "—",
    shift,
    statusKind: "employment",
    status: e.employmentStatus,
    href: `/admin/employees/${e.id}`,
    raw: e,
  };
}

function shapeStaff(u) {
  const market = u.managedMarket ?? u.managedOverlookingMarket ?? null;
  const isOverlooking = !!u.managedOverlookingMarket;
  const zones = u.managedZones ?? [];
  return {
    key: `staff-${u.id}`,
    kind: "staff",
    id: u.id,
    name: u.name,
    code: u.loginId,
    photoUrl: null, // GET /api/auth/staff doesn't select a photo field
    role: u.role === "SUPERVISOR" && isOverlooking ? "OVERLOOKING_SUPERVISOR" : u.role,
    marketId: market?.id ?? null, // Regional Managers have no single market — deliberately never matched by the Market filter
    marketLabel: market ? market.name : zones.length ? `Zone ${zones.map((z) => z.number).join(", ")}` : "—",
    shift: null, // staff accounts have no shift concept — shown as "—", never fabricated
    statusKind: "account",
    status: u.accountStatus,
    href: market ? `/admin/markets/${market.id}/supervisors/${u.id}` : null, // no Admin-side profile exists for a Regional Manager yet
    raw: u,
  };
}

function ShiftCell({ shift }) {
  if (!shift) return <span className="text-[#5C6479]">—</span>;
  const meta = SHIFT_META[shift];
  if (!meta) return <span className="text-[#C4C9D6]">{shift}</span>; // legacy free-text value — shown as-is, not fabricated into an icon it doesn't have
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-[#C4C9D6]">
      <Icon size={13} className="text-[#8B93A8]" /> {meta.label}
    </span>
  );
}

// AdminPeoplePage.jsx — Admin → People, replacing AdminEmployeesPage.jsx
// and AdminStaffPage.jsx (both now deleted; their real functionality —
// listing, search/filters, staff creation, the staff actions panel — is
// carried forward here, not duplicated).
//
// TeamMart has always represented "people" as two distinct, real backend
// models: an Employee row (Worker/Cashier/Butcher, its own login) and a
// staff User row (Supervisor/Overlooking Supervisor/Regional Manager/
// Admin, a different login and permission system entirely). This page
// presents both as ONE workspace — matching the reference — without
// inventing a merged "Person" table: every row here is tagged back to
// its real Employee or User id and every action routes to the real
// model-specific endpoint.
//
// Two known-real data sources, no backend changes:
//   - GET /api/employees (unscoped for ADMIN) — Workforce.
//   - GET /api/auth/staff (ADMIN-only) — Staff Accounts. Already returns
//     managedMarket/managedOverlookingMarket/managedZones per row, which
//     is also how a genuinely-unassigned/orphaned staff row (leftover
//     test data, see AdminZonesPage's own history) is excluded here:
//     only accounts pointed at by a real market or zone are shown or
//     counted, the same principle listAccessibleSupervisors() already
//     uses server-side for the exact same reason.
//
// KPIs are always organization-wide (not affected by the active tab),
// matching the reference; Total is Employees + Supervisors + Regional
// Managers, deliberately excluding Admin accounts — the same arithmetic
// the reference image itself uses (56 + 12 + 13 = 81).
//
// No new global "search anything" control was added in the page header:
// that would be a materially separate feature (cross-entity results,
// its own navigation), and the one real candidate for it
// (adminController.globalSearch) currently has no live UI consumer
// anywhere in the app to model this on. The real, required search this
// page needs — searching the People table itself — is built and wired.
export default function AdminPeoplePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("workforce"); // "workforce" | "staff"
  const [marketId, setMarketId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [manageStaff, setManageStaff] = useState(null);

  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const { data: employees, error: empError, loading: empLoading, reload: reloadEmployees } = useAsync(listEmployees, { deps: [] });
  const { data: staffAccounts, error: staffError, loading: staffLoading, reload: reloadStaff } = useAsync(() => listStaffAccounts(), { deps: [] });

  const loading = empLoading || staffLoading;
  const error = empError || staffError;
  const marketById = useMemo(() => new Map((markets ?? []).map((m) => [m.id, m])), [markets]);

  const workforceRows = useMemo(() => (employees ?? []).map((e) => shapeEmployee(e, marketById)), [employees, marketById]);
  // Real assignment required — see this file's header comment.
  const staffRows = useMemo(
    () =>
      (staffAccounts ?? [])
        .filter((u) => u.role !== "ADMIN" && (u.managedMarket || u.managedOverlookingMarket || (u.managedZones ?? []).length > 0))
        .map(shapeStaff),
    [staffAccounts]
  );

  const kpi = useMemo(() => {
    const supervisors = staffRows.filter((r) => r.role === "SUPERVISOR" || r.role === "OVERLOOKING_SUPERVISOR").length;
    const regionalManagers = staffRows.filter((r) => r.role === "REGIONAL_MANAGER").length;
    const employeesCount = workforceRows.length;
    return { total: employeesCount + supervisors + regionalManagers, employeesCount, supervisors, regionalManagers };
  }, [workforceRows, staffRows]);

  useEffect(() => {
    setPage(1);
    setRole("");
    setStatus("");
  }, [tab]);
  useEffect(() => {
    setPage(1);
  }, [marketId, role, status, search]);

  const activeRows = tab === "workforce" ? workforceRows : staffRows;
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeRows.filter((r) => {
      if (marketId && r.marketId !== marketId) return false;
      if (role && r.role !== role && !(role === "SUPERVISOR" && r.role === "OVERLOOKING_SUPERVISOR")) return false;
      if (status && r.status !== status) return false;
      if (q) {
        const idField = tab === "workforce" ? r.code : r.raw.email;
        if (!r.name.toLowerCase().includes(q) && !(idField ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activeRows, marketId, role, status, search, tab]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const roleOptions =
    tab === "workforce"
      ? [{ value: "WORKER", label: "Workers" }, { value: "CASHIER", label: "Cashiers" }] // Butcher deliberately not offered as a filter — see spec
      : [{ value: "SUPERVISOR", label: "Supervisors" }, { value: "REGIONAL_MANAGER", label: "Regional Managers" }];
  const statusOptions =
    tab === "workforce"
      ? [{ value: "ACTIVE", label: "Active" }, { value: "ON_LEAVE", label: "On Leave" }, { value: "INACTIVE", label: "Inactive" }]
      : [{ value: "ACTIVE", label: "Active" }, { value: "SUSPENDED", label: "Suspended" }, { value: "BANNED", label: "Banned" }];

  function openPerson(row) {
    if (row.href) navigate(row.href);
    else if (row.kind === "staff") setManageStaff(row.raw); // Regional Manager: no profile route exists yet — the real admin panel is the closest genuine destination
  }

  function reload() {
    reloadEmployees();
    reloadStaff();
  }

  const selectClass =
    "rounded-xl bg-gradient-to-b from-[#131C31]/90 to-[#0F1728]/90 border border-white/[0.09] px-3 py-2.5 text-sm text-white outline-none transition-all duration-150 focus:border-[#F47A20]/55 focus:shadow-[0_0_0_3px_rgba(244,122,32,0.15)]";

  return (
    <div className="max-w-7xl mx-auto animate-fade-up" onClick={() => setOpenMenuKey(null)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h1 className="font-display text-xl md:text-[26px] font-bold text-white">People</h1>
          <p className="mt-1 text-sm text-[#9AA1B4]">Manage all employees and staff across your company</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 self-start rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#F47A20] to-[#E0561A] shadow-[0_4px_24px_-6px_rgba(244,122,32,0.75)] ring-1 ring-white/10 transition-all duration-150 hover:from-[#ff8b36] hover:to-[#F47A20] hover:shadow-[0_4px_28px_-4px_rgba(244,122,32,0.9)] active:scale-[0.97]"
        >
          <UserPlus size={15} /> Add Person
        </button>
      </div>

      {/* KPIs — always organization-wide, unaffected by the active tab */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <AdminKpiCard icon={Users} tone="blue" value={loading ? undefined : kpi.total} label="Total People" loading={loading} />
        <AdminKpiCard icon={UserRound} tone="green" value={loading ? undefined : kpi.employeesCount} label="Employees" loading={loading} onClick={() => setTab("workforce")} />
        <AdminKpiCard icon={ShieldCheck} tone="purple" value={loading ? undefined : kpi.supervisors} label="Supervisors" loading={loading} onClick={() => setTab("staff")} />
        <AdminKpiCard icon={Crown} tone="amber" value={loading ? undefined : kpi.regionalManagers} label="Regional Managers" loading={loading} onClick={() => setTab("staff")} />
      </div>

      {/* Workforce / Staff Accounts — a real filter switching the data
          source, not a decorative tab. */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "workforce", label: "Workforce", icon: UserRound },
          { key: "staff", label: "Staff Accounts", icon: ShieldCheck },
        ].map((v) => {
          const Icon = v.icon;
          const activeTab = tab === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setTab(v.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                activeTab
                  ? "bg-gradient-to-b from-[#F47A20]/25 to-[#F47A20]/[0.08] text-[#FFA35C] ring-1 ring-[#F47A20]/50 shadow-[0_0_22px_-6px_rgba(244,122,32,0.8)]"
                  : "bg-[#111A2D]/80 text-[#8B93A8] ring-1 ring-white/[0.06] hover:text-white hover:bg-white/[0.05] hover:ring-white/[0.12]"
              }`}
            >
              <Icon size={15} /> {v.label}
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col lg:flex-row flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5266]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={tab === "workforce" ? "Search by name, ID, or email..." : "Search by name, ID, or email..."}
            className="w-full rounded-xl bg-gradient-to-b from-[#131C31]/90 to-[#0F1728]/90 border border-white/[0.09] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#5C6479] outline-none transition-all duration-150 focus:border-[#F47A20]/55 focus:shadow-[0_0_0_3px_rgba(244,122,32,0.15)]"
          />
        </div>
        <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
          <option value="">All Markets</option>
          {(markets ?? []).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
          <option value="">All Roles</option>
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-[60px]" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[#111A2D]/80 border border-white/[0.07] text-center">
          <p className="text-sm font-medium text-white">
            {marketId || role || status || search
              ? "No people match your filters."
              : tab === "workforce"
                ? "No employees found."
                : "No staff accounts found."}
          </p>
          {(marketId || role || status || search) && <p className="mt-1 text-xs text-[#8B93A8]">Try clearing the search and filters above.</p>}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#101A2E]/90 to-[#0A0F1D]/90 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wide text-[#6B7284]">
                  <th className="px-4 py-3 font-medium">Person</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Market</th>
                  <th className="px-4 py-3 font-medium">Shift</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  const roleMeta = ROLE_META[r.role];
                  const RoleIcon = roleMeta?.icon ?? UserRound;
                  const statusMeta = (r.statusKind === "employment" ? EMPLOYMENT_STATUS_META : ACCOUNT_STATUS_META)[r.status];
                  const canViewProfile = !!r.href;
                  const canManageAccount = r.kind === "staff";

                  return (
                    <tr
                      key={r.key}
                      style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                      // A faint alternating tint plus a stronger hover —
                      // real row-to-row separation instead of every row
                      // sitting on identical flat background.
                      className={`animate-fade-up group relative border-b border-white/[0.05] last:border-0 transition-colors duration-150 cursor-pointer hover:bg-white/[0.035] ${
                        i % 2 === 1 ? "bg-white/[0.014]" : ""
                      }`}
                      onClick={() => openPerson(r)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[11px] font-bold text-white ring-1 ring-white/10">
                            {r.photoUrl ? <AuthenticatedImage src={r.photoUrl} alt="" className="h-full w-full object-cover" /> : initialsOf(r.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-medium text-white truncate group-hover:text-[#F47A20] transition-colors">{r.name}</p>
                            <p className="text-[11px] text-[#6B7284]">{r.code ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${roleMeta?.tone ?? "text-[#9AA1B4] bg-white/[0.06] ring-white/10"}`}>
                          <RoleIcon size={12} /> {roleMeta?.label ?? r.role?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#C4C9D6]">
                        <span className="inline-flex items-center gap-1.5">
                          {r.marketLabel !== "—" && (r.kind === "employee" || r.raw.managedMarket || r.raw.managedOverlookingMarket) ? (
                            <Store size={12} className="text-[#5C6479]" />
                          ) : r.marketLabel !== "—" ? (
                            <Layers size={12} className="text-[#5C6479]" />
                          ) : null}
                          {r.marketLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px]"><ShiftCell shift={r.shift} /></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusMeta?.tone ?? "bg-white/[0.06] text-[#9AA1B4] ring-white/10"}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" /> {statusMeta?.label ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right relative">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenMenuKey(openMenuKey === r.key ? null : r.key); }}
                          aria-label="Row actions"
                          className="grid h-8 w-8 place-items-center rounded-lg text-[#6B7284] transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuKey === r.key && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-4 top-11 z-20 w-48 rounded-xl border border-white/[0.08] bg-[#151B2E] p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]"
                          >
                            {canViewProfile && (
                              <button
                                type="button"
                                onClick={() => { setOpenMenuKey(null); navigate(r.href); }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] text-[#C4C9D6] transition-colors hover:bg-white/[0.06] hover:text-white"
                              >
                                <UserRound size={13} /> View Profile
                              </button>
                            )}
                            {canManageAccount && (
                              <button
                                type="button"
                                onClick={() => { setOpenMenuKey(null); setManageStaff(r.raw); }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] text-[#C4C9D6] transition-colors hover:bg-white/[0.06] hover:text-white"
                              >
                                <KeyRound size={13} /> Manage Account
                              </button>
                            )}
                            {!canViewProfile && !canManageAccount && <p className="px-3 py-2 text-[11.5px] text-[#5C6479]">No actions available</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination — client-side over the real fetched/filtered rows,
              matching AdminAttendancePage.jsx's own convention. */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
            <p className="text-[12.5px] text-[#8B93A8]">
              Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} people
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-[#8B93A8] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "…" ? (
                    <span key={`gap-${idx}`} className="px-1.5 text-[12px] text-[#5C6479]">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`grid h-8 w-8 place-items-center rounded-lg text-[12.5px] font-medium transition-colors ${
                        p === currentPage ? "bg-[#F47A20]/15 text-[#F47A20] ring-1 ring-[#F47A20]/40" : "text-[#8B93A8] hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-[#8B93A8] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <AddPersonModal
          markets={markets ?? []}
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); reload(); }}
        />
      )}

      {manageStaff && (
        <AdminStaffActionsPanel
          staff={manageStaff}
          onClose={() => setManageStaff(null)}
          onChanged={() => { reload(); setManageStaff(null); }}
        />
      )}
    </div>
  );
}

const fieldClass =
  "w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50";

const STAFF_ROLES = [
  { value: "REGIONAL_MANAGER", label: "Regional Manager" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "OVERLOOKING_SUPERVISOR", label: "Overlooking Supervisor" },
  { value: "ADMIN", label: "Admin" },
];

// AddPersonModal — the real create-person workflow, in two real forms:
//   - "New Employee" -> POST /api/employees (createEmployee). ADMIN/RM/
//     Supervisor-authorized and already existed server-side with no
//     frontend ever built for it; this is that first UI. It always
//     creates a WORKER (the endpoint has no role field — Cashier/Butcher
//     need a username/cashierShift this endpoint doesn't set), so the
//     form is honest about that rather than offering a role picker that
//     would silently do nothing.
//   - "New Staff Account" -> POST /api/auth/register (registerStaff) —
//     the exact same fields/logic AdminStaffPage.jsx's form used.
// Both return a one-time credential (temporary password / the password
// just set) that is shown once and never retrievable again — matching
// this app's "no plaintext password persistence" rule.
function AddPersonModal({ markets, onClose, onCreated }) {
  const [kind, setKind] = useState("employee"); // "employee" | "staff"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { name, credentialLabel, credentialValue }

  const [empForm, setEmpForm] = useState({ name: "", position: "", marketId: "", shift: "" });
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "", role: "SUPERVISOR", loginId: "" });

  async function handleCreateEmployee(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await createEmployee({
        name: empForm.name.trim(),
        position: empForm.position.trim(),
        marketId: empForm.marketId,
        shift: empForm.shift.trim() || undefined,
      });
      setResult({ name: created.name, credentialLabel: "Employee ID", credentialValue: created.employeeCode, extra: `Temporary password: ${created.temporaryPassword}` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this employee.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateStaff(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await registerStaff({
        name: staffForm.name.trim(),
        email: staffForm.email.trim(),
        password: staffForm.password,
        role: staffForm.role,
        loginId: staffForm.loginId.trim() || undefined,
      });
      setResult({ name: staffForm.name.trim(), credentialLabel: "Sign in with", credentialValue: staffForm.email.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this account.");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <Modal open onClose={onCreated} title="Person Added">
        <div className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/25">
            <Check size={22} />
          </div>
          <p className="text-sm text-white">
            <span className="font-semibold">{result.name}</span> was created.
          </p>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-left">
            <p className="text-[11px] uppercase tracking-wide text-[#8B93A8]">{result.credentialLabel}</p>
            <p className="mt-0.5 font-mono text-[14px] text-white">{result.credentialValue}</p>
            {result.extra && <p className="mt-1.5 text-[11.5px] text-amber-400">{result.extra} — write this down, it cannot be shown again.</p>}
          </div>
          <button type="button" onClick={onCreated} className="w-full rounded-xl bg-[#F47A20] py-3 text-sm font-semibold text-white hover:bg-[#ff8b36] transition-colors">
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Add Person">
      <div className="mb-4 flex gap-2">
        {[{ key: "employee", label: "New Employee" }, { key: "staff", label: "New Staff Account" }].map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k.key)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
              kind === k.key ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] hover:bg-white/[0.09]"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === "employee" ? (
        <form onSubmit={handleCreateEmployee} className="space-y-3">
          <input value={empForm.name} onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" required className={fieldClass} />
          <input value={empForm.position} onChange={(e) => setEmpForm((f) => ({ ...f, position: e.target.value }))} placeholder="Position (e.g. Shelf Stocker)" required className={fieldClass} />
          <select value={empForm.marketId} onChange={(e) => setEmpForm((f) => ({ ...f, marketId: e.target.value }))} required className={fieldClass}>
            <option value="" disabled>Select a market</option>
            {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input value={empForm.shift} onChange={(e) => setEmpForm((f) => ({ ...f, shift: e.target.value }))} placeholder="Shift (optional, e.g. Morning)" className={fieldClass} />
          <p className="text-[11px] text-[#6B7284]">
            Creates a Worker with a generated Employee ID and a one-time temporary password shown after creation.
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create Employee
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreateStaff} className="space-y-3">
          <input value={staffForm.name} onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" required className={fieldClass} />
          <input type="email" value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" autoCapitalize="none" required className={fieldClass} />
          <input type="password" value={staffForm.password} onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))} placeholder="Password (min 8 characters)" autoComplete="new-password" required minLength={8} className={fieldClass} />
          <select value={staffForm.role} onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))} className={fieldClass}>
            {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {(staffForm.role === "SUPERVISOR" || staffForm.role === "OVERLOOKING_SUPERVISOR") && (
            <input value={staffForm.loginId} onChange={(e) => setStaffForm((f) => ({ ...f, loginId: e.target.value }))} placeholder="User ID (optional — can be set later)" autoCapitalize="none" className={fieldClass} />
          )}
          <p className="text-[11px] text-[#6B7284]">
            Market/zone assignment happens separately, from Zones & Markets or this account's own Manage Account panel.
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create Account
          </button>
        </form>
      )}
    </Modal>
  );
}
