// AdminKpiCard.jsx — one company-level number.
//
// `value` is whatever the backend actually returned; the caller passes
// "—" (or leaves it undefined) when a figure genuinely isn't available,
// so a KPI never shows a fabricated placeholder. There is deliberately
// no trend/delta prop: this backend stores no historical snapshot to
// compare against, and "+2 from yesterday" would have to be invented.
const TONES = {
  blue: "text-[#7EA6FF] bg-[#7EA6FF]/10 ring-[#7EA6FF]/20",
  orange: "text-[#F47A20] bg-[#F47A20]/10 ring-[#F47A20]/20",
  purple: "text-[#C08BFF] bg-[#C08BFF]/10 ring-[#C08BFF]/20",
  green: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20",
  amber: "text-amber-400 bg-amber-500/10 ring-amber-500/20",
  red: "text-red-400 bg-red-500/10 ring-red-500/20",
};

export default function AdminKpiCard({ icon: Icon, value, label, tone = "blue", loading, onClick, hint }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      className={`rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#111A2D]/90 to-[#0C1424]/90 p-4 text-left backdrop-blur-xl
                  shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)] transition-all duration-200 ${
                    onClick ? "hover:border-[#F47A20]/30 hover:-translate-y-0.5 active:scale-[0.99]" : ""
                  }`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ring-inset ${TONES[tone]}`}>
        <Icon size={16} />
      </span>
      {loading ? (
        <div className="mt-3 h-6 w-16 animate-pulse rounded bg-white/[0.07]" />
      ) : (
        <p className="mt-3 font-display text-[24px] font-bold leading-none tabular-nums text-white">{value}</p>
      )}
      <p className="mt-1.5 text-[12px] text-[#8B93A8]">{label}</p>
      {hint && !loading && <p className="mt-0.5 text-[10.5px] text-[#5C6479]">{hint}</p>}
    </Tag>
  );
}
