import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Logo from "../components/common/Logo";
import RoleCard from "../components/auth/RoleCard";
import ZonePicker from "../components/auth/ZonePicker";
import MarketPicker from "../components/auth/MarketPicker";
import EmployeeCodeStep from "../components/auth/EmployeeCodeStep";
import PasswordStep from "../components/auth/PasswordStep";
import { ROLE_OPTIONS, regionalManagerPassword, validateLogin, SUPERVISOR_DEMO_PASSWORD } from "../data/auth";
import { employeeLogin } from "../services/authService";
import { ApiError } from "../services/apiClient";
import { initialsOf } from "../utils/initials";

// LoginPage.jsx — role -> location (if applicable) -> password -> session.
//
// Regional Manager and Supervisor still use the prototype's hardcoded
// passwords (see data/auth.js) — that's Manager/Supervisor work, out of
// scope for this phase. Employee login is now real: it calls the backend
// (POST /api/auth/employee-login) instead of checking a shared demo
// password against mock data.

const STEP_ROLE = "role";
const STEP_LOCATION = "location";
const STEP_PASSWORD = "password";

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState(STEP_ROLE);
  const [role, setRole] = useState(null);
  const [zone, setZone] = useState(null);
  const [market, setMarket] = useState(null);
  const [employeeCode, setEmployeeCode] = useState(null);
  const [loginError, setLoginError] = useState(null);

  const roleLabel = ROLE_OPTIONS.find((r) => r.key === role)?.label;

  const chooseRole = (key) => {
    setRole(key);
    setStep(STEP_LOCATION);
  };

  const chooseZone = (z) => { setZone(z); setStep(STEP_PASSWORD); };
  const chooseMarket = (m) => { setMarket(m); setStep(STEP_PASSWORD); };
  const chooseEmployeeCode = (code) => { setEmployeeCode(code); setStep(STEP_PASSWORD); };

  const goBack = () => {
    if (step === STEP_PASSWORD) setStep(STEP_LOCATION);
    else if (step === STEP_LOCATION) { setStep(STEP_ROLE); setRole(null); setZone(null); setMarket(null); setEmployeeCode(null); }
  };

  const submitPassword = async (password) => {
    setLoginError(null);

    if (role === "employee") {
      try {
        const employee = await employeeLogin(employeeCode, password);
        onLogin({ role, employeeId: employee.id, marketId: employee.marketId, displayName: employee.name, initials: initialsOf(employee.name) });
        return true;
      } catch (err) {
        setLoginError(err instanceof ApiError ? err.message : "Could not log in. Please try again.");
        return false;
      }
    }

    // Regional Manager / Supervisor — unchanged prototype flow.
    const ok = validateLogin({
      role,
      zoneId: zone?.id,
      marketId: market?.id,
      password,
    });
    if (!ok) return false;

    if (role === "regionalManager") {
      onLogin({ role, zoneId: zone.id, displayName: zone.manager, initials: initialsOf(zone.manager) });
    } else if (role === "supervisor") {
      onLogin({ role, marketId: market.id, zoneId: market.zoneId, displayName: `${market.name} Supervisor`, initials: initialsOf(market.name) });
    }
    return true;
  };

  const summary = [
    { label: "Role", value: roleLabel },
    ...(role === "regionalManager" ? [{ label: "Zone", value: `Zone ${zone?.number}` }] : []),
    ...(role === "supervisor" ? [{ label: "Market", value: market?.name }] : []),
    ...(role === "employee" ? [{ label: "Employee Code", value: employeeCode }] : []),
  ];

  const hint =
    role === "regionalManager" && zone ? regionalManagerPassword(zone.number) :
    role === "supervisor" ? SUPERVISOR_DEMO_PASSWORD : null;

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

        {step === STEP_LOCATION && (
          <>
            <div className="text-center mb-6 animate-fade-up">
              <h2 className="font-display text-xl font-bold text-white">
                {role === "regionalManager" && "Which zone do you manage?"}
                {role === "supervisor" && "Which market are you responsible for?"}
                {role === "employee" && "Enter your employee code"}
              </h2>
            </div>
            {role === "regionalManager" && <ZonePicker onSelect={chooseZone} />}
            {role === "supervisor" && <MarketPicker onSelect={chooseMarket} />}
            {role === "employee" && <EmployeeCodeStep onSelect={chooseEmployeeCode} />}
          </>
        )}

        {step === STEP_PASSWORD && (
          <>
            <div className="text-center mb-6 animate-fade-up">
              <h2 className="font-display text-xl font-bold text-white">Enter your password</h2>
            </div>
            <PasswordStep summary={summary} hint={hint} onSubmit={submitPassword} errorMessage={loginError} />
          </>
        )}
      </div>
    </div>
  );
}
