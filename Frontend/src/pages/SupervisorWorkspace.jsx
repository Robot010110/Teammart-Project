import { Routes, Route, Navigate } from "react-router-dom";
import { Home, Users, MessageCircle, Store, Settings as SettingsIcon } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import SettingsScreen from "../components/employee/SettingsScreen";
import SupervisorHomeTab from "../components/supervisor/SupervisorHomeTab";
import EmployeesListScreen from "../components/supervisor/EmployeesListScreen";
import SupervisorEmployeeProfileRoute from "../components/supervisor/SupervisorEmployeeProfileRoute";
import SupervisorChatTab from "../components/supervisor/SupervisorChatTab";
import MarketTab from "../components/supervisor/MarketTab";

const BASE_PATH = "/supervisor";

// SupervisorWorkspace.jsx — Supervisor Mode's entry point, same
// route-driven AppShell as the Worker/Cashier workspaces:
// Home/Employees/Chat/Market/Settings, each a real route under
// /supervisor. The Employees -> Employee Details -> Attendance/Tasks/
// Activity History drill-down (the exact chain the routing spec's
// acceptance tests use as their example) is now real nested routes with
// a :employeeId param — see SupervisorEmployeeProfileRoute.jsx.
export default function SupervisorWorkspace({ session, onLogout }) {
  const tabs = [
    { key: "home", label: "Home", icon: Home },
    { key: "employees", label: "Employees", icon: Users },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "market", label: "Market", icon: Store },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Routes>
      <Route element={<AppShell tabs={tabs} basePath={BASE_PATH} />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<SupervisorHomeTab session={session} />} />
        <Route path="employees" element={<EmployeesListScreen session={session} basePath={BASE_PATH} />} />
        <Route path="employees/:employeeId/*" element={<SupervisorEmployeeProfileRoute basePath={BASE_PATH} />} />
        <Route path="chat" element={<SupervisorChatTab session={session} basePath={BASE_PATH} />} />
        <Route path="chat/:channelId" element={<SupervisorChatTab session={session} basePath={BASE_PATH} />} />
        <Route path="market" element={<MarketTab session={session} />} />
        <Route path="settings" element={<SettingsScreen onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Route>
    </Routes>
  );
}
