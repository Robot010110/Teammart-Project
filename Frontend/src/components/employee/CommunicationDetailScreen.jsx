import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, CheckCircle2, Loader2, Send } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import SenderIdentityBadge, { SenderAccentLine } from "../common/SenderIdentityBadge";
import { ApiError } from "../../services/apiClient";
import {
  getMyCommunication, acknowledgeCommunication, startCommunicationTask, completeCommunicationTask,
} from "../../services/communicationsService";

const PRIORITY_STYLE = {
  NORMAL: "bg-white/5 text-[#9AA1B4] ring-white/10",
  IMPORTANT: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  HIGH: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  URGENT: "bg-red-500/10 text-red-400 ring-red-500/20",
};

const TYPE_LABEL = { ANNOUNCEMENT: "Announcement", WARNING: "Warning", TASK: "Task", INFORMATION: "Information" };

function timeLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// CommunicationDetailScreen.jsx — Warnings & Notifications §28: the
// recipient's own view of one targeted communication, with whatever
// action it actually requires (nothing, Acknowledge, or Start->Complete
// with a structured response). Every action here calls the real backend
// endpoint and re-renders from ITS response — this component never
// flips myStatus locally as if the action already succeeded.
export default function CommunicationDetailScreen({ basePath }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: communication, setData, error, loading, reload } = useAsync(() => getMyCommunication(id), { deps: [id] });
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [response, setResponse] = useState({ note: "" });

  async function handleAcknowledge() {
    setActionBusy(true);
    setActionError(null);
    try {
      setData(await acknowledgeCommunication(id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not acknowledge this communication.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleStart() {
    setActionBusy(true);
    setActionError(null);
    try {
      setData(await startCommunicationTask(id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not start this task.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleComplete() {
    setActionBusy(true);
    setActionError(null);
    try {
      setData(await completeCommunicationTask(id, response));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not submit this task.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-[360px]" /></div>;
  }
  if (error) {
    return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><ErrorBanner message={error} onRetry={reload} /></div>;
  }
  if (!communication) return null;

  const needsAcknowledge = communication.actionType === "ACKNOWLEDGEMENT" && !communication.acknowledgedAt;
  const needsStart = communication.actionType === "COMPLETION" && !communication.startedAt && !communication.completedAt;
  const needsComplete = communication.actionType === "COMPLETION" && communication.startedAt && !communication.completedAt;
  const isDone = !!communication.acknowledgedAt && communication.actionType === "ACKNOWLEDGEMENT" || !!communication.completedAt;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[#9AA1B4] hover:text-white mb-4 -ml-1 py-1.5 px-1">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden">
        <SenderAccentLine senderRole={communication.senderRole} />
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <SenderIdentityBadge senderRole={communication.senderRole} senderZone={communication.senderZone} />
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${PRIORITY_STYLE[communication.priority] || PRIORITY_STYLE.NORMAL}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {communication.priority}
            </span>
          </div>

          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mb-1">{TYPE_LABEL[communication.type] || communication.type}</p>
          <h1 className="text-lg font-semibold text-white">{communication.title}</h1>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#8B93A8]">
            <Clock3 size={13} /> {timeLabel(communication.createdAt)}
          </div>

          {communication.deadline && (
            <p className="mt-2 text-xs text-amber-400">Deadline: {timeLabel(communication.deadline)}</p>
          )}

          <p className="mt-4 text-sm text-[#D5D9E5] leading-relaxed whitespace-pre-wrap">{communication.message}</p>

          {actionError && <p className="mt-4 text-xs text-red-400">{actionError}</p>}

          {needsAcknowledge && (
            <button
              type="button" onClick={handleAcknowledge} disabled={actionBusy}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
            >
              {actionBusy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Acknowledge
            </button>
          )}

          {needsStart && (
            <button
              type="button" onClick={handleStart} disabled={actionBusy}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
            >
              {actionBusy ? <Loader2 size={15} className="animate-spin" /> : null}
              Start Task
            </button>
          )}

          {needsComplete && (
            <div className="mt-5 rounded-xl p-4 bg-white/[0.03] border border-white/[0.06]">
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Note (optional)</label>
              <textarea
                value={response.note}
                onChange={(e) => setResponse((r) => ({ ...r, note: e.target.value }))}
                rows={3}
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 resize-none"
                placeholder="Add any relevant details..."
              />
              <button
                type="button" onClick={handleComplete} disabled={actionBusy}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
              >
                {actionBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Submit Result
              </button>
            </div>
          )}

          {isDone && (
            <div className="mt-5 flex items-center gap-2 rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
              <CheckCircle2 size={15} />
              {communication.completedAt ? "Completed" : "Acknowledged"}
              {communication.response?.note && <span className="text-emerald-300/80 font-normal ml-1">— "{communication.response.note}"</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
