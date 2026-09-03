import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import SupervisorPageHeader from "./SupervisorPageHeader";
import { useAsync } from "../../../hooks/useAsync";
import { SkeletonCard } from "../../common/SkeletonCard";
import ErrorBanner from "../../common/ErrorBanner";
import { getMarketAttendanceToday } from "../../../services/attendanceService";

const BUCKET_STYLE = {
  present: { label: "Present", text: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" },
  late: { label: "Late", text: "text-[#F9A03C]", bg: "bg-[#F47A20]/10", ring: "ring-[#F47A20]/20" },
  notCheckedIn: { label: "Not Checked In", text: "text-[#FF5C5C]", bg: "bg-red-500/10", ring: "ring-red-500/20" },
  offLeave: { label: "Off / Leave", text: "text-[#8B93A8]", bg: "bg-white/5", ring: "ring-white/10" },
};

const timeLabel = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—");

// SupervisorTeamAttendancePage.jsx — the dedicated screen Team Status'
// "View Team Attendance" (and the Quick Actions "Team Attendance" card)
// both open. Same real GET /attendance/market/today the donut uses, just
// the per-employee row-level view — one real endpoint, two real
// presentations, not two data sources.
export default function SupervisorTeamAttendancePage({ session, basePath }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(() => getMarketAttendanceToday(session.marketId), {
    deps: [session.marketId],
    fallbackError: "Could not load team attendance.",
  });

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <SupervisorPageHeader title="Team Attendance" subtitle="Today's real-time status" onBack={() => navigate(`${basePath}/home`)} />

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} className="h-[62px]" />
          ))}
        </div>
      )}
      {!loading && error && <ErrorBanner message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          {data.employees.length === 0 ? (
            <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
              <Users size={22} className="mx-auto text-[#4C5266] mb-2" />
              <p className="text-sm text-[#8B93A8]">No employees in your market yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.employees.map((e) => {
                const style = BUCKET_STYLE[e.bucket];
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
                    <span className="w-9 h-9 shrink-0 rounded-lg bg-white/[0.04] grid place-items-center text-[12px] font-bold text-white">
                      {e.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{e.name}</p>
                      <p className="text-[11px] text-[#8B93A8]">
                        {e.employeeCode ?? e.role} · In {timeLabel(e.checkIn)} · Out {timeLabel(e.checkOut)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium ring-1 ring-inset ${style.bg} ${style.text} ${style.ring}`}>
                      {style.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
