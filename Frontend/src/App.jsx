import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import LoginPage from "./pages/LoginPage";
import ZonePage from "./pages/ZonePage";
import MarketDashboard from "./pages/MarketDashboard";
import EmployeeProfile from "./pages/EmployeeProfile";
import EmployeeWorkspace from "./pages/EmployeeWorkspace";
import CashierWorkspace from "./pages/CashierWorkspace";
import SupervisorWorkspace from "./pages/SupervisorWorkspace";
import { isAuthenticated, logout as clearEmployeeToken } from "./services/authService";
import { getProfile } from "./services/profileService";
import { listMarkets } from "./services/marketService";
import { onUnauthorized } from "./services/apiClient";
import { initialsOf } from "./utils/initials";

// App.jsx — root shell, now driven by real browser history
// (react-router-dom's BrowserRouter) instead of plain React state. Every
// screen that used to be reached by flipping a `page`/`activeTab` string
// now has a real URL, so the Android/browser Back button walks back
// through the screens the user actually visited instead of leaving the
// app immediately — see AppShell.jsx (mobile workspaces) and the RM
// routes below for how each drill-down became a route.
//
// Route map:
//   /login                              -> <LoginPage />
//   /zones/:zoneId                      -> <ZonePage />               (Regional Manager)
//   /zones/:zoneId/markets/:marketId    -> <MarketDashboard />        (Regional Manager)
//   /employees/:employeeId              -> <EmployeeProfile />        (Regional Manager)
//   /me/*                               -> <EmployeeWorkspace />      (Employee/Worker)
//   /cashier/*                          -> <CashierWorkspace />       (Employee/Cashier)
//   /supervisor/*                       -> <SupervisorWorkspace />    (Supervisor/Overlooking)
//
// A route is not an authorization boundary — every one of these screens
// still only renders once `session` (derived from a real backend
// call/token, see the restore effect below) says the caller is allowed
// to see it, and every API call the resulting screens make is re-checked
// server-side (staffCanAccessMarket/assertMarketAccess/
// requireAccessibleEmployee) regardless of what URL got them there.
//
// Session persistence: only Employee and Supervisor have real backend
// logins, so only those survive a page refresh — the JWT is saved by
// authService (see services/apiClient.js), and on first mount we ask the
// backend "who does this token belong to?" (GET /api/profile) instead of
// trusting anything stored client-side about who the user is. Regional
// Manager still uses the prototype's mock login (data/auth.js, untouched
// by this routing change) and has never persisted across a refresh —
// that's a pre-existing limitation of that mock flow, not something this
// task changes.

const ROLE_LABELS = {
  regionalManager: "Regional Manager",
  supervisor: "Supervisor",
};

