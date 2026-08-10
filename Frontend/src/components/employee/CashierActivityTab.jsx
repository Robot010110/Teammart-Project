import CashierCleaningSection from "./CashierCleaningSection";
import PriceReportSection from "./PriceReportSection";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getProfile } from "../../services/profileService";
import { useAsync } from "../../hooks/useAsync";

// CashierActivityTab.jsx — the Activity tab's content for Cashier
// employees: Cleaning (Morning shift only, unchanged) + Price Report
// (unchanged), just relocated under the bottom-nav Activity tab instead
// of a standalone page section.
export default function CashierActivityTab() {
  const { data: profile, error, loading, reload } = useAsync(getProfile, { deps: [] });

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Daily Activity</h1>

      {loading ? (
        <SkeletonCard className="h-[140px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          {profile?.cashierShift === "MORNING" && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Cleaning</h2>
              <CashierCleaningSection />
            </section>
          )}

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Price Report</h2>
            <PriceReportSection />
          </section>
        </>
      )}
    </div>
  );
}
