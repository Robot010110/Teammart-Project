import { useEffect, useRef, useState } from "react";
import { ScanBarcode, Camera, Search, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import Modal from "../common/Modal";
import { searchProducts, createItemReport } from "../../services/itemReportService";
import { prepareImageForUpload } from "../../services/activityService";
import { startScanning, stopScanning } from "../../utils/barcodeScanner";
import { ApiError } from "../../services/apiClient";

// ItemReportFlow.jsx — the Expired/Wasted Items multi-step submission
// flow. Both entry paths (barcode scan, photo capture) end at the same
// place: a searchable product picker. There is no real AI photo-based
// product recognition here (no vision service exists) — a photo is
// evidence only; the barcode path is the only one that can identify a
// product automatically, and even it falls back to manual search if the
// scanned code doesn't match anything in this market's catalog.
//
// Steps: "choose" -> "barcode" | "photo" -> "search" -> "details" -> submit.

const CONDITIONS = [
  { value: "EXPIRED", label: "Expired" },
  { value: "WASTED", label: "Wasted" },
];

export default function ItemReportFlow({ open, onClose, onSaved }) {
  const [step, setStep] = useState("choose");
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [manualBarcode, setManualBarcode] = useState("");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [evidencePhoto, setEvidencePhoto] = useState(null); // { url, progress } | null
  const [photoBusy, setPhotoBusy] = useState(false);
  const [condition, setCondition] = useState("EXPIRED");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);

  const reset = () => {
    setStep("choose");
    setProducts([]);
    setSearchTerm("");
    setScanError(null);
    setManualBarcode("");
    setSelectedProduct(null);
    setEvidencePhoto(null);
    setCondition("EXPIRED");
    setQuantity("");
    setNotes("");
    setError(null);
  };

  const handleClose = () => {
    stopScanning();
    reset();
    onClose();
  };

  // Camera lifecycle for the barcode step only.
  useEffect(() => {
    if (step !== "barcode") return;
    setScanError(null);
    startScanning(videoRef.current, (text) => {
      stopScanning();
      handleBarcodeDetected(text);
    }).catch(() => {
      setScanError("Could not access the camera. Enter the barcode manually below instead.");
    });
    return () => stopScanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const runSearch = async (query) => {
    setSearching(true);
    setError(null);
    try {
      const results = await searchProducts(query.barcode ? { barcode: query.barcode } : { search: query.search });
      setProducts(results);
      return results;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not search products.");
      return [];
    } finally {
      setSearching(false);
    }
  };

  const handleBarcodeDetected = async (barcode) => {
    const results = await runSearch({ barcode });
    if (results.length === 1) {
      setSelectedProduct(results[0]);
      setStep("details");
    } else {
      setSearchTerm(barcode);
      setStep("search");
    }
  };

  const handleManualBarcodeSubmit = () => {
    if (!manualBarcode.trim()) return;
    handleBarcodeDetected(manualBarcode.trim());
  };

  const handleTakePicture = async (file) => {
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    setEvidencePhoto({ url: null, progress: 0 });
    try {
      const url = await prepareImageForUpload(file, {
        onProgress: (progress) => setEvidencePhoto({ url: null, progress }),
      });
      setEvidencePhoto({ url, progress: 100 });
      setStep("search");
    } catch (err) {
      setError("Could not process that photo. Please try again.");
      setEvidencePhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  useEffect(() => {
    if (step !== "search") return;
    const timer = setTimeout(() => {
      if (searchTerm.trim()) runSearch({ search: searchTerm.trim() });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, step]);

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setStep("details");
  };

  const handleSubmit = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const report = await createItemReport({
        productId: selectedProduct.id,
        condition,
        quantity: qty,
        notes: notes || undefined,
        imageUrl: evidencePhoto?.url || undefined,
      });
      onSaved(report, `${condition === "EXPIRED" ? "Expired" : "Wasted"} item reported.`);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit this report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitle = {
    choose: "Report Expired / Wasted Item",
    barcode: "Scan Barcode",
    search: "Find Product",
    details: "Item Details",
  }[step];

  return (
    <Modal open={open} onClose={handleClose} title={stepTitle}>
      <div className="space-y-4">
        {step === "choose" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStep("barcode")}
              className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200"
            >
              <ScanBarcode size={22} className="text-[#F47A20]" />
              <span className="text-xs font-medium text-white">Scan Barcode</span>
            </button>
            <label className="flex flex-col items-center gap-2 rounded-xl p-5 bg-[#1A1F33]/70 border border-white/[0.05] hover:border-[#F47A20]/35 hover:bg-[#1F2436] transition-all duration-200 cursor-pointer">
              <Camera size={22} className="text-[#F47A20]" />
              <span className="text-xs font-medium text-white">Take Picture</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleTakePicture(e.target.files[0])}
              />
            </label>
          </div>
        )}

        {step === "barcode" && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            </div>
            {scanError && (
              <div className="space-y-2">
                <p className="text-xs text-red-400">{scanError}</p>
                <div className="flex gap-2">
                  <input
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    placeholder="Enter barcode number"
                    className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
                  />
                  <button
                    onClick={handleManualBarcodeSubmit}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36]"
                  >
                    Search
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => setStep("choose")}
              className="flex items-center gap-1 text-xs text-[#9AA1B4] hover:text-white"
            >
              <ArrowLeft size={12} /> Back
            </button>
          </div>
        )}

        {step === "search" && (
          <div className="space-y-3">
            {evidencePhoto?.url && (
              <div className="flex items-center gap-2 rounded-lg p-2 bg-white/[0.04]">
                <img src={evidencePhoto.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <span className="text-xs text-[#9AA1B4]">Photo attached as evidence</span>
              </div>
            )}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search product by name..."
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
              />
            </div>
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {searching && <p className="text-xs text-[#4C5266] text-center py-4">Searching...</p>}
              {!searching && searchTerm.trim() && products.length === 0 && (
                <p className="text-xs text-[#4C5266] text-center py-4">No products found.</p>
              )}
              {!searching &&
                products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="w-full text-left rounded-lg p-3 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/35 transition-colors duration-150"
                  >
                    <p className="text-sm text-white font-medium">{product.name}</p>
                    <p className="text-[11px] text-[#8B93A8]">Barcode {product.barcode}</p>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setStep("choose")}
              className="flex items-center gap-1 text-xs text-[#9AA1B4] hover:text-white"
            >
              <ArrowLeft size={12} /> Back
            </button>
          </div>
        )}

        {step === "details" && selectedProduct && (
          <div className="space-y-4">
            <div className="rounded-lg p-3 bg-white/[0.04]">
              <p className="text-sm text-white font-medium">{selectedProduct.name}</p>
              <p className="text-[11px] text-[#8B93A8]">Barcode {selectedProduct.barcode}</p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Condition</label>
              <div className="flex gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCondition(c.value)}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors duration-150 ${
                      condition === c.value ? "bg-[#F47A20] text-white" : "bg-white/[0.05] text-[#9AA1B4]"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Number of items"
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        )}

        {step === "choose" && error && <p className="text-xs text-red-400">{error}</p>}
        {photoBusy && evidencePhoto && step === "choose" && (
          <p className="text-xs text-[#9AA1B4]">Processing photo... {evidencePhoto.progress}%</p>
        )}
      </div>
    </Modal>
  );
}
