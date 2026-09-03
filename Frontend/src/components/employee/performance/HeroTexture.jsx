import { useId, useMemo } from "react";

// HeroTexture.jsx — the hero card's decorative depth layer: a faint
// particle field over soft wave contours, plus corner colour wash.
//
// This is the "subtle mesh/wave texture" the design calls for, and it is
// a real rendered layer rather than a flat background colour — but it is
// deliberately held at very low opacity so it reads as atmosphere behind
// the content and never competes with the score.
//
// Entirely decorative: aria-hidden, pointer-events-none, and it renders
// no data. Particle positions come from a fixed seeded sequence rather
// than Math.random() so the texture is stable across re-renders (a
// re-randomising background visibly twitches on every state change).
//
// Cost note: this is one inline <svg> with ~46 circles and two paths, no
// canvas and no animation loop — the only motion is the two CSS blur
// blobs, which reuse the app's existing `animate-ambient-drift` keyframe
// and are disabled under prefers-reduced-motion by that class's own rule.
const PARTICLES = (() => {
  // Deterministic LCG — same sequence every time, no RNG at render.
  let s = 20260903;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: 46 }, () => ({
    cx: rnd() * 320,
    cy: rnd() * 200,
    r: 0.5 + rnd() * 1.3,
    o: 0.12 + rnd() * 0.5,
  }));
})();

export default function HeroTexture() {
  const uid = useId();
  const particles = useMemo(() => PARTICLES, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[22px]" aria-hidden="true">
      {/* Corner colour wash — light spilling into the card. */}
      <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full bg-[#F47A20]/[0.10] blur-3xl animate-ambient-drift" />
      <div
        className="absolute -bottom-24 -right-12 w-64 h-64 rounded-full bg-violet-600/[0.09] blur-3xl animate-ambient-drift"
        style={{ animationDelay: "-4s" }}
      />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${uid}-wave`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F47A20" stopOpacity="0.30" />
            <stop offset="60%" stopColor="#F47A20" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#F47A20" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${uid}-dots`} cx="28%" cy="72%" r="62%">
            <stop offset="0%" stopColor="#FFB067" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FFB067" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Wave contours across the lower half. */}
        <path
          d="M-10 150 C 50 120, 95 168, 150 142 S 250 108, 330 132"
          fill="none"
          stroke={`url(#${uid}-wave)`}
          strokeWidth="1.1"
        />
        <path
          d="M-10 168 C 55 140, 100 186, 158 160 S 255 126, 330 150"
          fill="none"
          stroke={`url(#${uid}-wave)`}
          strokeWidth="0.9"
          opacity="0.65"
        />

        {/* Particle field, masked toward the lower-left by the radial
            gradient so it fades out rather than tiling edge to edge. */}
        <g fill={`url(#${uid}-dots)`}>
          {particles.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={p.r} opacity={p.o} />
          ))}
        </g>
      </svg>
    </div>
  );
}
