import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, ShieldAlert, CheckCircle2, XCircle, Layers, ArrowRightLeft, Ban, Loader2 } from "lucide-react";
import RmMarketOverview from "./RmMarketOverview";
import Modal from "../components/common/Modal";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/apiClient";
import { startMarketVisit, completeMarketVisit, cancelMarketVisit, listMarketVisits } from "../services/adminService";
import { getMarket, moveMarketZone, closeMarket } from "../services/marketService";
import { listZones } from "../services/zoneService";

// AdminMarketDetailPage.jsx — Admin Phase 3 §6: "when Admin starts an
// inspection for a Market, open the existing Market page/data. Do NOT
// build a separate duplicate Market implementation." Wraps
// RmMarketOverview.jsx entirely unchanged — the exact same real
// Employees/Supervisor/Departments/Attendance/Activities view a Regional
// Manager already gets — and adds only the explicit Visit/Inspection
// action bar on top (spec §1: a normal market page open must never
// itself count as a visit).
//
// onOpenEmployees/onOpenActivityToday/onOpenSupervisor previously
// weren't wired at all here — the "Total Employees" tile and "Market
// Activity Today" silently did nothing, and tapping the supervisor's
// name threw (RmMarketOverview calls onOpenSupervisor directly, with no
// undefined guard). All three are real, existing screens; this market
// can be reached from either the flat /admin/markets list or from
// Zones & Markets (/admin/zones/:zoneId/markets), so onBack uses
// navigate(-1) rather than a single hardcoded destination.
export default function AdminMarketDetailPage({ marketId }) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const { data: openVisits, reload } = useAsync(
    () => listMarketVisits({ marketId, status: "STARTED", pageSize: 1 }),
    { deps: [marketId] }
  );
  const openVisit = openVisits?.visits?.[0] ?? null;

  const { data: market, reload: reloadMarket } = useAsync(() => getMarket(marketId), { deps: [marketId] });

  return (
    <div>
      <div className="px-4 sm:px-6 md:px-10 pt-6 max-w-4xl mx-auto">
        <VisitBar marketId={marketId} openVisit={openVisit} onChanged={reload} starting={starting} setStarting={setStarting} />
        {market && <ZoneManagementBar market={market} onChanged={reloadMarket} />}
      </div>
      <RmMarketOverview
        marketId={marketId}
        onOpenEmployee={(employeeId) => navigate(`/admin/employees/${employeeId}`)}
        onOpenEmployees={() => navigate(`/admin/markets/${marketId}/employees`)}
        onOpenActivityToday={() => navigate(`/admin/markets/${marketId}/activity`)}
        onOpenSupervisor={(userId) => navigate(`/admin/markets/${marketId}/supervisors/${userId}`)}
        onOpenSection={() => {}}
        onOpenHistory={() => {}}
        onOpenTotalSales={() => {}}
        onOpenCardSales={() => {}}
        onBack={() => navigate(-1)}
      />
    </div>
  );
}

