import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { useAsync } from "../../hooks/useAsync";
import { getEmployee } from "../../services/staffEmployeeService";
import EmployeeInfoScreen from "./EmployeeInfoScreen";
import EmployeeAttendanceScreen from "./EmployeeAttendanceScreen";
import EmployeeActivityHistoryScreen from "./EmployeeActivityHistoryScreen";
import EmployeeTasksSection from "./EmployeeTasksSection";

// SupervisorEmployeeProfileRoute.jsx — route wrapper for
// "employees/:employeeId/*". Fetches the employee once and shares it
// across Info/Tasks (both need the name); Attendance/History fetch their
// own market-scoped data independently (they always have). Info,
// Attendance, Tasks, and History (and History's own :category calendar)
// are each a real nested route now instead of a local `screen` string —
// this is the exact "Employees -> Employee Details -> deeper activity
// screen -> Back" chain the routing spec uses as its acceptance example.
export default function SupervisorEmployeeProfileRoute({ basePath }) {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const employeeBase = `${basePath}/employees/${employeeId}`;

  const { data: employee, setData: setEmployee, error, loading, reload } = useAsync(
    () => getEmployee(employeeId),
    { deps: [employeeId], fallbackError: "Could not load this employee." }
  );

  const goToInfo = () => navigate(employeeBase);

  return (
    <Routes>
      <Route
        index
        element={
          <EmployeeInfoScreen
            employee={employee}
            setEmployee={setEmployee}
            loading={loading}
            error={error}
            reload={reload}
            onBack={() => navigate(`${basePath}/employees`)}
            onOpenAttendance={() => navigate(`${employeeBase}/attendance`)}
            onOpenTasks={() => navigate(`${employeeBase}/tasks`)}
            onOpenHistory={() => navigate(`${employeeBase}/history`)}
          />
        }
      />
      <Route path="attendance" element={<EmployeeAttendanceScreen employeeId={employeeId} onBack={goToInfo} />} />
      <Route
        path="tasks"
        element={<EmployeeTasksSection employeeId={employeeId} employeeName={employee?.name} onBack={goToInfo} />}
      />
      <Route
        path="history/*"
        element={<EmployeeActivityHistoryScreen employeeId={employeeId} onBack={goToInfo} basePath={`${employeeBase}/history`} />}
      />
    </Routes>
  );
}
