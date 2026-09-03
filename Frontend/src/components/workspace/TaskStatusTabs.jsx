import { useEffect, useState } from "react";
import { Clock3, ImageIcon, Pencil, Trash2, Loader2 } from "lucide-react";
import { CATEGORY_LABELS } from "../../data/workspaceData";
import { canEditActivity, canDeleteActivity } from "../../data/activityRules";
import ActivityStatusPill from "../common/ActivityStatusPill";

// TaskStatusTabs.jsx — Draft / Pending / Approved / Rejected filters over
// the employee's own Activity history (GET /api/activities). These four
// tabs map 1:1 onto the real backend ActivityStatus enum
// (schema.prisma) — there is deliberately no synthetic "Completed" tab
// grouping Approved+Rejected: the Worker Activity status model reflects
// the actual backend lifecycle exactly, nothing derived/invented on top
// of it.
//
// The Approved/Rejected tabs are live: a Supervisor decides an activity
// through POST /api/activities/:id/review (activitiesController.
// reviewActivity), reached from DepartmentReportReviewModal.jsx and
// TodayActivityFeed.jsx. (An older comment here claimed no review
// endpoint existed yet — it was written before that endpoint shipped.)
//
// Edit is only offered for Draft/Pending (matches the backend's own rule
// in activitiesController.js — anything else 400s). Delete is only
// offered for Draft, and always asks for confirmation first. Both rules
// live in data/activityRules.js so this file, EmployeeWorkspace.jsx, and
// SubmitTaskModal.jsx can't drift apart on what "editable" means.

const TABS = ["Draft", "Pending", "Approved", "Rejected"];

function matchesTab(activity, tab) {
  if (tab === "Draft") return activity.status === "DRAFT";
  if (tab === "Pending") return activity.status === "PENDING";
  if (tab === "Approved") return activity.status === "APPROVED";
  if (tab === "Rejected") return activity.status === "REJECTED";
  return false;
}

// `requestedTab` (optional) lets a caller open this on a specific tab —
// the Performance page's Approved/Pending/Rejected hero cards use it to
// drill down into the matching list. It's a request, not a lock: the
// user can still switch tabs freely afterwards. Omitted by any caller
// that doesn't need it, which keeps the original "always opens on
// Pending" behaviour exactly as it was.
export default function TaskStatusTabs({ activities, onEdit, onDelete, deletingId, requestedTab }) {
  const [tab, setTab] = useState("Pending");

  useEffect(() => {
    if (requestedTab && TABS.includes(requestedTab)) setTab(requestedTab);
  }, [requestedTab]);

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
          const canEdit = canEditActivity(activity);
          const canDelete = canDeleteActivity(activity);
          const isDeleting = deletingId === activity.id;
          const dateLabel = new Date(activity.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

          return (
            <div key={activity.id} className="rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-white">{CATEGORY_LABELS[activity.category] || activity.category}</span>
                <ActivityStatusPill status={activity.status} />
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
