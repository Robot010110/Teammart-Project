import DailySectionChecks from "./DailySectionChecks";
import ReportsProblemsSection from "./ReportsProblemsSection";
import WastedItemsSection from "./WastedItemsSection";
import CartonFillingButton from "./CartonFillingButton";

// MarketTab.jsx — the physical/operational condition of the market:
// structure + daily checks, problems, today's waste, carton collection.
// Deliberately separate from Employees/Chat (spec §16: "this is
// intentionally separate").
export default function MarketTab({ session }) {
  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Market</h1>

      <section>
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
    </div>
  );
}
