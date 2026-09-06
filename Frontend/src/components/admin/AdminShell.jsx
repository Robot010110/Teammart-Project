import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import AdminSidebar, { ADMIN_NAV, isNavActive } from "./AdminSidebar";
import NotificationBell from "../employee/NotificationBell";

// AdminShell.jsx — the Admin workspace frame: a persistent left rail on
// desktop, a compact top bar, and the active page in the content well.
//
// Deliberately NOT the shared AppShell/BottomNav every other role uses.
// Employee/Cashier/Supervisor/Regional Manager are phone-first products;
// Admin is an organization-wide desktop workspace, so it gets a sidebar
// and the full width of the screen. The rail collapses into a drawer
// below `lg` so the panel stays usable on a tablet or phone without
// turning into the Employee tab bar.
//
// The ambient glow layer matches the rest of the app's environment (see
// AppShell.jsx) so Admin still reads as the same product.
export default function AdminShell({ session }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on navigation — otherwise it stays over the page
  // the user just chose.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const current = ADMIN_NAV.find((item) => isNavActive(item, location.pathname));

  return (
    <div className="relative min-h-screen bg-[#050A18]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 right-1/4 h-80 w-80 rounded-full bg-[#F47A20]/[0.06] blur-3xl animate-ambient-drift" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#1D2D5C]/40 blur-3xl animate-ambient-drift" style={{ animationDelay: "-4.5s" }} />
      </div>

      <AdminSidebar session={session} pathname={location.pathname} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="relative lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/[0.05] bg-[#050A18]/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-[#C4C9D6] transition-colors hover:text-white lg:hidden"
            >
              <Menu size={17} />
            </button>
            <h1 className="truncate font-display text-[16px] font-semibold text-white">{current?.label ?? "Admin"}</h1>
          </div>
          <NotificationBell basePath="/admin" />
        </header>

        <main className="px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
