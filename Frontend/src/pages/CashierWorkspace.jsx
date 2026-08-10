import { useState } from "react";
import { Home, ClipboardList, LayoutGrid, MessageCircle, UserCircle2 } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import HomeTab from "../components/employee/HomeTab";
import SuddenTaskListScreen from "../components/employee/SuddenTaskListScreen";
import CashierActivityTab from "../components/employee/CashierActivityTab";
import ChatListScreen from "../components/employee/ChatListScreen";
import ProfileTab from "../components/employee/ProfileTab";
import { useUnreadBadges } from "../hooks/useUnreadBadges";

// CashierWorkspace.jsx — the Cashier's mobile app shell, same AppShell
// convention as EmployeeWorkspace.jsx. Sudden Tasks, Chat, Home, and
// Profile are identical to the Worker experience (SuddenTasksSection/
// AttendanceSection/LeaveRequestSection were always shared); only the
// Activity tab's content differs (Cleaning + Price Report instead of
// Expired Items/Shelf Labels/Facing/Refilling — see CashierActivityTab.jsx).
export default function CashierWorkspace({ employeeId, onLogout }) {
  const [activeTab, setActiveTab] = useState("home");
  const { notifUnread, chatUnread } = useUnreadBadges();

  const tabs = [
    { key: "home", label: "Home", icon: Home, badge: notifUnread > 0 ? notifUnread : undefined, content: <HomeTab onNavigate={setActiveTab} /> },
    { key: "tasks", label: "Tasks", icon: ClipboardList, content: <SuddenTaskListScreen /> },
    { key: "activity", label: "Activity", icon: LayoutGrid, content: <CashierActivityTab /> },
    { key: "chat", label: "Chat", icon: MessageCircle, badge: chatUnread > 0 ? chatUnread : undefined, content: <ChatListScreen currentEmployeeId={employeeId} /> },
    { key: "profile", label: "Profile", icon: UserCircle2, content: <ProfileTab onLogout={onLogout} /> },
  ];

  return <AppShell tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />;
}
