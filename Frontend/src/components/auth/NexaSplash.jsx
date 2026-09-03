import { useEffect, useId, useRef, useState } from "react";

// NexaSplash.jsx — the one-time NEXA brand reveal shown before the
// existing "Who's logging in?" experience (see App.jsx: rendered first,
// unconditionally, on every fresh mount of the app — logging out and
// returning to /login within the same tab does NOT remount <App>, so it
// never replays there; only an actual fresh page load does). Purely
// presentational: it owns no auth/session state and takes only
// `onComplete`, which App.jsx uses to swap over to the real login flow.
// A hard timeout below guarantees onComplete always fires even if
// something in the animation timeline goes wrong — a broken splash must
// never block reaching login (see this file's own SAFETY_TIMEOUT_MS).
//
// Silver/white/midnight-navy palette, deliberately distinct from
// TeamMart's own orange/blue/purple/green neon system (see index.css's
// glow-* utilities) — NEXA is the parent brand, TeamMart's system
// returns once the employee interface begins.
//
// Letters "emerge from light" via nexaLetterIn (opacity + brightness
// together, staggered per letter — see index.css), then the assembled
// wordmark gets exactly one light sweep (nexaSweep), then the subtitle
// settles in (nexaSubtitleIn). Ambient particles are canvas-based and
// fully isolated from React state (same technique as
// PerformanceAtmosphere.jsx — a ref array mutated in place every
// requestAnimationFrame tick, never setState), so the sequence costs
// nothing extra in re-renders.
const LETTERS = ["N", "E", "X", "A"];
const LETTER_DELAY_MS = 220; // "0.15-0.25s between letter reveals"
const FIRST_LETTER_AT_MS = 650; // matches the brief's 0.60-1.00s window
const SWEEP_AT_MS = FIRST_LETTER_AT_MS + LETTERS.length * LETTER_DELAY_MS + 150;
const SUBTITLE_AT_MS = SWEEP_AT_MS + 700;
const HOLD_UNTIL_MS = SUBTITLE_AT_MS + 1400;
const FADE_OUT_MS = 700;
const TOTAL_MS = HOLD_UNTIL_MS + FADE_OUT_MS;
const SAFETY_TIMEOUT_MS = TOTAL_MS + 2000; // never let a stuck timeline block login

const REDUCED_HOLD_MS = 1300;
const REDUCED_FADE_MS = 400;

const PARTICLE_COUNT = 34;
// Silver/white/champagne only — the NEXA palette, not TeamMart's orange.
const COLORS = ["226,230,238", "255,255,255", "196,201,214", "232,214,178"];

function makeParticle(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    r: 0.5 + Math.random() * 1.3,
    baseAlpha: 0.08 + Math.random() * 0.22,
    speedX: (Math.random() - 0.5) * 0.035,
    speedY: (Math.random() - 0.5) * 0.02 - 0.008,
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.25 + Math.random() * 0.45,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

// Sparse ambient field — deliberately much quieter than the Employee
// Home performance atmosphere (see PerformanceAtmosphere.jsx's own
// comment): "the particles should be sparse... this is NOT the Employee
// Home snow animation."
function NexaParticles() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(window.innerWidth, window.innerHeight));
    }
    resize();
    window.addEventListener("resize", resize);

    function drawStatic() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particlesRef.current) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.color},${p.baseAlpha.toFixed(3)})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (reduceMotion) {
      drawStatic();
      return () => window.removeEventListener("resize", resize);
    }

    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particlesRef.current) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < -4) p.x = window.innerWidth + 4;
        if (p.x > window.innerWidth + 4) p.x = -4;
        if (p.y < -4) p.y = window.innerHeight + 4;
        const pulse = 0.5 + 0.5 * Math.sin(t * p.phaseSpeed + p.phase);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.color},${(p.baseAlpha * (0.4 + 0.6 * pulse)).toFixed(3)})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    });

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0" />;
}

export default function NexaSplash({ onComplete }) {
  const uid = useId();
  const [fadingOut, setFadingOut] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timers = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onComplete?.();
    };

    // Safety net — see this file's own top comment. Fires regardless of
    // what happens above it.
    timers.push(setTimeout(finish, SAFETY_TIMEOUT_MS));

    if (reduceMotionRef.current) {
      setShowSubtitle(true);
      timers.push(setTimeout(() => setFadingOut(true), REDUCED_HOLD_MS));
      timers.push(setTimeout(finish, REDUCED_HOLD_MS + REDUCED_FADE_MS));
    } else {
      timers.push(setTimeout(() => setShowSubtitle(true), SUBTITLE_AT_MS));
      timers.push(setTimeout(() => setFadingOut(true), HOLD_UNTIL_MS));
      timers.push(setTimeout(finish, HOLD_UNTIL_MS + FADE_OUT_MS));
    }

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reduceMotion = reduceMotionRef.current;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-[#05060A] flex items-center justify-center transition-opacity ease-out"
      style={{ opacity: fadingOut ? 0 : 1, transitionDuration: `${reduceMotion ? REDUCED_FADE_MS : FADE_OUT_MS}ms` }}
      role="status"
      aria-label="Loading NEXA"
    >
      {/* Deep black -> midnight navy atmosphere, radial toward the
          center so the wordmark reads as the light source. */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 55% at 50% 46%, #0B1830 0%, #05060A 60%, #030407 100%)" }}
      />
      <NexaParticles />
      {/* Fine grain, same technique as CinematicBackground.jsx — breaks
          up gradient banding without reading as visible noise. */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03] mix-blend-overlay" aria-hidden="true">
        <filter id={`${uid}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${uid}-grain)`} />
      </svg>

      <div className="relative flex flex-col items-center px-6">
        <h1
          className="relative font-display font-extrabold flex"
          style={{ fontSize: "clamp(48px, 12vw, 96px)", letterSpacing: "0.08em" }}
        >
          {LETTERS.map((letter, i) => (
            <span
              key={letter}
              className={reduceMotion ? "" : "animate-nexa-letter"}
              style={{
                ...(reduceMotion ? {} : { animationDelay: `${FIRST_LETTER_AT_MS + i * LETTER_DELAY_MS}ms` }),
                backgroundImage: "linear-gradient(160deg, #7c8394 0%, #e9ecf2 35%, #ffffff 50%, #e2e6ee 65%, #9096a3 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 0 18px rgba(220,225,235,0.25))",
              }}
            >
              {letter}
            </span>
          ))}
          {/* The single light sweep across the assembled wordmark — never
              repeats (animation-fill-mode both + no infinite loop). */}
          {!reduceMotion && (
            <span
              className="animate-nexa-sweep absolute inset-y-0 left-0 w-1/3 pointer-events-none"
              style={{
                animationDelay: `${SWEEP_AT_MS}ms`,
                background: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%)",
                mixBlendMode: "screen",
              }}
              aria-hidden="true"
            />
          )}
        </h1>

        <p
          className={`mt-5 text-[11px] sm:text-xs font-medium text-[#B9BFCC] ${showSubtitle ? (reduceMotion ? "opacity-100" : "animate-nexa-subtitle") : "opacity-0"}`}
          style={{ letterSpacing: showSubtitle ? "0.32em" : "0.32em" }}
        >
          POWERED&nbsp;BY&nbsp;NEXA
        </p>
      </div>
    </div>
  );
}
