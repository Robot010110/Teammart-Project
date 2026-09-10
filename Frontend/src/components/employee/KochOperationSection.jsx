import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import WorkerKochOperationFlow from "./WorkerKochOperationFlow";
import KochOperationHistoryList from "./KochOperationHistoryList";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import { listMyKochOperations } from "../../services/kochOperationService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

// KochOperationSection.jsx — Koch Operation, Worker side: a "Select
// Operation" entry point + this employee's own submission history, same
// shell shape InventoryCountingSection.jsx already uses for the adjacent
// Daily Counting card (entry point + real history, no separate "New" vs
// "History" screens) — opened from the new Koch Operation card in
// WorkerActivityTab.jsx's Daily Activities carousel.
export default function KochOperationSection() {
  const { t } = useTranslation();
  const [toast, setToast] = useToast();
  const [flowOpen, setFlowOpen] = useState(false);

  const { data: operations, setData: setOperations, error, loading, reload } = useAsync(listMyKochOperations, {
    fallbackError: t("emp.couldNotLoadKochOperations"),
  });

  function handleSaved(operation, message) {
    setOperations((prev) => [operation, ...(prev ?? [])]);
    setToast(message);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setFlowOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-150"
      >
        <Camera size={14} /> {t("emp.selectOperation")}
      </button>

      {loading ? (
        <SkeletonCard className="h-16" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : (
        <KochOperationHistoryList operations={operations} />
      )}

      <WorkerKochOperationFlow open={flowOpen} onClose={() => setFlowOpen(false)} onSaved={handleSaved} />

      <Toast message={toast} />
    </div>
  );
}
