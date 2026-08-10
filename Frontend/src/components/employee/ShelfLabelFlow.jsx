import { useState } from "react";
import { ScanBarcode, Search, Loader2 } from "lucide-react";
import Modal from "../common/Modal";
import BarcodeScanStep from "./itemReport/BarcodeScanStep";
import ProductSearchStep from "./itemReport/ProductSearchStep";
import { searchProducts } from "../../services/itemReportService";
import { createActivity } from "../../services/activityService";
import { stopScanning } from "../../utils/barcodeScanner";
import { ApiError } from "../../services/apiClient";

const ISSUE_TYPES = [
  { value: "MISSING", label: "Missing" },
  { value: "INCORRECT", label: "Incorrect Price / Info" },
  { value: "DAMAGED", label: "Damaged" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowTimeLabel() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ShelfLabelFlow.jsx — Shelf Labels: scan/search a product, flag what's
// wrong with its label, then either Save for Later (DRAFT) or Fix Now
// (submitted as PENDING) — the exact same DRAFT/PENDING states every
// other Activity uses, just with the two extra fields (productId,
// labelIssueType) the backend added for this flow.
export default function ShelfLabelFlow({ open, onClose, onSaved }) {
  const [step, setStep] = useState("choose");
  const [searchSeed, setSearchSeed] = useState("");
  const [product, setProduct] = useState(null);
  const [issueType, setIssueType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setStep("choose");
    setSearchSeed("");
    setProduct(null);
    setIssueType(null);
    setError(null);
  };

  const handleClose = () => {
    stopScanning();
    reset();
    onClose();
  };

  const handleBarcodeDetected = async (barcode) => {
    try {
      const results = await searchProducts({ barcode });
      if (results.length === 1) {
        setProduct(results[0]);
        setStep("issue");
      } else {
        setSearchSeed(barcode);
        setStep("search");
      }
    } catch {
      setSearchSeed(barcode);
      setStep("search");
    }
  };

  const handleSelectProduct = (p) => {
    setProduct(p);
    setStep("issue");
  };

  async function handleSubmit(status) {
    setSubmitting(true);
    setError(null);
    try {
      const activity = await createActivity({
        category: "LABEL_CHECKING",
        date: todayISO(),
        time: nowTimeLabel(),
        status,
        productId: product.id,
        labelIssueType: issueType,
      });
      onSaved(activity, status === "DRAFT" ? "Saved for later." : "Label issue submitted.");
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this label issue.");
    } finally {
      setSubmitting(false);
    }
  }

  const stepTitle = { choose: "Shelf Labels", search: "Find Product", issue: "Label Issue" }[step];

  return (
    <Modal open={open} onClose={handleClose} title={stepTitle}>
      {step === "choose" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setStep("barcode")}
            className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200"
          >
            <ScanBarcode size={22} className="text-[#F47A20]" />
            <span className="text-xs font-medium text-white">Scan Barcode</span>
          </button>
          <button
            onClick={() => setStep("search")}
            className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200"
          >
            <Search size={22} className="text-[#F47A20]" />
            <span className="text-xs font-medium text-white">Search Product</span>
          </button>
        </div>
      )}

      {step === "barcode" && (
        <BarcodeScanStep onDetected={handleBarcodeDetected} onBack={() => setStep("choose")} />
      )}

      {step === "search" && (
        <ProductSearchStep initialQuery={searchSeed} onSelect={handleSelectProduct} onBack={() => setStep("choose")} />
      )}

      {step === "issue" && product && (
        <div className="space-y-4">
          <div className="rounded-lg p-3 bg-white/[0.04]">
            <p className="text-sm text-white font-medium">{product.name}</p>
            <p className="text-[11px] text-[#8B93A8]">Barcode {product.barcode}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#8B93A8] mb-2">What's wrong with the label?</p>
            <div className="grid grid-cols-1 gap-2">
              {ISSUE_TYPES.map((it) => (
                <button
                  key={it.value}
                  onClick={() => setIssueType(it.value)}
                  className={`rounded-lg px-3.5 py-3 text-sm text-left font-medium transition-colors duration-150 ${
                    issueType === it.value
                      ? "bg-[#F47A20] text-white"
                      : "bg-white/[0.05] text-[#9AA1B4] hover:bg-white/[0.09]"
                  }`}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => handleSubmit("DRAFT")}
              disabled={!issueType || submitting}
              className="rounded-xl py-3 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] disabled:opacity-40 transition-colors duration-200"
            >
              Save for Later
            </button>
            <button
              onClick={() => handleSubmit("PENDING")}
              disabled={!issueType || submitting}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              Fix Now
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
