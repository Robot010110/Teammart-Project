import { useState } from "react";
import {
  Users2, UserCheck, Star, CalendarClock, ChevronRight, ShieldAlert, Sparkles,
  NotebookPen, History, ClipboardList, DollarSign, CreditCard, Moon,
} from "lucide-react";
import Breadcrumb from "../components/layout/Breadcrumb";
import StatusPill from "../components/common/StatusPill";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { RateMarketModal, AddNoteModal, SendFeedbackModal } from "../components/regionalManager/InspectionModals";
import { useAsync } from "../hooks/useAsync";
import { getMarketOverview, listMarketSections, createMarketVisit } from "../services/marketManagementService";
import { useToast } from "../hooks/useToast";
import Toast from "../components/common/Toast";

function titleCaseStatus(status) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function EmployeeRow({ employee, onOpen }) {
  const active = employee.status === "ACTIVE";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 rounded-xl p-3 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
    >
      <span className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-white shrink-0">
        {employee.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-medium text-white truncate">{employee.name}</p>
        <p className="text-xs text-[#8B93A8]">{employee.position}{employee.department ? ` · ${employee.department}` : ""}</p>
      </div>
      <span className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${active ? "text-emerald-400" : "text-[#4C5266]"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-[#4C5266]"}`} />
        {active ? "Active" : "Off Shift"}
      </span>
      <ChevronRight size={15} className="text-[#4C5266] shrink-0" />
    </button>
  );
}

function SectionCard({ section, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/25 transition-colors"
    >
      <p className="text-sm font-semibold text-white">{section.department}</p>
      <div className="mt-2 flex items-center gap-3 text-xs text-[#9AA1B4]">
        <span className="flex items-center gap-1"><Users2 size={11} /> {section.employeeCount}</span>
        <span className="flex items-center gap-1 text-emerald-400"><UserCheck size={11} /> {section.activeCount} active</span>
      </div>
    </button>
  );
}

// RmMarketOverview.jsx — spec §6/§9/§20-24: market header (real stats),
// Sections (observation entry points), Employees (with real computed
// status), and the inspection action bar (Rate / Note / Warning /
// Recognition / History). This is an observer/evaluator surface, not an
// operational one — no controls here perform employee-level work.
export default function RmMarketOverview({ marketId, onOpenEmployee, onOpenSection, onOpenHistory, onOpenTotalSales, onOpenCardSales, onBack }) {
  const { data: overview, error, loading, reload } = useAsync(() => getMarketOverview(marketId), { deps: [marketId] });
  const { data: sections, error: sectionsError, loading: sectionsLoading } = useAsync(() => listMarketSections(marketId), { deps: [marketId] });
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

  if (loading) return <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto"><SkeletonCard className="h-64" /></div>;
  if (error) return <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto"><ErrorBanner message={error} onRetry={reload} /></div>;

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto animate-fade-up">
      <Breadcrumb items={[{ label: "Markets", onClick: onBack }, { label: overview.name }]} />

      <div className="mt-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">{overview.name}</h1>
          <p className="mt-1.5 text-sm text-[#9AA1B4]">
            Zone {overview.zone.number} &middot; Supervisor: {overview.supervisor?.name ?? "Unassigned"}
            {overview.overlookingSupervisor && (
              <span className="flex items-center gap-1 inline-flex ml-1"> &middot; <Moon size={12} className="text-[#8B93A8]" /> {overview.overlookingSupervisor.name}</span>
            )}
          </p>
        </div>
        <StatusPill status={titleCaseStatus(overview.status)} />
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
          <p className="flex items-center gap-1.5 text-white font-bold text-lg"><Users2 size={15} className="text-[#8B93A8]" /> {overview.employeeCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mt-1">Employees</p>
        </div>
        <div className="rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
          <p className="flex items-center gap-1.5 text-emerald-400 font-bold text-lg"><UserCheck size={15} /> {overview.activeCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mt-1">Active Now</p>
        </div>
        <div className="rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06]">
          <p className="flex items-center gap-1.5 text-amber-400 font-bold text-lg">
            <Star size={15} className={overview.currentRating != null ? "fill-current" : ""} />
            {overview.currentRating != null ? `${overview.currentRating}/10` : "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mt-1">Rating</p>
        </div>
        <button type="button" onClick={onOpenHistory} className="rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 text-left transition-colors">
          <p className="flex items-center gap-1.5 text-white font-bold text-lg"><CalendarClock size={15} className="text-[#8B93A8]" />
            {overview.lastVisitDate ? new Date(overview.lastVisitDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mt-1 flex items-center gap-1"><History size={10} /> Last Visit &middot; View History</p>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={onOpenTotalSales} className="rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 text-left transition-colors">
          <p className="flex items-center gap-1.5 text-white font-bold text-lg">
            <DollarSign size={15} className="text-[#F47A20]" /> {overview.totalSalesToday ? overview.totalSalesToday.amount.toFixed(2) : "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mt-1">Total Sales &middot; Today</p>
        </button>
        <button type="button" onClick={onOpenCardSales} className="rounded-xl p-4 bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/25 text-left transition-colors">
          <p className="flex items-center gap-1.5 text-white font-bold text-lg">
            <CreditCard size={15} className="text-[#F47A20]" />
            {["MORNING", "AFTERNOON", "NIGHT"].filter((s) => overview.cardSalesToday?.[s]).length}/3
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8] mt-1">Card Sales &middot; Today's Shifts</p>
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <button type="button" onClick={() => openModal("rate")} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-white/[0.05] hover:bg-white/[0.09] transition-colors">
          <Star size={14} /> Rate Market
        </button>
        <button type="button" onClick={() => openModal("note")} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-white/[0.05] hover:bg-white/[0.09] transition-colors">
          <NotebookPen size={14} /> Add Note
        </button>
        <button type="button" onClick={() => openModal("warning")} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors">
          <ShieldAlert size={14} /> Send Warning
        </button>
        <button type="button" onClick={() => openModal("recognition")} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors">
          <Sparkles size={14} /> Send Recognition
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8] flex items-center gap-1.5">
            <ClipboardList size={13} /> Sections
          </h2>
          {sectionsLoading ? (
            <SkeletonCard className="h-32" />
          ) : sectionsError ? (
            <ErrorBanner message={sectionsError} />
          ) : sections.length === 0 ? (
            <div className="rounded-xl p-6 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
              No employees assigned to a department yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sections.map((s) => (
                <SectionCard key={s.department} section={s} onOpen={() => onOpenSection(s.department)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Employees</h2>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {overview.employees.map((e) => (
              <EmployeeRow key={e.id} employee={e} onOpen={() => onOpenEmployee(e.id)} />
            ))}
          </div>
        </section>
      </div>

      <RateMarketModal open={modal === "rate"} marketId={marketId} visitId={visitId} onClose={() => setModal(null)} onSaved={() => handleSaved("rate")} />
      <AddNoteModal open={modal === "note"} marketId={marketId} visitId={visitId} onClose={() => setModal(null)} onSaved={() => handleSaved("note")} />
      <SendFeedbackModal open={modal === "warning"} type="WARNING" marketId={marketId} visitId={visitId} onClose={() => setModal(null)} onSaved={() => handleSaved("warning")} />
      <SendFeedbackModal open={modal === "recognition"} type="RECOGNITION" marketId={marketId} visitId={visitId} onClose={() => setModal(null)} onSaved={() => handleSaved("recognition")} />
      <Toast message={toast} />
    </div>
  );
}
