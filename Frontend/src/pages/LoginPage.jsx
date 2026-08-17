import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Logo from "../components/common/Logo";
import RoleCard from "../components/auth/RoleCard";
import EmployeeTypeStep from "../components/auth/EmployeeTypeStep";
import SupervisorShiftStep from "../components/auth/SupervisorShiftStep";
import SupervisorEmailStep from "../components/auth/SupervisorEmailStep";
import EmployeeCodeStep from "../components/auth/EmployeeCodeStep";
import CashierUsernameStep from "../components/auth/CashierUsernameStep";
import PasswordStep from "../components/auth/PasswordStep";
import { ROLE_OPTIONS } from "../data/auth";
import { employeeLogin, cashierLogin, staffLogin } from "../services/authService";
import { listMarkets } from "../services/marketService";
import { ApiError } from "../services/apiClient";
import { initialsOf } from "../utils/initials";

// LoginPage.jsx — role -> (sub-step depending on role) -> identifier -> password -> session.
//
// Every role now authenticates against the real backend: Employee via
// POST /api/auth/employee-login / cashier-login, Supervisor and Regional
// Manager both via the same POST /api/auth/login every staff role uses.
// A Regional Manager's assigned zones/market count are never picked in
// the UI — they come entirely from the account (User.managedZones on the
// backend, returned as zoneIds), same convention as a Supervisor's
// market. Supervisor/Overlooking are the same backend SUPERVISOR
// account; "Overlooking" is purely a shift label chosen here (User has
// no shift column) — see SupervisorShiftStep.jsx.

