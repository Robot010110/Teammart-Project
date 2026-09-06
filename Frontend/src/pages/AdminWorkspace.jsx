import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import AdminShell from "../components/admin/AdminShell";
import SettingsScreen from "../components/employee/SettingsScreen";
import AdminDashboard from "./AdminDashboard";
import RmExpiredItemsPage from "./RmExpiredItemsPage";
import AdminZonesPage from "./AdminZonesPage";
import AdminZoneMarketsPage from "./AdminZoneMarketsPage";
import AdminMarketsPage from "./AdminMarketsPage";
import AdminPeoplePage from "./AdminPeoplePage";
import AdminEmployeeProfilePage from "./AdminEmployeeProfilePage";
import AdminAttendancePage from "./AdminAttendancePage";
import AdminActivitiesPage from "./AdminActivitiesPage";
import AdminChatPage from "./AdminChatPage";
import AdminMarketDetailPage from "./AdminMarketDetailPage";
import AdminAuditLogPage from "./AdminAuditLogPage";
import AdminReportsPage from "./AdminReportsPage";
import RmMarketEmployeesPage from "./RmMarketEmployeesPage";
import RmMarketActivityTodayPage from "./RmMarketActivityTodayPage";
import RmSupervisorProfilePage from "./RmSupervisorProfilePage";
import CommunicationHistoryScreen from "../components/common/communications/CommunicationHistoryScreen";
import CommunicationComposer from "../components/common/communications/CommunicationComposer";

const BASE_PATH = "/admin";

// AdminWorkspace.jsx — Admin's entry point. Unlike every other role
// (Employee/Cashier/Supervisor/Regional Manager), which are phone-first
// and use the shared AppShell/BottomNav, Admin is an organization-wide
// DESKTOP workspace and uses AdminShell: a persistent left sidebar that
// collapses to a drawer on small screens. Every screen here talks to
// endpoints that already existed and were already ADMIN-gated on the
// backend, plus the small set of genuinely-missing company-wide
// endpoints added in Admin Phase 1 (adminController.js,
// attendanceController.listCompanyAttendance,
// activitiesController.listCompanyActivities) — this file and its tab
// pages are the UI for them, not new backend authorization surface.
//
// Activities and Audit are real routes reached from the Reports area and
// the dashboard rather than being separate sidebar entries, so the rail
// stays at the eight top-level destinations the design calls for.
export default function AdminWorkspace({ session, onLogout }) {
  return (
    <Routes>
      <Route element={<AdminShell session={session} />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<AdminDashboard session={session} />} />
        <Route path="zones" element={<AdminZonesPage />} />
        <Route path="zones/:zoneId/markets" element={<AdminZoneMarketsRoute />} />
        <Route path="markets" element={<AdminMarketsPage />} />
        <Route path="markets/:marketId" element={<AdminMarketDetailRoute />} />
        <Route path="markets/:marketId/employees" element={<AdminMarketEmployeesRoute />} />
        <Route path="markets/:marketId/activity" element={<AdminMarketActivityTodayRoute />} />
        <Route path="markets/:marketId/supervisors/:userId" element={<AdminSupervisorProfileRoute />} />
        <Route path="employees" element={<AdminPeoplePage />} />
        <Route path="employees/:employeeId" element={<AdminEmployeeProfileRoute />} />
        <Route path="attendance" element={<AdminAttendancePage />} />
        <Route path="activities" element={<AdminActivitiesPage />} />
        <Route path="audit" element={<AdminAuditLogPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        {/* Company-wide Expired/Wasted Items. Same page and same
            GET /api/item-reports/zone the Regional Manager uses — that
            endpoint is already unscoped for ADMIN (see
            itemReportsController.listZoneItemReports), so this is one
            report system with two scopes, not a second one. */}
        <Route path="expired-items" element={<RmExpiredItemsPage scopeLabel="across the organization" />} />
        <Route path="communications" element={<CommunicationHistoryScreen session={session} basePath={BASE_PATH} />} />
        <Route path="communications/new" element={<CommunicationComposer session={session} basePath={BASE_PATH} />} />
        <Route path="chat" element={<AdminChatPage session={session} />} />
        <Route path="chat/:conversationId" element={<AdminChatPage session={session} />} />
        <Route path="settings" element={<SettingsScreen onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Route>
    </Routes>
  );
}

function AdminEmployeeProfileRoute() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  return <AdminEmployeeProfilePage employeeId={employeeId} onBack={() => navigate(`${BASE_PATH}/employees`)} />;
}

function AdminMarketDetailRoute() {
  const { marketId } = useParams();
  return <AdminMarketDetailPage marketId={marketId} />;
}

// Zones & Markets, drilled in: this zone's own markets. Opening one goes
// to the same /admin/markets/:marketId detail every market already has;
// Back returns to the zone list.
function AdminZoneMarketsRoute() {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  return (
    <AdminZoneMarketsPage
      zoneId={zoneId}
      onOpenMarket={(marketId) => navigate(`${BASE_PATH}/markets/${marketId}`)}
      onBack={() => navigate(`${BASE_PATH}/zones`)}
    />
  );
}

// The market's own employee roster, same screen and same data the
// Regional Manager gets at the equivalent route. Selecting someone opens
// the existing global employee profile Admin already has.
function AdminMarketEmployeesRoute() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  return (
    <RmMarketEmployeesPage
      marketId={marketId}
      onOpenEmployee={(employeeId) => navigate(`${BASE_PATH}/employees/${employeeId}`)}
      onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)}
    />
  );
}

function AdminMarketActivityTodayRoute() {
  const { marketId } = useParams();
  const navigate = useNavigate();
  return <RmMarketActivityTodayPage marketId={marketId} onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)} />;
}

// The supervisor's profile, reached from the market they run. Nested
// under that market (rather than a flat /admin/supervisors/:userId) so
// Back returns to the exact market this was opened from — getAccessible
// Supervisor is already unscoped for ADMIN server-side (see
// marketsController.scopedMarketWhere), so this is the same real screen
// the Regional Manager uses, not a new one.
function AdminSupervisorProfileRoute() {
  const { marketId, userId } = useParams();
  const navigate = useNavigate();
  return (
    <RmSupervisorProfilePage
      userId={userId}
      basePath={BASE_PATH}
      onBack={() => navigate(`${BASE_PATH}/markets/${marketId}`)}
    />
  );
}
