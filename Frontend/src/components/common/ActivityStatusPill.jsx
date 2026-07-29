import { FileEdit, HourglassIcon, CheckCircle2, XCircle } from "lucide-react";

// ActivityStatusPill.jsx — Draft / Pending / Approved / Rejected, the
// ActivityStatus enum shared by both Activity and ItemReport (see
// schema.prisma). Extracted out of TaskStatusTabs.jsx once ItemReportHistory
// needed the exact same status set — StatusPill.jsx is a different value
// set (Market status: Active/Maintenance/Closed) and shouldn't be reused
// here just because the visuals happen to look similar.

const STYLE = {
  DRAFT: { icon: FileEdit, tone: "bg-white/5 text-[#9AA1B4] ring-white/10" },
  PENDING: { icon: HourglassIcon, tone: "bg-amber-500/10 text-amber-400 ring-amber-500/20" },
  APPROVED: { icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" },
  REJECTED: { icon: XCircle, tone: "bg-red-500/10 text-red-400 ring-red-500/20" },
};

export default function ActivityStatusPill({ status }) {
  const { icon: Icon, tone } = STYLE[status] || STYLE.PENDING;
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tone}`}
    >
      <Icon size={11} />
      {status}
    </span>
  );
}
