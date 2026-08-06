import { BadgeCheck, Store, Sun, Moon, Clock, Briefcase, MessageCircle, CircleDot, TrendingUp } from "lucide-react";
import { initialsOf } from "../../utils/initials";

// ProfileHeaderCard.jsx — the profile header shown at the top of both
// EmployeeWorkspace.jsx (Worker) and CashierWorkspace.jsx (Cashier).
// Extracted into one shared component per spec §2 ("profile layout
// should remain visually consistent across Worker and Cashier
// profiles") — previously each workspace hand-rolled its own version of
// this block, and Worker's was missing department/employment
// status/WhatsApp entirely. One component, role-aware only where the
// underlying data actually differs (shift: Worker's free-text `shift`
// string vs. Cashier's `cashierShift` enum).

const CASHIER_SHIFT_LABEL = { MORNING: "Morning", EVENING: "Evening" };
const CASHIER_SHIFT_ICON = { MORNING: Sun, EVENING: Moon };
const EMPLOYMENT_STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive", ON_LEAVE: "On Leave" };

function ShiftField({ profile }) {
  if (profile.role === "CASHIER") {
    if (!profile.cashierShift) return null;
    const Icon = CASHIER_SHIFT_ICON[profile.cashierShift];
    return (
      <span className="flex items-center gap-1.5">
        <Icon size={13} /> {CASHIER_SHIFT_LABEL[profile.cashierShift]} Shift
      </span>
    );
  }
  if (!profile.shift) return null;
  return (
    <span className="flex items-center gap-1.5">
      <Clock size={13} /> {profile.shift}
    </span>
  );
}

export default function ProfileHeaderCard({ profile }) {
  return (
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
          <p className="text-[#F47A20] text-sm font-medium">{profile.position}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#9AA1B4]">
        <span className="flex items-center gap-1.5"><BadgeCheck size={13} /> {profile.employeeCode}</span>
        {profile.username && (
          <span className="flex items-center gap-1.5"><BadgeCheck size={13} /> {profile.username}</span>
        )}
        <ShiftField profile={profile} />
        <span className="flex items-center gap-1.5"><Store size={13} /> {profile.market?.name}</span>
        {profile.department && (
          <span className="flex items-center gap-1.5"><Briefcase size={13} /> {profile.department}</span>
        )}
        <span className="flex items-center gap-1.5">
          <CircleDot size={13} className={profile.employmentStatus === "ACTIVE" ? "text-emerald-400" : "text-[#9AA1B4]"} />
          {EMPLOYMENT_STATUS_LABEL[profile.employmentStatus] || profile.employmentStatus}
        </span>
        {profile.role !== "CASHIER" && (
          <span className="flex items-center gap-1.5">
            <TrendingUp size={13} />
            {profile.performanceRate != null ? `Performance: ${profile.performanceRate}%` : "Performance: not yet available"}
          </span>
        )}
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
  );
}
