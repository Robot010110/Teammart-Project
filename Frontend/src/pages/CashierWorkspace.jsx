import { BadgeCheck, Store, Sun, Moon, Briefcase, MessageCircle, CircleDot } from "lucide-react";
import SuddenTasksSection from "../components/employee/SuddenTasksSection";
import AttendanceSection from "../components/employee/AttendanceSection";
import CashierCleaningSection from "../components/employee/CashierCleaningSection";
import PriceReportSection from "../components/employee/PriceReportSection";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { getProfile } from "../services/profileService";
import { initialsOf } from "../utils/initials";
import { useAsync } from "../hooks/useAsync";

// CashierWorkspace.jsx — the Cashier role's dashboard, a sibling to
// EmployeeWorkspace.jsx (Worker) rather than a variant of it: Cashiers
// never see Daily Activities, My Activities, or Expired/Wasted Items
// (those stay exclusively in EmployeeWorkspace.jsx) — there's nothing to
// "hide", those components are simply never imported here.
//
// Reused with zero changes from the Worker workspace: SuddenTasksSection
// and AttendanceSection are the exact same components, same backend
// endpoints — both roles are still the same Employee model under a
// different `role`, so nothing employee-scoped needed to change.
//
// Cleaning is Morning-shift only per the spec; Evening cashiers simply
// never render <CashierCleaningSection />.

const SHIFT_LABEL = { MORNING: "Morning", EVENING: "Evening" };
const SHIFT_ICON = { MORNING: Sun, EVENING: Moon };
const STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave" };

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
      {!loading && !error && profile && (
        <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[#1D2D5C]/50 to-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-white/[0.06] overflow-hidden">
              {profile.profilePictureUrl ? (
                <img src={profile.profilePictureUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-base sm:text-lg font-display font-bold text-white">{initialsOf(profile.name)}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">{profile.name}</h1>
              <p className="text-[#F47A20] text-sm font-medium">Cashier</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#9AA1B4]">
            <span className="flex items-center gap-1.5"><BadgeCheck size={13} /> {profile.employeeCode}</span>
            <span className="flex items-center gap-1.5"><Store size={13} /> {profile.market?.name}</span>
            {profile.cashierShift && (
              <span className="flex items-center gap-1.5">
                {(() => { const Icon = SHIFT_ICON[profile.cashierShift]; return <Icon size={13} />; })()}
                {SHIFT_LABEL[profile.cashierShift]} Shift
              </span>
            )}
            {profile.department && (
              <span className="flex items-center gap-1.5"><Briefcase size={13} /> {profile.department}</span>
            )}
            <span className="flex items-center gap-1.5">
              <CircleDot size={13} className={profile.employmentStatus === "ACTIVE" ? "text-emerald-400" : "text-[#9AA1B4]"} />
              {STATUS_LABEL[profile.employmentStatus] || profile.employmentStatus}
            </span>
            {profile.whatsappNumber && (
              <a
                href={`https://wa.me/${profile.whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300"
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
            )}
          </div>
        </section>
      )}

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
    </div>
  );
}
