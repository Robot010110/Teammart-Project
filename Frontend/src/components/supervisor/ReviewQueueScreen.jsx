import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, ChevronRight } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import ReviewDecisionModal from "./ReviewDecisionModal";
import { getReviewQueue } from "../../services/workReviewService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

// ReviewQueueScreen.jsx — everything in this market still waiting to be
// judged, merged across all five reviewable work types.
//
// The queue is a union of five real queries rather than a maintained
// inbox table, so it cannot go stale: a piece of work is in this list if
// and only if it is genuinely still pending. Reviewing something removes
// it from the list immediately (optimistically) and the next reload
// confirms it.

const TYPE_LABELS = {
  ACTIVITY: "sup.workTypeActivity",
  TASK: "sup.workTypeTask",
  ITEM_REPORT: "sup.workTypeItemReport",
  PRICE_REPORT: "sup.workTypePriceReport",
  WASTED_OVERALL: "sup.workTypeWastedOverall",
};

const TYPE_TONE = {
  ACTIVITY: "text-[#F9A03C] bg-[#F47A20]/[0.12]",
  TASK: "text-sky-400 bg-sky-500/[0.12]",
  ITEM_REPORT: "text-violet-400 bg-violet-500/[0.12]",
  PRICE_REPORT: "text-emerald-400 bg-emerald-500/[0.12]",
  WASTED_OVERALL: "text-amber-400 bg-amber-500/[0.12]",
};

function whenLabel(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ReviewQueueScreen({ marketId }) {
  const { t } = useTranslation();
  const [reviewing, setReviewing] = useState(null);
  const [dismissed, setDismissed] = useState([]);
  const [toast, setToast] = useToast();

  const { data, loading, error, reload } = useAsync(
    () => getReviewQueue({ marketId }),
    { deps: [marketId], fallbackError: "Could not load the review queue." }
  );

  const items = (data?.items ?? []).filter((i) => !dismissed.includes(i.targetId));

  function handleDone(item, outcome) {
    // Removed locally so the supervisor sees the queue shrink immediately;
    // the reload below reconciles with the server's own view.
    setDismissed((prev) => [...prev, item.targetId]);
    setToast(
      outcome === "REJECTED"
        ? t("sup.workRejected")
        : outcome === "APPROVED_WITH_CORRECTION"
          ? t("sup.workApprovedWithCorrection")
          : t("sup.workApproved")
    );
    reload();
  }

  return (
    <div className="px-4 sm:px-6 pb-6 max-w-3xl mx-auto">
      <header className="pt-4 pb-3">
        <h1 className="text-[17px] font-semibold text-white">{t("sup.reviewQueue")}</h1>
        <p className="mt-0.5 text-[11.5px] text-[#8B93A8]">{t("sup.reviewQueueHint")}</p>
      </header>

      {loading && <SkeletonCard className="h-[160px]" />}
      {!loading && error && <ErrorBanner message={error} onRetry={reload} />}

      {!loading && !error && items.length === 0 && (
        <div className="py-12 text-center">
          <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-white/[0.04] text-[#4C5266]">
            <ClipboardList size={20} />
          </span>
          <p className="mt-3 text-[13px] text-[#8B93A8]">{t("sup.reviewQueueEmpty")}</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <p className="mb-2 px-1 text-[11px] text-[#8B93A8]">
            {t("sup.reviewQueueCount", { count: items.length })}
          </p>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={`${item.targetType}-${item.targetId}`}>
                <button
                  type="button"
                  onClick={() => setReviewing(item)}
                  className="w-full text-left flex items-center gap-3 rounded-[18px] p-3 bg-[#0D1223]/80 border border-white/[0.07] hover:border-white/[0.14] transition-colors"
                >
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${TYPE_TONE[item.targetType] ?? "text-white bg-white/[0.08]"}`}>
                    {t(TYPE_LABELS[item.targetType] ?? item.targetType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {/* Who did the work comes first — it is the thing a
                        supervisor scans the queue by. */}
                    <p className="text-[12.5px] font-medium text-white truncate">
                      {item.employeeName ?? t("sup.unknownEmployee")}
                    </p>
                    <p className="text-[10.5px] text-[#8B93A8] truncate">
                      {item.workCategory?.replace(/_/g, " ").toLowerCase()} · {whenLabel(item.submittedAt)}
                    </p>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-[#5C6479]" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {reviewing && (
        <ReviewDecisionModal item={reviewing} onClose={() => setReviewing(null)} onDone={handleDone} />
      )}
      <Toast message={toast} />
    </div>
  );
}
