import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search, Users, CheckCircle2, Coffee, LogOut, AlertTriangle,
  ChevronLeft, ChevronRight, CalendarDays, Download, MoreVertical,
  HardHat, Wallet, Beef, ShieldCheck, Gauge, UserRound,
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import AttendanceStatusPill from "../components/common/AttendanceStatusPill";
import AdminKpiCard from "../components/admin/AdminKpiCard";
import { listCompanyAttendance } from "../services/adminService";
import { listMarkets } from "../services/marketService";
import { initialsOf } from "../utils/initials";

const PAGE_SIZE = 10;

// deriveAttendanceState's four real states (attendanceController.js) —
// icon + color exactly following the brief's hierarchy: green/working,
// gold/on-break, muted blue-gray/checked-out, red/missing.
const STATE_META = {
  WORKING: { label: "Working", icon: CheckCircle2, chip: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20", dot: "bg-emerald-400" },
  ON_BREAK: { label: "On Break", icon: Coffee, chip: "bg-amber-500/10 text-amber-400 ring-amber-500/20", dot: "bg-amber-400" },
  CHECKED_OUT: { label: "Checked Out", icon: LogOut, chip: "bg-white/[0.06] text-[#9AA1B4] ring-white/10", dot: "bg-[#8B93A8]" },
  MISSING: { label: "Missing", icon: AlertTriangle, chip: "bg-red-500/10 text-red-400 ring-red-500/20", dot: "bg-red-400" },
};

// Real EmployeeRole/StaffRole values only (schema.prisma) — BUTCHER is a
// genuine role even though no demo employee currently holds it, so it
// keeps its own icon rather than being dropped. Same icon language the
// login flow already established (HardHat/Wallet — EmployeeTypeStep.jsx)
// so a role reads the same way everywhere in the app.
const ROLE_META = {
  WORKER: { label: "Worker", icon: HardHat, tone: "text-[#7EA6FF] bg-[#7EA6FF]/10" },
  CASHIER: { label: "Cashier", icon: Wallet, tone: "text-[#C08BFF] bg-[#C08BFF]/10" },
  BUTCHER: { label: "Butcher", icon: Beef, tone: "text-amber-400 bg-amber-500/10" },
  SUPERVISOR: { label: "Supervisor", icon: ShieldCheck, tone: "text-[#F9A03C] bg-[#F47A20]/10" },
  OVERLOOKING_SUPERVISOR: { label: "Overlooking Sup.", icon: ShieldCheck, tone: "text-[#F9A03C] bg-[#F47A20]/10" },
};

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function isSameDay(a, b) {
  return isoDate(a) === isoDate(b);
}
function timeLabel(iso) {
  return iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
}

// A CSV of exactly the rows currently on screen (every filter/search/date
// already applied) — built client-side from the same real rows already
// rendered, not a second fetch or a different shape of the data.
function downloadCsv(rows, dateIso) {
  const header = ["Name", "Employee Code", "Market", "Role", "Check In", "Check Out", "Status"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.map(escape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.employeeCode ?? "",
        r.marketName ?? "",
        (ROLE_META[r.role]?.label ?? r.role ?? "").toString(),
        r.checkIn ? new Date(r.checkIn).toISOString() : "",
        r.checkOut ? new Date(r.checkOut).toISOString() : "",
        STATE_META[r.state]?.label ?? r.state,
      ]
        .map(escape)
        .join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${dateIso}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// AdminAttendancePage.jsx — Admin Phase 1 §16's company-wide attendance
// snapshot, redesigned to a dense desktop SaaS table. Still entirely the
// same listCompanyAttendance endpoint and the same real
// AttendanceRecord-derived state every other attendance screen reads —
// this pass changes presentation, not the data or its authorization.
//
// Additions beyond the original page, all built from data the endpoint
// already returns rather than new backend surface:
//   - Date navigation: the endpoint already accepts `date`; the original
//     page just never exposed it.
//   - "vs previous day" hints on the KPI cards: a second real fetch for
//     the day before, diffed client-side (a genuine comparison of two
//     real snapshots, not a fabricated number).
//   - An "Attendance Rate" figure: (total − missing) / total from this
//     same response — one honest derived percentage, not a second metric
//     system.
//   - Pagination and CSV export: both operate on the exact rows already
//     fetched and filtered here; nothing is paginated or exported
//     server-side because the endpoint doesn't support that, so neither
//     claims to be a server capability.
export default function AdminAttendancePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(() => new Date());
  const [marketId, setMarketId] = useState("");
  const [role, setRole] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("state") ?? "");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [openMenuKey, setOpenMenuKey] = useState(null);

  const dateIso = isoDate(date);
  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const { data, error, loading, reload } = useAsync(
    () => listCompanyAttendance({ date: dateIso, marketId: marketId || undefined, role: role || undefined, search: searchInput || undefined }),
    { deps: [dateIso, marketId, role, searchInput] }
  );
  // A second, real fetch for the previous day — the only way to show a
  // genuine "vs yesterday" comparison rather than inventing one.
  const { data: prevData } = useAsync(
    () => listCompanyAttendance({ date: isoDate(addDays(date, -1)), marketId: marketId || undefined, role: role || undefined }),
    { deps: [dateIso, marketId, role] }
  );

  useEffect(() => {
    setPage(1);
  }, [dateIso, marketId, role, statusFilter, searchInput]);

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => !statusFilter || r.state === statusFilter), [data, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const attendanceRate = data?.summary && data.summary.total > 0
    ? Math.round(((data.summary.total - data.summary.missing) / data.summary.total) * 100)
    : null;

  function trendHint(key) {
    if (!data?.summary || !prevData?.summary) return undefined;
    const diff = data.summary[key] - prevData.summary[key];
    if (diff === 0) return "No change vs previous day";
    return `${diff > 0 ? "+" : ""}${diff} vs previous day`;
  }

  function profileHref(row) {
    if (row.kind === "employee") return `/admin/employees/${row.id}`;
    if (row.kind === "staff" && row.marketId) return `/admin/markets/${row.marketId}/supervisors/${row.id}`;
    return null; // an unassigned supervisor has no market to anchor the route to — no fake link
  }

  const isToday = isSameDay(date, new Date());
  const selectClass =
    "rounded-xl bg-[#111A2D]/80 border border-white/[0.08] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#F47A20]/50";

  return (
    <div className="max-w-7xl mx-auto animate-fade-up" onClick={() => setOpenMenuKey(null)}>
      {/* Header: title + real selected date + a derived attendance-rate figure */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h1 className="font-display text-xl md:text-[26px] font-bold text-white">Attendance</h1>
          <p className="mt-1 text-sm text-[#9AA1B4]">Track and manage attendance across all markets and employees.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#111A2D]/80 px-2 py-2">
            <button
              type="button"
              onClick={() => setDate((d) => addDays(d, -1))}
              aria-label="Previous day"
              className="grid h-7 w-7 place-items-center rounded-lg text-[#8B93A8] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="flex items-center gap-2 px-2 text-[13px] font-medium text-white">
              <CalendarDays size={14} className="text-[#F47A20]" />
              {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => !isToday && setDate((d) => addDays(d, 1))}
              disabled={isToday}
              aria-label="Next day"
              className="grid h-7 w-7 place-items-center rounded-lg text-[#8B93A8] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {attendanceRate !== null && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 ${
                attendanceRate >= 80
                  ? "border-emerald-500/25 bg-emerald-500/[0.08]"
                  : attendanceRate >= 50
                    ? "border-amber-500/25 bg-amber-500/[0.08]"
                    : "border-red-500/25 bg-red-500/[0.08]"
              }`}
            >
              <Gauge size={16} className={attendanceRate >= 80 ? "text-emerald-400" : attendanceRate >= 50 ? "text-amber-400" : "text-red-400"} />
              <div className="leading-tight">
                <p className="text-[10.5px] uppercase tracking-wide text-[#8B93A8]">Attendance Today</p>
                <p className={`text-[15px] font-bold ${attendanceRate >= 80 ? "text-emerald-400" : attendanceRate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                  {attendanceRate}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI cards — five real counts from the same summary object */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <AdminKpiCard icon={Users} tone="blue" value={loading ? undefined : data?.summary?.total ?? 0} label="Total" hint={trendHint("total")} loading={loading} onClick={() => setStatusFilter("")} />
        <AdminKpiCard icon={CheckCircle2} tone="green" value={loading ? undefined : data?.summary?.working ?? 0} label="Working" hint={trendHint("working")} loading={loading} onClick={() => setStatusFilter("WORKING")} />
        <AdminKpiCard icon={Coffee} tone="amber" value={loading ? undefined : data?.summary?.onBreak ?? 0} label="On Break" hint={trendHint("onBreak")} loading={loading} onClick={() => setStatusFilter("ON_BREAK")} />
        <AdminKpiCard icon={LogOut} tone="purple" value={loading ? undefined : data?.summary?.checkedOut ?? 0} label="Checked Out" hint={trendHint("checkedOut")} loading={loading} onClick={() => setStatusFilter("CHECKED_OUT")} />
        <AdminKpiCard icon={AlertTriangle} tone="red" value={loading ? undefined : data?.summary?.missing ?? 0} label="Missing" hint={trendHint("missing")} loading={loading} onClick={() => setStatusFilter("MISSING")} />
      </div>

      {/* Search + filters + export */}
      <div className="flex flex-col lg:flex-row flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5266]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, employee code, or market..."
            className="w-full rounded-xl bg-[#111A2D]/80 border border-white/[0.08] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#5C6479] outline-none transition-colors focus:border-[#F47A20]/50"
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
          <option value="WORKER">Worker</option>
          <option value="CASHIER">Cashier</option>
          <option value="BUTCHER">Butcher</option>
          <option value="STAFF">Supervisor/Overlooking</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">All Status</option>
          <option value="WORKING">Working</option>
          <option value="ON_BREAK">On Break</option>
          <option value="CHECKED_OUT">Checked Out</option>
          <option value="MISSING">Missing</option>
        </select>
        <button
          type="button"
          onClick={() => downloadCsv(rows, dateIso)}
          disabled={rows.length === 0}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#F47A20] border border-[#F47A20]/35 bg-[#F47A20]/[0.08] transition-all duration-150 hover:bg-[#F47A20]/[0.14] hover:shadow-[0_0_18px_-6px_rgba(244,122,32,0.6)] disabled:opacity-40 disabled:hover:shadow-none"
        >
          <Download size={15} /> Export
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-[60px]" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[#111A2D]/80 border border-white/[0.07] text-center">
          <p className="text-sm font-medium text-white">No attendance records found</p>
          <p className="mt-1 text-xs text-[#8B93A8]">Try a different date, or clear the search and filters above.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0C1424]/80 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wide text-[#6B7284]">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Market</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Check In</th>
                  <th className="px-4 py-3 font-medium">Check Out</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  const state = STATE_META[r.state] ?? STATE_META.CHECKED_OUT;
                  const StateIcon = state.icon;
                  const roleMeta = ROLE_META[r.role];
                  const RoleIcon = roleMeta?.icon ?? UserRound;
                  const rowKey = `${r.kind}-${r.id}`;
                  const href = profileHref(r);

                  return (
                    <tr
                      key={rowKey}
                      style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                      className="animate-fade-up border-b border-white/[0.04] last:border-0 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[11px] font-bold text-white ring-1 ring-white/10">
                            {initialsOf(r.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-medium text-white truncate">{r.name}</p>
                            <p className="text-[11px] text-[#6B7284]">{r.employeeCode ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#C4C9D6]">{r.marketName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${roleMeta?.tone ?? "text-[#9AA1B4] bg-white/[0.06]"}`}>
                          <RoleIcon size={12} /> {roleMeta?.label ?? r.role?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] tabular-nums text-[#C4C9D6]">
                        {r.checkIn ? <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {timeLabel(r.checkIn)}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] tabular-nums text-[#C4C9D6]">
                        {r.checkOut ? <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> {timeLabel(r.checkOut)}</span> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${state.chip}`}>
                            <StateIcon size={11} /> {state.label}
                          </span>
                          {r.status === "LATE" && <AttendanceStatusPill status="LATE" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right relative">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenMenuKey(openMenuKey === rowKey ? null : rowKey); }}
                          aria-label="Row actions"
                          className="grid h-8 w-8 place-items-center rounded-lg text-[#6B7284] transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuKey === rowKey && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-4 top-11 z-20 w-44 rounded-xl border border-white/[0.08] bg-[#151B2E] p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]"
                          >
                            {href ? (
                              <button
                                type="button"
                                onClick={() => { setOpenMenuKey(null); navigate(href); }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] text-[#C4C9D6] transition-colors hover:bg-white/[0.06] hover:text-white"
                              >
                                <UserRound size={13} /> View Profile
                              </button>
                            ) : (
                              <p className="px-3 py-2 text-[11.5px] text-[#5C6479]">No profile available</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination — over the rows already fetched and filtered here;
              the endpoint itself returns everything in one response. */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
            <p className="text-[12.5px] text-[#8B93A8]">
              Showing {rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, rows.length)} of {rows.length} record{rows.length === 1 ? "" : "s"}
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
    </div>
  );
}
