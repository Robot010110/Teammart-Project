import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../services/apiClient";

// useAsync.js — the "load on mount, track loading/error, expose a retry"
// pattern that was hand-written near-identically in EmployeeWorkspace.jsx,
// SuddenTasksSection.jsx, AttendanceSection.jsx, and ItemReportSection.jsx.
// One hook instead of four copies of the same ~12 lines.
//
// fetchFn is called on mount and whenever `deps` changes (same rules as
// useEffect's dependency array). Returns `setData` so callers that need
// optimistic local updates (e.g. appending a newly-created item without
// waiting for a refetch) can still do that.
export function useAsync(fetchFn, { deps = [], fallbackError = "Something went wrong. Please try again." } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchFn()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : fallbackError))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, setData, error, loading, reload: load };
}
