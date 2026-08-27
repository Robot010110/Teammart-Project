import { useState } from "react";
import { Building2 } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ActivityStatusPill from "../components/common/ActivityStatusPill";
import { listCompanyActivities } from "../services/adminService";
import { listMarkets } from "../services/marketService";

const CATEGORY_LABEL = {
  EXPIRED_ITEMS: "Expired Items", SHELF_CLEANING: "Shelf Cleaning", PRODUCT_CUSTOMIZATION: "Product Customization",
  DAILY_CLEANING: "Daily Cleaning", ITEM_COUNTING: "Item Counting", LABEL_CHECKING: "Label Issue",
  FACING: "Facing", REFILLING: "Refilling", DEPARTMENT_CLOSING: "Department Closing",
};

function timeAgo(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// AdminActivitiesPage.jsx — Admin Phase 1 §17: a company-wide activity
// feed, built entirely on the new activitiesController.listCompanyActivities
// endpoint (the exact same Activity table every market's own Today's
// Activity feed already reads — see that endpoint's own comment).
// Capped/most-recent-first server-side, never the whole company's
// history loaded at once.
export default function AdminActivitiesPage() {
  const [marketId, setMarketId] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const { data: markets } = useAsync(listMarkets, { deps: [] });
  const { data: activities, error, loading, reload } = useAsync(
    () => listCompanyActivities({ marketId: marketId || undefined, category: category || undefined, status: status || undefined }),
    { deps: [marketId, category, status] }
  );

  const selectClass =
    "rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-[#F47A20]/50";

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-7xl mx-auto animate-fade-up">
      <h1 className="font-display text-xl md:text-2xl font-bold text-white mb-4">Activities</h1>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
          <option value="">All Markets</option>
          {(markets ?? []).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-[70px]" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : activities.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
          No activities match these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id} className="rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{CATEGORY_LABEL[a.category] ?? a.category}</p>
                  <p className="text-xs text-[#8B93A8] mt-0.5 flex items-center gap-1.5">
                    <Building2 size={11} /> {a.market?.name ?? a.employee?.market?.name ?? "—"}
                    {" · "}
                    {a.employee?.name ?? a.submittedByStaff?.name ?? "—"}
                  </p>
                </div>
                <ActivityStatusPill status={a.status} />
              </div>
              <p className="mt-1.5 text-[11px] text-[#6B7284]">{timeAgo(a.date)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
