import { useState } from "react";
import { BadgeCheck, Store, Sun, Moon, Clock, Briefcase, CircleDot, Camera } from "lucide-react";
import { initialsOf } from "../../utils/initials";
import WhatsAppField from "./WhatsAppField";
import AuthenticatedImage from "../common/AuthenticatedImage";
import ChangePhotoModal from "./ChangePhotoModal";

// ProfileHeaderCard.jsx — the profile header shown at the top of both
// EmployeeWorkspace.jsx (Worker) and CashierWorkspace.jsx (Cashier). One
// component, role-aware only where the underlying data actually differs
// (shift: Worker's free-text `shift` string vs. Cashier's `cashierShift`
// enum).
//
// Performance is deliberately NOT shown here anymore — it has its own
// dedicated circular widget on the Home tab (PerformanceCircle.jsx) now
// that a real Activity-based Performance metric exists, so the old
// inline "Performance: not yet available" placeholder text has nowhere
// left to live (and shouldn't — a placeholder that will never resolve
// into anything useful in this exact spot).

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
  const [whatsapp, setWhatsapp] = useState(profile.whatsappNumber);
  const [photo, setPhoto] = useState(profile.profilePictureUrl);
  const [changingPhoto, setChangingPhoto] = useState(false);

  // A Cashier doesn't work within a department (spec §1) — showing
  // "Not assigned" for a field that structurally doesn't apply to this
  // role would misrepresent it as an oversight rather than a role
  // difference, so the card is simply omitted for Cashier instead.
  const showDepartment = profile.role !== "CASHIER";

  return (
    <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[#1D2D5C]/50 to-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center gap-4 sm:gap-5">
        <button
          type="button"
          onClick={() => setChangingPhoto(true)}
          aria-label="Change profile photo"
          className="group relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-white/[0.06] overflow-hidden"
        >
          {photo ? (
            <AuthenticatedImage src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-base sm:text-lg font-display font-bold text-white">{initialsOf(profile.name)}</span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200">
            <Camera size={16} className="text-white" />
          </span>
        </button>
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
        <span className="flex items-center gap-1.5">
          <CircleDot size={13} className={profile.employmentStatus === "ACTIVE" ? "text-emerald-400" : "text-[#9AA1B4]"} />
          {EMPLOYMENT_STATUS_LABEL[profile.employmentStatus] || profile.employmentStatus}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {showDepartment && (
          <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]">
              <Briefcase size={11} /> Department
            </p>
            <p className="mt-1 text-sm font-medium text-white truncate">{profile.department || "Not assigned"}</p>
          </div>
        )}
        <div className={showDepartment ? "" : "col-span-2"}>
          <WhatsAppField number={whatsapp} onSaved={setWhatsapp} />
        </div>
      </div>

      <ChangePhotoModal open={changingPhoto} onClose={() => setChangingPhoto(false)} onSaved={setPhoto} />
    </section>
  );
}
