import { useMemo } from "react";
import { ChevronLeft, Phone, MessageCircle, Store, Users2, ShieldCheck, Clock3, MapPin, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import ZonePerformanceCard from "../components/regionalManager/home/ZonePerformanceCard";
import { computeZoneMetrics } from "../components/regionalManager/home/zoneMetrics";
import { getAccessibleSupervisor, listMarkets } from "../services/marketService";
import { listMarketProblems } from "../services/marketProblemsService";
import { listActivitiesForMarket } from "../services/activityService";
import { initialsOf } from "../utils/initials";

const LIVE = {
  ACTIVE: { label: "Active", chip: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30", dot: "bg-emerald-400" },
  ON_BREAK: { label: "On Break", chip: "bg-amber-500/15 text-amber-400 ring-amber-500/30", dot: "bg-amber-400" },
  OFF: { label: "Off Shift", chip: "bg-[#0D1424]/90 text-[#8B93A8] ring-white/10", dot: "bg-[#4C5266]" },
};

function InfoRow({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tone}`}>
        <Icon size={14} />
      </span>
      <span className="text-[12px] text-[#8B93A8]">{label}</span>
      <span className="ml-auto min-w-0 truncate text-right text-[12.5px] font-medium text-white">{value}</span>
    </div>
  );
}

function clockLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// RmSupervisorProfilePage.jsx — a supervisor's profile, the
// management-side counterpart to RmEmployeeProfile. Used by both the
// Regional Manager (basePath="/rm", the default) and Admin
// (basePath="/admin", passed explicitly by AdminWorkspace.jsx) — the
// backend already authorizes both (getAccessibleSupervisor scopes by
// zone for a Regional Manager and is unscoped for ADMIN), so this is one
// screen with two entry points, not a fork. `basePath` only affects the
// two in-page navigations below (Message, Assigned Market); `onBack` is
// still supplied by the caller for the same reason every other page here
// takes it as a prop instead of assuming one fixed parent route.
//
// Everything here is real and comes from GET /api/markets/supervisors/:userId,
// which resolves access through the market this person actually
// supervises (out-of-zone returns 404, never another zone's staff).
//
// What is deliberately NOT shown, because this backend genuinely cannot
// give it to a Regional Manager:
//   • Attendance rate / hours worked / days off — staff attendance is
//     self-only (attendanceController.getMyStaffAttendanceMonth checks
//     req.user.userId), so an RM cannot read another account's history.
//     Today's live on-shift state IS available and is shown instead.
//   • A hire/join date — the User model has no startDate. The account's
//     createdAt is shown, labelled as exactly that, rather than dressed
//     up as an employment date.
export default function RmSupervisorProfilePage({ userId, onBack, basePath = "/rm" }) {
  const navigate = useNavigate();
  const { data: sup, error, loading, reload } = useAsync(() => getAccessibleSupervisor(userId), { deps: [userId] });

  // Market Performance inputs. All three are existing endpoints the
  // Regional Manager already uses elsewhere, each access-checked
  // server-side; they only run once the supervisor's market is known.
  const marketId = sup?.market?.id ?? null;

  const { data: markets, loading: marketsLoading } = useAsync(
    () => (marketId ? listMarkets() : Promise.resolve(null)),
    { deps: [marketId] }
  );
  const { data: problems, loading: problemsLoading } = useAsync(
    () => (marketId ? listMarketProblems(marketId, "active") : Promise.resolve(null)),
    { deps: [marketId] }
  );
  const { data: activities, loading: activitiesLoading } = useAsync(
    () => (marketId ? listActivitiesForMarket({ marketId }) : Promise.resolve(null)),
    { deps: [marketId] }
  );

  const perfLoading = !!marketId && (marketsLoading || problemsLoading || activitiesLoading);

  // computeZoneMetrics works on a list of markets — handing it just this
  // supervisor's own row scopes the exact same calculation to one market.
  const marketMetrics = useMemo(() => {
    const row = (markets ?? []).find((m) => m.id === marketId);
    return computeZoneMetrics({
      markets: row ? [row] : null,
      problems,
      activities,
    });
  }, [markets, problems, activities, marketId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-4 pt-5 sm:max-w-3xl sm:px-6">
        <SkeletonCard className="h-44 rounded-[22px]" />
        <div className="mt-3 space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-16 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-4 pt-5 sm:max-w-3xl sm:px-6">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to employees"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/10 active:scale-95"
          >
            <ChevronLeft size={17} />
          </button>
          <h1 className="font-display text-xl font-bold text-white">Supervisor</h1>
        </div>
        <ErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }

  const state = sup.onBreak ? LIVE.ON_BREAK : sup.onShift ? LIVE.ACTIVE : LIVE.OFF;
  const roleLabel = sup.kind === "OVERLOOKING" ? "Overlooking Supervisor" : "Supervisor";

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-4 pt-4 sm:max-w-3xl sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to employees"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/10 active:scale-95"
        >
          <ChevronLeft size={17} />
        </button>
        {sup.whatsappNumber && (
          <a
            href={`https://wa.me/${sup.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11.5px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/15"
          >
            <Phone size={12} /> {sup.whatsappNumber}
          </a>
        )}
      </div>

      {/* Identity */}
      <div className="mt-3 flex flex-col items-center text-center">
        <div className="relative">
          <span className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1D2D5C] to-[#16233D] text-[26px] font-bold text-white ring-2 ring-[#F47A20]/45 shadow-[0_0_28px_-6px_rgba(244,122,32,0.6)]">
            {sup.profilePictureUrl ? (
              <AuthenticatedImage src={sup.profilePictureUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsOf(sup.name)
            )}
          </span>
          <span
            className={`absolute -bottom-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-semibold ring-1 ring-inset backdrop-blur-md ${state.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
            {state.label}
          </span>
        </div>

        <h1 className="mt-4 font-display text-[22px] font-bold leading-tight text-white">{sup.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#F9A03C]">
          <ShieldCheck size={13} /> {roleLabel}
        </p>
        {sup.loginId && <p className="mt-0.5 text-[11.5px] tabular-nums text-[#5C6479]">{sup.loginId}</p>}
      </div>

      {/* Contact — only what actually exists on the account. */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {sup.whatsappNumber || sup.phoneNumber ? (
          <a
            href={`https://wa.me/${sup.whatsappNumber ?? sup.phoneNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 py-3 backdrop-blur-xl transition-all duration-200 hover:border-[#F47A20]/30 active:scale-[0.97]"
          >
            <Phone size={17} className="text-emerald-400" />
            <span className="text-[11px] font-medium text-[#C4C9D6]">Call</span>
          </a>
        ) : (
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.05] bg-[#111A2D]/40 py-3 opacity-50">
            <Phone size={17} className="text-[#5C6479]" />
            <span className="text-[11px] font-medium text-[#5C6479]">No number</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate(`${basePath}/chat`)}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 py-3 backdrop-blur-xl transition-all duration-200 hover:border-[#F47A20]/30 active:scale-[0.97]"
        >
          <MessageCircle size={17} className="text-[#F47A20]" />
          <span className="text-[11px] font-medium text-[#C4C9D6]">Message</span>
        </button>
      </div>

      {/* Assignment */}
      <div className="mt-2.5 divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 px-3.5 backdrop-blur-xl">
        <InfoRow icon={Store} label="Market" value={sup.market?.name ?? "—"} tone="text-[#F47A20] bg-[#F47A20]/10" />
        <InfoRow icon={MapPin} label="Zone" value={sup.market ? `Zone ${sup.market.zoneNumber}` : "—"} tone="text-sky-400 bg-sky-500/10" />
        <InfoRow icon={Users2} label="Team size" value={`${sup.employeeCount} employees`} tone="text-[#7EA6FF] bg-[#7EA6FF]/10" />
        <InfoRow
          icon={Clock3}
          label="Today"
          value={
            sup.checkInAt
              ? `${clockLabel(sup.checkInAt)}${sup.checkOutAt ? ` – ${clockLabel(sup.checkOutAt)}` : ""}`
              : "Not checked in"
          }
          tone="text-violet-400 bg-violet-500/10"
        />
      </div>

      {/* How this supervisor's market is actually performing — the same
          computation and card the Regional Manager's Home uses for the
          whole zone (computeZoneMetrics + ZonePerformanceCard), pointed
          at this one market instead. Every figure is real; a metric with
          no data yet renders "—" rather than a fabricated number.
          "Market Health" is necessarily 0% or 100% for a single market:
          it means "has open issues, or not". */}
      {sup.market && (
        <div className="mt-2.5">
          <ZonePerformanceCard
            title="Market Performance"
            footnote={sup.market.name}
            overall={marketMetrics.overall}
            metrics={marketMetrics.metrics}
            marketCount={1}
            loading={perfLoading}
          />
        </div>
      )}

      {/* Their market — a real link into the market this person runs. */}
      {sup.market && (
        <section className="mt-4">
          <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-white">
            <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
            Assigned Market
          </h2>
          <button
            type="button"
            onClick={() => navigate(`${basePath}/markets/${sup.market.id}`)}
            className="group flex w-full items-center gap-3 rounded-[18px] border border-white/[0.07] bg-[#111A2D]/80 p-3 text-left backdrop-blur-xl transition-all duration-200 hover:border-[#F47A20]/30 active:scale-[0.985]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F47A20]/10 text-[#F47A20]">
              <Store size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-white">{sup.market.name}</p>
              <p className="mt-0.5 text-[11.5px] text-[#8B93A8]">
                Zone {sup.market.zoneNumber} · {sup.employeeCount} employees
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-[#4C5266] transition-all group-hover:translate-x-0.5 group-hover:text-[#F47A20]" />
          </button>
        </section>
      )}

      {/* Honest about the gap rather than filling it with numbers. */}
      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#5C6479]">
        Attendance history and performance for staff accounts are private to the
        account holder, so they are not shown here.
      </p>
    </div>
  );
}
