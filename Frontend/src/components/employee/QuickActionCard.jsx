// QuickActionCard.jsx — one card in the Home tab's "Quick Actions" row.
// tone communicates meaning (orange = do-something-now, blue =
// attendance/time, violet = communication), never picked at random —
// see HomeTab.jsx's own QUICK_ACTIONS config for what each tone means.
const TONE = {
  orange: { bg: "bg-[#F47A20]/10", text: "text-[#F47A20]" },
  blue: { bg: "bg-sky-500/10", text: "text-sky-400" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-400" },
};

export default function QuickActionCard({ icon: Icon, label, tone = "orange", badge, onClick }) {
  const t = TONE[tone] ?? TONE.orange;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative shrink-0 w-[92px] flex flex-col items-center gap-2 rounded-2xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl active:scale-[0.96] transition-transform"
    >
      <span className={`relative w-11 h-11 rounded-xl flex items-center justify-center ${t.bg} ${t.text}`}>
        <Icon size={19} />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 ring-2 ring-[#171C2E] flex items-center justify-center text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[11px] font-medium text-white text-center leading-tight">{label}</span>
    </button>
  );
}
