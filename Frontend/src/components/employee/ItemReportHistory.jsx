import { Trash2, PackageX, Clock3 } from "lucide-react";
import ActivityStatusPill from "../common/ActivityStatusPill";

// ItemReportHistory.jsx — this month's Expired/Wasted Items reports, same
// row-card shell as TaskStatusTabs.jsx uses for Activities.

const CONDITION_LABEL = { EXPIRED: "Expired", WASTED: "Wasted" };
const CONDITION_ICON = { EXPIRED: Clock3, WASTED: Trash2 };

const dateTimeLabel = (isoString) =>
  new Date(isoString).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function ItemReportHistory({ reports }) {
  if (reports.length === 0) {
    return <p className="text-sm text-[#4C5266] text-center py-8">No reports for this month.</p>;
  }

  return (
    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
      {reports.map((report) => {
        const Icon = CONDITION_ICON[report.condition] || PackageX;
        return (
          <div key={report.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <Icon size={13} className="text-[#F47A20]" /> {report.product.name}
              </span>
              <ActivityStatusPill status={report.status} />
            </div>
            <div className="mt-1.5 flex items-center gap-4 text-xs text-[#9AA1B4]">
              <span>{CONDITION_LABEL[report.condition]}</span>
              <span>Qty {report.quantity}</span>
              <span>{dateTimeLabel(report.reportedAt)}</span>
            </div>
            {report.notes && <p className="mt-1.5 text-xs text-[#8B93A8]">{report.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
