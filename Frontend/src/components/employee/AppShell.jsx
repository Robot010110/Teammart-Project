import BottomNav from "./BottomNav";

// AppShell.jsx — the mobile app shell: renders the active bottom-nav
// tab's content and renders BottomNav fixed to the bottom. Controlled by
// the caller (EmployeeWorkspace / CashierWorkspace own `activeTab` as
// plain React state — no router, this app has never used one, see
// App.jsx) so a tile inside one tab (e.g. Home's Sudden Tasks count) can
// switch tabs by calling the same `onTabChange` the nav bar uses. `tabs`
// is built by the caller since Activity-tab content differs by role — the
// shell itself stays role-agnostic.
//
// tabs: [{ key, label, icon: LucideIcon, badge?: number, content: ReactNode }]
export default function AppShell({ tabs, activeTab, onTabChange }) {
  const active = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#1A1A1A]">
      <div className="flex-1 overflow-y-auto pb-24">{active?.content}</div>
      <BottomNav tabs={tabs} activeTab={active?.key} onSelect={onTabChange} />
    </div>
  );
}
