// LeaveStatusPill.jsx — the LeaveRequestStatus enum (schema.prisma).
// Same pill shape as every other status pill in this app (StatusPill,
// ActivityStatusPill, AttendanceStatusPill) — its own component since
// it's a distinct value set (adds CANCELLED, which none of the others have).

const STYLES = {
  PENDING: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  REJECTED: "bg-red-500/10 text-red-400 ring-red-500/20",
  CANCELLED: "bg-white/5 text-[#9AA1B4] ring-white/10",
};

export default function LeaveStatusPill({ status }) {
  const style = STYLES[status] || STYLES.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
