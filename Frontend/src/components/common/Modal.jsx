import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

// Modal.jsx — generic centered modal with backdrop blur + fade/scale-in.
// Every photo/camera capture flow in this app (SubmitTaskModal,
// WastedOverallFlow, ShelfLabelFlow, PriceReportFlow, ItemReportFlow,
// DailyStatusTile, ...) opens its content through this one component, so
// fixing it here fixes all of them at once.
//
// Rendered via a portal straight into document.body rather than inline in
// the caller's component tree. Reason: `position: fixed` is supposed to
// be relative to the viewport, but CSS creates a new "containing block"
// for fixed descendants whenever an ANCESTOR has a transform, filter,
// backdrop-filter, perspective, or certain will-change values — and this
// app's card styling uses backdrop-blur-* and transform-based entrance
// animations (animate-fade-up, etc.) pervasively. Whenever a Modal was
// opened from inside one of those ancestors, `fixed inset-0` silently
// became relative to that ancestor instead of the real viewport — that's
// what caused the camera/photo UI to appear mid-page and require
// scrolling back up to find it. A portal makes this impossible: the
// modal's DOM parent is always <body> directly, so no ancestor's CSS can
// ever affect its containing block, regardless of where in the page tree
// it was opened from. Body scroll is locked while open, matching the
// spec's "no background interaction" requirement.
export default function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${maxWidth} rounded-2xl bg-[#1F2436] border border-white/10 shadow-2xl animate-modal-in max-h-[90vh] overflow-y-auto`}
      >
        <div className="sticky top-0 flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/[0.06] bg-[#1F2436]/95 backdrop-blur-xl">
          <h3 className="font-display font-semibold text-white text-base pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="shrink-0 h-10 w-10 rounded-full grid place-items-center bg-white/5 hover:bg-white/10 active:bg-white/[0.14] transition-colors duration-200"
            aria-label="Close"
          >
            <X size={16} className="text-[#E8E8E8]" />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
