import { ArrowLeft, CalendarDays } from "lucide-react";

// AttendanceHeader.jsx — the Attendance page header, in the two forms
// the references show.
//
//   mobile   [back]   Attendance (centred)   [calendar]
//   desktop  "← Back to Profile" above a large left-aligned title
//
// `onBack` comes from whatever mounted this page (ProfileTab passes its
// own goToMenu), so back always returns to the real entry point rather
// than a hardcoded route.
//
// The calendar button is not decorative: it jumps to the month grid,
// which is the one thing a person opening this header icon would want.
export default function AttendanceHeader({ onBack, onJumpToCalendar }) {
  return (
    <header className="mb-4">
      {/* Desktop — back link above a large title. */}
      <div className="hidden lg:block">
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-[#9AA1B4] hover:text-white transition-colors -ml-1 px-1 py-1"
        >
          ← Back to Profile
        </button>
        <h1 className="mt-2 font-display text-[26px] font-extrabold text-white">Attendance</h1>
      </div>

      {/* Mobile — centred title flanked by the two controls. */}
      <div className="lg:hidden flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Profile"
          className="shrink-0 w-10 h-10 grid place-items-center rounded-xl text-white hover:bg-white/[0.06] active:scale-95 transition-all"
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="font-display text-[19px] font-bold text-white text-center">Attendance</h1>

        <button
          type="button"
          onClick={onJumpToCalendar}
          aria-label="Go to calendar"
          className="shrink-0 w-10 h-10 grid place-items-center rounded-xl text-white bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.07] active:scale-95 transition-all"
        >
          <CalendarDays size={18} />
        </button>
      </div>
    </header>
  );
}
