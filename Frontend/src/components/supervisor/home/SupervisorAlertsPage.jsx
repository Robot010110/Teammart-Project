import { useNavigate } from "react-router-dom";
import SupervisorPageHeader from "./SupervisorPageHeader";
import ReportsProblemsSection from "../ReportsProblemsSection";

// SupervisorAlertsPage.jsx — the dedicated Alerts screen the Today
// Overview "Alerts" card opens. Reuses ReportsProblemsSection.jsx
// as-is — it is already a complete, real Alerts experience (create,
// Active/History tabs, status cycling, detail view) over the real
// MarketProblem model; this file only gives it its own route and a
// consistent header rather than rebuilding any of that.
export default function SupervisorAlertsPage({ session, basePath }) {
  const navigate = useNavigate();
  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <SupervisorPageHeader title="Alerts" subtitle="Operational issues in your market" onBack={() => navigate(`${basePath}/home`)} />
      <ReportsProblemsSection marketId={session.marketId} />
    </div>
  );
}
