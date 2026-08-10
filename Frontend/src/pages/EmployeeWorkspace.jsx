import { useState } from "react";
import { Home, ClipboardList, LayoutGrid, MessageCircle, UserCircle2 } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import HomeTab from "../components/employee/HomeTab";
import SuddenTaskListScreen from "../components/employee/SuddenTaskListScreen";
import WorkerActivityTab from "../components/employee/WorkerActivityTab";
import ChatListScreen from "../components/employee/ChatListScreen";
import ProfileTab from "../components/employee/ProfileTab";
import { useUnreadBadges } from "../hooks/useUnreadBadges";

// EmployeeWorkspace.jsx — the Worker's mobile app shell: Home / Tasks /
// Activity / Chat / Profile bottom-nav tabs (AppShell.jsx), replacing the
// old single-scroll section layout. `activeTab` is lifted here (not owned
// by AppShell) so a tile inside one tab (e.g. Home's Sudden Tasks count)
// can switch tabs via the same setter the nav bar uses — still plain
// React state, no router, same convention as the rest of this app.
export default function EmployeeWorkspace({ employeeId, onLogout }) {
  const [activeTab, setActiveTab] = useState("home");
  const { notifUnread, chatUnread } = useUnreadBadges();

  const tabs = [
    { key: "home", label: "Home", icon: Home, badge: notifUnread > 0 ? notifUnread : undefined, content: <HomeTab onNavigate={setActiveTab} /> },
    { key: "tasks", label: "Tasks", icon: ClipboardList, content: <SuddenTaskListScreen /> },
    { key: "activity", label: "Activity", icon: LayoutGrid, content: <WorkerActivityTab /> },
    { key: "chat", label: "Chat", icon: MessageCircle, badge: chatUnread > 0 ? chatUnread : undefined, content: <ChatListScreen currentEmployeeId={employeeId} /> },
    { key: "profile", label: "Profile", icon: UserCircle2, content: <ProfileTab onLogout={onLogout} /> },
  ];

  return <AppShell tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />;
}
