import { useState } from "react";
import { Clock3, ImageIcon, CheckCircle2, XCircle, HourglassIcon, FileEdit, Pencil, Trash2, Loader2 } from "lucide-react";
import { CATEGORY_LABELS } from "../../data/workspaceData";
import { canEditActivity, canDeleteActivity } from "../../data/activityRules";

// TaskStatusTabs.jsx — Draft / Pending / Completed / Approved / Rejected
// filters over the employee's own Activity history (GET /api/activities).
//
// Only "Draft", "Pending", "Approved", "Rejected" are real backend
// statuses (ActivityStatus in schema.prisma) — those four and only those
// four ever come back from the API. "Completed" is NOT a status: it is a
// purely client-side filter that groups Approved + Rejected together
// ("the review cycle is over, one way or the other"). It never gets sent
// to the backend and no Activity object ever has status "Completed" — see
// matchesTab() below, where it's the only tab computed from an OR of two
// real statuses instead of an equality check against one.
//
// TODO(supervisor-review): today nothing in this app ever sets an
// Activity to Approved/Rejected — there is no review endpoint yet (see
// backend/src/controllers/activitiesController.js). Once the Supervisor
// module adds one, those two tabs will start showing real data without
// any change needed here.
//
// Edit is only offered for Draft/Pending (matches the backend's own rule
// in activitiesController.js — anything else 400s). Delete is only
// offered for Draft, and always asks for confirmation first. Both rules
// live in data/activityRules.js so this file, EmployeeWorkspace.jsx, and
// SubmitTaskModal.jsx can't drift apart on what "editable" means.

const TABS = ["Draft", "Pending", "Completed", "Approved", "Rejected"];

const STATUS_STYLE = {
  DRAFT: { icon: FileEdit, tone: "bg-white/5 text-[#9AA1B4] ring-white/10" },
  PENDING: { icon: HourglassIcon, tone: "bg-amber-500/10 text-amber-400 ring-amber-500/20" },
  APPROVED: { icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" },
  REJECTED: { icon: XCircle, tone: "bg-red-500/10 text-red-400 ring-red-500/20" },
};

function matchesTab(activity, tab) {
  if (tab === "Draft") return activity.status === "DRAFT";
  if (tab === "Pending") return activity.status === "PENDING";
  if (tab === "Completed") return activity.status === "APPROVED" || activity.status === "REJECTED";
  if (tab === "Approved") return activity.status === "APPROVED";
  if (tab === "Rejected") return activity.status === "REJECTED";
  return false;
}

export default function TaskStatusTabs({ activities, onEdit, onDelete, deletingId }) {
  const [tab, setTab] = useState("Pending");
  const filtered = activities.filter((a) => matchesTab(a, tab));

  return (
    <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const count = activities.filter((a) => matchesTab(a, t)).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                tab === t ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4] hover:bg-white/[0.09]"
              }`}
            >
              {t} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-sm text-[#4C5266] text-center py-8">No {tab.toLowerCase()} activities.</p>
        )}
        {filtered.map((activity) => {
          const style = STATUS_STYLE[activity.status] || STATUS_STYLE.PENDING;
          const Icon = style.icon;
          const canEdit = canEditActivity(activity);
          const canDelete = canDeleteActivity(activity);
          const isDeleting = deletingId === activity.id;
          const dateLabel = new Date(activity.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

          return (
            <div key={activity.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-white">{CATEGORY_LABELS[activity.category] || activity.category}</span>
                <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${style.tone}`}>
                  <Icon size={11} />
                  {activity.status}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-4 text-xs text-[#9AA1B4]">
                <span className="flex items-center gap-1"><Clock3 size={12} /> {dateLabel} · {activity.time}</span>
                {activity.images?.length > 0 && (
                  <span className="flex items-center gap-1"><ImageIcon size={12} /> {activity.images.length}</span>
                )}
              </div>
              {activity.notes && <p className="mt-1.5 text-xs text-[#8B93A8]">{activity.notes}</p>}

              {(canEdit || canDelete) && (
                <div className="mt-2.5 flex items-center gap-3">
                  {canEdit && (
                    <button
                      onClick={() => onEdit(activity)}
                      disabled={isDeleting}
                      className="flex items-center gap-1 text-[11px] text-[#9AA1B4] hover:text-[#F47A20] disabled:opacity-40 transition-colors duration-150"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => onDelete(activity)}
                      disabled={isDeleting}
                      className="flex items-center gap-1 text-[11px] text-[#9AA1B4] hover:text-red-400 disabled:opacity-40 transition-colors duration-150"
                    >
                      {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
