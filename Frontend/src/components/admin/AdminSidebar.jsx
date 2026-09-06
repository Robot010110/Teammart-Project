import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Layers, CalendarCheck, FileBarChart, PackageX, Megaphone, Settings, X } from "lucide-react";

// Every entry points at a route that already exists in AdminWorkspace —
// no invented destinations. `match` lists the extra path prefixes that
// should still light this item up (Zones & Markets is one nav entry
// covering the two existing pages; People covers employee profiles).
export const ADMIN_NAV = [
  { key: "home", label: "Dashboard", icon: LayoutDashboard, to: "/admin/home" },
  { key: "employees", label: "People", icon: Users, to: "/admin/employees" },
  { key: "zones", label: "Zones & Markets", icon: Layers, to: "/admin/zones", match: ["/admin/markets"] },
  { key: "attendance", label: "Attendance", icon: CalendarCheck, to: "/admin/attendance" },
  { key: "reports", label: "Reports", icon: FileBarChart, to: "/admin/reports", match: ["/admin/activities", "/admin/audit"] },
  { key: "expired-items", label: "Expired Items", icon: PackageX, to: "/admin/expired-items" },
  { key: "communications", label: "Communication", icon: Megaphone, to: "/admin/communications", match: ["/admin/chat"] },
  { key: "settings", label: "Settings", icon: Settings, to: "/admin/settings" },
];

export function isNavActive(item, pathname) {
  const all = [item.to, ...(item.match ?? [])];
  return all.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// AdminSidebar.jsx — the Admin panel's primary navigation. Admin is a
// desktop-first workspace (unlike Employee/Supervisor/RM, which are
// phone-first and use BottomNav), so this is a persistent rail on large
// screens and a slide-in drawer below `lg`.
export default function AdminSidebar({ session, pathname, open, onClose }) {
  return (
    <>
      {/* Drawer scrim — only below lg, where the rail is not persistent. */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-white/[0.06] bg-[#0A101E]/95 backdrop-blur-xl
                    transition-transform duration-300 ease-out lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-2 px-5 pb-5 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] shadow-[0_0_16px_-2px_rgba(244,122,32,0.55)]">
              <span className="font-display text-[13px] font-extrabold tracking-tight text-white">TM</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold tracking-wide text-white">
                TEAM<span className="text-[#F47A20]">MART</span>
              </p>
              <p className="text-[8.5px] uppercase tracking-[0.16em] text-[#5C6479]">People Drive Great Markets</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#8B93A8] transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item, pathname);
            return (
              <NavLink
                key={item.key}
                to={item.to}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ${
                  active
                    ? "bg-[#F47A20]/[0.13] text-white shadow-[0_0_18px_-6px_rgba(244,122,32,0.8)]"
                    : "text-[#8B93A8] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.9)]" />}
                <Icon size={17} className={active ? "text-[#F47A20]" : ""} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Real authenticated identity — never a hardcoded "Admin User". */}
        <div className="m-3 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[11.5px] font-bold text-white ring-1 ring-white/10">
            {session?.initials ?? "AD"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">{session?.displayName ?? "Admin"}</p>
            <p className="truncate text-[10.5px] text-[#5C6479]">Administrator</p>
          </div>
        </div>
      </aside>
    </>
  );
}
