import { useMemo, useState } from "react";
import {
  CheckCircle2,
  PackageX,
  ClipboardList,
  Sparkles,
  XCircle,
  Loader2,
  Clock3,
  Trash2,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { SkeletonCard } from "../common/SkeletonCard";
import Modal from "../common/Modal";
import {
  listActivitiesForMarket,
  reviewActivity,
} from "../../services/activityService";
import {
  listItemReportsForMarket,
  deleteItemReport,
} from "../../services/itemReportService";
import {
  listWastedOverallReportsForMarket,
  reviewWastedOverallReport,
} from "../../services/wastedOverallService";
import { listSuddenTasks } from "../../services/suddenTaskService";
import {
  listExtraHoursRequestsForMarket,
  reviewExtraHoursRequest,
} from "../../services/attendanceService";
import { ApiError } from "../../services/apiClient";

// Only these submission kinds have a real staff review endpoint today
// (Activity, Wasted Overall, Extra Hours) — Item Reports and Sudden Tasks
// don't, so no Approve/Reject is rendered for those (a real gap, not
// hidden: showing non-functional buttons would be exactly the "fake
// frontend-only button" this fix pass explicitly rules out).
//
// reviewExtraHoursRequest's real body shape is { status, reviewNote } —
// this adapter maps handleReview's shared { status, rejectionReason }
// call shape onto that, rather than changing handleReview itself (used
// by the other two kinds too).
const REVIEWABLE_KINDS = {
  ACTIVITY: reviewActivity,
  WASTED_OVERALL: reviewWastedOverallReport,
  EXTRA_HOURS: (id, body) =>
    reviewExtraHoursRequest(
      id,
      body.status === "REJECTED"
        ? { status: body.status, reviewNote: body.rejectionReason }
        : { status: body.status },
    ),
};

const CATEGORY_LABEL = {
  EXPIRED_ITEMS: "expired items",
  SHELF_CLEANING: "shelf cleaning",
  PRODUCT_CUSTOMIZATION: "product customization",
  DAILY_CLEANING: "daily cleaning",
  ITEM_COUNTING: "item counting",
  LABEL_CHECKING: "a label issue",
  FACING: "facing",
  REFILLING: "refilling",
};
const WASTED_LABEL = {
  EGGS: "eggs",
  TOMATO: "tomato",
  POTATO: "potato",
  CUCUMBER: "cucumber",
  ONION: "onion",
  OTHER: "other",
};

function wastedItemLabel(w) {
  if (w.item === "OTHER" && w.otherItemName) return w.otherItemName;
  return WASTED_LABEL[w.item] ?? w.item.toLowerCase();
}
function wastedQuantityLabel(w) {
  return w.item === "EGGS"
    ? `${w.quantityCount} egg${w.quantityCount === 1 ? "" : "s"}`
    : `${w.quantityKg}kg`;
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// TodayActivityFeed.jsx — a real, automatic feed of what happened in the
// Supervisor's market today, merged from every real source that already
// exists: Activities (shelf cleaning, facing, item counting, etc.),
// Expired/Wasted Item reports, Wasted Overall reports, and completed
// Sudden Tasks. Nothing here is invented — this is "Automatically
// Received Information" (spec category A), a pure read/merge over
// endpoints that already exist, sorted by time, today only.
export default function TodayActivityFeed({ marketId }) {
  const { data, error, loading, reload } = useAsync(
    async () => {
      const [activities, itemReports, wasted, suddenTasks, extraHours] =
        await Promise.all([
          listActivitiesForMarket({ marketId, status: "PENDING" }),
          listItemReportsForMarket({ marketId }),
          listWastedOverallReportsForMarket({ marketId }),
          listSuddenTasks({ status: "COMPLETED" }),
          listExtraHoursRequestsForMarket({ marketId }),
        ]);

      const items = [
        ...activities.map((a) => ({
          id: `activity-${a.id}`,
          kind: "ACTIVITY",
          icon: Sparkles,
          employeeName: a.employee?.name ?? "Unknown",
          title: `completed ${CATEGORY_LABEL[a.category] ?? a.category.toLowerCase()}`,
          subtitle:
            a.notes ||
            (a.images?.length ? `${a.images.length} photo(s)` : null),
          timestamp: a.updatedAt ?? a.createdAt,
          raw: a,
        })),
        ...itemReports.map((r) => ({
          id: `item-report-${r.id}`,
          kind: "ITEM_REPORT",
          icon: PackageX,
          employeeName: r.employee?.name ?? "Unknown",
          title: `reported ${r.condition === "EXPIRED" ? "expired" : "wasted"} items`,
          subtitle: `${r.product?.name ?? "Item"} × ${r.quantity}`,
          timestamp: r.reportedAt,
          raw: r,
        })),
        ...wasted.map((w) => ({
          id: `wasted-${w.id}`,
          kind: "WASTED_OVERALL",
          icon: PackageX,
          employeeName: w.employee?.name ?? "Unknown",
          title: "submitted a waste report",
          subtitle: `${wastedItemLabel(w)} — ${wastedQuantityLabel(w)}`,
          timestamp: w.reportedAt,
          raw: w,
        })),
        ...suddenTasks.map((t) => ({
          id: `sudden-task-${t.id}`,
          kind: "SUDDEN_TASK",
          icon: CheckCircle2,
          employeeName: t.employee?.name ?? "Unknown",
          title: `completed "${t.title}"`,
          subtitle: null,
          timestamp: t.completedAt ?? t.assignedAt,
          raw: t,
        })),
        ...extraHours.map((r) => ({
          id: `extra-hours-${r.id}`,
          kind: "EXTRA_HOURS",
          icon: Clock3,
          employeeName: r.employee?.name ?? "Unknown",
          title: `reported ${r.hours} extra hour${r.hours === 1 ? "" : "s"}`,
          subtitle: r.reason,
          timestamp: r.createdAt,
          raw: r,
        })),
      ]
        .filter((item) => isToday(item.timestamp))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return items;
    },
    { deps: [marketId], fallbackError: "Could not load today's activity." },
  );

  const [selected, setSelected] = useState(null);

  if (loading) return <SkeletonCard className="h-40" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  if (data.length === 0) {
    return (
      <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
        <ClipboardList size={22} className="mx-auto text-[#4C5266] mb-2" />
        <p className="text-sm text-[#8B93A8]">No activity yet today.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {data.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="w-full text-left flex items-start gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
            >
              <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F47A20]/10 flex items-center justify-center text-[#F47A20]">
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">
                  <span className="font-semibold">{item.employeeName}</span>{" "}
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-xs text-[#8B93A8] mt-0.5">
                    {item.subtitle}
                  </p>
                )}
                <p className="text-[11px] text-[#4C5266] mt-1">
                  {timeLabel(item.timestamp)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.employeeName}` : ""}
      >
        {selected && (
          <FeedItemDetail
            item={selected}
            onReviewed={() => {
              setSelected(null);
              reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function FeedItemDetail({ item, onReviewed }) {
  const { raw, kind } = item;
  const [reasonDraft, setReasonDraft] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(null); // "APPROVED" | "REJECTED" | null
  const [reviewError, setReviewError] = useState(null);

  const row = (label, value) =>
    value != null && value !== "" ? (
      <div className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-white/[0.05] last:border-0">
        <span className="text-[#8B93A8]">{label}</span>
        <span className="text-white text-right">{value}</span>
      </div>
    ) : null;

  const reviewFn = REVIEWABLE_KINDS[kind];
  const canReview = !!reviewFn && raw.status === "PENDING";
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteItemReport(raw.id);
      onReviewed();
    } finally {
      setDeleting(false);
    }
  }

  async function handleReview(status) {
    if (status === "REJECTED" && !rejecting) {
      setRejecting(true);
      return;
    }
    if (status === "REJECTED" && !reasonDraft.trim()) {
      setReviewError("A rejection reason is required.");
      return;
    }
    setBusy(status);
    setReviewError(null);
    try {
      await reviewFn(
        raw.id,
        status === "REJECTED"
          ? { status, rejectionReason: reasonDraft.trim() }
          : { status },
      );
      onReviewed();
    } catch (err) {
      setReviewError(
        err instanceof ApiError
          ? err.message
          : "Could not submit this review. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {row(
        "Date",
        new Date(item.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      )}
      {row(
        "Time",
        new Date(item.timestamp).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      )}

      {kind === "ACTIVITY" && (
        <>
          {row("Category", CATEGORY_LABEL[raw.category] ?? raw.category)}
          {row("Status", raw.status)}
          {row("Notes", raw.notes)}
          {row("Rejection reason", raw.rejectionReason)}
        </>
      )}
      {kind === "ITEM_REPORT" && (
        <>
          {row("Item", raw.product?.name)}
          {row("Barcode", raw.product?.barcode)}
          {row("Condition", raw.condition)}
          {row("Quantity", raw.quantity)}
          {row("Status", raw.status)}
          {row("Notes", raw.notes)}
        </>
      )}
      {kind === "WASTED_OVERALL" && (
        <>
          {row("Item", wastedItemLabel(raw))}
          {row("Quantity", wastedQuantityLabel(raw))}
          {row("Status", raw.status)}
          {row("Notes", raw.notes)}
          {row("Rejection reason", raw.rejectionReason)}
        </>
      )}
      {kind === "SUDDEN_TASK" && (
        <>
          {row("Task", raw.title)}
          {row("Description", raw.description)}
          {row("Priority", raw.priority)}
        </>
      )}
      {kind === "EXTRA_HOURS" && (
        <>
          {row(
            "Date worked",
            new Date(raw.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          )}
          {row("Employee declared", `${raw.hours}h`)}
          {/* Extra Hours spec §8: compare the declaration against the real
              attendance-derived figure for that same date — the
              attendance record stays the primary source of truth; this
              is shown for the reviewer to compare, not to auto-decide. */}
          {row(
            "Attendance record shows",
            raw.hasAttendanceRecord
              ? `${raw.attendanceExtraHours?.toFixed(2)}h extra`
              : "No attendance record for this date yet",
          )}
          {row("Status", raw.status)}
          {row("Reason", raw.reason)}
          {row("Review note", raw.reviewNote)}
        </>
      )}

      {raw.imageUrl && (
        <AuthenticatedImage
          src={raw.imageUrl}
          alt=""
          className="mt-3 rounded-lg w-full max-h-64 object-cover"
        />
      )}
      {raw.photoUrl && (
        <AuthenticatedImage
          src={raw.photoUrl}
          alt=""
          className="mt-3 rounded-lg w-full max-h-64 object-cover"
        />
      )}
      {raw.images?.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {raw.images.map((img) => (
            <AuthenticatedImage
              key={img.id}
              src={img.url}
              alt=""
              className="rounded-lg aspect-square object-cover"
            />
          ))}
        </div>
      )}

      {canReview && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          {rejecting && (
            <textarea
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              placeholder="Reason for rejecting..."
              rows={2}
              autoFocus
              className="w-full mb-2 resize-none rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-red-500/50"
            />
          )}
          {reviewError && (
            <p className="mb-2 text-xs text-red-400">{reviewError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleReview("APPROVED")}
              disabled={busy != null || rejecting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {busy === "APPROVED" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Approve
            </button>
            <button
              type="button"
              onClick={() => handleReview("REJECTED")}
              disabled={busy != null}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {busy === "REJECTED" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <XCircle size={15} />
              )}
              {rejecting ? "Confirm Reject" : "Reject"}
            </button>
          </div>
        </div>
      )}

      {kind === "ITEM_REPORT" && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-red-400 bg-red-500/[0.06] border border-red-500/20 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
        >
          {deleting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}{" "}
          Delete Report
        </button>
      )}
    </div>
  );
}
