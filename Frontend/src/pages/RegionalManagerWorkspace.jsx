import { Routes, Route, Navigate, Outlet, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import RegionalManagerProfile from "./RegionalManagerProfile";
import MarketsPage from "./MarketsPage";
import RmMarketOverview from "./RmMarketOverview";
import RmSectionDetail from "./RmSectionDetail";
import RmMarketHistory from "./RmMarketHistory";
import RmEmployeeProfile from "./RmEmployeeProfile";
import RmEmployeeChat from "./RmEmployeeChat";

const BASE_PATH = "/rm";

// RegionalManagerWorkspace.jsx — the Regional Manager's real, route-driven
// desktop shell (Sidebar + Header + drill-down), replacing the old
// RmShell/ZonePage/MarketDashboard/EmployeeProfile mock flow entirely.
// Every screen below is backed by real data (marketManagementService.js,
// staffEmployeeService.js, chatService.js) and real server-side
// authorization (a Regional Manager can only ever reach markets/
// employees inside their own assigned zones — see
// backend/src/middleware/auth.js's staffCanAccessMarket).
//
// Connected drill-down, all real routes (not fake local state):
//   /rm/profile
//   /rm/markets
//   /rm/markets/:marketId
//   /rm/markets/:marketId/sections/:department
//   /rm/markets/:marketId/history
//   /rm/markets/:marketId/employees/:employeeId
//   /rm/markets/:marketId/employees/:employeeId/chat
export default function RegionalManagerWorkspace({ session, onLogout }) {
  return (
    <Routes>
      <Route element={<RmShell session={session} onLogout={onLogout} />}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<RegionalManagerProfile session={session} />} />
        <Route path="markets" element={<MarketsPage />} />
        <Route path="markets/:marketId" element={<RmMarketOverviewRoute />} />
        <Route path="markets/:marketId/sections/:department" element={<RmSectionDetailRoute />} />
        <Route path="markets/:marketId/history" element={<RmMarketHistoryRoute />} />
        <Route path="markets/:marketId/employees/:employeeId" element={<RmEmployeeProfileRoute />} />
        <Route path="markets/:marketId/employees/:employeeId/chat" element={<RmEmployeeChatRoute session={session} />} />
        <Route path="*" element={<Navigate to="profile" replace />} />
      </Route>
    </Routes>
  );
}

function RmShell({ session, onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white font-sans antialiased">
      <Sidebar
        role="regionalManager"
        currentPage="dashboard"
        onNavigate={(key) => navigate(`${BASE_PATH}/${key === "dashboard" ? "profile" : "markets"}`)}
      />
      <div className="md:pl-[68px]">
        <Header
          user={{ name: session.displayName, role: "Regional Manager", avatarInitials: session.initials }}
          onLogout={onLogout}
        />
        <main className="animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function RmMarketOverviewRoute() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  return (
    <RmMarketOverview
      marketId={marketId}
      onOpenEmployee={(employeeId) => navigate(`${BASE_PATH}/markets/${marketId}/employees/${employeeId}`)}
      onOpenSection={(department) => navigate(`${BASE_PATH}/markets/${marketId}/sections/${encodeURIComponent(department)}`)}
      onOpenHistory={() => navigate(`${BASE_PATH}/markets/${marketId}/history`)}
      onBack={() => navigate(`${BASE_PATH}/markets`)}
    />
  );
}

function RmSectionDetailRoute() {
  const { marketId, department } = useParams();
  const navigate = useNavigate();
  return (
    <RmSectionDetail
      marketId={marketId}
      department={department}
      onOpenEmployee={(employeeId) => navigate(`${BASE_PATH}/markets/${marketId}/employees/${employeeId}`)}
      onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)}
    />
  );
}

function RmMarketHistoryRoute() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  return <RmMarketHistory marketId={marketId} onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)} />;
}

function RmEmployeeProfileRoute() {
  const { marketId, employeeId } = useParams();
  const navigate = useNavigate();
  return (
    <RmEmployeeProfile
      marketId={marketId}
      employeeId={employeeId}
      onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)}
      onOpenChat={() => navigate(`${BASE_PATH}/markets/${marketId}/employees/${employeeId}/chat`)}
    />
  );
}

function RmEmployeeChatRoute({ session }) {
  const { marketId, employeeId } = useParams();
  const navigate = useNavigate();
  return (
    <RmEmployeeChat
      employeeId={employeeId}
      currentStaffUserId={session.staffId}
      onBack={() => navigate(`${BASE_PATH}/markets/${marketId}/employees/${employeeId}`)}
    />
  );
}
