import { useNavigate } from "react-router-dom";
import SupervisorPageHeader from "./SupervisorPageHeader";
import TodayActivityFeed from "../TodayActivityFeed";

// SupervisorPendingTasksPage.jsx — the dedicated Pending Tasks screen.
// Reuses TodayActivityFeed.jsx with pendingOnly=true: the same real
// 5-source merge, filtered to items with a real PENDING status — i.e.
// exactly the things still awaiting the Supervisor's own Approve/Reject
// decision (Activities, Wasted Overall reports, Extra Hours requests).
export default function SupervisorPendingTasksPage({ session, basePath }) {
  const navigate = useNavigate();
  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <SupervisorPageHeader title="Pending Tasks" subtitle="Waiting on your review" onBack={() => navigate(`${basePath}/home`)} />
      <TodayActivityFeed marketId={session.marketId} todayOnly={false} pendingOnly />
    </div>
  );
}
