import { useEffect, useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import LoginPage from "./pages/LoginPage";
import ZonePage from "./pages/ZonePage";
import MarketDashboard from "./pages/MarketDashboard";
import EmployeeProfile from "./pages/EmployeeProfile";
import EmployeeWorkspace from "./pages/EmployeeWorkspace";
import { isAuthenticated, logout as clearEmployeeToken } from "./services/authService";
import { getProfile } from "./services/profileService";
import { onUnauthorized } from "./services/apiClient";
import { initialsOf } from "./utils/initials";

// App.jsx — root shell, now session-driven. Nobody sees an unscoped
// "pick anything" dashboard: a Regional Manager lands straight in their
// zone, a Supervisor lands straight in their market, and an Employee gets
// an entirely different, simpler workspace shell (no Sidebar at all).
//
// Navigation remains state-based (no router dependency) but still maps
// 1:1 onto real routes:
//   "/login"                            -> <LoginPage />
//   "/zones/:zoneId"                    -> <ZonePage />               (Regional Manager)
//   "/zones/:zoneId/markets/:marketId"  -> <MarketDashboard />        (Regional Manager, Supervisor)
//   "/employees/:employeeId"            -> <EmployeeProfile />        (Regional Manager, Supervisor)
//   "/me"                               -> <EmployeeWorkspace />      (Employee)
//
// Session persistence: only the Employee role has a real backend login, so
// only Employee sessions survive a page refresh. The JWT is saved by
// authService (see services/apiClient.js), and on first mount we ask the
// backend "who does this token belong to?" (GET /api/profile) instead of
// trusting anything stored client-side about who the user is — a token
// could be expired or revoked, so the backend is always the source of
// truth for whether a session is actually still valid.

const ROLE_LABELS = {
  regionalManager: "Regional Manager",
  supervisor: "Supervisor",
};

export default function App() {
  const [session, setSession] = useState(null); // { role, zoneId?, marketId?, employeeId?, displayName, initials }
  const [restoringSession, setRestoringSession] = useState(true);
  const [page, setPage] = useState("zone"); // "zone" | "market" | "employee" — only used for RM/Supervisor
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [selectedMarketId, setSelectedMarketId] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const handleLogin = (newSession) => {
    setSession(newSession);
    if (newSession.role === "regionalManager") {
      setSelectedZoneId(newSession.zoneId);
      setPage("zone");
    } else if (newSession.role === "supervisor") {
      setSelectedMarketId(newSession.marketId);
      setPage("market");
    }
    // Employee role bypasses this page state machine entirely.
  };

  const handleLogout = () => {
    clearEmployeeToken();
    setSession(null);
    setSelectedZoneId(null);
    setSelectedMarketId(null);
    setSelectedEmployeeId(null);
    setPage("zone");
  };

  // On first load: if a token is saved from a previous Employee login, ask
  // the backend to confirm it's still valid and rebuild the session from
  // real data instead of logging the person out and making them log in
  // again on every page refresh.
  useEffect(() => {
    if (!isAuthenticated()) {
      setRestoringSession(false);
      return;
    }
    getProfile()
      .then((profile) => {
        if (profile.kind === "employee") {
          setSession({
            role: "employee",
            employeeId: profile.id,
            marketId: profile.market.id,
            displayName: profile.name,
            initials: initialsOf(profile.name),
          });
        }
      })
      .catch(() => clearEmployeeToken()) // expired/invalid token — just show the login page
      .finally(() => setRestoringSession(false));
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
  }, []);

  const openZone = (zoneId) => { setSelectedZoneId(zoneId); setPage("zone"); };
  const openMarket = (marketId) => { setSelectedMarketId(marketId); setPage("market"); };
  const openEmployee = (employeeId) => { setSelectedEmployeeId(employeeId); setPage("employee"); };

  // "Home" is scoped per role: a Regional Manager's home is their own zone;
  // a Supervisor's home is their own market. Neither role has an unscoped
  // "all zones" home to return to — that's the point of role-based access.
  const goHome = () => {
    if (session?.role === "regionalManager") { setSelectedZoneId(session.zoneId); setPage("zone"); }
    else if (session?.role === "supervisor") { setSelectedMarketId(session.marketId); setPage("market"); }
  };

  // While checking a saved token against the backend, show nothing but a
  // simple loading screen rather than flashing the login page for a
  // moment and then jumping straight into the workspace.
  if (restoringSession) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] grid place-items-center">
        <p className="text-sm text-[#8B93A8]">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (session.role === "employee") {
    return (
      <div className="min-h-screen bg-[#1A1A1A] text-white font-sans antialiased">
        <Header
          user={{ name: session.displayName, role: "Employee", avatarInitials: session.initials }}
          onLogout={handleLogout}
        />
        <EmployeeWorkspace employeeId={session.employeeId} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white font-sans antialiased">
      <Sidebar role={session.role} currentPage={page} onNavigate={() => goHome()} />

      <div className="md:pl-[68px]">
        <Header
          user={{ name: session.displayName, role: ROLE_LABELS[session.role], avatarInitials: session.initials }}
          onLogout={handleLogout}
        />

        <main key={page + selectedZoneId + selectedMarketId + selectedEmployeeId} className="animate-fade-in">
          {page === "zone" && (
            <ZonePage
              zoneId={selectedZoneId}
              onGoHome={goHome}
              onOpenMarket={(market) => openMarket(market.id)}
            />
          )}

          {page === "market" && (
            <MarketDashboard
              marketId={selectedMarketId}
              role={session.role}
              onGoHome={goHome}
              onGoZone={openZone}
              onOpenEmployee={openEmployee}
            />
          )}

          {page === "employee" && (
            <EmployeeProfile
              employeeId={selectedEmployeeId}
              role={session.role}
              onGoHome={goHome}
              onGoZone={openZone}
              onGoMarket={openMarket}
            />
          )}
        </main>
      </div>
    </div>
  );
}
