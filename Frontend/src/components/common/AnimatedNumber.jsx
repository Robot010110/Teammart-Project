import { useEffect, useRef, useState } from "react";

// AnimatedNumber.jsx — TeamMart visual system: counts up from 0 to a
// REAL value on mount/change (never a fabricated animation over a fake
// number — the value itself always comes from the caller's own real
// data). Respects prefers-reduced-motion (jumps straight to the final
// value, same convention as every CSS animation class in index.css).
// `value` may be a number (animated) or a pre-formatted string like
// "8.4h"/"—" (rendered as-is, no animation attempted) — callers that
// already format their own labels don't need a second code path.
export default function AnimatedNumber({ value, decimals = 0, suffix = "", duration = 700 }) {
  const isNumeric = typeof value === "number" && Number.isFinite(value);
  const [display, setDisplay] = useState(isNumeric ? 0 : value);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(value);
      return;
    }
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const from = 0;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setDisplay(from + (value - from) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!isNumeric) return <>{display}</>;
  return <>{display.toFixed(decimals)}{suffix}</>;
}