// RmShell — the Regional Manager's desktop Sidebar+Header+drill-down
// shell, now route-driven. zoneId/marketId/employeeId come from
// useParams() (real, refreshable, back/forward-able URL state) instead
// of a single global selectedX variable that only ever lived in memory.
function RmShell({ session, onLogout }) {
  const navigate = useNavigate();
  const goHome = () => navigate(`/zones/${session.zoneId}`);

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white font-sans antialiased">
      <Sidebar role={session.role} currentPage="zone" onNavigate={goHome} />

      <div className="md:pl-[68px]">
        <Header
          user={{ name: session.displayName, role: ROLE_LABELS[session.role], avatarInitials: session.initials }}
          onLogout={onLogout}
        />

        <main className="animate-fade-in">
          <Routes>
            <Route index element={<Navigate to={`/zones/${session.zoneId}`} replace />} />
            <Route
              path="/zones/:zoneId"
              element={
                <ZonePageRoute
                  onGoHome={goHome}
                  onOpenMarket={(market) => navigate(`/zones/${market.zoneId}/markets/${market.id}`)}
                />
              }
            />
            <Route
              path="/zones/:zoneId/markets/:marketId"
              element={
                <MarketDashboardRoute
                  role={session.role}
                  onGoHome={goHome}
                  onGoZone={(zoneId) => navigate(`/zones/${zoneId}`)}
                  onOpenEmployee={(employeeId) => navigate(`/employees/${employeeId}`)}
                />
              }
            />
            <Route
              path="/employees/:employeeId"
              element={
                <EmployeeProfileRoute
                  role={session.role}
                  onGoHome={goHome}
                  onGoZone={(zoneId) => navigate(`/zones/${zoneId}`)}
                  onGoMarket={(marketId) => navigate(`/zones/${session.zoneId}/markets/${marketId}`)}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function ZonePageRoute({ onGoHome, onOpenMarket }) {
  const { zoneId } = useParams();
  return <ZonePage zoneId={zoneId} onGoHome={onGoHome} onOpenMarket={onOpenMarket} />;
}
function MarketDashboardRoute({ role, onGoHome, onGoZone, onOpenEmployee }) {
  const { marketId } = useParams();
  return <MarketDashboard marketId={marketId} role={role} onGoHome={onGoHome} onGoZone={onGoZone} onOpenEmployee={onOpenEmployee} />;
}
function EmployeeProfileRoute({ role, onGoHome, onGoZone, onGoMarket }) {
  const { employeeId } = useParams();
  return <EmployeeProfile employeeId={employeeId} role={role} onGoHome={onGoHome} onGoZone={onGoZone} onGoMarket={onGoMarket} />;
}

function AppRoutes() {
  const [session, setSession] = useState(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const navigate = useNavigate();

  const handleLogin = (newSession) => {
    setSession(newSession);
    if (newSession.role === "regionalManager") navigate(`/zones/${newSession.zoneId}`, { replace: true });
    else if (newSession.role === "supervisor") navigate("/supervisor", { replace: true });
    else if (newSession.employeeRole === "CASHIER") navigate("/cashier", { replace: true });
    else navigate("/me", { replace: true });
  };

  const handleLogout = () => {
    clearEmployeeToken();
    setSession(null);
    navigate("/login", { replace: true });
  };

  // On first load: if a token is saved from a previous login, ask the
  // backend to confirm it's still valid and rebuild the session from
  // real data instead of logging the person out and making them log in
  // again on every page refresh. Deliberately does NOT redirect on
  // success — the current URL (e.g. a refreshed /me/activity) is left
  // alone so a valid deep link survives a refresh instead of always
  // bouncing back to a tab's root.
  useEffect(() => {
    if (!isAuthenticated()) {
      setRestoringSession(false);
      return;
    }
    getProfile()
      .then(async (profile) => {
        if (profile.kind === "employee") {
          setSession({
            role: "employee",
            employeeRole: profile.role,
            employeeId: profile.id,
            marketId: profile.market.id,
            displayName: profile.name,
            initials: initialsOf(profile.name),
          });
        } else if (profile.kind === "staff" && profile.role === "SUPERVISOR") {
          // Shift ("Supervisor"/"Overlooking") isn't persisted anywhere
          // (User has no shift column — see LoginPage.jsx) so a refresh
          // can't recover which one was chosen; defaults back to
          // Supervisor/Morning rather than asking again mid-session.
          let marketName = null;
          try {
            const [market] = await listMarkets();
            marketName = market?.name ?? null;
          } catch {
            // Non-fatal — see the same fallback in LoginPage.jsx.
          }
          setSession({
            role: "supervisor",
            staffId: profile.id,
            marketId: profile.marketId,
            zoneId: profile.zoneId,
            marketName,
            shift: "MORNING",
            title: "Supervisor",
            displayName: profile.name,
            initials: initialsOf(profile.name),
          });
        }
      })
      .catch(() => clearEmployeeToken()) // expired/invalid token — just show the login page
      .finally(() => setRestoringSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If any later request comes back 401 (token expired mid-session), drop
  // back to the login page instead of leaving the user stuck on a broken
  // screen full of failed requests. `onUnauthorized` stores its callback
  // in a module-level variable (see apiClient.js) rather than React state,
  // so the cleanup here matters: without it, a hot-reload or future
  // remount of <App> would register a second handler on top of the first.
  useEffect(() => {
    onUnauthorized(() => handleLogout());
    return () => onUnauthorized(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (restoringSession) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] grid place-items-center">
        <p className="text-sm text-[#8B93A8]">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
      </Routes>
    );
  }

  if (session.role === "employee") {
    const isCashier = session.employeeRole === "CASHIER";
    return (
      <div className="min-h-screen bg-[#1A1A1A] text-white font-sans antialiased">
        <Header
          user={{ name: session.displayName, role: isCashier ? "Cashier" : "Employee", avatarInitials: session.initials }}
          onLogout={handleLogout}
          notificationCount={0}
        />
        <Routes>
          <Route path="/" element={<Navigate to={isCashier ? "/cashier" : "/me"} replace />} />
          <Route path="/login" element={<Navigate to={isCashier ? "/cashier" : "/me"} replace />} />
          {isCashier ? (
            <Route path="/cashier/*" element={<CashierWorkspace employeeId={session.employeeId} onLogout={handleLogout} />} />
          ) : (
            <Route path="/me/*" element={<EmployeeWorkspace employeeId={session.employeeId} onLogout={handleLogout} />} />
          )}
          <Route path="*" element={<Navigate to={isCashier ? "/cashier" : "/me"} replace />} />
        </Routes>
      </div>
    );
  }

  if (session.role === "supervisor") {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/supervisor" replace />} />
        <Route path="/login" element={<Navigate to="/supervisor" replace />} />
        <Route path="/supervisor/*" element={<SupervisorWorkspace session={session} onLogout={handleLogout} />} />
        <Route path="*" element={<Navigate to="/supervisor" replace />} />
      </Routes>
    );
  }

  // Regional Manager — desktop drill-down.
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/zones/${session.zoneId}`} replace />} />
      <Route path="/login" element={<Navigate to={`/zones/${session.zoneId}`} replace />} />
      <Route path="/*" element={<RmShell session={session} onLogout={handleLogout} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
