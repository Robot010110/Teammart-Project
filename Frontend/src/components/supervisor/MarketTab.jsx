import { useState } from "react";
import { DollarSign } from "lucide-react";
import DailySectionChecks from "./DailySectionChecks";
import ReportsProblemsSection from "./ReportsProblemsSection";
import WastedItemsSection from "./WastedItemsSection";
import CartonFillingButton from "./CartonFillingButton";
import CardSalesSection from "./CardSalesSection";
import SubmitTotalSalesModal from "./SubmitTotalSalesModal";
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
      <h1 className="text-lg font-semibold text-white mb-4">Market</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Sales</h2>
        {canSubmitTotalSales && (
          <button
            onClick={() => setTotalSalesOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 mb-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-150"
          >
            <DollarSign size={15} /> Submit Total Sales
          </button>
        )}
        <h3 className="mb-2 text-[11px] uppercase tracking-wide text-[#8B93A8]">Card Sales — Today</h3>
        <CardSalesSection marketId={session.marketId} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Market Structure & Daily Checks</h2>
        <DailySectionChecks />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Reports & Problems</h2>
        <ReportsProblemsSection reporterName={session.displayName} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Today's Wasted Items</h2>
        <WastedItemsSection marketId={session.marketId} />
      </section>

      <section className="mt-6">
        <CartonFillingButton marketName={session.marketName} />
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
