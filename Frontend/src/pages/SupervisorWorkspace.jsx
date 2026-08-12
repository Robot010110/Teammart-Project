import { useState } from "react";
import { Home, Users, MessageCircle, Store, Settings as SettingsIcon } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import SettingsScreen from "../components/employee/SettingsScreen";
import SupervisorHomeTab from "../components/supervisor/SupervisorHomeTab";
import EmployeesListScreen from "../components/supervisor/EmployeesListScreen";
import SupervisorChatTab from "../components/supervisor/SupervisorChatTab";
import MarketTab from "../components/supervisor/MarketTab";

// SupervisorWorkspace.jsx — Supervisor Mode's entry point: the same
// mobile bottom-nav shell (AppShell.jsx) the Worker/Cashier workspaces
// use, five tabs instead of five (Home/Tasks/Activity/Chat/Profile) ->
// (Home/Employees/Chat/Market/Settings) per the spec's exact nav model.
// Same account either way (Supervisor or Overlooking — see
// session.title/session.shift, set at login) — one component, not two
// parallel workspaces, matching the "reusable management architecture"
// requirement instead of duplicating this file per shift.
export default function SupervisorWorkspace({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState("home");

  const tabs = [
    { key: "home", label: "Home", icon: Home, content: <SupervisorHomeTab session={session} /> },
    { key: "employees", label: "Employees", icon: Users, content: <EmployeesListScreen session={session} /> },
    { key: "chat", label: "Chat", icon: MessageCircle, content: <SupervisorChatTab session={session} /> },
    { key: "market", label: "Market", icon: Store, content: <MarketTab session={session} /> },
    { key: "settings", label: "Settings", icon: SettingsIcon, content: <SettingsScreen onLogout={onLogout} /> },
  ];

  return <AppShell tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />;
}
