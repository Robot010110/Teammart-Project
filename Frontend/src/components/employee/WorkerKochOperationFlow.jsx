import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import Modal from "../common/Modal";
import EvidenceCapture from "./EvidenceCapture";
import { createKochOperation } from "../../services/kochOperationService";
import { ApiError } from "../../services/apiClient";

const OPERATION_TYPES = [
  { value: "CUSTOMIZATION", label: "emp.customization" },
  { value: "DISCOUNT_CUSTOMIZATION", label: "emp.discountCustomization" },
];

// WorkerKochOperationFlow.jsx — Koch Operation, Worker flow: Select
// Operation -> Photo -> Submit (spec's own step order). Identity/market/
// department are never collected here — the backend fills all of that in
// from the authenticated employee's own token (see
// kochOperationsController.createKochOperation). Same step-machine-in-a-
// Modal shape ShelfLabelFlow.jsx already uses for its own flow.
export default function WorkerKochOperationFlow({ open, onClose, onSaved }) {
  const { t } = useTranslation();
  const [step, setStep] = useState("select");
  const [operationType, setOperationType] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setStep("select");
    setOperationType(null);
    setPhoto(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  function handleSelect(value) {
    setOperationType(value);
    setStep("photo");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const operation = await createKochOperation({ operationType, evidenceUrl: photo });
      onSaved(operation, t("emp.kochOperationSubmitted"));
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("emp.couldNotSubmitKochOperation"));
    } finally {
      setSubmitting(false);
    }
  }

  const stepTitle = { select: t("emp.selectOperation"), photo: t("emp.kochOperation") }[step];

  return (
    <Modal open={open} onClose={handleClose} title={stepTitle}>
      {step === "select" && (
        <div className="grid grid-cols-1 gap-2">
          {OPERATION_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className="rounded-lg px-3.5 py-3 text-sm text-start font-medium text-white bg-white/[0.05] hover:bg-white/[0.09] transition-colors duration-150"
            >
              {t(opt.label)}
            </button>
          ))}
        </div>
      )}

      {step === "photo" && (
        <div className="space-y-4">
          <div className="rounded-lg p-3 bg-white/[0.04]">
            <p className="text-sm text-white font-medium">{t(OPERATION_TYPES.find((o) => o.value === operationType)?.label)}</p>
          </div>

          <EvidenceCapture photo={photo} onPhotoChange={setPhoto} />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep("select")}
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
