import { CheckCircle2, XCircle, MessageSquareQuote, ChevronRight } from "lucide-react";
import { CATEGORY_LABELS } from "../../../data/workspaceData";

// RecentReviews.jsx — the employee's most recently decided activities.
//
// Real data, no new endpoint: GET /api/activities already returns every
// one of the employee's own activities including the scalar review
// fields a Supervisor's approve/reject writes (status, reviewedAt,
// rejectionReason — see the Activity model and
// activitiesController.reviewActivity). This filters to decided ones and
// sorts by when they were actually reviewed.
//
// Two things in the visual reference are deliberately NOT reproduced,
// because TeamMart has no data behind them and inventing them would put
// fake numbers on a performance record: the per-review percentage ring
// and the star rating. There is no numeric score or rating on a review
// in this schema. The row keeps the same shape and visual weight — a
// glowing status badge on the left, the decision and date, the real
// review comment, a chevron — with the category standing in where the
// reference shows a score.
//
// The rejection reason is shown verbatim as the review comment when
// there is one; an approval with no note simply shows no note, never a
// generated compliment.

function reviewDateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function RecentReviews({ activities, limit = 4, onSeeAll }) {
  const reviewed = (activities ?? [])
    .filter((a) => a.status === "APPROVED" || a.status === "REJECTED")
    .sort((a, b) => new Date(b.reviewedAt ?? b.date) - new Date(a.reviewedAt ?? a.date))
    .slice(0, limit);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-white">Recent Reviews</h2>
        {onSeeAll && reviewed.length > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[12px] font-semibold text-[#F47A20] hover:text-[#ff8b36] transition-colors"
          >
            View All
          </button>
        )}
      </div>

      {reviewed.length === 0 ? (
        <div className="rounded-[22px] px-4 py-9 bg-[#0D1223]/80 border border-white/[0.07] text-center">
          <span className="mx-auto mb-3 w-11 h-11 rounded-full grid place-items-center bg-white/[0.04] text-[#4C5266]">
            <MessageSquareQuote size={19} />
          </span>
          <p className="text-sm text-[#8B93A8]">No reviews yet.</p>
          <p className="mt-1 text-xs text-[#4C5266]">
            Your supervisor's decisions on your activities will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reviewed.map((a) => {
            const approved = a.status === "APPROVED";
            const Icon = approved ? CheckCircle2 : XCircle;
            return (
              <article
                key={a.id}
                className={`rounded-[18px] p-3.5 bg-[#0D1223]/80 border ${
                  approved ? "border-emerald-500/[0.16]" : "border-[#FF5C5C]/[0.16]"
                } shadow-[0_8px_28px_-14px_rgba(0,0,0,0.9)] flex items-start gap-3`}
              >
                <span
                  className={`shrink-0 w-11 h-11 rounded-full grid place-items-center bg-white/[0.03] ${
                    approved ? "text-emerald-400" : "text-[#FF5C5C]"
                  }`}
                  style={{
                    boxShadow: approved
                      ? "0 0 16px 1px rgba(52,211,153,0.35), inset 0 0 0 1px rgba(52,211,153,0.25)"
                      : "0 0 16px 1px rgba(255,92,92,0.35), inset 0 0 0 1px rgba(255,92,92,0.25)",
                  }}
                >
                  <Icon size={19} strokeWidth={2.1} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12.5px] text-[#9AA1B4]">{reviewDateLabel(a.reviewedAt ?? a.date)}</p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${
                        approved
                          ? "bg-emerald-500/[0.14] text-emerald-400"
                          : "bg-[#FF5C5C]/[0.14] text-[#FF5C5C]"
                      }`}
                    >
                      {approved ? "Approved" : "Rejected"}
                    </span>
                  </div>

                  <p className="mt-1 text-[13px] font-medium text-white truncate">
                    {CATEGORY_LABELS[a.category] ?? a.category}
                  </p>

                  {a.rejectionReason && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[#8B93A8]">{a.rejectionReason}</p>
                  )}
                </div>

                <ChevronRight size={16} className="shrink-0 mt-3 text-[#5C6479]" />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