function VisitBar({ marketId, openVisit, onChanged, starting, setStarting }) {
  const { t } = useTranslation();
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleStart(visitType) {
    setStarting(true);
    setError(null);
    try {
      await startMarketVisit(marketId, { visitType });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotStartThisVisit"));
    } finally {
      setStarting(false);
    }
  }

  if (openVisit) {
    return (
      <>
        <div className="rounded-xl p-3.5 mb-4 bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <ShieldAlert size={15} />
            {openVisit.visitType === "INSPECTION" ? t("admin.administrativeInspection") : t("admin.marketVisit")} in progress
          </div>
          <button
            type="button"
            onClick={() => setCompleting(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors"
          >
            <CheckCircle2 size={13} /> {t("admin.complete")}
          </button>
        </div>
        {completing && (
          <CompleteCancelModal
            visit={openVisit}
            onClose={() => setCompleting(false)}
            onDone={() => { setCompleting(false); onChanged(); }}
          />
        )}
      </>
    );
  }

  return (
    <div className="rounded-xl p-3.5 mb-4 bg-[#171C2E]/80 border border-white/[0.06] flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => handleStart("VISIT")}
        disabled={starting}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 transition-colors"
      >
        <ClipboardCheck size={13} /> {t("admin.startMarketVisit")}
      </button>
      <button
        type="button"
        onClick={() => handleStart("INSPECTION")}
        disabled={starting}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
      >
        <ShieldAlert size={13} /> {t("admin.startAdministrativeInspection")}
      </button>
      {error && <p className="text-xs text-red-400 w-full">{error}</p>}
    </div>
  );
}

function CompleteCancelModal({ visit, onClose, onDone }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleComplete() {
    setBusy(true);
    setError(null);
    try {
      await completeMarketVisit(visit.id, notes.trim() || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotCompleteThisVisit"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelMarketVisit(visit.id, notes.trim() || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotCancelThisVisit"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={visit.visitType === "INSPECTION" ? t("admin.completeInspection") : t("admin.completeVisit")}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.notesFindingsOptional")}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50" />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleCancel} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/15 disabled:opacity-50 transition-colors">
            <XCircle size={14} /> {t("admin.cancelVisit")}
          </button>
          <button type="button" onClick={handleComplete} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors">
            <CheckCircle2 size={14} /> {busy ? t("emp.saving") : t("admin.complete")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// A zone's own id comes back prefixed ("zone-3" — see
// zonesController.shapeZoneSummary) from GET /api/zones; the move/close
// endpoints take the raw numeric market/zone ids. Same conversion
// AdminZonesPage.jsx already uses.
function rawZoneId(zone) {
  return Number(String(zone.id).replace("zone-", ""));
}

const STATUS_META = {
  ACTIVE: { label: "status.active", tone: "bg-emerald-500/12 text-emerald-400 ring-emerald-500/30" },
  MAINTENANCE: { label: "rm.maintenance", tone: "bg-amber-500/12 text-amber-400 ring-amber-500/30" },
  CLOSED: { label: "status.inactive", tone: "bg-red-500/12 text-red-400 ring-red-500/30" },
};

// ZoneManagementBar — Admin Market <-> Zone Management: the two new
// focused actions (Change Zone / Close Market), added the same way
// VisitBar above was: a small action bar layered on top of the existing,
// unchanged RmMarketOverview, not a redesign of it. Deliberately lives
// here (the ADMIN-only wrapper) rather than inside RmMarketOverview
// itself, since that component is shared with the Regional Manager's own
// market page and a Regional Manager must never see a market-move
// action (the backend also enforces this — this is presentation only).
function ZoneManagementBar({ market, onChanged }) {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null); // "move" | "close" | null
  const statusMeta = STATUS_META[market.status] ?? STATUS_META.ACTIVE;

  return (
    <div className="rounded-xl p-3.5 mb-4 bg-[#171C2E]/80 border border-white/[0.06] flex flex-wrap items-center gap-2.5">
      <span className="flex items-center gap-1.5 text-xs text-[#9AA1B4]">
        <Layers size={13} className="text-[#8B93A8]" />
        {t("rm.zoneNumbered", { number: market.zone.number })}
      </span>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusMeta.tone}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {t(statusMeta.label)}
      </span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setModal("move")}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
      >
        <ArrowRightLeft size={13} /> {t("admin.changeZone")}
      </button>
      {market.status !== "CLOSED" && (
        <button
          type="button"
          onClick={() => setModal("close")}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors"
        >
          <Ban size={13} /> {t("admin.closeMarket")}
        </button>
      )}

      {modal === "move" && (
        <ChangeZoneModal market={market} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />
      )}
      {modal === "close" && (
        <CloseMarketModal market={market} onClose={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />
      )}
    </div>
  );
}

function ChangeZoneModal({ market, onClose, onDone }) {
  const { t } = useTranslation();
  const { data: zones } = useAsync(listZones, { deps: [] });
  const [zoneId, setZoneId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const destinationOptions = (zones ?? []).filter((z) => rawZoneId(z) !== market.zoneId);
  const selectedZone = (zones ?? []).find((z) => String(rawZoneId(z)) === String(zoneId));

  async function handleConfirm() {
    if (!zoneId) return;
    setBusy(true);
    setError(null);
    try {
      await moveMarketZone(market.id, Number(zoneId));
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotMoveThisMarket"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("admin.changeZone")}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{t("admin.destinationZone")}</label>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50"
          >
            <option value="" disabled>{t("admin.selectADestinationZone")}</option>
            {destinationOptions.map((z) => (
              <option key={z.id} value={rawZoneId(z)}>{t("rm.zoneNumbered", { number: z.number })}</option>
            ))}
          </select>
        </div>

        {selectedZone && (
          <p className="text-[13px] text-[#C4C9D6] leading-relaxed">
            {t("admin.moveMarketConfirm", {
              market: market.name,
              from: t("rm.zoneNumbered", { number: market.zone.number }),
              to: t("rm.zoneNumbered", { number: selectedZone.number }),
            })}
          </p>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || !zoneId}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />} {t("admin.confirmMove")}
        </button>
      </div>
    </Modal>
  );
}

function CloseMarketModal({ market, onClose, onDone }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await closeMarket(market.id);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldNotCloseThisMarket"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("admin.closeMarket")}>
      <div className="space-y-4">
        <p className="text-[14px] font-semibold text-white">{t("admin.closeMarketQuestion", { market: market.name })}</p>
        <p className="text-[13px] text-[#8B93A8] leading-relaxed">{t("admin.closeMarketExplain")}</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 transition-colors">
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white bg-red-500/90 hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} {t("admin.closeMarket")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
