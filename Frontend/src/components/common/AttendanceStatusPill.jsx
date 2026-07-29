// AttendanceStatusPill.jsx — Present / Late / Absent / Day Off, the
// AttendanceStatus enum (schema.prisma). Same pill shape as StatusPill.jsx
// / ActivityStatusPill.jsx, but its own component since it's a distinct
// value set with a different color mapping (Absent is a real problem,
// not a "rejected" outcome — worth its own visual weight).

const STYLES = {
  PRESENT: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  LATE: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  ABSENT: "bg-red-500/10 text-red-400 ring-red-500/20",
  DAY_OFF: "bg-white/5 text-[#9AA1B4] ring-white/10",
};

const LABELS = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  DAY_OFF: "Day Off",
};

export default function AttendanceStatusPill({ status }) {
  const style = STYLES[status] || STYLES.PRESENT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status] || status}
    </span>
  );
}
