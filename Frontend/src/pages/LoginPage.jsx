import { useState } from "react";
import RoleSelectScreen from "../components/auth/RoleSelectScreen";
import EmployeeLoginScreen from "../components/auth/EmployeeLoginScreen";
import StaffLoginScreen from "../components/auth/StaffLoginScreen";

// LoginPage.jsx — three stages: Who's logging in? -> Employee Login /
// Staff Login -> real session. Replaces the old Role -> sub-step ->
// identifier -> password wizard: each Stage-2 screen now shows its full
// credential form at once (see EmployeeLoginScreen.jsx / StaffLoginScreen.jsx
// for the real per-role backend calls each one makes).
const STAGE_ROLE = "role";
const STAGE_EMPLOYEE = "employee";
const STAGE_STAFF = "staff";

export default function LoginPage({ onLogin }) {
  const [stage, setStage] = useState(STAGE_ROLE);
  const [initialStaffRole, setInitialStaffRole] = useState("supervisor");

  function handleRoleSelect(key) {
    if (key === "employee") {
      setStage(STAGE_EMPLOYEE);
    } else {
      setInitialStaffRole(key); // admin | regionalManager | supervisor
      setStage(STAGE_STAFF);
    }
  }

  if (stage === STAGE_EMPLOYEE) {
    return <EmployeeLoginScreen onBack={() => setStage(STAGE_ROLE)} onLogin={onLogin} />;
  }

  if (stage === STAGE_STAFF) {
    return <StaffLoginScreen initialRole={initialStaffRole} onBack={() => setStage(STAGE_ROLE)} onLogin={onLogin} />;
  }

  return <RoleSelectScreen onSelect={handleRoleSelect} />;
}
