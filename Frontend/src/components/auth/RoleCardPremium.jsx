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

// Per-role accent, matching the reference: gold for Admin, blue for
// Regional Manager, purple for Supervisor, green for Employee. The blue
// (#7EA6FF), purple (#C08BFF) and green (#34D399) are the exact accents
// already used elsewhere in the app (Settings' account/notification
// icons), so the login screen's role colors read as the same palette
// rather than a one-off. Each entry is a set of complete, literal
// Tailwind class strings (not composed from a hex variable) so the JIT
// compiler can find them in this file the way NotificationSettings.jsx
// already does it for its own per-mode tones.
const THEME = {
  admin: {
    iconBox: "bg-[#FBBF24]/12 text-[#FBBF24] ring-[#FBBF24]/25",
    iconBoxActive: "bg-[#FBBF24]/22 text-[#FBBF24] ring-[#FBBF24]/45 shadow-[0_0_16px_-2px_rgba(251,191,36,0.75)]",
    border: "border-[#FBBF24]/20",
    borderHover: "hover:border-[#FBBF24]/45",
    borderActive: "border-[#FBBF24]/70",
    glowHover: "hover:shadow-[0_16px_40px_-16px_rgba(251,191,36,0.4)]",
    glowActive: "shadow-[0_0_34px_-8px_rgba(251,191,36,0.5)]",
    arrowActive: "text-[#FBBF24]",
    arrowIdle: "text-[#4C5266] group-hover:text-[#FBBF24]",
  },
  regionalManager: {
    iconBox: "bg-[#7EA6FF]/12 text-[#7EA6FF] ring-[#7EA6FF]/25",
    iconBoxActive: "bg-[#7EA6FF]/22 text-[#7EA6FF] ring-[#7EA6FF]/45 shadow-[0_0_16px_-2px_rgba(126,166,255,0.75)]",
    border: "border-[#7EA6FF]/20",
    borderHover: "hover:border-[#7EA6FF]/45",
    borderActive: "border-[#7EA6FF]/70",
    glowHover: "hover:shadow-[0_16px_40px_-16px_rgba(126,166,255,0.4)]",
    glowActive: "shadow-[0_0_34px_-8px_rgba(126,166,255,0.5)]",
    arrowActive: "text-[#7EA6FF]",
    arrowIdle: "text-[#4C5266] group-hover:text-[#7EA6FF]",
  },
  supervisor: {
    iconBox: "bg-[#C08BFF]/12 text-[#C08BFF] ring-[#C08BFF]/25",
    iconBoxActive: "bg-[#C08BFF]/22 text-[#C08BFF] ring-[#C08BFF]/45 shadow-[0_0_16px_-2px_rgba(192,139,255,0.75)]",
    border: "border-[#C08BFF]/20",
    borderHover: "hover:border-[#C08BFF]/45",
    borderActive: "border-[#C08BFF]/70",
    glowHover: "hover:shadow-[0_16px_40px_-16px_rgba(192,139,255,0.4)]",
    glowActive: "shadow-[0_0_34px_-8px_rgba(192,139,255,0.5)]",
    arrowActive: "text-[#C08BFF]",
    arrowIdle: "text-[#4C5266] group-hover:text-[#C08BFF]",
  },
  employee: {
    iconBox: "bg-[#34D399]/12 text-[#34D399] ring-[#34D399]/25",
    iconBoxActive: "bg-[#34D399]/22 text-[#34D399] ring-[#34D399]/45 shadow-[0_0_16px_-2px_rgba(52,211,153,0.75)]",
    border: "border-[#34D399]/20",
    borderHover: "hover:border-[#34D399]/45",
    borderActive: "border-[#34D399]/70",
    glowHover: "hover:shadow-[0_16px_40px_-16px_rgba(52,211,153,0.4)]",
    glowActive: "shadow-[0_0_34px_-8px_rgba(52,211,153,0.5)]",
    arrowActive: "text-[#34D399]",
    arrowIdle: "text-[#4C5266] group-hover:text-[#34D399]",
  },
};

// `pending` is true for the ~220ms between tap and the actual screen
// transition (see RoleSelectScreen.jsx) — a real sequential state, not a
// decorative fake: the card visibly lights up and THEN the app
// navigates, rather than an instant hard cut.
export default function RoleCardPremium({ role, onSelect, index = 0, pending }) {
  const Icon = ICONS[role.key];
  const theme = THEME[role.key];

  return (
    <button
      type="button"
      style={{ animationDelay: `${index * 90}ms` }}
      onClick={() => onSelect(role.key)}
      aria-label={`Continue as ${role.label}`}
      // A horizontal row — icon left, title/description center, arrow
      // right — rather than the previous stacked-tile shape, so the full
      // width of the card is one comfortable thumb target instead of a
      // small square. min-h keeps every card the same comfortable height
      // regardless of how long its description runs.
      className={`animate-fade-up group relative flex w-full min-h-[76px] sm:min-h-[84px] items-center gap-3.5 sm:gap-4 rounded-2xl border px-4 py-4 sm:px-5 text-left backdrop-blur-xl transition-all duration-300 ease-out active:scale-[0.98] ${
        pending
          ? `bg-gradient-to-r from-[#151B2E]/95 to-[#0D1223]/95 ${theme.borderActive} ${theme.glowActive} -translate-y-0.5 scale-[1.01]`
          : `bg-gradient-to-r from-[#12172A]/80 to-[#0D1223]/85 ${theme.border} ${theme.borderHover} ${theme.glowHover} hover:-translate-y-0.5`
      }`}
    >
      <span
        className={`grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-xl ring-1 ring-inset transition-all duration-300 ${
          pending ? theme.iconBoxActive : theme.iconBox
        }`}
      >
        <Icon size={22} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-display text-[16px] sm:text-[17px] font-bold text-white">{role.label}</span>
        <span className="mt-0.5 block text-[12.5px] sm:text-[13px] leading-snug text-[#9AA1B4]">{role.tagline}</span>
      </span>

      <ArrowRight
        size={19}
        className={`shrink-0 transition-all duration-300 ${
          pending ? `${theme.arrowActive} translate-x-1.5` : `${theme.arrowIdle} group-hover:translate-x-1`
        }`}
      />
    </button>
  );
}
