import { ArrowRight, Crown, ShieldCheck, ClipboardList, UserCircle2 } from "lucide-react";

// RoleCardPremium.jsx — Stage 1's four role cards. Same icon choices
// RoleCard.jsx already established (kept for continuity — this isn't a
// new icon language, just a new surface treatment).
const ICONS = {
  admin: Crown,
  regionalManager: ShieldCheck,
  supervisor: ClipboardList,
  employee: UserCircle2,
};

// `pending` is true for the ~220ms between tap and the actual screen
// transition (see RoleSelectScreen.jsx) — a real sequential state, not a
// decorative fake: the card visibly lights up and THEN the app
// navigates, rather than an instant hard cut.
export default function RoleCardPremium({ role, onSelect, index = 0, pending }) {
  const Icon = ICONS[role.key];

  return (
    <button
      type="button"
      style={{ animationDelay: `${index * 90}ms` }}
      onClick={() => onSelect(role.key)}
      aria-label={`Continue as ${role.label}`}
      className={`animate-fade-up group relative text-left rounded-2xl p-5 sm:p-6 border backdrop-blur-xl transition-all duration-300 ease-out active:scale-[0.98] ${
        pending
          ? "bg-gradient-to-b from-[#3a2410]/90 to-[#171C2E]/95 border-[#F47A20]/60 shadow-[0_0_36px_-6px_rgba(244,122,32,0.55)] -translate-y-1 scale-[1.01]"
          : "bg-gradient-to-b from-[#12172A]/80 to-[#0D1223]/90 border-white/[0.07] hover:border-[#F47A20]/40 hover:-translate-y-1 hover:shadow-[0_20px_45px_-10px_rgba(244,122,32,0.2)]"
      }`}
    >
      <div className="flex items-start justify-between">
        <span
          className={`h-11 w-11 rounded-xl grid place-items-center transition-all duration-300 ${
            pending ? "bg-[#F47A20]/20 text-[#F47A20] shadow-[0_0_14px_-1px_rgba(244,122,32,0.7)]" : "bg-[#F47A20]/10 text-[#F47A20] group-hover:bg-[#F47A20]/15"
          }`}
        >
          <Icon size={20} />
        </span>
        <ArrowRight
          size={18}
          className={`transition-all duration-300 ${pending ? "text-[#F47A20] translate-x-1.5" : "text-[#4C5266] group-hover:text-[#F47A20] group-hover:translate-x-1"}`}
        />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-white">{role.label}</h3>
      <p className="mt-1 text-[13px] text-[#9AA1B4] leading-snug">{role.tagline}</p>
    </button>
  );
}
