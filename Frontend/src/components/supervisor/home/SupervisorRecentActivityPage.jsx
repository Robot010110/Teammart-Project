import { useNavigate } from "react-router-dom";
import SupervisorPageHeader from "./SupervisorPageHeader";
import TodayActivityFeed from "../TodayActivityFeed";

// SupervisorRecentActivityPage.jsx — the dedicated Recent Activity
// screen. Reuses TodayActivityFeed.jsx with todayOnly=false, so it shows
// the real, wider chronological history (including already-reviewed
// items) instead of Home's today-only teaser — same real 5-source merge,
// same detail/review modal, just not date-limited.
export default function SupervisorRecentActivityPage({ session, basePath }) {
  const navigate = useNavigate();
  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <SupervisorPageHeader title="Recent Activity" subtitle="Everything that's happened in your market" onBack={() => navigate(`${basePath}/home`)} />
      <TodayActivityFeed marketId={session.marketId} todayOnly={false} />
    </div>
  );
}
