import { useState } from "react";
import { ClipboardList, ShieldCheck, Loader2, MapPin } from "lucide-react";
import { listCountingAssignmentsForMarket, verifyCountingAssignment } from "../../services/countingAssignmentService";
import { useAsync } from "../../hooks/useAsync";
import { SkeletonCard } from "../common/SkeletonCard";

// CountingVerificationQueue.jsx — spec §3: cross-department counting
// assignments awaiting Regional/Zone Manager sign-off, for the market
// currently being viewed. Only rendered when the queue is non-empty
// (RmMarketOverview.jsx) — an empty queue means nothing needs this
// manager's attention, so nothing is shown rather than an empty card.
export default function CountingVerificationQueue({ marketId }) {
  const { data: assignments, setData, loading } = useAsync(
    () => listCountingAssignmentsForMarket({ marketId, pending: true }),
    { deps: [marketId] }
  );
  const [busyId, setBusyId] = useState(null);

  async function handleVerify(assignment) {
    setBusyId(assignment.id);
    try {
      await verifyCountingAssignment(assignment.id);
      setData((prev) => prev.filter((a) => a.id !== assignment.id));
    } catch {
      // Non-fatal — the item just stays in the queue for another try.
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <SkeletonCard className="h-24" />;
  if (!assignments || assignments.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8B93A8] flex items-center gap-1.5">
        <ClipboardList size={13} /> Counting Assignments Awaiting Verification
      </h2>
      <div className="space-y-2">
        {assignments.map((a) => (
          <div key={a.id} className="rounded-xl p-3.5 bg-amber-500/[0.06] border border-amber-500/20 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{a.employee?.name}</p>
              <p className="text-xs text-[#9AA1B4] mt-0.5">
                {a.originalDepartment} → {a.assignedDepartment}
                {a.countingArea && (
                  <span className="flex items-center gap-1 mt-0.5"><MapPin size={11} /> {a.countingArea}</span>
                )}
              </p>
              <p className="text-[11px] text-[#4C5266] mt-0.5">Assigned by {a.assignedBy?.name}</p>
            </div>
            <button
              type="button"
              onClick={() => handleVerify(a)}
              disabled={busyId === a.id}
              className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50 transition-colors duration-150"
            >
              {busyId === a.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              Verify
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
