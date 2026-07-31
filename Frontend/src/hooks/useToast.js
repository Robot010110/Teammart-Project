import { useEffect, useState } from "react";

// useToast.js — the "show a message, auto-dismiss after a few seconds"
// pattern duplicated in EmployeeWorkspace.jsx and ItemReportSection.jsx.
// Pair with <Toast message={toast} /> (components/common/Toast.jsx).
export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);

  return [toast, setToast];
}
