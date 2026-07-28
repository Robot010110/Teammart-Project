import { AlertTriangle } from "lucide-react";

// ErrorBanner.jsx — shared "this failed, here's why, try again" banner.
// Extracted out of EmployeeWorkspace.jsx once the Sudden Tasks and
// Attendance sections needed the exact same loading/error/retry shape.

export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="rounded-2xl p-5 bg-red-500/5 border border-red-500/20 flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-sm text-red-300"><AlertTriangle size={15} /> {message}</span>
      <button
        onClick={onRetry}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/15 transition-colors duration-150"
      >
        Retry
      </button>
    </div>
  );
}
