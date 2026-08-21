import {
  LayoutGrid,
  Store,
  Users,
  MessageCircle,
  BarChart3,
  Settings,
} from "lucide-react";

// Sidebar.jsx
// Ships collapsed (icon rail) and expands on hover, per the brief.
// "Dashboard" (Regional Manager Profile), "Markets", "Employees" (spec
// §3/§16 — the RM's own global roster across every market they manage,
// not just the per-market drill-down under Markets), and "Chat" (spec
// §9/§16) are wired up; Reports/Settings remain placeholders for a
// future pass (each market's own Reports sub-page already exists under
// Markets -> a market -> Reports/Problems, this is only the top-level
// standalone Reports page).
const NAV_ITEMS = [
  { key: "dashboard", label: "Profile", icon: LayoutGrid, active: true, roles: ["regionalManager", "supervisor"] },
  { key: "markets", label: "Markets", icon: Store, active: true, roles: ["regionalManager", "supervisor"] },
  { key: "employees", label: "Employees", icon: Users, active: true, roles: ["regionalManager", "supervisor"] },
  { key: "chat", label: "Chat", icon: MessageCircle, active: true, roles: ["regionalManager"] },
  { key: "reports", label: "Reports", icon: BarChart3, active: false, roles: ["regionalManager", "supervisor"] },
  { key: "settings", label: "Settings", icon: Settings, active: false, roles: ["regionalManager", "supervisor"] },
];

export default function Sidebar({ currentPage, onNavigate, role = "regionalManager" }) {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      className="group fixed left-0 top-0 z-40 h-screen w-[68px] hover:w-56
                 bg-[#15192A]/95 backdrop-blur-xl border-r border-white/5
                 transition-[width] duration-300 ease-out overflow-hidden
                 hidden md:flex md:flex-col"
    >
      <div className="h-16 flex items-center px-5 border-b border-white/5">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center shrink-0">
          <span className="text-white font-display font-extrabold text-xs">TM</span>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {items.map(({ key, label, icon: Icon, active }) => {
          const isCurrent =
            key === "dashboard"
              ? currentPage === "dashboard"
              : key === "markets"
              ? ["markets", "market", "employee"].includes(currentPage)
              : currentPage === key;
          return (
            <button
              key={key}
              disabled={!active}
              onClick={() => active && onNavigate(key)}
              title={label}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200
                ${isCurrent
                  ? "bg-[#F47A20]/15 text-[#F47A20]"
                  : active
                  ? "text-[#B7BDCB] hover:bg-white/5 hover:text-white"
                  : "text-[#4C5266] cursor-not-allowed"}
              `}
            >
              <Icon size={20} strokeWidth={1.8} className="shrink-0" />
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {label}
              </span>
              {!active && (
                <span className="ml-auto text-[10px] uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
