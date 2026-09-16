import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import AuthenticatedImage from "../../common/AuthenticatedImage";

// ZoneActivityPhotoViewer.jsx — a full-screen "1 / N" gallery for a Zone
// Activities record's attached photos.
//
// No swipeable multi-image viewer existed anywhere in this app before
// this (confirmed during planning — ActivityCarousel.jsx is a card
// carousel, MultiPhotoEvidence.jsx is an upload grid, neither is a
// viewer), so this is new. It reuses Modal.jsx's underlying technique —
// a document.body portal, Escape-to-close, body-scroll-lock while open —
// rather than importing Modal.jsx itself, since Modal's fixed title bar
// and `max-w-lg` centered card don't fit a full-bleed image viewer; the
// actual image loading goes through the same AuthenticatedImage every
// other photo in this app already uses, so file authorization is
// unchanged (nothing here bypasses the private-upload auth check).
//
// `photos` — the record's own real `photos: [{url}]` array (already
// lightweight: only ever a list of URL strings server-side — see
// zoneActivitiesService.js's own comment). `startIndex` opens already on
// the photo that was actually tapped, not always at 0.
export default function ZoneActivityPhotoViewer({ photos, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef(null);

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length]);

  if (!photos.length) return null;

  function goNext() {
    setIndex((i) => Math.min(photos.length - 1, i + 1));
  }
  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    const SWIPE_THRESHOLD = 40;
    if (delta > SWIPE_THRESHOLD) goPrev();
    else if (delta < -SWIPE_THRESHOLD) goNext();
    touchStartX.current = null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between px-4 py-3.5 sm:px-6">
        {photos.length > 1 ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold text-white tabular-nums">
            {index + 1} / {photos.length}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-2 pb-4">
        {photos.length > 1 && index > 0 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous photo"
            className="absolute start-2 top-1/2 hidden -translate-y-1/2 h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:grid"
          >
            <ChevronLeft size={20} className="rtl-flip" />
          </button>
        )}

        <AuthenticatedImage
          key={photos[index].url}
          src={photos[index].url}
          alt=""
          className="max-h-full max-w-full rounded-lg object-contain"
        />

        {photos.length > 1 && index < photos.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next photo"
            className="absolute end-2 top-1/2 hidden -translate-y-1/2 h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:grid"
          >
            <ChevronRight size={20} className="rtl-flip" />
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-5">
          {photos.map((p, i) => (
            <span
              key={p.url}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/30"}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
