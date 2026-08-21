import { Sun, Moon, BadgeCheck, Store, MessageCircle } from "lucide-react";

// SupervisorProfileCard.jsx — visually distinct from ProfileHeaderCard
// (the Worker/Cashier version) on purpose: management accounts get a
// deeper accent border and no performance/department fields (spec:
// explicitly no performance-rating circle, no department shown here for
// a Supervisor). Real data throughout — session.displayName/staffId come
// from the real staff JWT (POST /api/auth/login), session.title/shift
// are chosen at login (Supervisor Mode has no backend shift column yet).
export default function SupervisorProfileCard({ session }) {
  const isEvening = session.shift === "EVENING";
  const ShiftIcon = isEvening ? Moon : Sun;

  return (
    <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[#3a2410]/60 to-[#171C2E]/80 border border-[#F47A20]/25 backdrop-blur-xl">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center ring-4 ring-[#F47A20]/20 overflow-hidden">
          <span className="text-base sm:text-lg font-display font-bold text-white">{session.initials}</span>
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">{session.displayName}</h1>
          <p className="text-[#F47A20] text-sm font-medium">{session.title}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#9AA1B4]">
        <span className="flex items-center gap-1.5">
          <ShiftIcon size={13} /> {isEvening ? "Evening Shift" : "Morning Shift"}
        </span>
        <span className="flex items-center gap-1.5">
          <BadgeCheck size={13} /> {session.loginId || `Staff ID #${session.staffId}`}
        </span>
        <span className="flex items-center gap-1.5">
          <Store size={13} /> {session.marketName || "Your market"}
        </span>
        {session.whatsappNumber && (
          <a
            href={`https://wa.me/${session.whatsappNumber.replace(/[\s\-().]/g, "").replace(/^\+/, "")}`}
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
