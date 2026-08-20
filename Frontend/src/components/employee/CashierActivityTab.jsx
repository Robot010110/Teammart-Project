import { useState } from "react";
import { Tag } from "lucide-react";
import CashierCleaningSection from "./CashierCleaningSection";
import PriceReportSection from "./PriceReportSection";
import PriceLookupFlow from "./PriceLookupFlow";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getProfile } from "../../services/profileService";
import { useAsync } from "../../hooks/useAsync";

// CashierActivityTab.jsx — the Activity tab's content for Cashier
// employees: Price Lookup (spec §2, new), Cleaning (Morning shift only,
// unchanged) + Price Report (unchanged), just relocated under the
// bottom-nav Activity tab instead of a standalone page section.
export default function CashierActivityTab() {
  const { data: profile, error, loading, reload } = useAsync(getProfile, { deps: [] });
  const [lookupOpen, setLookupOpen] = useState(false);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto animate-fade-up">
      <h1 className="text-lg font-semibold text-white mb-4">Daily Activity</h1>

      {loading ? (
        <SkeletonCard className="h-[140px]" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Price Lookup</h2>
            <button
              onClick={() => setLookupOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-semibold text-white bg-[#171C2E]/80 border border-white/[0.06] hover:border-[#F47A20]/35 active:bg-[#1F2436] transition-colors duration-150"
            >
              <Tag size={16} className="text-[#F47A20]" /> Look Up a Price
            </button>
          </section>

          {profile?.cashierShift === "MORNING" && (
            <section className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Cleaning</h2>
              <CashierCleaningSection />
            </section>
          )}

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8]">Price Report</h2>
            <PriceReportSection />
          </section>

          <PriceLookupFlow open={lookupOpen} onClose={() => setLookupOpen(false)} />
        </>
      )}
    </div>
  );
}
