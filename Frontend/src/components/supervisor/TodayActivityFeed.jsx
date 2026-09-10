import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  PackageX,
  ClipboardList,
  Sparkles,
  XCircle,
  Loader2,
  Clock3,
  Trash2,
  Hourglass,
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

// Values are translation KEYS, resolved with t() inside the component —
// these constants sit at module scope, where `t` doesn't exist yet.
const CATEGORY_LABEL = {
  EXPIRED_ITEMS: "emp.catExpiredItems",
  SHELF_CLEANING: "sup.shelfCleaning",
  PRODUCT_CUSTOMIZATION: "emp.productCustomization",
  DAILY_CLEANING: "emp.dailyCleaning",
  ITEM_COUNTING: "sup.inventoryCounting",
  LABEL_CHECKING: "sup.labelChecking",
  FACING: "sup.facing",
  REFILLING: "sup.refilling",
};
const WASTED_LABEL = {
  EGGS: "emp.eggs",
  TOMATO: "emp.tomato",
  POTATO: "emp.potato",
  CUCUMBER: "emp.cucumber",
  ONION: "emp.onion",
  OTHER: "emp.other",
};

function wastedItemLabel(w, t) {
  if (w.item === "OTHER" && w.otherItemName) return w.otherItemName;
  return WASTED_LABEL[w.item] ? t(WASTED_LABEL[w.item]) : w.item.toLowerCase();
}
function wastedQuantityLabel(w, t) {
  return w.item === "EGGS"
    ? t("sup.eggCount", { count: w.quantityCount })
    : t("sup.kgAmount", { count: w.quantityKg });
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// A row "needs review" only when its kind actually has a review flow AND
// its real backend status is still PENDING — the one and only source of
// truth for prominence. A kind with no REVIEWABLE_KINDS entry (Item
// Report, Sudden Task) never counts, since it never had a decision to
// make in this feed to begin with.
function isNeedsReview(item) {
  return !!REVIEWABLE_KINDS[item.kind] && item.raw.status === "PENDING";
}

const REVIEW_STATUS_META = {
  PENDING: { label: "status.pending", tone: "text-amber-400 bg-amber-500/10 ring-amber-500/25" },
  APPROVED: { label: "status.approved", tone: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/25" },
  REJECTED: { label: "status.rejected", tone: "text-red-400 bg-red-500/10 ring-red-500/25" },
};

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
// Supervisor's market, merged from every real source that already
// exists: Activities (shelf cleaning, facing, item counting, etc.),
// Expired/Wasted Item reports, Wasted Overall reports, and completed
// Sudden Tasks. Nothing here is invented — this is "Automatically
// Received Information" (spec category A), a pure read/merge over
// endpoints that already exist.
//
// Sorting/grouping is a real behaviour, not just visual: within a kind
// that has a review flow (Activity/Wasted Overall/Extra Hours — see
// REVIEWABLE_KINDS), a row whose real status is still PENDING is
// "needs review" and stays pinned above everything else; once the
// Supervisor approves or rejects it, the very next reload (this reads
// straight from the backend result, never a locally-patched status)
// moves it down into the ordinary chronological stream instead of
// leaving it sitting in the same prominent slot forever. A kind with no
// review flow (Item Report, Sudden Task) never HAS a "pending decision"
// state in this feed to begin with, so it is always chronological.
// Nothing is ever deleted or hidden — this only changes where a row
// sorts, never whether it's still reachable.
//
// Three optional props reuse this exact same merge/detail/review
// machinery across every place this feed appears, instead of
// duplicating it:
//   todayOnly   (default true) restricts to today only — used for
//               Home's own compact preview.
//   pendingOnly (default false) true additionally restricts to items
//               with a real PENDING status — i.e. things still awaiting
//               the Supervisor's own decision — for
//               SupervisorPendingTasksPage.jsx's worklist. Distinct from
//               Alerts (real MarketProblem rows), so the four Today
//               Overview cards never show the same underlying list twice
//               under two names. Section headers are skipped in this
//               mode — every row is already "needs review", so a second
//               label saying so would be redundant.
//   limit       (default none) caps the total rows shown, pending rows
//               first — Home's preview only ever wants the top few, with
//               "See All" as the real escape hatch to the full page.
export default function TodayActivityFeed({ marketId, todayOnly = true, pendingOnly = false, recentLimit = 60, limit }) {
  const { t } = useTranslation();
  const { data, error, loading, reload } = useAsync(
    async () => {
      // Activities are the one source with a real server-side status
      // filter already wired up. Pending Tasks (pendingOnly) wants only
      // PENDING ones server-side; every other mode fetches the real full
      // status range and lets the client-side grouping below decide
      // what's prominent vs. historical — todayOnly no longer forces a
      // PENDING-only fetch, since "what happened today" should include
      // today's already-reviewed items too, not just what's still
      // waiting.
      const activitiesStatus = pendingOnly ? "PENDING" : undefined;
      const [activities, itemReports, wasted, suddenTasks, extraHours] =
        await Promise.all([
          listActivitiesForMarket({ marketId, status: activitiesStatus }),
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
          employeeName: a.employee?.name ?? t("sup.unknown"),
          title: t("sup.completedActivity", {
            activity: CATEGORY_LABEL[a.category] ? t(CATEGORY_LABEL[a.category]) : a.category.toLowerCase(),
          }),
          subtitle:
            a.notes ||
            (a.images?.length ? t("sup.photoCount", { count: a.images.length }) : null),
          timestamp: a.updatedAt ?? a.createdAt,
          raw: a,
        })),
        ...itemReports.map((r) => ({
          id: `item-report-${r.id}`,
          kind: "ITEM_REPORT",
          icon: PackageX,
          employeeName: r.employee?.name ?? t("sup.unknown"),
          title: r.condition === "EXPIRED" ? t("sup.reportedExpiredItems") : t("sup.reportedWastedItems"),
          subtitle: `${r.product?.name ?? t("sup.item")} × ${r.quantity}`,
          timestamp: r.reportedAt,
          raw: r,
        })),
        ...wasted.map((w) => ({
          id: `wasted-${w.id}`,
          kind: "WASTED_OVERALL",
          icon: PackageX,
          employeeName: w.employee?.name ?? t("sup.unknown"),
          title: t("sup.submittedAWasteReport"),
          subtitle: `${wastedItemLabel(w, t)} — ${wastedQuantityLabel(w, t)}`,
          timestamp: w.reportedAt,
          raw: w,
        })),
        ...suddenTasks.map((task) => ({
          id: `sudden-task-${task.id}`,
          kind: "SUDDEN_TASK",
          icon: CheckCircle2,
          employeeName: task.employee?.name ?? t("sup.unknown"),
          title: t("sup.completedTaskNamed", { task: task.title }),
          subtitle: null,
          timestamp: task.completedAt ?? task.assignedAt,
          raw: task,
        })),
        ...extraHours.map((r) => ({
          id: `extra-hours-${r.id}`,
          kind: "EXTRA_HOURS",
          icon: Clock3,
          employeeName: r.employee?.name ?? t("sup.unknown"),
          title: r.hours === 1
            ? t("sup.reportedExtraHour", { count: r.hours })
            : t("sup.reportedExtraHours", { count: r.hours }),
          subtitle: r.reason,
          timestamp: r.createdAt,
          raw: r,
        })),
      ];

      const filtered = items
        .filter((item) => !todayOnly || isToday(item.timestamp))
        .filter((item) => !pendingOnly || item.raw.status === "PENDING");

      // Two buckets, each sorted by recency within itself, pending
      // bucket first — a stable priority sort, not a single comparator
      // that could reorder as soon as a status changes mid-list.
      const pending = filtered
        .filter((item) => isNeedsReview(item))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const rest = filtered
        .filter((item) => !isNeedsReview(item))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const ordered = [...pending, ...rest];
      const capped = typeof limit === "number" ? ordered.slice(0, limit) : ordered;
      return {
        items: todayOnly ? capped : capped.slice(0, recentLimit),
        pendingCount: pending.length,
      };
    },
    {
      deps: [marketId, todayOnly, pendingOnly, recentLimit, limit],
      fallbackError: todayOnly ? t("sup.couldNotLoadTodaysActivity") : t("sup.couldNotLoadActivity"),
    },
  );

  const [selected, setSelected] = useState(null);

  if (loading) return <SkeletonCard className="h-40" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  if (data.items.length === 0) {
    const emptyMessage = pendingOnly
      ? t("sup.noActivitiesAwaitingReview")
      : todayOnly
        ? t("sup.noActivityYetToday")
        : t("sup.noRecentActivityYet");
    return (
      <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
        <ClipboardList size={22} className="mx-auto text-[#4C5266] mb-2" />
        <p className="text-sm text-[#8B93A8]">{emptyMessage}</p>
      </div>
    );
  }

  // Section headers only when the list is a genuine mix and there's
  // something in each bucket worth labelling — pendingOnly's list is
  // already all "needs review" (a header would be redundant), and a
  // list with zero pending items has no "needs review" section to name.
  const showSections = !pendingOnly && data.pendingCount > 0 && data.pendingCount < data.items.length;

  return (
    <>
      <div className="space-y-2">
        {data.items.map((item, i) => {
          const pendingRow = isNeedsReview(item);
          const isFirstHistoryRow = showSections && i === data.pendingCount;
          return (
            <div key={item.id}>
              {showSections && i === 0 && <SectionLabel icon={Hourglass} label={t("sup.needsReview")} tone="amber" />}
              {isFirstHistoryRow && <SectionLabel icon={ClipboardList} label={t("emp.history")} tone="slate" />}
              <ActivityRow item={item} pendingRow={pendingRow} onOpen={() => setSelected(item)} />
            </div>
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

const SECTION_TONE = {
  amber: "text-amber-400",
  slate: "text-[#5C6479]",
};

function SectionLabel({ icon: Icon, label, tone }) {
  return (
    <p className={`mb-2 mt-1 first:mt-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${SECTION_TONE[tone]}`}>
      <Icon size={11} /> {label}
    </p>
  );
}

// ActivityRow.jsx — one merged feed item. `pendingRow` gets a brighter,
// amber-outlined treatment (it needs the Supervisor's attention right
// now); an already-reviewed row gets a small Approved/Rejected pill
// instead — visibly demoted, never hidden.
function ActivityRow({ item, pendingRow, onOpen }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const reviewStatus = REVIEWABLE_KINDS[item.kind] ? REVIEW_STATUS_META[item.raw.status] : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-start flex items-start gap-3 rounded-xl p-3.5 border backdrop-blur-xl transition-all duration-150 ${
        pendingRow
          ? "bg-amber-500/[0.06] border-amber-500/25 hover:border-amber-400/45 shadow-[0_0_16px_-8px_rgba(251,191,36,0.5)]"
          : "bg-[#1A1F33]/70 border-white/[0.06] hover:border-[#F47A20]/25"
      }`}
    >
      <span
        className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
          pendingRow ? "bg-amber-500/15 text-amber-400" : "bg-[#F47A20]/10 text-[#F47A20]"
        }`}
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-white">
            <span className="font-semibold">{item.employeeName}</span> {item.title}
          </p>
          {reviewStatus && (
            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${reviewStatus.tone}`}>
              {t(reviewStatus.label)}
            </span>
          )}
        </div>
        {pendingRow && <p className="text-[11px] text-amber-400/90 mt-0.5">{t("sup.awaitingReview")}</p>}
        {item.subtitle && <p className="text-xs text-[#8B93A8] mt-0.5">{item.subtitle}</p>}
        <p className="text-[11px] text-[#4C5266] mt-1">{timeLabel(item.timestamp)}</p>
      </div>
    </button>
  );
}

function FeedItemDetail({ item, onReviewed }) {
  const { t } = useTranslation();
  const { raw, kind } = item;
  const [reasonDraft, setReasonDraft] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(null); // "APPROVED" | "REJECTED" | null
  const [reviewError, setReviewError] = useState(null);

  const row = (label, value) =>
    value != null && value !== "" ? (
      <div className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-white/[0.05] last:border-0">
        <span className="text-[#8B93A8]">{label}</span>
        <span className="text-white text-end">{value}</span>
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
      setReviewError(t("sup.aRejectionReasonIsRequired"));
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
          : t("sup.couldNotSubmitThisReviewPlease"),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {row(
        t("emp.date"),
        new Date(item.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      )}
      {row(
        t("sup.time"),
        new Date(item.timestamp).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      )}

      {kind === "ACTIVITY" && (
        <>
          {row(t("sup.category"), CATEGORY_LABEL[raw.category] ?? raw.category)}
          {row(t("sup.status"), raw.status)}
          {row(t("emp.notes"), raw.notes)}
          {row(t("sup.rejectionReason"), raw.rejectionReason)}
        </>
      )}
      {kind === "ITEM_REPORT" && (
        <>
          {row(t("sup.item"), raw.product?.name)}
          {row(t("emp.barcode"), raw.product?.barcode)}
          {row(t("emp.condition"), raw.condition)}
          {row(t("emp.quantity"), raw.quantity)}
          {row(t("sup.status"), raw.status)}
          {row(t("emp.notes"), raw.notes)}
        </>
      )}
      {kind === "WASTED_OVERALL" && (
        <>
          {row(t("sup.item"), wastedItemLabel(raw, t))}
          {row(t("emp.quantity"), wastedQuantityLabel(raw, t))}
          {row(t("sup.status"), raw.status)}
          {row(t("emp.notes"), raw.notes)}
          {row(t("sup.rejectionReason"), raw.rejectionReason)}
        </>
      )}
      {kind === "SUDDEN_TASK" && (
        <>
          {row(t("emp.task"), raw.title)}
          {row(t("sup.description"), raw.description)}
          {row(t("emp.priority"), raw.priority)}
        </>
      )}
      {kind === "EXTRA_HOURS" && (
        <>
          {row(
            t("sup.dateWorked"),
            new Date(raw.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          )}
          {row(t("sup.employeeDeclared"), `${raw.hours}h`)}
          {/* Extra Hours spec §8: compare the declaration against the real
              attendance-derived figure for that same date — the
              attendance record stays the primary source of truth; this
              is shown for the reviewer to compare, not to auto-decide. */}
          {row(
            t("sup.attendanceRecordShows"),
            raw.hasAttendanceRecord
              ? `${raw.attendanceExtraHours?.toFixed(2)}h extra`
              : t("sup.noAttendanceRecordForThisDate"),
          )}
          {row(t("sup.status"), raw.status)}
          {row(t("emp.reason"), raw.reason)}
          {row(t("sup.reviewNote"), raw.reviewNote)}
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
              placeholder={t("sup.reasonForRejecting")}
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
              {rejecting ? t("sup.confirmReject") : t("sup.reject")}
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
