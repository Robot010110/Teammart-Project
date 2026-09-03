import { useState } from "react";
import {
  Sun,
  Moon,
  BadgeCheck,
  Store,
  Users,
  Camera,
  Circle,
} from "lucide-react";
import AuthenticatedImage from "../common/AuthenticatedImage";
import ChangePhotoModal from "../employee/ChangePhotoModal";
import WhatsAppField from "../employee/WhatsAppField";
import SupervisorWindBackground from "./home/SupervisorWindBackground";
import { getProfile } from "../../services/profileService";
import { listEmployeesByMarket } from "../../services/staffEmployeeService";
import { useAsync } from "../../hooks/useAsync";

// SupervisorProfileCard.jsx — the Supervisor Home glass hero card.
// Visually distinct from ProfileHeaderCard (the Worker/Cashier version)
// on purpose: management accounts get a deeper accent border, the
// flowing wind background, and no performance/department fields (spec:
// explicitly no performance-rating circle, no department shown here for
// a Supervisor). Real data throughout — session.displayName/staffId/
// shift/marketName come from the real staff JWT (POST /api/auth/login);
// profilePictureUrl/whatsappNumber are fetched fresh from
// GET /api/profile on mount rather than trusted from the (possibly
// stale, login-time-only) session prop, since they can change via this
// card's own edit affordances. Team size is the same real
// listEmployeesByMarket count SupervisorOverviewStats already used for
// "Employees Assigned" — not a second source of truth for the same
// number.
//
// Editing reuses existing architecture end to end: the avatar opens the
// same ChangePhotoModal an Employee already uses (verified to contain no
// employee-specific code — it just calls PATCH /api/profile), and
// WhatsAppField uses the same PATCH /api/profile + validated shape the
// Employee version already used. Ownership is enforced server-side (the
// token always identifies the caller as themselves) — this card has no
// way to edit anyone else's profile even in principle.
//
// The wind (SupervisorWindBackground.jsx) is purely decorative and sits
// behind everything via z-index/relative stacking — it never intercepts
// a tap on the avatar or the WhatsApp field.
export default function SupervisorProfileCard({ session, onDuty }) {
  const isEvening = session.shift === "EVENING";
  const ShiftIcon = isEvening ? Moon : Sun;

  const { data: profile, setData: setProfile } = useAsync(getProfile, {
    deps: [],
  });
  const { data: employees } = useAsync(() => listEmployeesByMarket(session.marketId), {
    deps: [session.marketId],
  });
  const [photoOpen, setPhotoOpen] = useState(false);

  const profilePictureUrl = profile?.profilePictureUrl;
  const whatsappNumber = profile?.whatsappNumber ?? session.whatsappNumber;
  const teamSize = employees?.length;

  return (
    <section className="card-premium relative overflow-hidden rounded-[24px] p-5 sm:p-6 bg-gradient-to-br from-[#241708]/80 to-[#0D1223]/90 border border-[#F47A20]/25 backdrop-blur-xl shadow-[0_10px_40px_-14px_rgba(0,0,0,0.85)]">
      <SupervisorWindBackground />

      <div className="relative flex items-center gap-4 sm:gap-5">
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          aria-label="Change profile photo"
          className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-[#F47A20]/20 shadow-[0_0_18px_-2px_rgba(244,122,32,0.6)] overflow-hidden group"
        >
          {profilePictureUrl ? (
            <AuthenticatedImage
              src={profilePictureUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-base sm:text-lg font-display font-bold text-white">
              {session.initials}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={16} className="text-white" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">
            {session.displayName}
          </h1>
          <p className="text-[#F47A20] text-sm font-medium">{session.title}</p>
        </div>
        {/* On-duty indicator — real: derived from the same today-
            attendance state AttendanceCheckInCard reads, passed down by
            SupervisorHomeTab rather than fetched twice. */}
        {onDuty != null && (
          <span
            className={`shrink-0 hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              onDuty ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/25" : "text-[#8B93A8] bg-white/[0.04] border border-white/[0.08]"
            }`}
          >
            <Circle size={7} className="fill-current" />
            {onDuty ? "On Duty" : "Off Duty"}
          </span>
        )}
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-[#9AA1B4]">
        <span className="flex items-center gap-1.5">
          <ShiftIcon size={13} />{" "}
          {isEvening ? "Evening Shift" : "Morning Shift"}
        </span>
        <span className="flex items-center gap-1.5">
          <BadgeCheck size={13} />{" "}
          {session.loginId || `Staff ID #${session.staffId}`}
        </span>
        <span className="flex items-center gap-1.5">
          <Store size={13} /> {session.marketName || "Your market"}
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={13} /> {teamSize != null ? `${teamSize} team ${teamSize === 1 ? "member" : "members"}` : "Team"}
        </span>

        <WhatsAppField
          number={whatsappNumber}
          onSaved={(value) =>
            setProfile((prev) =>
              prev ? { ...prev, whatsappNumber: value } : prev,
            )
          }
        />
      </div>

      <ChangePhotoModal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onSaved={(url) =>
          setProfile((prev) =>
            prev ? { ...prev, profilePictureUrl: url } : prev,
          )
        }
      />
    </section>
  );
}
