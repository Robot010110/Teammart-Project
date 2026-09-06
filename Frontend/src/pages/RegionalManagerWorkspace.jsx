import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { Home, Store, Users, MessageCircle, Settings as SettingsIcon, Activity } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import RegionalManagerHome from "./RegionalManagerHome";
import RegionalManagerProfile from "./RegionalManagerProfile";
import RmAttentionPage from "./RmAttentionPage";
import RmExpiredItemsPage from "./RmExpiredItemsPage";
import RmMarketActivitiesPage from "./RmMarketActivitiesPage";
import RmAllMarketsSalesPage from "./RmAllMarketsSalesPage";
import RmCardSalesZoneStatusPage from "./RmCardSalesZoneStatusPage";
import MarketsPage from "./MarketsPage";
import RmMarketOverview from "./RmMarketOverview";
import RmMarketEmployeesPage from "./RmMarketEmployeesPage";
import RmMarketActivityTodayPage from "./RmMarketActivityTodayPage";
import RmSectionDetail from "./RmSectionDetail";
import RmMarketHistory from "./RmMarketHistory";
import RmEmployeeProfile from "./RmEmployeeProfile";
import RmEmployeeChat from "./RmEmployeeChat";
import RmEmployeesPage from "./RmEmployeesPage";
import RmSupervisorProfilePage from "./RmSupervisorProfilePage";
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
//   /rm/activities, /rm/activities/markets, /rm/activities/card-sales
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
    { key: "activities", label: "Activities", icon: Activity },
    { key: "employees", label: "Employees", icon: Users },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Routes>
      <Route element={<AppShell tabs={tabs} basePath={BASE_PATH} />}>
        <Route index element={<Navigate to="profile" replace />} />
        {/* The Home tab is the zone command center. The previous Home
            screen (own attendance check-in, the full notification feed,
            communications) is not gone — it moved to /rm/account,
            reached from the header's role line, and its notification
            feed is also on every screen now via the header bell. */}
        <Route path="profile" element={<RegionalManagerHome session={session} />} />
        <Route path="account" element={<RegionalManagerProfile session={session} />} />
        <Route path="attention" element={<RmAttentionRoute session={session} />} />
        <Route path="expired-items" element={<RmExpiredItemsRoute />} />
        <Route path="markets" element={<MarketsPage />} />
        <Route path="activities" element={<RmMarketActivitiesPage />} />
        <Route path="activities/markets" element={<RmAllMarketsSalesRoute />} />
        <Route path="activities/card-sales" element={<RmCardSalesZoneStatusRoute />} />
        <Route path="markets/:marketId" element={<RmMarketOverviewRoute />} />
        <Route path="markets/:marketId/employees" element={<RmMarketEmployeesRoute />} />
        <Route path="markets/:marketId/activity" element={<RmMarketActivityTodayRoute />} />
        <Route path="markets/:marketId/sections/:department" element={<RmSectionDetailRoute />} />
        <Route path="markets/:marketId/history" element={<RmMarketHistoryRoute />} />
        <Route path="markets/:marketId/employees/:employeeId" element={<RmEmployeeProfileRoute />} />
        <Route path="markets/:marketId/employees/:employeeId/chat" element={<RmEmployeeChatRoute session={session} />} />
        <Route path="markets/:marketId/total-sales" element={<RmTotalSalesRoute />} />
        <Route path="markets/:marketId/card-sales" element={<RmCardSalesRoute />} />
        <Route path="employees" element={<RmEmployeesPage />} />
        {/* A supervisor is a staff account, not an employee of a market,
            so it gets its own route rather than being squeezed into the
            /markets/:marketId/employees/:employeeId shape. Nested under
            "employees" so AppShell's active-tab check (which matches on
            the path segment) keeps the Employees tab lit while viewing
            a profile opened from that directory. */}
        <Route path="employees/supervisors/:userId" element={<RmSupervisorProfileRoute />} />
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

function RmAttentionRoute({ session }) {
  const navigate = useNavigate();
  return <RmAttentionPage session={session} onBack={() => navigate(`${BASE_PATH}/profile`)} />;
}

// Zone-wide Expired/Wasted Items. No marketId or zoneId is passed —
// the backend scopes it to this account's own zones from the token.
function RmExpiredItemsRoute() {
  const navigate = useNavigate();
  return <RmExpiredItemsPage onBack={() => navigate(`${BASE_PATH}/profile`)} />;
}

function RmMarketOverviewRoute() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  return (
    <RmMarketOverview
      marketId={marketId}
      onOpenEmployees={() => navigate(`${BASE_PATH}/markets/${marketId}/employees`)}
      onOpenActivityToday={() => navigate(`${BASE_PATH}/markets/${marketId}/activity`)}
      onOpenSupervisor={(userId) => navigate(`${BASE_PATH}/employees/supervisors/${userId}`)}
      onOpenSection={(department) => navigate(`${BASE_PATH}/markets/${marketId}/sections/${encodeURIComponent(department)}`)}
      onOpenHistory={() => navigate(`${BASE_PATH}/markets/${marketId}/history`)}
      onOpenTotalSales={() => navigate(`${BASE_PATH}/markets/${marketId}/total-sales`)}
      onOpenCardSales={() => navigate(`${BASE_PATH}/markets/${marketId}/card-sales`)}
      onBack={() => navigate(`${BASE_PATH}/markets`)}
    />
  );
}

// Back goes to the people directory this profile was opened from.
function RmSupervisorProfileRoute() {
  const { userId } = useParams();
  const navigate = useNavigate();
  return <RmSupervisorProfilePage userId={userId} onBack={() => navigate(`${BASE_PATH}/employees`)} />;
}

// The market's own employee roster. Selecting someone here opens that
// employee's real profile at the existing
// /markets/:marketId/employees/:employeeId route — the same screen
// (and the same data) the app already had, just reached from the market
// instead of the global directory.
function RmMarketEmployeesRoute() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  return (
    <RmMarketEmployeesPage
      marketId={marketId}
      onOpenEmployee={(employeeId) => navigate(`${BASE_PATH}/markets/${marketId}/employees/${employeeId}`)}
      onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)}
    />
  );
}

function RmMarketActivityTodayRoute() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  return <RmMarketActivityTodayPage marketId={marketId} onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)} />;
}

function RmAllMarketsSalesRoute() {
  const navigate = useNavigate();
  return <RmAllMarketsSalesPage onBack={() => navigate(`${BASE_PATH}/activities`)} />;
}

function RmCardSalesZoneStatusRoute() {
  const navigate = useNavigate();
  return <RmCardSalesZoneStatusPage onBack={() => navigate(`${BASE_PATH}/activities`)} />;
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
      // Back returns to the market's employee list this profile was
      // opened from, not straight to the market overview — one step back
      // in the real flow (Market -> Employees -> Employee).
      onBack={() => navigate(`${BASE_PATH}/markets/${marketId}/employees`)}
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
