import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { Home, Layers, Store, Users2, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import SettingsScreen from "../components/employee/SettingsScreen";
import AdminHomeTab from "./AdminHomeTab";
import AdminZonesPage from "./AdminZonesPage";
import AdminMarketsPage from "./AdminMarketsPage";
import AdminEmployeesPage from "./AdminEmployeesPage";
import AdminEmployeeProfilePage from "./AdminEmployeeProfilePage";
import AdminAttendancePage from "./AdminAttendancePage";
import AdminActivitiesPage from "./AdminActivitiesPage";
import AdminChatPage from "./AdminChatPage";
import AdminMarketDetailPage from "./AdminMarketDetailPage";
import AdminAuditLogPage from "./AdminAuditLogPage";
import AdminReportsPage from "./AdminReportsPage";
import CommunicationHistoryScreen from "../components/common/communications/CommunicationHistoryScreen";
import CommunicationComposer from "../components/common/communications/CommunicationComposer";

const BASE_PATH = "/admin";

// AdminWorkspace.jsx — Admin's entry point, the same mobile-first
// AppShell/BottomNav shell every other role uses (Employee/Cashier/
// Supervisor) instead of a desktop sidebar — "TeamMart, but for an
// Admin," not a separate application. Every screen here talks to
// endpoints that already existed and were already ADMIN-gated on the
// backend, plus the small set of genuinely-missing company-wide
// endpoints added in Admin Phase 1 (adminController.js,
// attendanceController.listCompanyAttendance,
// activitiesController.listCompanyActivities) — this file and its tab
// pages are the UI for them, not new backend authorization surface.
//
// Attendance and Activities are real routes but deliberately NOT bottom-
// nav tabs — a management-heavy 8-tab bar doesn't fit the 360-430px
// target this app is built for (see BottomNav's own constraints). They're
// reached the same way Supervisor's employee-detail screens already are:
// pushed via router navigation from Home's dashboard tiles / the
// Employees list, not pinned to the tab bar.
export default function AdminWorkspace({ session, onLogout }) {
  const tabs = [
    { key: "home", label: "Home", icon: Home },
    { key: "zones", label: "Zones", icon: Layers },
    { key: "markets", label: "Markets", icon: Store },
    { key: "employees", label: "Employees", icon: Users2 },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Routes>
      <Route element={<AppShell tabs={tabs} basePath={BASE_PATH} showNotificationBell />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<AdminHomeTab session={session} />} />
        <Route path="zones" element={<AdminZonesPage />} />
        <Route path="markets" element={<AdminMarketsPage />} />
        <Route path="markets/:marketId" element={<AdminMarketDetailRoute />} />
        <Route path="employees" element={<AdminEmployeesPage />} />
        <Route path="employees/:employeeId" element={<AdminEmployeeProfileRoute />} />
        <Route path="attendance" element={<AdminAttendancePage />} />
        <Route path="activities" element={<AdminActivitiesPage />} />
        <Route path="audit" element={<AdminAuditLogPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
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
