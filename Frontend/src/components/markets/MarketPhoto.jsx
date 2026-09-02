import { useRef, useState } from "react";
import { Store, Camera, Loader2 } from "lucide-react";
import AuthenticatedImage from "../common/AuthenticatedImage";
import { prepareImageForUpload } from "../../services/activityService";
import { updateMarket } from "../../services/marketService";
import { ApiError } from "../../services/apiClient";

const SIZE_CLASSES = {
  sm: "h-14 w-14 rounded-xl", // MarketCard thumbnail
  lg: "h-24 w-24 sm:h-28 sm:w-28 rounded-2xl", // market detail header
};
const ICON_SIZE = { sm: 20, lg: 34 };

// A market's own NEXA-branded fallback — a Store glyph on the same
// orange gradient Logo.jsx's wordmark badge uses, so an unphotographed
// market still reads as "this app's own placeholder" rather than a
// broken image or a borrowed employee avatar (spec: never fall back to
// an employee profile picture).
function MarketPhotoFallback({ size }) {
  return (
    <div className={`${SIZE_CLASSES[size]} shrink-0 grid place-items-center bg-gradient-to-br from-[#F47A20] to-[#c95c10] ring-1 ring-white/10`}>
      <Store size={ICON_SIZE[size]} className="text-white/90" />
    </div>
  );
}

// MarketPhoto.jsx — a market's own storefront photo (Market.photoUrl),
// used consistently everywhere a market is represented: the Markets list
// card (size="sm") and the market detail header (size="lg"). Never an
// employee profile picture, never a generic supermarket stock icon — a
// real photo of THIS market, or the branded NEXA fallback above until
// one is assigned.
//
// editable + marketId together turn this into the upload control too
// (Regional Manager's own market detail header only — see
// RmMarketOverview.jsx) — a camera badge that opens a file picker,
// reuses the exact same compress+upload pipeline every other photo flow
// in this app already uses (prepareImageForUpload), then PATCHes the
// real Market.photoUrl via marketService.updateMarket. No local-only
// preview state pretending to be saved — onUploaded only fires after
// the backend confirms the write.
export default function MarketPhoto({ photoUrl, size = "sm", editable = false, marketId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await prepareImageForUpload(file);
      const updated = await updateMarket(marketId, { photoUrl: url });
      onUploaded?.(updated.photoUrl ?? url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the market photo. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative shrink-0">
      {photoUrl ? (
        <AuthenticatedImage src={photoUrl} alt="" className={`${SIZE_CLASSES[size]} object-cover ring-1 ring-white/10`} />
      ) : (
        <MarketPhotoFallback size={size} />
      )}

      {editable && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Change market photo"
            className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-[#171C2E] ring-2 ring-[#1A1A1A] grid place-items-center text-white hover:bg-[#232a45] disabled:opacity-60 transition-colors"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {error && <p className="absolute top-full mt-1 w-40 text-[10px] text-red-400">{error}</p>}
        </>
      )}
    </div>
  );
}