const STEP_ROLE = "role";
const STEP_EMPLOYEE_TYPE = "employeeType";
const STEP_SHIFT = "shift"; // Supervisor only
const STEP_LOCATION = "location";
const STEP_PASSWORD = "password";

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState(STEP_ROLE);
  const [role, setRole] = useState(null);
  const [employeeType, setEmployeeType] = useState(null); // "worker" | "cashier"
  const [supervisorShift, setSupervisorShift] = useState(null); // "MORNING" | "EVENING"
  const [email, setEmail] = useState(null); // Supervisor / Regional Manager
  const [employeeCode, setEmployeeCode] = useState(null);
  const [username, setUsername] = useState(null);
  const [loginError, setLoginError] = useState(null);

  const roleLabel = ROLE_OPTIONS.find((r) => r.key === role)?.label;

  const chooseRole = (key) => {
    setRole(key);
    if (key === "employee") setStep(STEP_EMPLOYEE_TYPE);
    else if (key === "supervisor") setStep(STEP_SHIFT);
    else setStep(STEP_LOCATION);
  };

  const chooseEmployeeType = (type) => { setEmployeeType(type); setStep(STEP_LOCATION); };
  const chooseSupervisorShift = (shift) => { setSupervisorShift(shift); setStep(STEP_LOCATION); };
  const chooseEmail = (e) => { setEmail(e); setStep(STEP_PASSWORD); };
  const chooseEmployeeCode = (code) => { setEmployeeCode(code); setStep(STEP_PASSWORD); };
  const chooseUsername = (u) => { setUsername(u); setStep(STEP_PASSWORD); };

  const resetAll = () => {
    setStep(STEP_ROLE);
    setRole(null);
    setEmployeeType(null);
    setSupervisorShift(null);
    setEmail(null);
    setEmployeeCode(null);
    setUsername(null);
  };

  const goBack = () => {
    if (step === STEP_PASSWORD) setStep(STEP_LOCATION);
    else if (step === STEP_LOCATION) {
      if (role === "employee") { setStep(STEP_EMPLOYEE_TYPE); setEmployeeCode(null); setUsername(null); }
      else if (role === "supervisor") { setStep(STEP_SHIFT); setEmail(null); }
      else { setEmail(null); resetAll(); }
    } else if (step === STEP_SHIFT) resetAll();
    else if (step === STEP_EMPLOYEE_TYPE) resetAll();
  };

  const submitPassword = async (password, rememberMe = false) => {
    setLoginError(null);

    if (role === "employee" && employeeType === "worker") {
      try {
        const employee = await employeeLogin(employeeCode, password, rememberMe);
        onLogin({
          role,
          employeeRole: employee.role,
          employeeId: employee.id,
          marketId: employee.marketId,
          displayName: employee.name,
          initials: initialsOf(employee.name),
        });
        return true;
      } catch (err) {
        setLoginError(err instanceof ApiError ? err.message : "Could not log in. Please try again.");
        return false;
      }
    }

    if (role === "employee" && employeeType === "cashier") {
      try {
        const employee = await cashierLogin(username, password, rememberMe);
        onLogin({
          role,
          employeeRole: employee.role,
          employeeId: employee.id,
          marketId: employee.marketId,
          displayName: employee.name,
          initials: initialsOf(employee.name),
        });
        return true;
      } catch (err) {
        setLoginError(err instanceof ApiError ? err.message : "Could not log in. Please try again.");
        return false;
      }
    }

    if (role === "supervisor") {
      try {
        const user = await staffLogin(email, password);
        if (user.role !== "SUPERVISOR") {
          setLoginError("This account isn't a Supervisor account.");
          return false;
        }
        // The account's managed market determines everything downstream
        // (employees, activities, attendance) — never picked in the UI.
        // Market name isn't in the login response, so one extra call
        // (staff-scoped, always resolves to just this account's market).
        let marketName = null;
        try {
          const [market] = await listMarkets();
          marketName = market?.name ?? null;
        } catch {
          // Non-fatal — the workspace can still function without a
          // display name for the market; it'll just show a fallback.
        }
        onLogin({
          role,
          staffId: user.id,
          marketId: user.marketId,
          zoneId: user.zoneId,
          marketName,
          shift: supervisorShift,
          title: supervisorShift === "EVENING" ? "Overlooking" : "Supervisor",
          displayName: user.name,
          initials: initialsOf(user.name),
        });
        return true;
      } catch (err) {
        setLoginError(err instanceof ApiError ? err.message : "Could not log in. Please try again.");
        return false;
      }
    }

    // Regional Manager — real backend auth (POST /api/auth/login), same
    // endpoint as Supervisor. Assigned zones/markets come entirely from
    // the account (User.managedZones -> zoneIds), never picked in the UI.
    if (role === "regionalManager") {
      try {
        const user = await staffLogin(email, password);
        if (user.role !== "REGIONAL_MANAGER") {
          setLoginError("This account isn't a Regional Manager account.");
          return false;
        }
        onLogin({
          role,
          staffId: user.id,
          zoneIds: user.zoneIds,
          displayName: user.name,
          initials: initialsOf(user.name),
        });
        return true;
      } catch (err) {
        setLoginError(err instanceof ApiError ? err.message : "Could not log in. Please try again.");
        return false;
      }
    }

    return false;
  };

  const summary = [
    { label: "Role", value: roleLabel },
    ...(role === "supervisor" ? [{ label: "Shift", value: supervisorShift === "EVENING" ? "Overlooking (Evening)" : "Supervisor (Morning)" }] : []),
    ...(role === "supervisor" || role === "regionalManager" ? [{ label: "Email", value: email }] : []),
    ...(role === "employee" && employeeType === "worker" ? [{ label: "Employee Code", value: employeeCode }] : []),
    ...(role === "employee" && employeeType === "cashier" ? [{ label: "Username", value: username }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center px-6 py-12">
      <div className="mb-10"><Logo /></div>

      <div className="w-full max-w-2xl">
        {step !== STEP_ROLE && (
          <button
            onClick={goBack}
            className="mb-6 flex items-center gap-1.5 text-sm text-[#8B93A8] hover:text-[#F47A20] transition-colors duration-150"
          >
            <ArrowLeft size={14} /> Back
          </button>
        )}

        {step === STEP_ROLE && (
          <>
            <div className="text-center mb-8 animate-fade-up">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Who's logging in?</h1>
              <p className="mt-2 text-[#9AA1B4] text-sm">Select your role to see the dashboard built for you.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {ROLE_OPTIONS.map((r, i) => <RoleCard key={r.key} role={r} index={i} onSelect={chooseRole} />)}
            </div>
          </>
        )}

        {step === STEP_EMPLOYEE_TYPE && (
          <>
            <div className="text-center mb-6 animate-fade-up">
              <h2 className="font-display text-xl font-bold text-white">Worker or Cashier?</h2>
            </div>
            <EmployeeTypeStep onSelect={chooseEmployeeType} />
          </>
        )}

        {step === STEP_SHIFT && (
          <>
            <div className="text-center mb-6 animate-fade-up">
              <h2 className="font-display text-xl font-bold text-white">Supervisor or Overlooking?</h2>
              <p className="mt-2 text-[#9AA1B4] text-sm">Same account, different shift — this just sets your label in the app.</p>
            </div>
            <SupervisorShiftStep onSelect={chooseSupervisorShift} />
          </>
        )}

        {step === STEP_LOCATION && (
          <>
            <div className="text-center mb-6 animate-fade-up">
              <h2 className="font-display text-xl font-bold text-white">
                {(role === "regionalManager" || role === "supervisor") && "Enter your email"}
                {role === "employee" && employeeType === "worker" && "Enter your employee code"}
                {role === "employee" && employeeType === "cashier" && "Enter your username"}
              </h2>
            </div>
            {(role === "regionalManager" || role === "supervisor") && <SupervisorEmailStep onSelect={chooseEmail} />}
            {role === "employee" && employeeType === "worker" && <EmployeeCodeStep onSelect={chooseEmployeeCode} />}
            {role === "employee" && employeeType === "cashier" && <CashierUsernameStep onSelect={chooseUsername} />}
          </>
        )}

        {step === STEP_PASSWORD && (
          <>
            <div className="text-center mb-6 animate-fade-up">
              <h2 className="font-display text-xl font-bold text-white">Enter your password</h2>
            </div>
            <PasswordStep
              summary={summary}
              onSubmit={submitPassword}
              errorMessage={loginError}
              showRememberMe={role === "employee"}
            />
          </>
        )}
      </div>
    </div>
  );
}
