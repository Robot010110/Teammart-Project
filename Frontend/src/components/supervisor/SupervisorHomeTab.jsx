import { Circle } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import SupervisorProfileCard from "./SupervisorProfileCard";
import AttendanceCheckInCard from "../common/AttendanceCheckInCard";
import SupervisorTodayOverview from "./home/SupervisorTodayOverview";
import SupervisorQuickActions from "./home/SupervisorQuickActions";
import TeamStatusChart from "./home/TeamStatusChart";
import { getTodayAttendance } from "../../services/attendanceService";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// SupervisorHomeTab.jsx — a short command center, not a scrolling feed.
// Order matches the design brief exactly:
//   header (AppShell's own bar)
//   greeting + duty status
//   hero card (SupervisorProfileCard — identity, market, team, wind bg)
//   attendance quick control (AttendanceCheckInCard, unchanged real logic)
//   Today's Overview — 4 real, distinct summary cards, each opening its
//     own dedicated page (no full lists live on Home)
//   Quick Actions
//   Team Status (compact donut + link to the full Team Attendance page)
//
// Every number anywhere on this page is real — see each child
// component's own comment for its exact backend source. Nothing here
// duplicates a data source under a different name.
export default function SupervisorHomeTab({ session, basePath }) {
  // Real on-duty state — the same GET /attendance/today
  // AttendanceCheckInCard itself reads, fetched once here and handed
  // down to the hero card's status pill rather than a second, redundant
  // call inside it.
  const { data: today } = useAsync(getTodayAttendance, { deps: [] });
  const onDuty = !!(today?.checkIn && !today?.checkOut);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-white">
            {greeting()}, {session.displayName?.split(" ")[0]} 👋
          </h1>
          <p className="text-xs text-[#8B93A8] mt-0.5">{todayLabel()}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            onDuty ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/25" : "text-[#8B93A8] bg-white/[0.04] border border-white/[0.08]"
          }`}
        >
          <Circle size={7} className="fill-current" />
          {onDuty ? "On Duty" : "Off Duty"}
        </span>
      </div>

      <SupervisorProfileCard session={session} onDuty={onDuty} />

      <AttendanceCheckInCard />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">Today's Overview</h2>
        <SupervisorTodayOverview session={session} basePath={basePath} />
      </section>

      <SupervisorQuickActions session={session} basePath={basePath} />

      <TeamStatusChart session={session} basePath={basePath} />
    </div>
  );
}
