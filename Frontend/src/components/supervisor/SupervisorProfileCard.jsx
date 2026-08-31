import { useState } from "react";
import {
  Sun,
  Moon,
  BadgeCheck,
  Store,
  MessageCircle,
  Camera,
} from "lucide-react";
import AuthenticatedImage from "../common/AuthenticatedImage";
import ChangePhotoModal from "../employee/ChangePhotoModal";
import WhatsAppField from "../employee/WhatsAppField";
import { getProfile } from "../../services/profileService";
import { useAsync } from "../../hooks/useAsync";

// SupervisorProfileCard.jsx — visually distinct from ProfileHeaderCard
// (the Worker/Cashier version) on purpose: management accounts get a
// deeper accent border and no performance/department fields (spec:
// explicitly no performance-rating circle, no department shown here for
// a Supervisor). Real data throughout — session.displayName/staffId come
// from the real staff JWT (POST /api/auth/login); profilePictureUrl/
// phoneNumber/whatsappNumber (Repair Pass §3) are fetched fresh from
// GET /api/profile on mount rather than trusted from the (possibly
// stale, login-time-only) session prop, since they can now change via
// this card's own edit affordances.
//
// Editing reuses existing architecture end to end: the avatar opens the
// same ChangePhotoModal an Employee already uses (verified to contain no
// employee-specific code — it just calls PATCH /api/profile), and
// EditContactInfoModal uses the same PATCH /api/profile + validated
// shape the Employee WhatsApp field already used. Ownership is enforced
// server-side (the token always identifies the caller as themselves) —
// this card has no way to edit anyone else's profile even in principle.
export default function SupervisorProfileCard({ session }) {
  const isEvening = session.shift === "EVENING";
  const ShiftIcon = isEvening ? Moon : Sun;

  const { data: profile, setData: setProfile } = useAsync(getProfile, {
    deps: [],
  });
  const [photoOpen, setPhotoOpen] = useState(false);

  const profilePictureUrl = profile?.profilePictureUrl;
  const whatsappNumber = profile?.whatsappNumber ?? session.whatsappNumber;

  return (
    <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[#3a2410]/60 to-[#171C2E]/80 border border-[#F47A20]/25 backdrop-blur-xl">
      <div className="flex items-center gap-4 sm:gap-5">
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          aria-label="Change profile photo"
          className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-[#F47A20]/20 overflow-hidden group"
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
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#9AA1B4]">
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
