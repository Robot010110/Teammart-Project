import SuddenTasksSection from "../components/employee/SuddenTasksSection";
import AttendanceSection from "../components/employee/AttendanceSection";
import CashierCleaningSection from "../components/employee/CashierCleaningSection";
import PriceReportSection from "../components/employee/PriceReportSection";
import LeaveRequestSection from "../components/employee/LeaveRequestSection";
import ProfileHeaderCard from "../components/employee/ProfileHeaderCard";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { getProfile } from "../services/profileService";
import { useAsync } from "../hooks/useAsync";

// CashierWorkspace.jsx — the Cashier role's dashboard, a sibling to
// EmployeeWorkspace.jsx (Worker) rather than a variant of it: Cashiers
// never see Daily Activities, My Activities, or Expired/Wasted Items
// (those stay exclusively in EmployeeWorkspace.jsx) — there's nothing to
// "hide", those components are simply never imported here.
//
// Reused with zero changes from the Worker workspace: SuddenTasksSection,
// AttendanceSection, LeaveRequestSection, and ProfileHeaderCard are the
// exact same components, same backend endpoints — both roles are still
// the same Employee model under a different `role`, so nothing
// employee-scoped needed to change.
//
// Cleaning is Morning-shift only per the spec; Evening cashiers simply
// never render <CashierCleaningSection />.

export default function CashierWorkspace({ employeeId }) {
  const { data: profile, error, loading, reload } = useAsync(getProfile, {
    deps: [employeeId],
    fallbackError: "Could not load your profile.",
  });

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 sm:py-8 max-w-4xl mx-auto animate-fade-up">
      {/* Profile */}
      {loading && <SkeletonCard className="h-[190px]" />}
      {!loading && error && <ErrorBanner message={error} onRetry={reload} />}
      {!loading && !error && profile && <ProfileHeaderCard profile={profile} />}

      {/* Sudden Tasks — reused verbatim from the Worker workspace */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Sudden Tasks</h2>
        <SuddenTasksSection />
      </section>

      {/* Cleaning — Morning shift only */}
      {profile?.cashierShift === "MORNING" && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Cleaning</h2>
          <CashierCleaningSection />
        </section>
      )}

      {/* Price Report */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Price Report</h2>
        <PriceReportSection />
      </section>

      {/* Attendance — reused verbatim from the Worker workspace */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Attendance</h2>
        <AttendanceSection />
      </section>

      {/* Off Days / Leave — reused verbatim from the Worker workspace */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Off Days / Leave</h2>
        <LeaveRequestSection />
      </section>
    </div>
  );
}
