import SupervisorProfileCard from "./SupervisorProfileCard";
import ZoneManagerNotificationCard from "./ZoneManagerNotificationCard";
import TodayActivityFeed from "./TodayActivityFeed";
import ReportsSection from "./ReportsSection";

// SupervisorHomeTab.jsx — the operational dashboard: profile -> Zone
// Manager notification -> Today's Activity -> Reports. Matches the
// spec's three-category separation (communication / automatically
// received activity / operational reports) as three distinct sections,
// not one merged feed.
export default function SupervisorHomeTab({ session }) {
  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <SupervisorProfileCard session={session} />

      <section className="mt-4">
        <ZoneManagerNotificationCard />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Today's Activity</h2>
        <TodayActivityFeed marketId={session.marketId} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Reports</h2>
        <ReportsSection marketId={session.marketId} />
      </section>
    </div>
  );
}
