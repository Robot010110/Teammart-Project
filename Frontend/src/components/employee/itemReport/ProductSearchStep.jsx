import { useEffect, useState } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { searchProducts } from "../../../services/itemReportService";
import { ApiError } from "../../../services/apiClient";

// ProductSearchStep.jsx — debounced product search, seeded with a
// scanned-but-unresolved barcode when arriving from BarcodeScanStep
// (`initialQuery`), or empty when arriving from a photo capture. Owns
// its own search state/debounce entirely locally — the orchestrator only
// needs to know which product got picked.

export default function ProductSearchStep({ initialQuery = "", evidencePhotoUrl, onSelect, onBack }) {
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [products, setProducts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setProducts([]);
      return;
    }
    setSearching(true);
    setError(null);
    const timer = setTimeout(() => {
      searchProducts({ search: searchTerm.trim() })
        .then(setProducts)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Could not search products."))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="space-y-3">
      {evidencePhotoUrl && (
        <div className="flex items-center gap-2 rounded-lg p-2 bg-white/[0.04]">
          <img src={evidencePhotoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
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
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="space-y-2 max-h-[260px] overflow-y-auto">
        {searching && <p className="text-xs text-[#4C5266] text-center py-4">Searching...</p>}
        {!searching && searchTerm.trim() && products.length === 0 && !error && (
          <p className="text-xs text-[#4C5266] text-center py-4">No products found.</p>
        )}
        {!searching &&
          products.map((product) => (
            <button
              key={product.id}
              onClick={() => onSelect(product)}
              className="w-full text-left rounded-lg p-3 bg-[#1A1F33]/70 border border-white/[0.06] hover:border-[#F47A20]/35 active:bg-[#1F2436] transition-colors duration-150"
            >
              <p className="text-sm text-white font-medium">{product.name}</p>
              <p className="text-[11px] text-[#8B93A8]">Barcode {product.barcode}</p>
            </button>
          ))}
      </div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 py-2 text-xs text-[#9AA1B4] hover:text-white"
      >
        <ArrowLeft size={12} /> Back
      </button>
    </div>
  );
}
