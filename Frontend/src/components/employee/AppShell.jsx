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
// Global Visual System Evolution — the page background moved from a
// near-black neutral (#1A1A1A) to a deep midnight navy (#050A18), the
// same base tone Home's Performance card already established (see
// PerformanceAtmosphere.jsx). Set once here, this single change is what
// makes every screen (Home/Tasks/Activity/Chat/Profile all mount
// through this one shell) share the same environment — the "hierarchy"
// the brief asks for (deepest navy = page, lighter navy = cards, still
// lighter = chrome like the top bar/BottomNav) needs no further edits
// per page, since every existing card already uses a lighter #171C2E/
// #1A1F33 surface that now reads correctly against this darker base.
//
// The two fixed ambient glow blobs below are the single "living
// background" layer shared by every screen this shell renders. Purely
// decorative, `pointer-events-none`, slow-looping (same
// `animate-ambient-drift` keyframe used on Home's hero card), and
// disabled under prefers-reduced-motion via that class's own index.css
// rule — never interferes with scrolling or tap targets.
//
// tabs: [{ key, label, icon: LucideIcon, badge?: number }] — no `content`
// anymore; each tab's screen is a nested <Route path={key}> the caller
// defines, matching the URL instead of being picked by local state.
export default function AppShell({ tabs, basePath, showNotificationBell = false, selfHeaderedRoutes = [] }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Active tab = the one whose path segment prefixes the current URL, so
  // a drill-down route like /me/tasks/abc123 still highlights "Tasks".
  const activeTab = tabs.find((t) => location.pathname.startsWith(`${basePath}/${t.key}`))?.key ?? tabs[0]?.key;

  // selfHeaderedRoutes — absolute paths whose screen renders its OWN
  // header, so this shell suppresses its top bar rather than stacking a
  // second one above it. Currently just Performance, which is reached
  // from Profile as a destination (not a tab) and is deliberately
  // branded with a CENTERED wordmark — having this shell's left-aligned
  // logo on screen at the same time would defeat that entirely.
  //
  // Defaults to [] so every existing caller (Cashier, Supervisor,
  // Regional Manager, Admin) is completely unaffected. The bottom nav is
  // never suppressed — only the top bar — so tab navigation and its
  // active state stay exactly as they are on every screen.
  const isSelfHeadered = selfHeaderedRoutes.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
  );

  return (
    <div className="relative min-h-screen flex flex-col bg-[#050A18] overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -right-20 w-80 h-80 rounded-full bg-[#F47A20]/[0.07] blur-3xl animate-ambient-drift" />
        <div className="absolute top-1/2 -left-24 w-80 h-80 rounded-full bg-[#1D2D5C]/50 blur-3xl animate-ambient-drift" style={{ animationDelay: "-4.5s" }} />
      </div>

      {showNotificationBell && !isSelfHeadered && (
        <div className="relative sticky top-0 z-20 h-14 flex items-center justify-between px-4 sm:px-6 bg-[#050A18]/85 backdrop-blur-xl border-b border-white/[0.05]">
          {/* Cleanup Phase §9 — logo click -> homepage, reusing the exact
              same routing this shell already does for a bottom-nav tab
              switch (navigate to `${basePath}/<tab>`), not a second
              navigation mechanism. */}
          <button type="button" onClick={() => navigate(`${basePath}/${tabs[0]?.key ?? "home"}`)} className="rounded-lg -m-1 p-1 hover:opacity-80 transition-opacity" aria-label="Go to homepage">
            <Logo withSubtitle={false} />
          </button>
          <NotificationBell basePath={basePath} />
        </div>
      )}
      <div className="relative flex-1 overflow-y-auto pb-28">
        <Outlet />
      </div>
      <BottomNav tabs={tabs} activeTab={activeTab} onSelect={(key) => navigate(`${basePath}/${key}`)} />
    </div>
  );
}
