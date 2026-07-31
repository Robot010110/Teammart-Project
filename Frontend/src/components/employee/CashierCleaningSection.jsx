import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import { getTodayCleaningLog, submitCleaningLog } from "../../services/cashierCleaningService";
import { CLEANING_CHECKLIST_ITEMS } from "../../data/workspaceData";
import { ApiError } from "../../services/apiClient";
import { useAsync } from "../../hooks/useAsync";

// CashierCleaningSection.jsx — the cashier station-cleaning checklist.
// Always means "clean the cashier station" — never shelf/aisle/department
// cleaning (that's the Worker's Daily Activities grid, which Cashiers
// never see). Only rendered by CashierWorkspace.jsx when
// profile.cashierShift === "MORNING".

const timeLabel = (isoString) =>
  new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function CashierCleaningSection() {
  const { data: log, setData: setLog, error, loading, reload } = useAsync(getTodayCleaningLog, {
    fallbackError: "Could not load today's cleaning checklist.",
  });
  const [checked, setChecked] = useState(() =>
    Object.fromEntries(CLEANING_CHECKLIST_ITEMS.map((label) => [label, false]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Resume any in-progress checklist state once today's log loads.
  useEffect(() => {
    if (!log) return;
    const fromLog = Object.fromEntries(log.items.map((item) => [item.label, item.checked]));
    setChecked((prev) => ({ ...prev, ...fromLog }));
  }, [log]);

  const toggle = (label) => setChecked((prev) => ({ ...prev, [label]: !prev[label] }));

  const allChecked = CLEANING_CHECKLIST_ITEMS.every((label) => checked[label]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const items = CLEANING_CHECKLIST_ITEMS.map((label) => ({ label, checked: checked[label] }));
      const updated = await submitCleaningLog(items);
      setLog(updated);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not save the checklist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SkeletonCard className="h-[220px]" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  if (log?.completedAt) {
    return (
      <section className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 size={24} className="text-emerald-400" />
          <p className="text-sm text-white font-medium">Station cleaning completed</p>
          <p className="text-xs text-[#9AA1B4]">Completed today at {timeLabel(log.completedAt)}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="space-y-2.5">
        {CLEANING_CHECKLIST_ITEMS.map((label) => (
          <label
            key={label}
            className="flex items-center gap-3 rounded-xl p-3.5 bg-[#1A1F33]/70 border border-white/[0.06] cursor-pointer active:bg-[#1F2436]"
          >
            <input
              type="checkbox"
              checked={!!checked[label]}
              onChange={() => toggle(label)}
              className="h-5 w-5 shrink-0 accent-[#F47A20]"
            />
            <span className="flex items-center gap-2 text-sm text-white">
              <Sparkles size={13} className="text-[#F47A20] shrink-0" /> {label}
            </span>
          </label>
        ))}
      </div>

      {submitError && <p className="mt-3 text-xs text-red-400">{submitError}</p>}

      <button
        onClick={handleSubmit}
        disabled={!allChecked || submitting}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
        {submitting ? "Saving..." : allChecked ? "Mark Complete" : "Check all items to complete"}
      </button>
    </section>
  );
}
