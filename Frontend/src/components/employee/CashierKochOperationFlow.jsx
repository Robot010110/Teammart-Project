import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Package, Minus, Plus, Check } from "lucide-react";
import Modal from "../common/Modal";
import EvidenceCapture from "./EvidenceCapture";
import ErrorBanner from "../common/ErrorBanner";
import { SkeletonCard } from "../common/SkeletonCard";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { listKochProducts, createKochOperation } from "../../services/kochOperationService";
import { useAsync } from "../../hooks/useAsync";
import { ApiError } from "../../services/apiClient";

function productLabel(product) {
  return [product.name, product.variant, product.size].filter(Boolean).join(" ");
}

// CashierKochOperationFlow.jsx — Koch Operation, Cashier flow: Select
// Products (multi-select, real DB catalog — never hardcoded, spec §5) ->
// Receipt Photo -> Submit. Same step-machine-in-a-Modal shape
// WorkerKochOperationFlow.jsx uses for its own flow, just with a
// multi-select first step instead of a single choice.
export default function CashierKochOperationFlow({ open, onClose, onSaved }) {
  const { t } = useTranslation();
  const [step, setStep] = useState("products");
  const [selected, setSelected] = useState({}); // { [kochProductId]: quantity }
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { data: products, error: productsError, loading: productsLoading, reload } = useAsync(listKochProducts, {
    deps: [],
    fallbackError: t("emp.couldNotLoadKochProducts"),
  });

  const reset = () => {
    setStep("products");
    setSelected({});
    setPhoto(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  function toggleProduct(id) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  function changeQuantity(id, delta) {
    setSelected((prev) => ({ ...prev, [id]: Math.max(1, Math.min(9999, (prev[id] ?? 1) + delta)) }));
  }

  const selectedIds = Object.keys(selected);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const operation = await createKochOperation({
        evidenceUrl: photo,
        products: selectedIds.map((kochProductId) => ({ kochProductId, quantity: selected[kochProductId] })),
      });
      onSaved(operation, t("emp.kochOperationSubmitted"));
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("emp.couldNotSubmitKochOperation"));
    } finally {
      setSubmitting(false);
    }
  }

  const stepTitle = { products: t("emp.selectProducts"), photo: t("emp.receiptPhoto") }[step];

  return (
    <Modal open={open} onClose={handleClose} title={stepTitle}>
      {step === "products" && (
        <div className="space-y-3">
          {productsLoading ? (
            <SkeletonCard className="h-40" />
          ) : productsError ? (
            <ErrorBanner message={productsError} onRetry={reload} />
          ) : !products || products.length === 0 ? (
            <p className="text-sm text-[#4C5266] text-center py-6">{t("emp.noKochProductsAvailable")}</p>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto">
              {products.map((product) => {
                const isSelected = !!selected[product.id];
                return (
                  <div
                    key={product.id}
                    className={`rounded-lg p-2.5 border transition-colors duration-150 ${
                      isSelected ? "border-[#F47A20]/50 bg-[#F47A20]/10" : "border-white/[0.06] bg-white/[0.02]"
                    }`}
                  >
                    <button type="button" onClick={() => toggleProduct(product.id)} className="w-full flex items-center gap-3 text-start">
                      {product.imageUrl ? (
                        <AuthenticatedImage src={product.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
                      ) : (
                        <span className="grid place-items-center h-11 w-11 rounded-lg bg-white/[0.05] text-[#4C5266] shrink-0">
                          <Package size={18} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 text-sm text-white font-medium truncate">{productLabel(product)}</span>
                      {isSelected && (
                        <span className="shrink-0 grid place-items-center h-6 w-6 rounded-full bg-[#F47A20] text-white">
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                    {isSelected && (
                      <div className="mt-2 flex items-center justify-end gap-3">
                        <span className="text-xs text-[#8B93A8]">{t("emp.quantity")}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, -1)}
                            className="grid place-items-center h-7 w-7 rounded-full bg-white/[0.06] text-white hover:bg-white/[0.1]"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center text-sm text-white tabular-nums">{selected[product.id]}</span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, 1)}
                            className="grid place-items-center h-7 w-7 rounded-full bg-white/[0.06] text-white hover:bg-white/[0.1]"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep("photo")}
            disabled={selectedIds.length === 0}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
          >
            {t("admin.continue")}
          </button>
        </div>
      )}

      {step === "photo" && (
        <div className="space-y-4">
          <EvidenceCapture photo={photo} onPhotoChange={setPhoto} />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep("products")}
              disabled={submitting}
              className="rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] disabled:opacity-40 transition-colors duration-200"
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!photo || submitting}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {t("common.submit")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
