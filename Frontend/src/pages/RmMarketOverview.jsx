import { useState } from "react";
import {
  Users2, UserCheck, Star, CalendarClock, ChevronRight, ShieldAlert, Sparkles,
  NotebookPen, History, ClipboardList, DollarSign, CreditCard, Moon, ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import MarketPhoto from "../components/markets/MarketPhoto";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { RateMarketModal, AddNoteModal, SendFeedbackModal } from "../components/regionalManager/InspectionModals";
import CountingVerificationQueue from "../components/regionalManager/CountingVerificationQueue";
import MarketActivityFeed from "../components/regionalManager/market/MarketActivityFeed";
import { isToday } from "../components/regionalManager/market/activityMeta";
import { useAsync } from "../hooks/useAsync";
import { getMarketOverview, listMarketSections, createMarketVisit } from "../services/marketManagementService";
import { listMarketProblems } from "../services/marketProblemsService";
import { listActivitiesForMarket } from "../services/activityService";
import { useToast } from "../hooks/useToast";
import Toast from "../components/common/Toast";

const STATUS = {
  ACTIVE: { label: "Active", dot: "bg-emerald-400", text: "text-emerald-400", ring: "ring-emerald-500/25", bg: "bg-emerald-500/12" },
  MAINTENANCE: { label: "Maintenance", dot: "bg-amber-400", text: "text-amber-400", ring: "ring-amber-500/25", bg: "bg-amber-500/12" },
  CLOSED: { label: "Inactive", dot: "bg-red-400", text: "text-red-400", ring: "ring-red-500/25", bg: "bg-red-500/12" },
};

function StatTile({ icon: Icon, tone, value, label, onClick }) {
  const Tag_ = onClick ? "button" : "div";
  return (
    <Tag_
      {...(onClick ? { type: "button", onClick } : {})}
      className={`rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-3 text-left backdrop-blur-xl transition-all duration-200 ${
        onClick ? "hover:border-[#F47A20]/30 active:scale-[0.98]" : ""
      }`}
    >
      <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}>
        <Icon size={15} />
      </span>
      <p className="mt-2 font-display text-[19px] font-bold leading-none tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[11px] text-[#8B93A8]">{label}</p>
    </Tag_>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 py-3 backdrop-blur-xl transition-all duration-200 hover:border-[#F47A20]/30 hover:bg-[#131E33]/90 active:scale-[0.97]"
    >
      <Icon size={17} className="text-[#F47A20]" />
      <span className="text-[11px] font-medium text-[#C4C9D6]">{label}</span>
    </button>
  );
}

function SectionCard({ section, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-xl border border-white/[0.06] bg-[#111A2D]/70 p-3 text-left transition-colors hover:border-[#F47A20]/25"
    >
      <p className="truncate text-[13px] font-semibold text-white">{section.department}</p>
      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#9AA1B4]">
        <span className="flex items-center gap-1"><Users2 size={11} /> {section.employeeCount}</span>
        <span className="flex items-center gap-1 text-emerald-400"><UserCheck size={11} /> {section.activeCount}</span>
      </div>
    </button>
  );
}

// RmMarketOverview.jsx — one market, mobile-first.
//
// Redesigned around a photo hero + a compact 2x2 of the numbers that
// actually decide whether this market needs attention, then quick
// actions, then a short activity teaser — with every capability this
// page already had kept below it (sections, employees, the counting
// queue, and the Rate / Note / Warning / Recognition inspection
// actions). Nothing was removed; the order changed so a phone shows the
// verdict first and the detail after.
//
// All real data: GET /api/markets/:id/overview, /sections,
// /market-problems?marketId=, /activities/market?marketId= — each one
// access-checked server-side against this market (assertMarketAccess),
// so a Regional Manager can never open a market outside their zones.
export default function RmMarketOverview({ marketId, onOpenSection, onOpenHistory, onOpenTotalSales, onOpenCardSales, onOpenEmployees, onOpenActivityToday, onOpenSupervisor, onBack }) {
  const { data: overview, error, loading, reload } = useAsync(() => getMarketOverview(marketId), { deps: [marketId] });
  const { data: sections, error: sectionsError, loading: sectionsLoading } = useAsync(() => listMarketSections(marketId), { deps: [marketId] });
  // Open Issues + Recent Activity — the two real sources the reference's
  // detail screen implies, both already exposed by this backend.
  const { data: problems } = useAsync(() => listMarketProblems(marketId, "active"), { deps: [marketId] });
  const { data: activities, loading: activitiesLoading } = useAsync(() => listActivitiesForMarket({ marketId }), { deps: [marketId] });

  const [modal, setModal] = useState(null); // "rate" | "note" | "warning" | "recognition" | null
  const [visitId, setVisitId] = useState(null);
  const [toast, setToast] = useToast();

  async function ensureVisit() {
    if (visitId) return visitId;
    try {
      const visit = await createMarketVisit(marketId);
      setVisitId(visit.id);
      return visit.id;
    } catch {
      return null; // rating/note/feedback can still be saved without a visit grouping
    }
  }

  async function openModal(key) {
    await ensureVisit();
    setModal(key);
  }

  function handleSaved(kind) {
    setModal(null);
    setToast(kind === "rate" ? "Rating saved." : kind === "note" ? "Note saved." : kind === "warning" ? "Warning sent to the Supervisor." : "Recognition sent to the Supervisor.");
    reload();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-4 pt-5 sm:max-w-3xl sm:px-6">
        <SkeletonCard className="h-52 rounded-[22px]" />
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[92px] rounded-2xl" />)}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-4 pt-5 sm:max-w-3xl sm:px-6">
        <ErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }

  const status = STATUS[overview.status] ?? STATUS.ACTIVE;
  const openIssues = problems?.length ?? 0;
  // Today only, newest first — the same isToday test the dedicated
  // Market Activity page uses, so the teaser and that page always agree
  // on which rows count as today.
  const todaysActivity = (activities ?? [])
    .filter((a) => isToday(a.date))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="mx-auto max-w-lg animate-fade-up px-4 pb-4 pt-4 sm:max-w-3xl sm:px-6">
      {/* Hero — the market's own real photo, still uploadable here. */}
      <div className="relative h-48 overflow-hidden rounded-[22px] border border-white/[0.07] sm:h-60">
        <MarketPhoto photoUrl={overview.photoUrl} size="hero" editable marketId={marketId} onUploaded={() => reload()} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070C18] via-[#070C18]/45 to-[#070C18]/25" aria-hidden="true" />

        <button
          type="button"
          onClick={onBack}
          aria-label="Back to markets"
          className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-md transition-all hover:bg-black/65 active:scale-95"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Pinned to the hero's own top-right rather than sitting beside
            the title: a long supervisor line (or an overlooking
            supervisor on a second line) would otherwise push the pill
            out of alignment on a narrow screen. */}
        <span
          className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset backdrop-blur-md ${status.bg} ${status.text} ${status.ring}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>

        <div className="absolute inset-x-3 bottom-3">
          <h1 className="truncate font-display text-[24px] font-bold leading-tight text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>
            {overview.name}
          </h1>
          {/* Both supervisor names open that person's profile — the ids
              come from the overview response itself. A market with no
              supervisor stays plain text: there is no account to open. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[#C4C9D6]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}>
            Zone {overview.zone.number}
            <span className="text-[#6B7488]">·</span>
            <span>
              Supervisor:{" "}
              {overview.supervisor?.id ? (
                <button
                  type="button"
                  onClick={() => onOpenSupervisor(overview.supervisor.id)}
                  className="font-semibold text-white underline decoration-[#F47A20]/50 decoration-dotted underline-offset-2 transition-colors hover:text-[#F9A03C] hover:decoration-[#F47A20]"
                >
                  {overview.supervisor.name}
                </button>
              ) : (
                "Unassigned"
              )}
            </span>
            {overview.overlookingSupervisor && (
              <span className="inline-flex items-center gap-1">
                <span className="text-[#6B7488]">·</span>
                <Moon size={11} />
                {overview.overlookingSupervisor.id ? (
                  <button
                    type="button"
                    onClick={() => onOpenSupervisor(overview.overlookingSupervisor.id)}
                    className="font-semibold text-white underline decoration-[#F47A20]/50 decoration-dotted underline-offset-2 transition-colors hover:text-[#F9A03C] hover:decoration-[#F47A20]"
                  >
                    {overview.overlookingSupervisor.name}
                  </button>
                ) : (
                  overview.overlookingSupervisor.name
                )}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 2x2 — the four numbers that decide whether this market is fine. */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {/* The count IS the way into the roster — tapping it opens this
            market's employee list, so the number and the action are one
            control rather than a dead figure plus a separate button. */}
        <StatTile
          icon={Users2}
          tone="bg-[#7EA6FF]/10 text-[#7EA6FF]"
          value={overview.employeeCount}
          label="Total Employees"
          onClick={onOpenEmployees}
        />
        <StatTile icon={UserCheck} tone="bg-emerald-500/10 text-emerald-400" value={overview.activeCount} label="Active Now" />
        <StatTile
          icon={Star}
          tone="bg-amber-500/10 text-amber-400"
          value={overview.currentRating != null ? `${overview.currentRating}/10` : "—"}
          label="Performance"
          onClick={() => openModal("rate")}
        />
        <StatTile
          icon={AlertTriangle}
          tone={openIssues > 0 ? "bg-red-500/10 text-red-400" : "bg-white/[0.05] text-[#6B7488]"}
          value={openIssues}
          label="Open Issues"
        />
      </div>

      {/* Quick actions — every one opens a real existing destination.
          Employees is deliberately NOT here: the Total Employees tile
          above is what opens the roster. */}
      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        <QuickAction icon={DollarSign} label="Sales" onClick={onOpenTotalSales} />
        <QuickAction icon={CreditCard} label="Card Sales" onClick={onOpenCardSales} />
        <QuickAction icon={History} label="History" onClick={onOpenHistory} />
      </div>

      {/* Today's sales summary — kept from the previous layout, both
          still real entry points with their real values. */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <button type="button" onClick={onOpenTotalSales} className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-3 text-left transition-colors hover:border-[#F47A20]/25">
          <p className="flex items-center gap-1.5 text-[15px] font-bold text-white">
            <DollarSign size={14} className="text-[#F47A20]" /> {overview.totalSalesToday ? overview.totalSalesToday.amount.toFixed(2) : "—"}
          </p>
          <p className="mt-1 text-[10.5px] uppercase tracking-wide text-[#8B93A8]">Total Sales · Today</p>
        </button>
        <button type="button" onClick={onOpenCardSales} className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-3 text-left transition-colors hover:border-[#F47A20]/25">
          <p className="flex items-center gap-1.5 text-[15px] font-bold text-white">
            <CreditCard size={14} className="text-[#F47A20]" />
            {["MORNING", "AFTERNOON", "NIGHT"].filter((s) => overview.cardSalesToday?.[s]).length}/3
          </p>
          <p className="mt-1 text-[10.5px] uppercase tracking-wide text-[#8B93A8]">Card Sales · Shifts</p>
        </button>
      </div>

      {/* Market Activity Today — this market's own work, today only.
          Short here on purpose; the full day lives behind "See All". */}
      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <span className="h-3.5 w-[3px] rounded-full bg-[#F47A20] shadow-[0_0_8px_rgba(244,122,32,0.8)]" />
            Market Activity Today
          </h2>
          <button
            type="button"
            onClick={onOpenActivityToday}
            className="flex items-center gap-0.5 text-[11.5px] font-medium text-[#F47A20] transition-colors hover:text-[#ff9a4d]"
          >
            See All <ChevronRight size={13} />
          </button>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 px-3.5 backdrop-blur-xl">
          <MarketActivityFeed activities={todaysActivity} loading={activitiesLoading} limit={5} />
        </div>
      </section>

      {/* Inspection actions — unchanged real behaviour (a visit is
          created to group them, then the same four modals as before). */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => openModal("rate")} className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3.5 py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-white/[0.09]">
          <Star size={14} /> Rate Market
        </button>
        <button type="button" onClick={() => openModal("warning")} className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-[12.5px] font-medium text-red-400 transition-colors hover:bg-red-500/15">
          <ShieldAlert size={14} /> Send Warning
        </button>
        <button type="button" onClick={() => openModal("recognition")} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-[12.5px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/15">
          <Sparkles size={14} /> Send Recognition
        </button>
        <button type="button" onClick={onOpenHistory} className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3.5 py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-white/[0.09]">
          <CalendarClock size={14} />
          {overview.lastVisitDate ? new Date(overview.lastVisitDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No visits"}
        </button>
      </div>

      <div className="mt-4">
        <CountingVerificationQueue marketId={marketId} />
      </div>

      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[#8B93A8]">
          <ClipboardList size={13} /> Sections
        </h2>
        {sectionsLoading ? (
          <SkeletonCard className="h-24" />
        ) : sectionsError ? (
          <ErrorBanner message={sectionsError} />
        ) : sections.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-[#111A2D]/70 p-5 text-center text-[12.5px] text-[#8B93A8]">
            No employees assigned to a department yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {sections.map((s) => (
              <SectionCard key={s.department} section={s} onOpen={() => onOpenSection(s.department)} />
            ))}
          </div>
        )}
      </section>

      <RateMarketModal open={modal === "rate"} marketId={marketId} visitId={visitId} onClose={() => setModal(null)} onSaved={() => handleSaved("rate")} />
      <AddNoteModal open={modal === "note"} marketId={marketId} visitId={visitId} onClose={() => setModal(null)} onSaved={() => handleSaved("note")} />
      <SendFeedbackModal open={modal === "warning"} type="WARNING" marketId={marketId} visitId={visitId} onClose={() => setModal(null)} onSaved={() => handleSaved("warning")} />
      <SendFeedbackModal open={modal === "recognition"} type="RECOGNITION" marketId={marketId} visitId={visitId} onClose={() => setModal(null)} onSaved={() => handleSaved("recognition")} />
      <Toast message={toast} />
    </div>
  );
}
