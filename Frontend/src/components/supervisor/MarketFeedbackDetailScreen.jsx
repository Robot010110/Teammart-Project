import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Sparkles, Clock3, Store, User, CalendarCheck } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { getMarketFeedback } from "../../services/marketManagementService";

const PRIORITY_STYLE = {
  LOW: "bg-white/5 text-[#9AA1B4] ring-white/10",
  NORMAL: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  HIGH: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  URGENT: "bg-red-500/10 text-red-400 ring-red-500/20",
};

function timeLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// MarketFeedbackDetailScreen.jsx — Supervisor <-> Regional Manager
// connectivity fix: what a Supervisor's MARKET_FEEDBACK notification
// actually opens now (see notificationLinks.js's MARKET_FEEDBACK case).
// Real data — GET /api/markets/feedback/:feedbackId (see
// marketManagementController.getMarketFeedbackDetail's own comment on
// why there's no marketId in the URL) — this is the complete original
// Warning/Recognition record, not just the notification's own
// title/body. Deliberately NOT a chat message and NOT routed through
// chatService/communicationsService — MarketFeedback stays its own
// formal record, this screen is purely a read-only view of it.
export default function MarketFeedbackDetailScreen({ basePath }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: feedback, error, loading, reload } = useAsync(() => getMarketFeedback(id), { deps: [id] });

  if (loading) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-[360px]" /></div>;
  }
  if (error) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><ErrorBanner message={error} onRetry={reload} /></div>;
  }
  if (!feedback) return null;

  const isWarning = feedback.type === "WARNING";

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden">
        <div className={`h-1 w-full ${isWarning ? "bg-red-500" : "bg-emerald-500"}`} />
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              isWarning ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {isWarning ? <ShieldAlert size={13} /> : <Sparkles size={13} />}
              {isWarning ? "Warning" : "Recognition"}
            </span>
            {feedback.priority && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${PRIORITY_STYLE[feedback.priority] || PRIORITY_STYLE.NORMAL}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {feedback.priority}
              </span>
            )}
          </div>

          {feedback.category && (
            <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1">{feedback.category}</p>
          )}
          <h1 className="text-lg font-semibold text-white">{feedback.title}</h1>

          <div className="mt-3 space-y-1.5 text-xs text-[#8B93A8]">
            <p className="flex items-center gap-1.5"><Clock3 size={13} /> {timeLabel(feedback.createdAt)}</p>
            <p className="flex items-center gap-1.5"><Store size={13} /> {feedback.market?.name}</p>
            <p className="flex items-center gap-1.5"><User size={13} /> {feedback.regionalManager?.name} &middot; Regional Manager</p>
            {feedback.visit && (
              <p className="flex items-center gap-1.5"><CalendarCheck size={13} /> From a visit on {new Date(feedback.visit.visitDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
            )}
          </div>

          <p className="mt-4 text-sm text-[#D5D9E5] leading-relaxed whitespace-pre-wrap">{feedback.description}</p>

          {feedback.photoUrl && (
            <AuthenticatedImage src={feedback.photoUrl} alt="" className="mt-4 rounded-xl w-full max-h-64 object-cover" />
          )}
        </div>
      </div>
    </div>
  );
}
