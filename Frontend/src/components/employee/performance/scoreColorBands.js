// scoreColorBands.js — the Performance score RING's own color system.
//
// This is a strictly presentational lookup: score in, a color band out.
// It never talks to the API and never influences a score — it exists so
// PerformanceScoreRing (and nothing else) can decide which of six fixed
// colors to render.
//
// Deliberately NOT used by the five category cards (see
// CategoryStatusRow.jsx) — those keep their own fixed per-category
// colors regardless of the overall score, by explicit design. The two
// color systems must never mix.
//
// Band boundaries: six named ranges were specified as "0-25", "25-50",
// "50-75", "75-90", "90-96", "97-100" — note 96 and 97 are adjacent with
// no gap, but 25/50/75/90 are each named as the END of one range AND the
// START of the next. Resolved by rounding the score to the nearest whole
// number first (the same integer the ring's own center label shows, so
// the number on screen and the color always agree) and giving an exact
// boundary value to the HIGHER band — i.e. exactly 25 is Red, not Pink;
// exactly 90 is Green, not Blue. This is the standard "upper-exclusive"
// reading of a range like "0-25".
const BANDS = [
  {
    key: "pink",
    upTo: 25,
    stops: ["#FFB3EC", "#FF6FD8", "#E23FB8"],
    glowRgb: "255,111,216",
  },
  {
    key: "red",
    upTo: 50,
    stops: ["#FFA69B", "#FF5C4D", "#E22F1F"],
    glowRgb: "255,92,77",
  },
  {
    key: "yellow",
    upTo: 75,
    stops: ["#FFEA9E", "#FFCB3D", "#E8A400"],
    glowRgb: "255,203,61",
  },
  {
    key: "blue",
    upTo: 90,
    stops: ["#9AD6FF", "#3FA9FF", "#0B7DE0"],
    glowRgb: "63,169,255",
  },
  {
    key: "green",
    upTo: 97, // covers the named "90-96" band up to (not including) 97
    stops: ["#96F3C8", "#34D399", "#0EA972"],
    glowRgb: "52,211,153",
  },
  {
    key: "gold",
    upTo: Infinity, // "97-100"
    stops: ["#FFE9A8", "#FFCF4A", "#E8A400"],
    glowRgb: "255,207,74",
  },
];

// The band a score falls in, or null for "no data" (never guess a color
// for a period nothing was measured in).
export function bandForScore(score) {
  if (score == null) return null;
  const rounded = Math.round(Math.max(0, Math.min(100, score)));
  return BANDS.find((b) => rounded < b.upTo) ?? BANDS[BANDS.length - 1];
}
