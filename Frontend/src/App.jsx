import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import EmployeeWorkspace from "./pages/EmployeeWorkspace";
import CashierWorkspace from "./pages/CashierWorkspace";
import SupervisorWorkspace from "./pages/SupervisorWorkspace";
import RegionalManagerWorkspace from "./pages/RegionalManagerWorkspace";
import { isAuthenticated, logout as clearEmployeeToken } from "./services/authService";
import { getProfile } from "./services/profileService";
import { listMarkets } from "./services/marketService";
import { onUnauthorized } from "./services/apiClient";
import { initialsOf } from "./utils/initials";

// App.jsx — root shell, driven by real browser history
// (react-router-dom's BrowserRouter) instead of plain React state. Every
// screen that used to be reached by flipping a `page`/`activeTab` string
// now has a real URL, so the Android/browser Back button walks back
// through the screens the user actually visited instead of leaving the
// app immediately — see AppShell.jsx (mobile workspaces) and
// RegionalManagerWorkspace.jsx (RM's desktop drill-down) for how each
// drill-down became a route.
//
// Route map:
//   /login       -> <LoginPage />
//   /rm/*        -> <RegionalManagerWorkspace />  (Regional Manager)
//   /me/*        -> <EmployeeWorkspace />         (Employee/Worker)
//   /cashier/*   -> <CashierWorkspace />           (Employee/Cashier)
//   /supervisor/* -> <SupervisorWorkspace />       (Supervisor/Overlooking)
//
// A route is not an authorization boundary — every one of these screens
// still only renders once `session` (derived from a real backend
// call/token, see the restore effect below) says the caller is allowed
// to see it, and every API call the resulting screens make is re-checked
// server-side (staffCanAccessMarket/assertMarketAccess/
// requireAccessibleEmployee) regardless of what URL got them there.
//
// Session persistence: every role (Employee, Cashier, Supervisor, and
// now Regional Manager) has real backend login, so every one of them
// survives a page refresh — the JWT is saved by authService (see
// services/apiClient.js), and on first mount we ask the backend "who
// does this token belong to?" (GET /api/profile) instead of trusting
// anything stored client-side about who the user is.

function AppRoutes() {
  const [session, setSession] = useState(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const navigate = useNavigate();

  const handleLogin = (newSession) => {
    setSession(newSession);
    if (newSession.role === "regionalManager") navigate("/rm", { replace: true });
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
        } else if (profile.kind === "staff" && (profile.role === "SUPERVISOR" || profile.role === "OVERLOOKING_SUPERVISOR")) {
          // Supervisor and Overlooking are real, distinct accounts now
          // (see LoginPage.jsx) — profile.role IS which one this is,
          // recovered correctly on every refresh rather than defaulted.
          let marketName = null;
          try {
            const [market] = await listMarkets();
            marketName = market?.name ?? null;
          } catch {
            // Non-fatal — see the same fallback in LoginPage.jsx.
          }
          const isOverlooking = profile.role === "OVERLOOKING_SUPERVISOR";
          setSession({
            role: "supervisor",
            staffRole: profile.role,
            staffId: profile.id,
            marketId: profile.marketId,
            zoneId: profile.zoneId,
            marketName,
            shift: isOverlooking ? "EVENING" : "MORNING",
            title: isOverlooking ? "Overlooking" : "Supervisor",
            displayName: profile.name,
            initials: initialsOf(profile.name),
          });
        } else if (profile.kind === "staff" && profile.role === "REGIONAL_MANAGER") {
          setSession({
            role: "regionalManager",
            staffId: profile.id,
            zoneIds: profile.zoneIds,
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
    // No outer <Header/> here — AppShell (rendered inside
    // EmployeeWorkspace/CashierWorkspace) is this role's actual shell and
    // already renders its own top bar with the real, working notification
    // bell (see AppShell.jsx). This block used to also render the
    // desktop-style <Header/> (a second TEAMMART logo + a permanently
    // non-functional bell, notificationCount hardcoded to 0) on top of
    // it, producing two stacked headers on every Employee/Cashier screen.
    const isCashier = session.employeeRole === "CASHIER";
    return (
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
      <Route path="/" element={<Navigate to="/rm" replace />} />
      <Route path="/login" element={<Navigate to="/rm" replace />} />
      <Route path="/rm/*" element={<RegionalManagerWorkspace session={session} onLogout={handleLogout} />} />
      <Route path="*" element={<Navigate to="/rm" replace />} />
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
