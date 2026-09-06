// AdminKpiCard.jsx — one company-level number.
//
// `value` is whatever the backend actually returned; the caller passes
// "—" (or leaves it undefined) when a figure genuinely isn't available,
// so a KPI never shows a fabricated placeholder. There is deliberately
// no trend/delta prop: this backend stores no historical snapshot to
// compare against, and "+2 from yesterday" would have to be invented.
//
// Visual pass: each tone is a full, clearly-visible identity — a tinted
// border, a saturated icon container with its own bloom, an internal
// ambient blob bleeding from the icon corner, AND a colored halo on the
// card's own outer shadow (a box-shadow isn't clipped by the card's
// overflow-hidden, so this one genuinely escapes the card edge into the
// page, not just an internal gradient). Shared by AdminPeoplePage,
// AdminAttendancePage and AdminDashboard, so this one change lifts all
// three consistently.
const TONES = {
  blue: {
    icon: "text-[#9DBBFF] bg-gradient-to-br from-[#7EA6FF]/50 to-[#7EA6FF]/10 ring-[#7EA6FF]/60 shadow-[0_0_20px_2px_rgba(126,166,255,0.85)]",
    border: "border-[#7EA6FF]/40",
    borderHover: "group-hover:border-[#7EA6FF]/65",
    blob: "bg-[#7EA6FF]/[0.32]",
    outerGlow: "0_0_44px_-10px_rgba(126,166,255,0.55)",
  },
  orange: {
    icon: "text-[#FFB578] bg-gradient-to-br from-[#F47A20]/50 to-[#F47A20]/10 ring-[#F47A20]/60 shadow-[0_0_20px_2px_rgba(244,122,32,0.85)]",
    border: "border-[#F47A20]/40",
    borderHover: "group-hover:border-[#F47A20]/65",
    blob: "bg-[#F47A20]/[0.32]",
    outerGlow: "0_0_44px_-10px_rgba(244,122,32,0.55)",
  },
  purple: {
    icon: "text-[#D8C2FF] bg-gradient-to-br from-[#C08BFF]/50 to-[#C08BFF]/10 ring-[#C08BFF]/60 shadow-[0_0_20px_2px_rgba(192,139,255,0.85)]",
    border: "border-[#C08BFF]/40",
    borderHover: "group-hover:border-[#C08BFF]/65",
    blob: "bg-[#C08BFF]/[0.32]",
    outerGlow: "0_0_44px_-10px_rgba(192,139,255,0.55)",
  },
  green: {
    icon: "text-emerald-300 bg-gradient-to-br from-emerald-400/50 to-emerald-400/10 ring-emerald-400/60 shadow-[0_0_20px_2px_rgba(52,211,153,0.85)]",
    border: "border-emerald-400/40",
    borderHover: "group-hover:border-emerald-400/65",
    blob: "bg-emerald-400/[0.32]",
    outerGlow: "0_0_44px_-10px_rgba(52,211,153,0.55)",
  },
  amber: {
    icon: "text-amber-300 bg-gradient-to-br from-amber-400/50 to-amber-400/10 ring-amber-400/60 shadow-[0_0_20px_2px_rgba(251,191,36,0.85)]",
    border: "border-amber-400/40",
    borderHover: "group-hover:border-amber-400/65",
    blob: "bg-amber-400/[0.32]",
    outerGlow: "0_0_44px_-10px_rgba(251,191,36,0.55)",
  },
  red: {
    icon: "text-red-300 bg-gradient-to-br from-red-400/50 to-red-400/10 ring-red-400/60 shadow-[0_0_20px_2px_rgba(248,113,113,0.85)]",
    border: "border-red-400/40",
    borderHover: "group-hover:border-red-400/65",
    blob: "bg-red-400/[0.32]",
    outerGlow: "0_0_44px_-10px_rgba(248,113,113,0.55)",
  },
};

export default function AdminKpiCard({ icon: Icon, value, label, tone = "blue", loading, onClick, hint }) {
  const cfg = TONES[tone] ?? TONES.blue;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      style={{ boxShadow: `0 10px 30px -18px rgba(0,0,0,0.9), ${cfg.outerGlow.replace(/_/g, " ")}` }}
      className={`group relative overflow-hidden rounded-2xl border ${cfg.border} ${cfg.borderHover} bg-gradient-to-b from-[#131D33]/95 to-[#0C1424]/95 p-4 text-left backdrop-blur-xl
                  transition-all duration-200 animate-fade-up ${
                    onClick ? "hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer" : ""
                  }`}
    >
      {/* Ambient glow bleeding from the icon corner — real depth, not a
          brighter icon on an otherwise flat card. Clipped by the card's
          own `overflow-hidden`, so it reads as a soft colored wash across
          the top of the card rather than a visible shape. */}
      <span className={`pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full blur-3xl ${cfg.blob}`} aria-hidden="true" />

      <span className={`relative grid h-10 w-10 place-items-center rounded-xl ring-2 ring-inset ${cfg.icon}`}>
        <Icon size={18} />
      </span>
      {loading ? (
        <div className="relative mt-3 h-7 w-16 animate-pulse rounded bg-white/[0.07]" />
      ) : (
        <p className="relative mt-3 font-display text-[27px] font-bold leading-none tabular-nums text-white">{value}</p>
      )}
      <p className="relative mt-1.5 text-[12px] text-[#9AA1B4]">{label}</p>
      {hint && !loading && <p className="relative mt-0.5 text-[10.5px] text-[#5C6479]">{hint}</p>}
    </Tag>
  );
}
