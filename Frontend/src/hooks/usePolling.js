import { useEffect, useRef } from "react";

// usePolling.js — repeatedly calls `fn` every `intervalMs`, starting
// immediately on mount and whenever `deps` changes. Used by Chat (no
// WebSocket in this app, so new messages/conversations are picked up by
// polling) so the interval-management logic isn't duplicated between the
// conversation list (slower poll) and an open thread (faster poll).
//
// `fn` is read from a ref so changing its identity on every render (e.g.
// an inline arrow function closing over state) doesn't restart the
// interval — only `intervalMs` or `deps` do that.
export function usePolling(fn, intervalMs, deps = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fnRef.current();
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
