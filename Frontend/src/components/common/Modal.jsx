import { X } from "lucide-react";
import { useEffect } from "react";

// Modal.jsx — generic centered modal with backdrop blur + fade/scale-in.

export default function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidth} rounded-2xl bg-[#1F2436] border border-white/10 shadow-2xl animate-modal-in max-h-[85vh] overflow-y-auto`}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#1F2436]/95 backdrop-blur-xl">
          <h3 className="font-display font-semibold text-white text-base">{title}</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full grid place-items-center bg-white/5 hover:bg-white/10 transition-colors duration-200"
            aria-label="Close"
          >
            <X size={16} className="text-[#E8E8E8]" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
