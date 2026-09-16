import { ChevronRight } from "lucide-react";

// ZoneActivityCategoryCard.jsx — the redesigned Zone Activities category
// tile (visual reference: a premium dark operational dashboard — solid-
// colored icon square, big real count, short description, trailing
// chevron). Scoped to this page only, so it does not touch AdminKpiCard.jsx
// (used by Admin People/Attendance/Dashboard) — a presentational sibling,
// not a replacement.
//
// `tone` is the SAME identity already assigned per category in
// zoneActivityMeta.js (amber/red/purple/blue/green) — this file only
// changes how a tone is painted (solid icon square + soft outer glow
// instead of AdminKpiCard's translucent ring), never which category gets
// which tone. Every value (count/label/description) is read straight
// from real props — nothing here is fabricated.
const TONES = {
  amber: { icon: "bg-gradient-to-br from-amber-400 to-amber-500 text-[#241503]", glow: "shadow-[0_0_24px_-6px_rgba(251,191,36,0.55)]" },
  red: { icon: "bg-gradient-to-br from-red-400 to-red-500 text-[#2A0808]", glow: "shadow-[0_0_24px_-6px_rgba(248,113,113,0.55)]" },
  purple: { icon: "bg-gradient-to-br from-[#C08BFF] to-[#A265F5] text-[#1E1033]", glow: "shadow-[0_0_24px_-6px_rgba(192,139,255,0.55)]" },
  blue: { icon: "bg-gradient-to-br from-[#7EA6FF] to-[#5C86F0] text-[#0B1B3D]", glow: "shadow-[0_0_24px_-6px_rgba(126,166,255,0.55)]" },
  green: { icon: "bg-gradient-to-br from-emerald-400 to-emerald-500 text-[#052A1D]", glow: "shadow-[0_0_24px_-6px_rgba(52,211,153,0.55)]" },
};

export default function ZoneActivityCategoryCard({ icon: Icon, count, label, description, tone = "blue", index = 0, onClick }) {
  const cfg = TONES[tone] ?? TONES.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index, 11) * 30}ms` }}
      className="group animate-fade-up flex w-full flex-col gap-3 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#111A2D]/90 to-[#0C1424]/90 p-4 text-start backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] active:scale-[0.99]"
    >
      <div className="flex items-start justify-between">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${cfg.icon} ${cfg.glow}`}>
          <Icon size={19} strokeWidth={2.25} />
        </span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] text-[#8B93A8] ring-1 ring-white/[0.06] transition-colors group-hover:bg-white/[0.09] group-hover:text-white">
          <ChevronRight size={15} className="rtl-flip" />
        </span>
      </div>

      <div>
        <p className="font-display text-[13.5px] font-semibold text-white">{label}</p>
        <p className="mt-1 font-display text-[26px] font-bold leading-none tabular-nums text-white">{count}</p>
        {description && <p className="mt-1.5 truncate text-[11.5px] text-[#8B93A8]">{description}</p>}
      </div>
    </button>
  );
}
