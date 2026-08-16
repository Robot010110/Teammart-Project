import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import NotificationBell from "./NotificationBell";
import Logo from "../common/Logo";

// AppShell.jsx — the mobile app shell: a slim top bar (logo + the real
// notification bell, Employee/Cashier only — see NotificationBell.jsx's
// own comment on why Supervisor doesn't get one here), the active
// bottom-nav tab's screen (via <Outlet/> — the caller mounts this as a
// layout route with each tab as a nested <Route>, see
// EmployeeWorkspace.jsx/CashierWorkspace.jsx/SupervisorWorkspace.jsx),
// and BottomNav fixed to the bottom. Tab switches are real navigation
// (useNavigate) to a real URL under `basePath`, not local state — that's
// what makes the Android/browser Back button walk back through tabs and
// drill-down screens correctly instead of leaving the app.
//
// tabs: [{ key, label, icon: LucideIcon, badge?: number }] — no `content`
// anymore; each tab's screen is a nested <Route path={key}> the caller
// defines, matching the URL instead of being picked by local state.
export default function AppShell({ tabs, basePath, showNotificationBell = false }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Active tab = the one whose path segment prefixes the current URL, so
  // a drill-down route like /me/tasks/abc123 still highlights "Tasks".
  const activeTab = tabs.find((t) => location.pathname.startsWith(`${basePath}/${t.key}`))?.key ?? tabs[0]?.key;

  return (
    <div className="min-h-screen flex flex-col bg-[#1A1A1A]">
      {showNotificationBell && (
        <div className="sticky top-0 z-20 h-14 flex items-center justify-between px-4 sm:px-6 bg-[#1A1A1A]/85 backdrop-blur-xl border-b border-white/[0.05]">
          <Logo withSubtitle={false} />
          <NotificationBell basePath={basePath} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </div>
      <BottomNav tabs={tabs} activeTab={activeTab} onSelect={(key) => navigate(`${basePath}/${key}`)} />
    </div>
  );
}
