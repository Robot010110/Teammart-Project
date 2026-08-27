import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { getEmployee } from "../services/staffEmployeeService";
import RmEmployeeProfile from "./RmEmployeeProfile";
import AdminEmployeeActionsPanel from "./AdminEmployeeActionsPanel";

// AdminEmployeeProfilePage.jsx — Admin Phase 1 §15: the read-only
// employee-profile foundation. Rather than a new profile screen, this
// resolves the employee's marketId (getEmployee already works for Admin
// — assertMarketAccess bypasses for ADMIN, see middleware/auth.js) and
// hands off entirely to RmEmployeeProfile.jsx, the exact same read-only
// Identity/Organization/Employment/Attendance/Activity view a Regional
// Manager already sees for their own employees — no mutation controls
// exist there today (role change/reassignment/password reset/ID edit/
// suspension are explicitly Admin Phase 2, not built here or there).
// No onOpenChat is passed — Admin has no employee-1:1 chat type in this
// app (see chatController.listMyAdminConversations's own comment), so
// the Message button simply doesn't render (RmEmployeeProfile treats it
// as optional).
export default function AdminEmployeeProfilePage({ employeeId, onBack }) {
  const { data: employee, error, loading, reload } = useAsync(() => getEmployee(employeeId), { deps: [employeeId] });

  if (loading) return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-64" /></div>;
  if (error || !employee) {
    return (
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <ErrorBanner message={error ?? "Employee not found."} onRetry={onBack} />
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 sm:px-6 pt-6 max-w-4xl mx-auto">
        <AdminEmployeeActionsPanel employee={employee} onChanged={reload} />
      </div>
      <RmEmployeeProfile marketId={employee.marketId} employeeId={employeeId} onBack={onBack} />
    </div>
  );
}
