import { useState } from "react";
import { Tag, RotateCcw } from "lucide-react";
import Modal from "../common/Modal";
import AuthenticatedImage from "../common/AuthenticatedImage";
import ChooseMethodStep from "./itemReport/ChooseMethodStep";
import BarcodeScanStep from "./itemReport/BarcodeScanStep";
import ProductSearchStep from "./itemReport/ProductSearchStep";
import { searchProducts } from "../../services/itemReportService";
import { prepareImageForUpload } from "../../services/activityService";
import { stopScanning } from "../../utils/barcodeScanner";

// PriceLookupFlow.jsx — Cashier Activity → Price Lookup (spec §2). Scan a
// barcode or take a photo of the product, then show its real price from
// this market's catalog (Product.price — see productsController.js).
// Deliberately read-only: there's nothing to submit here, just a lookup,
// so it reuses the exact same barcode-scan/photo/search steps as
// ItemReportFlow (components/employee/itemReport/) rather than a
// separate implementation, and ends at a price display instead of a
// details form. A product with no price set yet shows "Price not set"
// honestly — never a fabricated number.

export default function PriceLookupFlow({ open, onClose }) {
  const [step, setStep] = useState("choose");
  const [searchSeed, setSearchSeed] = useState("");
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState(null);
  const [foundProduct, setFoundProduct] = useState(null);

  const reset = () => {
    setStep("choose");
    setSearchSeed("");
    setEvidencePhoto(null);
    setError(null);
    setFoundProduct(null);
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
        setFoundProduct(results[0]);
        setStep("price");
      } else {
        setSearchSeed(barcode);
        setStep("search");
      }
    } catch {
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
    } catch {
      setError("Could not process that photo. Please try again.");
      setEvidencePhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSelectProduct = (product) => {
    setFoundProduct(product);
    setStep("price");
  };

  const lookupAgain = () => {
    setStep("choose");
    setSearchSeed("");
    setEvidencePhoto(null);
    setFoundProduct(null);
  };

  const stepTitle = {
    choose: "Price Lookup",
    barcode: "Scan Barcode",
    search: "Find Product",
    price: "Price",
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

      {step === "price" && foundProduct && (
        <div className="space-y-4 text-center">
          {evidencePhoto?.url && (
            <AuthenticatedImage src={evidencePhoto.url} alt="" className="mx-auto h-24 w-24 rounded-xl object-cover" />
          )}
          <div>
            <p className="text-sm text-[#9AA1B4]">{foundProduct.name}</p>
            <p className="text-[11px] text-[#4C5266]">Barcode {foundProduct.barcode}</p>
          </div>
          <div className="rounded-2xl p-6 bg-[#1A1F33]/70 border border-white/[0.06]">
            {foundProduct.price != null ? (
              <p className="flex items-center justify-center gap-2 text-3xl font-display font-bold text-white">
                <Tag size={22} className="text-[#F47A20]" /> ${foundProduct.price.toFixed(2)}
              </p>
            ) : (
              <p className="text-sm font-medium text-[#8B93A8]">Price not set for this product</p>
            )}
          </div>
          <button
            onClick={lookupAgain}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] transition-colors duration-200"
          >
            <RotateCcw size={14} /> New Lookup
          </button>
        </div>
      )}
    </Modal>
  );
}
