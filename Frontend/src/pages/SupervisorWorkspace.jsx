import { Routes, Route, Navigate } from "react-router-dom";
import { Home, Users, MessageCircle, Store, Settings as SettingsIcon } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import SettingsScreen from "../components/employee/SettingsScreen";
import SupervisorHomeTab from "../components/supervisor/SupervisorHomeTab";
import EmployeesListScreen from "../components/supervisor/EmployeesListScreen";
import SupervisorEmployeeProfileRoute from "../components/supervisor/SupervisorEmployeeProfileRoute";
import SupervisorChatTab from "../components/supervisor/SupervisorChatTab";
import MarketTab from "../components/supervisor/MarketTab";
import CommunicationDetailScreen from "../components/employee/CommunicationDetailScreen";
import MarketFeedbackDetailScreen from "../components/supervisor/MarketFeedbackDetailScreen";
import SupervisorAlertsPage from "../components/supervisor/home/SupervisorAlertsPage";
import SupervisorRecentActivityPage from "../components/supervisor/home/SupervisorRecentActivityPage";
import SupervisorPendingTasksPage from "../components/supervisor/home/SupervisorPendingTasksPage";
import SupervisorTeamAttendancePage from "../components/supervisor/home/SupervisorTeamAttendancePage";

const BASE_PATH = "/supervisor";

// SupervisorWorkspace.jsx — Supervisor Mode's entry point, same
// route-driven AppShell as the Worker/Cashier workspaces:
// Home/Employees/Chat/Market/Settings, each a real route under
// /supervisor. The Employees -> Employee Details -> Attendance/Tasks/
// Activity History drill-down (the exact chain the routing spec's
// acceptance tests use as their example) is now real nested routes with
// a :employeeId param — see SupervisorEmployeeProfileRoute.jsx.
export default function SupervisorWorkspace({ session, onLogout }) {
  // Employees management isn't part of the Overlooking account's
  // permission set (spec §15's Overlooking summary only lists Chat +
  // Card Sales) — the backend's GET /api/employees already 403s for
  // OVERLOOKING_SUPERVISOR, so the tab is hidden rather than left to
  // error out.
  const tabs = [
    { key: "home", label: "Home", icon: Home },
    ...(session.staffRole !== "OVERLOOKING_SUPERVISOR" ? [{ key: "employees", label: "Employees", icon: Users }] : []),
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "market", label: "Market", icon: Store },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Routes>
      {/* Cleanup Phase §3 — Supervisor gets the same real notification
          bell every other staff/employee role already has. Backend
          support already existed (GET /api/notifications' recipientWhere
          already branches on a staff userId, not just employeeId — see
          notificationsController.js) — this was purely a missing
          frontend wire-up, not a new backend capability. */}
      <Route element={<AppShell tabs={tabs} basePath={BASE_PATH} showNotificationBell />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<SupervisorHomeTab session={session} basePath={BASE_PATH} />} />
        {/* Supervisor Home redesign — the Today Overview cards each open
            one of these dedicated pages instead of Home carrying full
            lists. All four are real data, see each page's own comment
            for its exact backend source. */}
        <Route path="alerts" element={<SupervisorAlertsPage session={session} basePath={BASE_PATH} />} />
        <Route path="activity" element={<SupervisorRecentActivityPage session={session} basePath={BASE_PATH} />} />
        <Route path="pending-tasks" element={<SupervisorPendingTasksPage session={session} basePath={BASE_PATH} />} />
        <Route path="team-attendance" element={<SupervisorTeamAttendancePage session={session} basePath={BASE_PATH} />} />
        <Route path="employees" element={<EmployeesListScreen session={session} basePath={BASE_PATH} />} />
        <Route path="employees/:employeeId/*" element={<SupervisorEmployeeProfileRoute basePath={BASE_PATH} />} />
        <Route path="chat" element={<SupervisorChatTab session={session} basePath={BASE_PATH} />} />
        <Route path="chat/:channelId" element={<SupervisorChatTab session={session} basePath={BASE_PATH} />} />
        <Route path="market" element={<MarketTab session={session} />} />
        {/* Verification pass §1 — a Supervisor can now be a targeted
            recipient (Specific-Supervisor warnings from a Zone Manager/
            Admin); this reuses the exact same detail screen an employee
            recipient uses (see that component's own comment — nothing in
            it is employee-specific), reached the same way an employee
            reaches it: the notification bell's linkType "COMMUNICATION". */}
        <Route path="communications/:id" element={<CommunicationDetailScreen basePath={BASE_PATH} />} />
        {/* Supervisor <-> Regional Manager connectivity fix — a
            Supervisor's MARKET_FEEDBACK notification (a Warning or
            Recognition) used to dead-end with no route to open; this is
            that real detail screen (see notificationLinks.js's
            MARKET_FEEDBACK case and MarketFeedbackDetailScreen's own
            comment). */}
        <Route path="market-feedback/:id" element={<MarketFeedbackDetailScreen basePath={BASE_PATH} />} />
        <Route path="settings" element={<SettingsScreen onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Route>
    </Routes>
  );
}
