import SupervisorProfileCard from "./SupervisorProfileCard";
import SupervisorOverviewStats from "./SupervisorOverviewStats";
import SupervisorAnnouncementsCard from "./SupervisorAnnouncementsCard";
import TodayActivityFeed from "./TodayActivityFeed";
import ReportsSection from "./ReportsSection";
import AttendanceCheckInCard from "../common/AttendanceCheckInCard";

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

// SupervisorHomeTab.jsx — greeting header -> shift/attendance -> today's
// overview -> important information -> Today's Activity + Reports,
// mobile-first and card-based, every value real TeamMart data end to
// end. The Notifications preview section was removed per explicit
// request (notifications are already reachable via the top-bar bell) —
// Today's Activity and Reports are both still real, unchanged data
// (TodayActivityFeed/ReportsSection), just placed side by side as two
// square tiles instead of two stacked full-width sections.
export default function SupervisorHomeTab({ session, basePath }) {
  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up space-y-5">
      <div>
        <h1 className="text-xl font-display font-bold text-white">
          {greeting()}, {session.displayName?.split(" ")[0]}
        </h1>
        <p className="text-xs text-[#8B93A8] mt-0.5">{todayLabel()}</p>
      </div>

      <SupervisorProfileCard session={session} />

      <AttendanceCheckInCard />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">
          Today's Overview
        </h2>
        <SupervisorOverviewStats session={session} basePath={basePath} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">
          Important Information
        </h2>
        <SupervisorAnnouncementsCard session={session} basePath={basePath} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">
            Today's Activity
          </h2>
          <TodayActivityFeed marketId={session.marketId} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">
            Reports
          </h2>
          <ReportsSection marketId={session.marketId} />
        </div>
      </section>
    </div>
  );
}
