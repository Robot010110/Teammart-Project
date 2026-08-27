import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { Home, Store, Users, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import RegionalManagerProfile from "./RegionalManagerProfile";
import MarketsPage from "./MarketsPage";
import RmMarketOverview from "./RmMarketOverview";
import RmSectionDetail from "./RmSectionDetail";
import RmMarketHistory from "./RmMarketHistory";
import RmEmployeeProfile from "./RmEmployeeProfile";
import RmEmployeeChat from "./RmEmployeeChat";
import RmEmployeesPage from "./RmEmployeesPage";
import RmChatPage from "./RmChatPage";
import RmTotalSalesPage from "./RmTotalSalesPage";
import RmCardSalesPage from "./RmCardSalesPage";
import RmSettingsPage from "./RmSettingsPage";
import CommunicationHistoryScreen from "../components/common/communications/CommunicationHistoryScreen";
import CommunicationComposer from "../components/common/communications/CommunicationComposer";

const BASE_PATH = "/rm";

// RegionalManagerWorkspace.jsx — Regional Manager's entry point, the
// same mobile-first AppShell/BottomNav shell every other role uses
// (Employee/Cashier/Supervisor) instead of a permanent desktop sidebar —
// "TeamMart, but for a Regional Manager," not a separate application.
// Every screen below is backed by real data (marketManagementService.js,
// staffEmployeeService.js, chatService.js) and real server-side
// authorization (a Regional Manager can only ever reach markets/
// employees inside their own assigned zones — see
// backend/src/middleware/auth.js's staffCanAccessMarket).
//
// Connected drill-down, all real routes (not fake local state):
//   /rm/profile (Home tab)
//   /rm/markets
//   /rm/markets/:marketId
//   /rm/markets/:marketId/sections/:department
//   /rm/markets/:marketId/history
//   /rm/markets/:marketId/employees/:employeeId
//   /rm/markets/:marketId/employees/:employeeId/chat
//   /rm/employees
//   /rm/chat, /rm/chat/:conversationId
//   /rm/settings
export default function RegionalManagerWorkspace({ session, onLogout }) {
  const tabs = [
    { key: "profile", label: "Home", icon: Home },
    { key: "markets", label: "Markets", icon: Store },
    { key: "employees", label: "Employees", icon: Users },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Routes>
      <Route element={<AppShell tabs={tabs} basePath={BASE_PATH} />}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<RegionalManagerProfile session={session} />} />
        <Route path="markets" element={<MarketsPage />} />
        <Route path="markets/:marketId" element={<RmMarketOverviewRoute />} />
        <Route path="markets/:marketId/sections/:department" element={<RmSectionDetailRoute />} />
        <Route path="markets/:marketId/history" element={<RmMarketHistoryRoute />} />
        <Route path="markets/:marketId/employees/:employeeId" element={<RmEmployeeProfileRoute />} />
        <Route path="markets/:marketId/employees/:employeeId/chat" element={<RmEmployeeChatRoute session={session} />} />
        <Route path="markets/:marketId/total-sales" element={<RmTotalSalesRoute />} />
        <Route path="markets/:marketId/card-sales" element={<RmCardSalesRoute />} />
        <Route path="employees" element={<RmEmployeesPage />} />
        <Route path="communications" element={<CommunicationHistoryScreen session={session} basePath={BASE_PATH} />} />
        <Route path="communications/new" element={<CommunicationComposer session={session} basePath={BASE_PATH} />} />
        <Route path="chat" element={<RmChatPage session={session} />} />
        <Route path="chat/:conversationId" element={<RmChatPage session={session} />} />
        <Route path="settings" element={<RmSettingsPage onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="profile" replace />} />
      </Route>
    </Routes>
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
      onOpenTotalSales={() => navigate(`${BASE_PATH}/markets/${marketId}/total-sales`)}
      onOpenCardSales={() => navigate(`${BASE_PATH}/markets/${marketId}/card-sales`)}
      onBack={() => navigate(`${BASE_PATH}/markets`)}
    />
  );
}

function RmTotalSalesRoute() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  return <RmTotalSalesPage marketId={marketId} onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)} />;
}

function RmCardSalesRoute() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  return <RmCardSalesPage marketId={marketId} onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)} />;
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
