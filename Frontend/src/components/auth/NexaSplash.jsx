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
// Second pass, matched to a concrete reference: badge-first reveal (a
// glowing ring materializes with an "N" mark inside it), which then
// cross-fades into the full beveled-metal "NEXA" wordmark, a single
// light sweep, "POWERED BY NEXA", then a prominent gold particle wave
// underneath the whole sequence (much more visible than a first pass at
// this — the reference's hero shot makes clear the wave is a real
// visual anchor, not a faint afterthought). Silver/white/midnight-navy
// palette throughout, deliberately distinct from TeamMart's own
// orange/blue/purple/green neon system (see index.css's glow-*
// utilities) — NEXA is the parent brand, TeamMart's system returns once
// the employee interface begins.
//
// All particle work (starfield + wave) is canvas-based and fully
// isolated from React state (same technique as
// PerformanceAtmosphere.jsx — a ref array mutated in place every
// requestAnimationFrame tick, never setState), so the sequence costs
// nothing extra in re-renders.
const RING_START_MS = 300;
const BADGE_HOLD_UNTIL_MS = 1500;
const WORDMARK_START_MS = 1600;
const SWEEP_AT_MS = 2350;
const SUBTITLE_AT_MS = 2750;
const HOLD_UNTIL_MS = 5000;
const FADE_OUT_MS = 750;
const TOTAL_MS = HOLD_UNTIL_MS + FADE_OUT_MS;
const SAFETY_TIMEOUT_MS = TOTAL_MS + 2000; // never let a stuck timeline block login

const REDUCED_HOLD_MS = 1300;
const REDUCED_FADE_MS = 400;

const STAR_COUNT = 46;
const WAVE_PARTICLE_COUNT = 70;
// Silver/white for the starfield; warm gold/champagne for the wave —
// the two-tone NEXA palette the reference's hero shot uses.
const STAR_COLORS = ["226,230,238", "255,255,255", "196,201,214"];
const WAVE_COLORS = ["232,196,120", "244,214,150", "255,230,180", "214,170,100"];

function makeStar(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height * 0.75, // stars stay above the wave band
    r: 0.4 + Math.random() * 1.1,
    baseAlpha: 0.1 + Math.random() * 0.35,
    speedY: 0.004 + Math.random() * 0.01,
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.2 + Math.random() * 0.4,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
  };
}

function makeWaveParticle(width) {
  return {
    x: Math.random() * width,
    xSpeed: 0.07 + Math.random() * 0.09,
    yJitter: (Math.random() - 0.5) * 1.4,
    r: 0.5 + Math.random() * 1.3,
    baseAlpha: 0.16 + Math.random() * 0.3,
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.4 + Math.random() * 0.7,
    color: WAVE_COLORS[Math.floor(Math.random() * WAVE_COLORS.length)],
  };
}

function drawGlowDot(ctx, x, y, r, color, alpha) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
  grad.addColorStop(0, `rgba(${color},${alpha.toFixed(3)})`);
  grad.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = `rgba(${color},${Math.min(alpha * 1.7, 1).toFixed(3)})`;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// The atmosphere: a quiet starfield up top (visible from the very first
