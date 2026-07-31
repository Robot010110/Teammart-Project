import { useState } from "react";
import Modal from "../common/Modal";
import ChooseMethodStep from "./itemReport/ChooseMethodStep";
import BarcodeScanStep from "./itemReport/BarcodeScanStep";
import ProductSearchStep from "./itemReport/ProductSearchStep";
import ItemDetailsStep from "./itemReport/ItemDetailsStep";
import { searchProducts, createItemReport } from "../../services/itemReportService";
import { prepareImageForUpload } from "../../services/activityService";
import { stopScanning } from "../../utils/barcodeScanner";
import { ApiError } from "../../services/apiClient";

// ItemReportFlow.jsx — orchestrator for the Expired/Wasted Items
// multi-step submission flow. Both entry paths (barcode scan, photo
// capture) end at the same place: a searchable product picker. There is
// no real AI photo-based product recognition here (no vision service
// exists) — a photo is evidence only; the barcode path is the only one
// that can identify a product automatically, and even it falls back to
// manual search if the scanned code doesn't match anything in this
// market's catalog.
//
// Steps: "choose" -> "barcode" | (photo, no step) -> "search" -> "details" -> submit.
// Split into one component per step (components/employee/itemReport/) —
// this file now only owns cross-step state and the handlers each step
// needs to call back into; each step owns its own step-local UI state
// (e.g. the camera lifecycle lives entirely in BarcodeScanStep).

export default function ItemReportFlow({ open, onClose, onSaved }) {
  const [step, setStep] = useState("choose");
  const [searchSeed, setSearchSeed] = useState(""); // seeds ProductSearchStep when a scanned barcode has no exact match

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [evidencePhoto, setEvidencePhoto] = useState(null); // { url, progress } | null
  const [photoBusy, setPhotoBusy] = useState(false);
  const [condition, setCondition] = useState("EXPIRED");
  const [quantity, setQuantity] = useState("");
  const [quantityInvalid, setQuantityInvalid] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setStep("choose");
    setSearchSeed("");
    setSelectedProduct(null);
    setEvidencePhoto(null);
    setCondition("EXPIRED");
    setQuantity("");
    setQuantityInvalid(false);
    setNotes("");
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
        setSelectedProduct(results[0]);
        setStep("details");
      } else {
        setSearchSeed(barcode);
        setStep("search");
      }
    } catch (err) {
      // Fall through to manual search rather than getting stuck — the
      // scanned code still seeds the search box.
      setSearchSeed(barcode);
      setStep("search");
    }
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
      setSearchSeed("");
      setStep("search");
    } catch (err) {
      setError("Could not process that photo. Please try again.");
      setEvidencePhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setError(null);
    setStep("details");
  };

  const handleSubmit = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setQuantityInvalid(true);
      setError("Enter a quantity greater than 0.");
      return;
    }
    setQuantityInvalid(false);
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
      {step === "choose" && (
        <ChooseMethodStep
          onScanBarcode={() => setStep("barcode")}
          onTakePicture={handleTakePicture}
          busy={photoBusy}
          progress={evidencePhoto?.progress}
          error={error}
        />
      )}

      {step === "barcode" && (
        <BarcodeScanStep onDetected={handleBarcodeDetected} onBack={() => setStep("choose")} />
      )}

      {step === "search" && (
        <ProductSearchStep
          initialQuery={searchSeed}
          evidencePhotoUrl={evidencePhoto?.url}
          onSelect={handleSelectProduct}
          onBack={() => setStep("choose")}
        />
      )}

      {step === "details" && selectedProduct && (
        <ItemDetailsStep
          product={selectedProduct}
          condition={condition}
          onConditionChange={setCondition}
          quantity={quantity}
          onQuantityChange={(v) => { setQuantity(v); setQuantityInvalid(false); }}
          quantityInvalid={quantityInvalid}
          notes={notes}
          onNotesChange={setNotes}
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
        />
      )}
    </Modal>
  );
}
