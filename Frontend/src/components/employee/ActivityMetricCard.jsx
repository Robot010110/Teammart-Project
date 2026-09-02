// ActivityMetricCard.jsx — one tile in the Activity tab's "Today
// Overview" panel (Completed/Pending/Compliance/Performance). Every
// value passed in is real (see WorkerActivityTab.jsx's own comment on
// how each of the four is computed) — this component never invents a
// number, it just renders whatever it's given, including "—" when the
// caller has nothing real to show yet (e.g. Performance with no reviewed
// activity, or Compliance with no tasks assigned today).
const TONE = {
  orange: { bg: "bg-[#F47A20]/10", text: "text-[#F47A20]" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-400" },
};

export default function ActivityMetricCard({ icon: Icon, value, label, tone = "orange" }) {
  const t = TONE[tone] ?? TONE.orange;
  return (
    <div className="flex-1 min-w-[74px] flex flex-col items-center gap-1.5 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06]">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center ${t.bg} ${t.text}`}>
        <Icon size={16} />
      </span>
      <span className="text-base font-bold text-white leading-none">{value}</span>
      <span className={`text-[10px] font-medium ${t.text}`}>{label}</span>
    </div>
  );
}
