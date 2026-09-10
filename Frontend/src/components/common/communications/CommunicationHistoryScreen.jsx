import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, ChevronUp, Clock3 } from "lucide-react";
import { useAsync } from "../../../hooks/useAsync";
import ErrorBanner from "../ErrorBanner";
import { SkeletonCard } from "../SkeletonCard";
import SenderIdentityBadge from "../SenderIdentityBadge";
import { listSentCommunications, getCommunicationProgress } from "../../../services/communicationsService";
import { listZones } from "../../../services/zoneService";

function timeLabel(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const TARGET_ROLE_LABEL = { WORKER: "roles.worker", CASHIER: "roles.cashier", BUTCHER: "sup.butcher", EVERYONE: "rm.everyone" };
const SCOPE_LABEL = (c, t) =>
  c.scopeType === "MARKET"
    ? c.market?.name
    : c.scopeType === "ZONE"
      ? t("rm.zoneNumbered", { number: c.zone?.number })
      : t("rm.allMarkets");

function ProgressRow({ communication }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { data: detail, loading } = useAsync(() => (expanded ? getCommunicationProgress(communication.id) : Promise.resolve(null)), { deps: [expanded] });

  return (
    <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full text-start p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{communication.title}</p>
            <p className="text-xs text-[#8B93A8] mt-0.5">{SCOPE_LABEL(communication, t)} · {TARGET_ROLE_LABEL[communication.targetRole] ? t(TARGET_ROLE_LABEL[communication.targetRole]) : communication.targetRole}{communication.targetDepartment ? ` · ${communication.targetDepartment}` : ""}</p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-[#4C5266] shrink-0" /> : <ChevronDown size={16} className="text-[#4C5266] shrink-0" />}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-[#6B7284]">
          <span className="flex items-center gap-1"><Clock3 size={11} /> {timeLabel(communication.createdAt)}</span>
          <span>{communication.recipientCount === 1 ? t("rm.recipientCount", { count: communication.recipientCount }) : t("rm.recipientsCount", { count: communication.recipientCount })}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
          {loading ? (
            <SkeletonCard className="h-16" />
          ) : detail ? (
            <div className="grid grid-cols-4 gap-2 text-center">
              <ProgressStat label={t("rm.recipients")} value={detail.progress.recipients} />
              <ProgressStat label={t("rm.read")} value={detail.progress.read} />
              <ProgressStat label={t("emp.acknowledged")} value={detail.progress.acknowledged} />
              <ProgressStat label={t("status.completed")} value={detail.progress.completed} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ProgressStat({ label, value }) {
  return (
    <div className="rounded-lg p-2 bg-white/[0.03]">
      <p className="text-base font-bold text-white">{value}</p>
      <p className="text-[10px] text-[#8B93A8] mt-0.5">{label}</p>
    </div>
  );
}

// CommunicationHistoryScreen.jsx — Warnings & Notifications §32-33:
// shared by both Admin and Zone Manager (session-driven identity badge
// only). Sender-scoping (a Zone Manager only ever sees their OWN sends)
// is enforced by the backend (GET /api/communications/sent), not by
// anything filtered here.
// bare — Chat Hub §4: when embedded as the Awareness tab's content
// (RmChatPage.jsx), the hub already owns page-level padding/max-width
// and its own "Awareness" heading, so this skips its standalone
// heading/wrapper and returns just the list + New button. The
// standalone /rm/communications route (still reachable from Settings/
// elsewhere) is unaffected — bare defaults to false.
export default function CommunicationHistoryScreen({ session, basePath, bare = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: communications, error, loading, reload } = useAsync(listSentCommunications, { deps: [] });
  // Zone.number, not Zone.id — see CommunicationComposer.jsx's identical
  // comment on senderZoneNumber.
  const { data: zones } = useAsync(listZones, { deps: [] });

  const body = (
    <>
      <button
        type="button"
        onClick={() => navigate(`${basePath}/communications/new`)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mb-5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors"
      >
        <Plus size={15} /> {t("rm.newCommunication")}
      </button>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-20" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : communications?.length === 0 ? (
        <div className="rounded-2xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center">
          <p className="text-sm text-[#8B93A8]">{t("rm.youHavenTSentAnyCommunications")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {communications.map((c) => <ProgressRow key={c.id} communication={c} />)}
        </div>
      )}
    </>
  );

  if (bare) return body;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-white">{t("rm.warningsNotifications")}</h1>
        <SenderIdentityBadge senderRole={session.role === "admin" ? "ADMIN" : session.staffRole} senderZone={zones?.[0]?.number} size="sm" />
      </div>
      <p className="text-xs text-[#6B7284] mb-5">{t("rm.communicationsYouVeSent")}</p>
      {body}
    </div>
  );
}
