import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import ActivityStatusPill from "../components/common/ActivityStatusPill";
import { listCompanyActivities } from "../services/adminService";
import { listMarkets } from "../services/marketService";

const CATEGORY_LABEL = {
  EXPIRED_ITEMS: "emp.catExpiredItems", SHELF_CLEANING: "sup.shelfCleaning", PRODUCT_CUSTOMIZATION: "emp.productCustomization",
  DAILY_CLEANING: "emp.dailyCleaning", ITEM_COUNTING: "admin.itemCounting", LABEL_CHECKING: "emp.labelIssue",
  FACING: "sup.facing", REFILLING: "sup.refilling", DEPARTMENT_CLOSING: "emp.catDepartmentClosing",
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
  const { t } = useTranslation();
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
      <h1 className="font-display text-xl md:text-2xl font-bold text-white mb-4">{t("rm.activities")}</h1>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={selectClass}>
          <option value="">{t("rm.allMarkets")}</option>
          {(markets ?? []).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="">{t("admin.allCategories")}</option>
          {Object.entries(CATEGORY_LABEL).map(([value, labelKey]) => (
            <option key={value} value={value}>{t(labelKey)}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">{t("admin.allStatuses")}</option>
          <option value="DRAFT">{t("status.draft")}</option>
          <option value="PENDING">{t("status.pending")}</option>
          <option value="APPROVED">{t("status.approved")}</option>
          <option value="REJECTED">{t("status.rejected")}</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-[70px]" />)}</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : activities.length === 0 ? (
        <div className="rounded-2xl p-10 bg-[#171C2E]/80 border border-white/[0.06] text-center text-sm text-[#8B93A8]">
          {t("admin.noActivitiesMatchTheseFilters")}
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id} className="rounded-xl p-3.5 bg-[#171C2E]/80 border border-white/[0.06]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{CATEGORY_LABEL[a.category] ? t(CATEGORY_LABEL[a.category]) : a.category}</p>
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
