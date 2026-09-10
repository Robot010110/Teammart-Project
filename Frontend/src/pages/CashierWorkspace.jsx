import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, ClipboardList, LayoutGrid, MessageCircle, UserCircle2 } from "lucide-react";
import AppShell from "../components/employee/AppShell";
import HomeTab from "../components/employee/HomeTab";
import SuddenTaskListScreen from "../components/employee/SuddenTaskListScreen";
import SuddenTaskDetailRoute from "../components/employee/SuddenTaskDetailRoute";
import CashierActivityTab from "../components/employee/CashierActivityTab";
import ChatListScreen from "../components/employee/ChatListScreen";
import ConversationRoute from "../components/employee/ConversationRoute";
import ProfileTab from "../components/employee/ProfileTab";
import CommunicationDetailScreen from "../components/employee/CommunicationDetailScreen";
import { useUnreadBadges } from "../hooks/useUnreadBadges";

const BASE_PATH = "/cashier";

// CashierWorkspace.jsx — the Cashier's mobile app shell, same
// route-driven AppShell convention as EmployeeWorkspace.jsx. Sudden
// Tasks, Chat, Home, and Profile are identical to the Worker experience;
// only the Activity tab's content differs (Cleaning + Price Report
// instead of Expired Items/Shelf Labels/Facing/Refilling — see
// CashierActivityTab.jsx).
export default function CashierWorkspace({ employeeId, onLogout }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifUnread, chatUnread } = useUnreadBadges();

  const tabs = [
    { key: "home", label: t("emp.navHome"), icon: Home, badge: notifUnread > 0 ? notifUnread : undefined },
    { key: "tasks", label: t("emp.navTasks"), icon: ClipboardList },
    { key: "activity", label: t("emp.activity"), icon: LayoutGrid },
    { key: "chat", label: t("emp.chat"), icon: MessageCircle, badge: chatUnread > 0 ? chatUnread : undefined },
    { key: "profile", label: t("emp.navProfile"), icon: UserCircle2 },
  ];

  return (
    <Routes>
      <Route element={<AppShell tabs={tabs} basePath={BASE_PATH} showNotificationBell />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<HomeTab basePath={BASE_PATH} onNavigate={(tab) => navigate(`${BASE_PATH}/${tab}`)} />} />
        <Route path="tasks" element={<SuddenTaskListScreen basePath={BASE_PATH} />} />
        <Route path="tasks/:taskId" element={<SuddenTaskDetailRoute basePath={BASE_PATH} />} />
        <Route path="activity" element={<CashierActivityTab />} />
        <Route path="communications/:id" element={<CommunicationDetailScreen basePath={BASE_PATH} />} />
        <Route path="chat" element={<ChatListScreen currentEmployeeId={employeeId} basePath={BASE_PATH} />} />
        <Route path="chat/:conversationId" element={<ConversationRoute currentEmployeeId={employeeId} basePath={BASE_PATH} />} />
        <Route path="profile/*" element={<ProfileTab onLogout={onLogout} basePath={`${BASE_PATH}/profile`} />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Route>
    </Routes>
  );
}
