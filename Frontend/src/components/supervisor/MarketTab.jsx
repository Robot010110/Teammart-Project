import { useState } from "react";
import { DollarSign, ChevronRight } from "lucide-react";
import DepartmentReportBoard from "./DepartmentReportBoard";
import MarketRatingSection from "./MarketRatingSection";
import ReportsProblemsSection from "./ReportsProblemsSection";
import WastedItemsSection from "./WastedItemsSection";
import CartonFillingButton from "./CartonFillingButton";
import CardSalesSection from "./CardSalesSection";
import SubmitTotalSalesModal from "./SubmitTotalSalesModal";
import NightShiftMonitoringSection from "./NightShiftMonitoringSection";
import Toast from "../common/Toast";
import { useToast } from "../../hooks/useToast";

// MarketTab.jsx — the physical/operational condition of the market:
// structure + daily checks, problems, today's waste, carton collection,
// plus Total Sales / Card Sales submission (spec §5-7 — "Inside the
// Supervisor's Market page, add: Total Sales"). Deliberately separate
// from Employees/Chat (spec §16: "this is intentionally separate").
//
// Total Sales submission is Supervisor-only — session.staffRole
// distinguishes a real Supervisor account from an Overlooking one now
// (see LoginPage.jsx); Overlooking still gets Card Sales, just not this
// button. The backend enforces this regardless (totalSalesController.js),
// this is purely "don't show a button that would just 403".
export default function MarketTab({ session }) {
  const [totalSalesOpen, setTotalSalesOpen] = useState(false);
  const [toast, setToast] = useToast();
  const canSubmitTotalSales = session.staffRole === "SUPERVISOR";

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Market</h1>
        <p className="text-sm text-[#8B93A8] mt-0.5">Market Overview & Daily Operations</p>
      </div>

      {canSubmitTotalSales && (
        <button
          type="button"
          onClick={() => setTotalSalesOpen(true)}
          className="w-full flex items-center gap-4 rounded-2xl p-4 sm:p-5 mb-6 text-left bg-gradient-to-r from-[#3a2412] via-[#241708] to-[#171C2E] border border-[#F47A20]/25 hover:border-[#F47A20]/45 active:border-[#F47A20]/60 transition-colors duration-150"
        >
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-[#F47A20]/15 text-[#F47A20] shrink-0">
            <DollarSign size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">Submit Total Sales</p>
            <p className="text-xs text-[#8B93A8] mt-0.5">Record today's total sales across all shifts</p>
          </div>
          <span className="shrink-0 hidden sm:flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-[#F47A20]">
            Submit Sales <ChevronRight size={15} />
          </span>
          <ChevronRight size={18} className="sm:hidden text-[#F47A20] shrink-0" />
        </button>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Market Rating</h2>
        <MarketRatingSection marketId={session.marketId} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Sales by Shift</h2>
        <CardSalesSection marketId={session.marketId} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Night Shift</h2>
        <NightShiftMonitoringSection marketId={session.marketId} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Market Structure & Daily Activities</h2>
        <DepartmentReportBoard marketId={session.marketId} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Reports & Problems</h2>
        <ReportsProblemsSection marketId={session.marketId} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">Today's Wasted Items</h2>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="flex-1 min-w-0">
            <WastedItemsSection marketId={session.marketId} />
          </div>
          <div className="sm:w-64 shrink-0">
            <CartonFillingButton marketName={session.marketName} />
          </div>
        </div>
      </section>

      <SubmitTotalSalesModal
        open={totalSalesOpen}
        onClose={() => setTotalSalesOpen(false)}
        onSaved={() => setToast("Total Sales report sent to your Regional Manager.")}
      />
      <Toast message={toast} />
    </div>
  );
}
