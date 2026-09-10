import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";
import CashierKochOperationFlow from "./CashierKochOperationFlow";
import KochOperationHistoryList from "./KochOperationHistoryList";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import Toast from "../common/Toast";
import { listMyKochOperations } from "../../services/kochOperationService";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";

// CashierKochOperationSection.jsx — Koch Operation, Cashier side. Same
// shell shape PriceReportSection.jsx already uses (icon + title/subtitle
// row, action button on the right, real history below) — mounted
// directly in CashierActivityTab.jsx alongside Price Report/Cleaning,
// since the Cashier tab has no card-carousel to launch a flow from the
// way the Worker tab does.
export default function CashierKochOperationSection() {
  const { t } = useTranslation();
  const [flowOpen, setFlowOpen] = useState(false);
  const [toast, setToast] = useToast();

  const { data: operations, setData: setOperations, error, loading, reload } = useAsync(listMyKochOperations, {
    fallbackError: t("emp.couldNotLoadKochOperations"),
  });

  function handleSaved(operation, message) {
    setOperations((prev) => [operation, ...(prev ?? [])]);
    setToast(message);
  }

  return (
    <section className="rounded-2xl p-4 sm:p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center flex-wrap justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-[#F47A20]/10 text-[#F47A20] shrink-0">
            <Package size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{t("emp.kochOperation")}</p>
            <p className="text-xs text-[#8B93A8]">{t("emp.kochOperationCardDescription")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFlowOpen(true)}
          aria-label={t("emp.selectProducts")}
          className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 sm:px-3.5 py-2.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-150"
        >
          <Package size={14} /> {t("emp.selectProducts")}
        </button>
      </div>

      {loading ? (
        <div className="mt-4"><SkeletonCard className="h-[60px]" /></div>
      ) : error ? (
        <div className="mt-4"><ErrorBanner message={error} onRetry={reload} /></div>
      ) : (
        <div className="mt-4">
          <KochOperationHistoryList operations={operations} />
        </div>
      )}

      <CashierKochOperationFlow open={flowOpen} onClose={() => setFlowOpen(false)} onSaved={handleSaved} />

      <Toast message={toast} />
    </section>
  );
}
