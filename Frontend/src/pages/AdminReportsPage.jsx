import { useAsync } from "../hooks/useAsync";
import ErrorBanner from "../components/common/ErrorBanner";
import { SkeletonCard } from "../components/common/SkeletonCard";
import { getAdminReportsSummary } from "../services/adminService";

const CATEGORY_LABEL = {
  EXPIRED_ITEMS: "Expired Items", SHELF_CLEANING: "Shelf Cleaning", PRODUCT_CUSTOMIZATION: "Product Customization",
  DAILY_CLEANING: "Daily Cleaning", ITEM_COUNTING: "Item Counting", LABEL_CHECKING: "Label Issue",
  FACING: "Facing", REFILLING: "Refilling", DEPARTMENT_CLOSING: "Department Closing",
};

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B93A8]">{title}</h2>
      {children}
    </section>
  );
}

function CountRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-sm text-[#9AA1B4]">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

// AdminReportsPage.jsx — Admin Phase 3 §14-15/§31: company-wide
// administrative reporting, built entirely on real aggregate queries
// (adminController.getAdminReportsSummary) — no fabricated metrics, no
// decorative analytics.
export default function AdminReportsPage() {
  const { data, error, loading, reload } = useAsync(getAdminReportsSummary, { deps: [] });

  if (loading) return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><SkeletonCard className="h-64" /></div>;
  if (error) return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><ErrorBanner message={error} onRetry={reload} /></div>;

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-4xl mx-auto animate-fade-up">
      <h1 className="font-display text-xl md:text-2xl font-bold text-white mb-1">Admin Reports</h1>
      <p className="text-sm text-[#9AA1B4] mb-6">
        Company-wide, last 30 days (unless filtered) · Attendance reflects today
      </p>

      <Section title="Attendance Today">
        <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] overflow-hidden">
          {Object.entries(data.attendance.byStatus).length === 0 ? (
            <p className="px-4 py-4 text-sm text-[#6B7284]">No attendance records yet today.</p>
          ) : (
            Object.entries(data.attendance.byStatus).map(([status, count]) => <CountRow key={status} label={status} value={count} />)
          )}
        </div>
      </Section>

      <Section title="Activities by Status">
        <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] overflow-hidden">
          {Object.entries(data.activities.byStatus).length === 0 ? (
            <p className="px-4 py-4 text-sm text-[#6B7284]">No activities in this range.</p>
          ) : (
            Object.entries(data.activities.byStatus).map(([status, count]) => <CountRow key={status} label={status} value={count} />)
          )}
        </div>
      </Section>

      <Section title="Activities by Category">
        <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] overflow-hidden">
          {Object.entries(data.activities.byCategory).map(([category, count]) => (
            <CountRow key={category} label={CATEGORY_LABEL[category] ?? category} value={count} />
          ))}
        </div>
      </Section>

      <Section title="Market Visits & Inspections">
        <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] overflow-hidden">
          {Object.entries(data.visits.byType).length === 0 ? (
            <p className="px-4 py-4 text-sm text-[#6B7284]">No visits or inspections in this range.</p>
          ) : (
            <>
              {Object.entries(data.visits.byType).map(([type, count]) => <CountRow key={type} label={type} value={count} />)}
              {Object.entries(data.visits.byStatus).map(([status, count]) => <CountRow key={status} label={`Status: ${status}`} value={count} />)}
            </>
          )}
        </div>
      </Section>

      <Section title="Administrative Actions">
        <div className="rounded-2xl bg-[#171C2E]/80 border border-white/[0.06] overflow-hidden">
          {Object.entries(data.auditActions).length === 0 ? (
            <p className="px-4 py-4 text-sm text-[#6B7284]">No administrative actions in this range.</p>
          ) : (
            Object.entries(data.auditActions).map(([action, count]) => <CountRow key={action} label={action.replace(/_/g, " ")} value={count} />)
          )}
        </div>
      </Section>
    </div>
  );
}
