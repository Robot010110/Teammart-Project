import { useState } from "react";
import { Camera, ChevronDown, ChevronUp, Droplets } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { listNightShiftActivityForMarket } from "../../services/nightShiftService";

const LABEL_STYLE = {
  DRAFT: { label: "Not Started", tone: "bg-white/5 text-[#9AA1B4]" },
  PENDING: { label: "Pending Review", tone: "bg-amber-500/10 text-amber-400" },
  APPROVED: { label: "Completed", tone: "bg-emerald-500/10 text-emerald-400" },
  REJECTED: { label: "Rejected", tone: "bg-red-500/10 text-red-400" },
};

function timeLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ActivityRow({ activity }) {
  const [expanded, setExpanded] = useState(false);
  const style = LABEL_STYLE[activity.status] || LABEL_STYLE.DRAFT;

  return (
    <div className="rounded-xl bg-[#1A1F33]/70 border border-white/[0.06] overflow-hidden">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-3 p-3.5 text-left">
        <span className="grid place-items-center h-9 w-9 rounded-lg bg-[#F47A20]/10 text-[#F47A20] shrink-0">
          <Droplets size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{activity.employee?.name}</p>
          <p className="text-xs text-[#8B93A8] mt-0.5">
            {activity.nightShiftTaskDefinition?.name || "Night Shift Task"} — {activity.images.length} photo{activity.images.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-1 ${style.tone}`}>{style.label}</span>
        {expanded ? <ChevronUp size={15} className="text-[#4C5266] shrink-0" /> : <ChevronDown size={15} className="text-[#4C5266] shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-white/[0.06] pt-3">
          <p className="text-[11px] text-[#8B93A8] mb-2.5">
            {activity.status === "DRAFT" ? "Not yet submitted" : `Submitted ${timeLabel(activity.updatedAt)}`}
          </p>
          {activity.images.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {activity.images.map((img) => (
                <div key={img.id} className="aspect-square rounded-lg overflow-hidden border border-white/[0.06]">
                  <AuthenticatedImage src={img.url} alt="Evidence" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-[#4C5266]">
              <Camera size={12} /> No evidence uploaded yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// NightShiftMonitoringSection.jsx — Night Shift §28-29: the Supervisor's
// read-only view of every Night Shift task instance in their market
// today — who's Not Started/Pending/Completed, photo counts, and the
// evidence itself. Reads GET /api/night-shift/market/:marketId, which is
// already server-scoped to markets this caller can access — this
// component never has to re-check that itself.
export default function NightShiftMonitoringSection({ marketId }) {
  const { data: activities, error, loading, reload } = useAsync(
    () => listNightShiftActivityForMarket(marketId),
    { deps: [marketId], fallbackError: "Could not load Night Shift activity." }
  );

  if (loading) return <SkeletonCard className="h-40" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
        <p className="text-sm text-[#8B93A8]">No Night Shift activity yet — this market has no employees assigned to Night Shift, or no tasks have generated tonight.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <ActivityRow key={a.id} activity={a} />
      ))}
    </div>
  );
}
