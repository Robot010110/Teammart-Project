import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Home, ClipboardList, LayoutGrid, MessageCircle, UserCircle2 } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import HomeTab from "../components/employee/HomeTab";
import SuddenTaskListScreen from "../components/employee/SuddenTaskListScreen";
import SuddenTaskDetailRoute from "../components/employee/SuddenTaskDetailRoute";
import WorkerActivityTab from "../components/employee/WorkerActivityTab";
import ChatListScreen from "../components/employee/ChatListScreen";
import ConversationRoute from "../components/employee/ConversationRoute";
import ProfileTab from "../components/employee/ProfileTab";
import { useUnreadBadges } from "../hooks/useUnreadBadges";

const BASE_PATH = "/me";

// EmployeeWorkspace.jsx — the Worker's mobile app shell: Home / Tasks /
// Activity / Chat / Profile, each a real route under /me (AppShell.jsx
// renders the active one via <Outlet/>). Tab switches and drill-downs
// (a task's detail, a chat thread, Profile's submenu) are now real
// browser history entries — Android/browser Back walks back through them
// instead of leaving the app, and a direct link/refresh to e.g.
// /me/tasks/abc123 resolves correctly instead of losing state.
export default function EmployeeWorkspace({ employeeId, onLogout }) {
  const navigate = useNavigate();
  const { notifUnread, chatUnread } = useUnreadBadges();

  const tabs = [
    { key: "home", label: "Home", icon: Home, badge: notifUnread > 0 ? notifUnread : undefined },
    { key: "tasks", label: "Tasks", icon: ClipboardList },
    { key: "activity", label: "Activity", icon: LayoutGrid },
    { key: "chat", label: "Chat", icon: MessageCircle, badge: chatUnread > 0 ? chatUnread : undefined },
    { key: "profile", label: "Profile", icon: UserCircle2 },
  ];

  return (
    <Routes>
      <Route element={<AppShell tabs={tabs} basePath={BASE_PATH} />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<HomeTab onNavigate={(tab) => navigate(`${BASE_PATH}/${tab}`)} />} />
        <Route path="tasks" element={<SuddenTaskListScreen basePath={BASE_PATH} />} />
        <Route path="tasks/:taskId" element={<SuddenTaskDetailRoute basePath={BASE_PATH} />} />
        <Route path="activity" element={<WorkerActivityTab />} />
        <Route path="chat" element={<ChatListScreen currentEmployeeId={employeeId} basePath={BASE_PATH} />} />
        <Route path="chat/:conversationId" element={<ConversationRoute currentEmployeeId={employeeId} basePath={BASE_PATH} />} />
        <Route path="profile/*" element={<ProfileTab onLogout={onLogout} basePath={`${BASE_PATH}/profile`} />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Route>
    </Routes>
  );
}
