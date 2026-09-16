import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AionSplash from "./components/auth/AionSplash";
import EmployeeWorkspace from "./pages/EmployeeWorkspace";
import CashierWorkspace from "./pages/CashierWorkspace";
import SupervisorWorkspace from "./pages/SupervisorWorkspace";
import RegionalManagerWorkspace from "./pages/RegionalManagerWorkspace";
import AdminWorkspace from "./pages/AdminWorkspace";
import { isAuthenticated, logout as clearEmployeeToken } from "./services/authService";
import { getProfile, updateMyPreferences } from "./services/profileService";
import { applyProfileLanguage, consumeExplicitLanguageChoice, TAG_TO_API } from "./i18n";
import i18n from "./i18n";
import { listMarkets } from "./services/marketService";
import { onUnauthorized } from "./services/apiClient";
import { initialsOf } from "./utils/initials";
import ErrorBoundary from "./components/common/ErrorBoundary";

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
//   /admin/*     -> <AdminWorkspace />             (Admin)
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
//
// AionSplash — a one-time brand reveal, shown first on every fresh
// mount regardless of session state (see the `splashDone` gate below,
// and AionSplash.jsx's own comment on why it never replays on in-app
// navigation). Purely presentational — it never touches session/auth.

function AppRoutes() {
  const [session, setSession] = useState(null);
  const [restoringSession, setRestoringSession] = useState(true);
  // AionSplash — the brand reveal shown before anything else, on every
  // fresh mount of <App> (a real page load), independent of whether a
  // saved session turns out to be valid. Session restoration below still
  // runs concurrently in the background during the splash (it's its own
  // effect, not gated by this state), so by the time the splash
  // finishes there's rarely an extra "Loading..." flash afterward. Once
  // true, this never flips back — logging out and returning to /login
  // within the same tab doesn't remount <App>, so the splash correctly
  // never replays for that (see AionSplash.jsx's own comment).
  const [splashDone, setSplashDone] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (newSession) => {
    setSession(newSession);
    if (newSession.role === "admin") navigate("/admin", { replace: true });
    else if (newSession.role === "regionalManager") navigate("/rm", { replace: true });
    else if (newSession.role === "supervisor") navigate("/supervisor", { replace: true });
    else if (newSession.employeeRole === "CASHIER") navigate("/cashier", { replace: true });
    else navigate("/me", { replace: true });

    // Reconcile the pre-login language with the account's saved one —
    // see i18n/index.js's own comment on consumeExplicitLanguageChoice
    // for why intent (not just "what's currently showing") decides which
    // one wins. Fire-and-forget either way: this must never block or
    // fail the login itself.
    if (consumeExplicitLanguageChoice()) {
      // The person actively picked a language on the login screen this
      // visit — that choice already IS the current UI language (the
      // toggle applied it immediately), so there is nothing to change
      // here. Only sync it up to the account so it follows them to
      // other devices too, exactly like changing it in Settings would.
      updateMyPreferences({ language: TAG_TO_API[i18n.language] }).catch(() => {
        // Non-fatal — the choice still holds for this session via the
        // localStorage mirror; it just won't have synced to the account
        // this time. Settings offers the same change again later.
      });
    } else {
      // Nobody touched the toggle — whatever language is showing is
      // just ambient state (the localStorage mirror or the "en"
      // default), not a real choice, so the account's own saved
      // preference is what should actually decide it. This lands a beat
      // after the workspace itself mounts (its own first-load requests
      // are already in flight), so a person whose account is set to a
      // different language than what's currently showing sees a brief,
      // self-correcting flip rather than an instant switch — the same
      // trade-off the existing page-reload session-restore path already
      // makes below, just without its "Loading…" gate.
      getProfile()
        .then((profile) => applyProfileLanguage(profile.language))
        .catch(() => {
          // Non-fatal — worst case the pre-login language stays showing,
          // which is still a language the person has actually used.
        });
    }
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
        // The account carries the language preference, so apply it as
        // soon as the profile lands: before this point the app was using
        // the local mirror (all a logged-out visitor can have).
        applyProfileLanguage(profile.language);
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
            loginId: profile.loginId,
            marketId: profile.marketId,
            zoneId: profile.zoneId,
            marketName,
            // Overlooking Supervisor covers the market's later coverage —
            // shown via the shared ShiftBadge (Shift System Cleanup: no
            // "Evening" anymore, so this reads as NIGHT).
            shift: isOverlooking ? "NIGHT" : "MORNING",
            // A translation KEY, not display text — the session outlives any
            // language switch, so resolving it here would freeze the title in
            // whatever language was active at login. SupervisorProfileCard
            // resolves it at render instead.
            titleKey: isOverlooking ? "roles.overlooking" : "roles.supervisor",
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
        } else if (profile.kind === "staff" && profile.role === "ADMIN") {
          setSession({
            role: "admin",
            staffId: profile.id,
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

  if (!splashDone) {
    return <AionSplash onComplete={() => setSplashDone(true)} />;
  }

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

  if (session.role === "admin") {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/login" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/*" element={<AdminWorkspace session={session} onLogout={handleLogout} />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
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

// ErrorBoundary sits OUTSIDE BrowserRouter deliberately — it's the
// last-resort net for a render crash anywhere in the app, including one
// thrown by routing itself. It only catches render errors; failed API
// calls keep their existing per-screen handling (ErrorBanner/ApiError).
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
