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
//
// Visibility-aware: polling is suspended while the page is hidden (phone
// screen locked, app backgrounded, tab switched) and resumes on return.
// This matters because useUnreadBadges.js polls from the app shell, so
// before this every backgrounded phone kept hitting the API forever —
// burning battery and mobile data for a user who cannot see the result.
// Coming back triggers one immediate catch-up call before the interval
// restarts, so returning to the app shows fresh data instantly rather
// than up to `intervalMs` of stale data.
//
// Deliberately does NOT fire on mount while hidden — a screen that mounts
// in a backgrounded tab fetches when it actually becomes visible.
export function usePolling(fn, intervalMs, deps = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let intervalId = null;

    const stop = () => {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    // Guarded against double-starting: visibilitychange can fire more
    // than once without an intervening hide, and leaking a second
    // interval would silently double this screen's request rate.
    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => fnRef.current(), intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        fnRef.current();
        start();
      }
    };

    if (!document.hidden) {
      fnRef.current();
      start();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
