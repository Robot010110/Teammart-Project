import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import AttendanceStatusPill from "../components/common/AttendanceStatusPill";
import { listCompanyAttendance } from "../services/adminService";
import { listMarkets } from "../services/marketService";
import { initialsOf } from "../utils/initials";

const STATE_LABEL = { WORKING: "Working", ON_BREAK: "On Break", CHECKED_OUT: "Checked Out", MISSING: "Missing" };
const STATE_STYLE = {
  WORKING: "bg-emerald-500/10 text-emerald-400",
  ON_BREAK: "bg-sky-500/10 text-sky-400",
  CHECKED_OUT: "bg-white/5 text-[#9AA1B4]",
  MISSING: "bg-red-500/10 text-red-400",
};

function timeLabel(iso) {
  return iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
}

// AdminAttendancePage.jsx — Admin Phase 1 §16: a company-wide attendance
// snapshot for one day, built entirely on the new
// attendanceController.listCompanyAttendance endpoint (the exact same
// AttendanceRecord table every other attendance screen already reads —
// see that endpoint's own comment). Reached from Home's dashboard tiles
// (e.g. "Currently Working" -> ?state=WORKING) or the bottom-nav-less
// direct route /admin/attendance.
export default function AdminAttendancePage() {
  const [searchParams] = useSearchParams();
  const [marketId, setMarketId] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState(searchParams.get("state") ?? "");
  const [searchInput, setSearchInput] = useState("");

  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const { data, error, loading, reload } = useAsync(
    () => listCompanyAttendance({ marketId: marketId || undefined, role: role || undefined, search: searchInput || undefined }),
    { deps: [marketId, role, searchInput] }
  );

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => !state || r.state === state), [data, state]);

  const selectClass =
    "rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50";

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-7xl mx-auto animate-fade-up">
      <h1 className="font-display text-xl md:text-2xl font-bold text-white mb-1">Attendance</h1>
      <p className="text-sm text-[#9AA1B4] mb-4">
        {data ? new Date(data.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Today"}
      </p>

      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
          {[
            { key: "", label: "Total", value: data.summary.total },
            { key: "WORKING", label: "Working", value: data.summary.working },
            { key: "ON_BREAK", label: "On Break", value: data.summary.onBreak },
            { key: "CHECKED_OUT", label: "Checked Out", value: data.summary.checkedOut },
            { key: "MISSING", label: "Missing", value: data.summary.missing },
          ].map((tile) => (
            <button
              key={tile.label}
              type="button"
              onClick={() => setState(tile.key)}
              className={`rounded-xl p-3 text-left border transition-colors ${
                state === tile.key ? "bg-[#F47A20]/10 border-[#F47A20]/40" : "bg-[#171C2E]/80 border-white/[0.06] hover:border-white/[0.15]"
              }`}
            >
              <p className="text-lg font-bold text-white">{tile.value}</p>
              <p className="text-[11px] text-[#8B93A8]">{tile.label}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5266]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or code..."
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
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
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-[64px]" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
          No attendance rows match these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="flex items-center gap-3 rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06]">
              <span className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                {initialsOf(r.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{r.name}</p>
                <p className="text-xs text-[#8B93A8] mt-0.5">
                  {r.marketName ?? "—"} · {r.role?.replace(/_/g, " ")}
                  {r.checkIn && ` · In ${timeLabel(r.checkIn)}`}
                  {r.checkOut && ` · Out ${timeLabel(r.checkOut)}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[10px] font-semibold uppercase rounded-full px-2 py-1 ${STATE_STYLE[r.state] ?? STATE_STYLE.CHECKED_OUT}`}>
                  {STATE_LABEL[r.state] ?? r.state}
                </span>
                {r.status === "LATE" && <AttendanceStatusPill status="LATE" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