// frame, per the reference's "app launch" beat) and a much more visible
// flowing gold "wave" of light points across the lower third — the
// reference's own hero shot is unambiguous that this wave is a real
// visual anchor, not a barely-there afterthought.
function NexaAtmosphere({ intensity }) {
  const canvasRef = useRef(null);
  const starsRef = useRef([]);
  const waveRef = useRef([]);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

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
      starsRef.current = Array.from({ length: STAR_COUNT }, () => makeStar(window.innerWidth, window.innerHeight));
      waveRef.current = Array.from({ length: WAVE_PARTICLE_COUNT }, () => makeWaveParticle(window.innerWidth));
    }
    resize();
    window.addEventListener("resize", resize);

    function drawFrame(t) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (const s of starsRef.current) {
        const pulse = 0.5 + 0.5 * Math.sin(t * s.phaseSpeed + s.phase);
        drawGlowDot(ctx, s.x, s.y, s.r, s.color, s.baseAlpha * (0.4 + 0.6 * pulse));
      }

      // Wave intensity ramps in over the sequence (near-invisible at
      // launch, full brightness once the wordmark has assembled) —
      // driven by the `intensity` prop (0-1), not a separate timer, so
      // it can never drift out of sync with the reveal itself.
      const amp = intensityRef.current;
      if (amp <= 0.001) return;
      const waveY = h * 0.86;
      const amplitude = h * 0.05;
      for (const wp of waveRef.current) {
        const y =
          waveY +
          Math.sin(wp.x * 0.014 + t * 0.55) * amplitude * 0.6 +
          Math.sin(wp.x * 0.006 - t * 0.3) * amplitude * 0.4 +
          wp.yJitter;
        const pulse = 0.5 + 0.5 * Math.sin(t * wp.phaseSpeed + wp.phase);
        drawGlowDot(ctx, wp.x, y, wp.r, wp.color, wp.baseAlpha * (0.35 + 0.65 * pulse) * amp);
      }
    }

    if (reduceMotion) {
      drawFrame(0);
      return () => window.removeEventListener("resize", resize);
    }

    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const t = (now - start) / 1000;
      for (const wp of waveRef.current) {
        wp.x += wp.xSpeed;
        if (wp.x > window.innerWidth + 6) wp.x = -6;
      }
      for (const s of starsRef.current) {
        s.y -= s.speedY;
        if (s.y < -4) s.y = window.innerHeight * 0.75 + 4;
      }
      drawFrame(t);
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
  const [phase, setPhase] = useState("badge"); // badge -> wordmark -> hold -> exit
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [waveIntensity, setWaveIntensity] = useState(0);
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
      setPhase("wordmark");
      setShowSubtitle(true);
      setWaveIntensity(0.6);
      timers.push(setTimeout(() => setPhase("exit"), REDUCED_HOLD_MS));
      timers.push(setTimeout(finish, REDUCED_HOLD_MS + REDUCED_FADE_MS));
    } else {
      timers.push(setTimeout(() => setPhase("wordmark"), WORDMARK_START_MS));
      timers.push(setTimeout(() => setWaveIntensity(1), WORDMARK_START_MS));
      timers.push(setTimeout(() => setShowSubtitle(true), SUBTITLE_AT_MS));
      timers.push(setTimeout(() => setPhase("exit"), HOLD_UNTIL_MS));
      timers.push(setTimeout(finish, HOLD_UNTIL_MS + FADE_OUT_MS));
    }

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reduceMotion = reduceMotionRef.current;
  const showBadge = phase === "badge";
  const showWordmark = phase === "wordmark" || phase === "exit" || reduceMotion;
  const fadingOut = phase === "exit";

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
        style={{ background: "radial-gradient(ellipse 70% 55% at 50% 42%, #0B1830 0%, #05060A 60%, #030407 100%)" }}
      />
      <NexaAtmosphere intensity={reduceMotion ? 0.6 : waveIntensity} />
      {/* Fine grain, same technique as CinematicBackground.jsx — breaks
          up gradient banding without reading as visible noise. */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03] mix-blend-overlay" aria-hidden="true">
        <filter id={`${uid}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${uid}-grain)`} />
      </svg>

      <div className="relative flex flex-col items-center px-6">
        {/* Stage 1 — the badge: a ring materializes (stroke draws in),
            an "N" fades in at its center, then the whole badge softly
            cross-fades out as the full wordmark takes over. */}
        {!reduceMotion && (
          <div
            className="absolute inset-0 flex items-center justify-center transition-all ease-out"
            style={{
              opacity: showBadge ? 1 : 0,
              transform: showBadge ? "scale(1)" : "scale(1.15)",
              transitionDuration: "550ms",
              pointerEvents: "none",
            }}
          >
            <div className="relative w-24 h-24 sm:w-28 sm:h-28">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: "0 0 42px 6px rgba(220,225,238,0.22)",
                  animation: `nexaBadgeGlow 1.8s ease-in-out ${RING_START_MS}ms both`,
                }}
              />
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="url(#nexa-ring-gradient)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 46}
                  style={{ animation: `nexaRingDraw 0.9s cubic-bezier(0.16,1,0.3,1) ${RING_START_MS}ms both` }}
                />
                <defs>
                  <linearGradient id="nexa-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f2f4f8" />
                    <stop offset="50%" stopColor="#9aa0ad" />
                    <stop offset="100%" stopColor="#e9ecf2" />
                  </linearGradient>
                </defs>
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center font-display font-extrabold text-4xl sm:text-5xl"
                style={{
                  backgroundImage: "linear-gradient(160deg, #7c8394 0%, #f2f4f8 40%, #ffffff 52%, #e2e6ee 68%, #9096a3 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  animation: `nexaLetterIn 0.5s cubic-bezier(0.16,1,0.3,1) ${RING_START_MS + 500}ms both`,
                }}
              >
                N
              </span>
            </div>
          </div>
        )}

        {/* Stage 2 — the full wordmark: bolder, tighter tracking, and a
            subtle bevel (layered highlight/shadow drop-shadows) for the
            beveled-metal look the reference's hero shot has, plus a
            slight sheared skew for the sharper, more angular feel. */}
        <div
          className="relative transition-all ease-out"
          style={{
            opacity: showWordmark ? 1 : 0,
            transform: showWordmark ? "scale(1)" : "scale(0.9)",
            transitionDuration: reduceMotion ? "500ms" : "650ms",
          }}
        >
          <h1
            className="relative font-display font-extrabold flex"
            style={{ fontSize: "clamp(52px, 13vw, 104px)", letterSpacing: "0.02em", transform: "skewX(-2deg)" }}
          >
            <span
              style={{
                backgroundImage:
                  "linear-gradient(155deg, #6b7280 0%, #cfd3dc 22%, #ffffff 42%, #ffffff 50%, #d7dbe4 58%, #8a90a0 78%, #b7bcc7 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.6)) drop-shadow(0 0 22px rgba(220,225,238,0.3))",
              }}
            >
              NEXA
            </span>
            {!reduceMotion && (
              <span
                className="animate-nexa-sweep absolute inset-y-0 left-0 w-1/3 pointer-events-none"
                style={{
                  animationDelay: `${SWEEP_AT_MS - WORDMARK_START_MS}ms`,
                  background: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%)",
                  mixBlendMode: "screen",
                }}
                aria-hidden="true"
              />
            )}
          </h1>

          <p
            className={`mt-5 text-center text-[11px] sm:text-xs font-medium text-[#B9BFCC] transition-opacity ${showSubtitle ? "opacity-100" : "opacity-0"}`}
            style={{ letterSpacing: "0.32em", transitionDuration: "700ms" }}
          >
            POWERED&nbsp;BY&nbsp;NEXA
          </p>
        </div>
      </div>

      <style>{`
        @keyframes nexaRingDraw {
          from { stroke-dashoffset: ${2 * Math.PI * 46}; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes nexaBadgeGlow {
          0% { opacity: 0; transform: scale(0.8); }
          60% { opacity: 1; }
          100% { opacity: 0.85; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
