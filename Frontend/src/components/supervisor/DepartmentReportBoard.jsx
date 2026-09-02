import { useState } from "react";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "../common/SkeletonCard";
import ErrorBanner from "../common/ErrorBanner";
import MarketStructureGrid from "./MarketStructureGrid";
import DepartmentReportReviewModal from "./DepartmentReportReviewModal";
import { listMarketDepartments } from "../../services/departmentClosingService";
import { MARKET_SECTIONS } from "../../data/supervisorMockData";

// How long a just-declined tile flashes RED before settling back to BLUE
// (see below) — purely a frontend display timer, not a backend status:
// once declined, the Activity's REJECTED status is the permanent history
// (spec §7's "decline reason system"), but the resting board treats a
// declined department the same as "not reported" so it's immediately
// clear the department is ready for another submission, matching spec
// §4's "the RED state is temporary... the department must be able to be
// reported again" without inventing a stored "acknowledged" flag.
const DECLINE_FLASH_MS = 2500;

// BLUE/YELLOW/GREEN come straight from the department's real submission
// status; REJECTED is intentionally mapped to BLUE here too (see
// DECLINE_FLASH_MS above) — RED only ever appears as the transient flash
// this component adds locally right after a decline, never as a resting
// state derived from stale data.
function statusFor(dept) {
  const status = dept?.submission?.status;
  if (status === "PENDING") return "YELLOW";
  if (status === "APPROVED") return "GREEN";
  return "BLUE";
}

// DepartmentReportBoard.jsx — Department Reporting redesign: the single
// department reporting system on the Supervisor Market page (replaces
// the old Department Monitoring section AND the old mock-data Daily
// Section Checks — see this file's git history). The department head
// completes their department, takes photos, and submits for real
// (DepartmentClosingFlow.jsx, unchanged) — real DEPARTMENT_CLOSING
// Activity rows are the entire data source here
// (departmentClosingService.listMarketDepartments, which already reuses
// GET /api/markets/:id/departments); the supervisor only reviews.
export default function DepartmentReportBoard({ marketId }) {
  const { data: departments, loading, error, reload } = useAsync(() => listMarketDepartments(marketId), { deps: [marketId] });
  const [activeSection, setActiveSection] = useState(null); // { section, dept } | null
  const [declinedFlash, setDeclinedFlash] = useState(null); // department label currently flashing RED

  if (loading) return <SkeletonCard className="h-64" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const byLabel = new Map((departments ?? []).map((d) => [d.department, d]));

  const statusBySection = {};
  const counts = { approved: 0, pending: 0, notReported: 0 };
  MARKET_SECTIONS.forEach((section) => {
    const dept = byLabel.get(section.label);
    const status = declinedFlash === section.label ? "RED" : statusFor(dept);
    statusBySection[section.key] = status;
    if (status === "GREEN") counts.approved++;
    else if (status === "YELLOW") counts.pending++;
    else counts.notReported++;
  });

  function openSection(section) {
    setActiveSection({ section, dept: byLabel.get(section.label) ?? null });
  }

  function handleReviewed(outcome) {
    if (outcome === "declined" && activeSection) {
      const label = activeSection.section.label;
      setDeclinedFlash(label);
      setTimeout(() => setDeclinedFlash((current) => (current === label ? null : current)), DECLINE_FLASH_MS);
    }
    setActiveSection(null);
    reload();
  }

  return (
    <div>
      <MarketStructureGrid sectionStatus={statusBySection} onSelect={openSection} />

      <p className="mt-3 text-xs text-[#8B93A8]">
        {counts.approved} of {MARKET_SECTIONS.length} approved
        {counts.pending > 0 ? ` · ${counts.pending} pending review` : ""}
        {counts.notReported > 0 ? ` · ${counts.notReported} not reported` : ""}
      </p>

      <DepartmentReportReviewModal
        key={activeSection?.section?.key}
        open={!!activeSection}
        section={activeSection?.section}
        dept={activeSection?.dept}
        marketId={marketId}
        onClose={() => setActiveSection(null)}
        onReviewed={handleReviewed}
      />
    </div>
  );
}
