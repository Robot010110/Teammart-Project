import { useEffect, useRef } from "react";

// PerformanceAtmosphere.jsx — the Home tab's Performance card ambient
// "golden dust flowing through a dark blue atmosphere" effect. Canvas
// 2D, not DOM particles: every particle lives in a plain ref array and
// is mutated in place frame-to-frame, so this never triggers a React
// re-render and never allocates per frame — the whole animation is
// isolated from React's render cycle by design. One requestAnimationFrame
// loop, cancelled on unmount and paused while the tab isn't visible (see
// the visibilitychange listener below — no point burning battery
// animating a card the user can't see); a CSS mask on the canvas itself
// handles the strongest-near-the-ring / faintest-near-the-text falloff
// so this component never needs to know where the PerformanceCircle/
// text actually sit in the DOM.
//
// Second pass (Global Visual System Evolution) — this is the same
// design (particles + a flowing current + warm light), made more
// visibly alive per that brief: more particles, ~30% faster drift, a
// wider brightness range so individual flares actually read as flares,
// and the "wave" rebuilt as a real second particle population riding a
// sine-driven band (glowing dots, not a filled gradient shape) instead
// of the original smooth-fill ribbon — closer to "light carried by a
// current" than to a literal chart line.
//
// Continuity: positions/phases are driven by `t` (seconds since mount,
// via performance.now() — never React state), and every oscillation
// here is a plain sine/cosine of `t` with a per-particle phase offset,
// so nothing in the whole field shares an identical cycle. A sine
// function has no "restart" — there is no moment this loops back to a
// visibly different frame 0, which is what makes the motion read as one
// continuous environment rather than a repeating clip.
const PARTICLE_COUNT = 64;
const WAVE_PARTICLE_COUNT = 34;
// Warm amber/gold/champagne only — deliberately no bright yellow.
const COLORS = ["244,180,90", "230,160,60", "255,214,153", "214,150,80", "250,200,120"];

function makeParticle(width, height) {
  const isFlare = Math.random() < 0.16; // a handful of larger, brighter points among the fine dust
  return {
    x: Math.random() * width,
    y: height * (0.28 + Math.random() * 0.72), // biased toward the lower area, where the ring/current live
    r: isFlare ? 1.6 + Math.random() * 1.4 : 0.5 + Math.random() * 1.3,
    baseAlpha: isFlare ? 0.3 + Math.random() * 0.3 : 0.14 + Math.random() * 0.26,
    speedX: (Math.random() - 0.5) * 0.066,
    speedY: -(0.02 + Math.random() * 0.046),
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.3 + Math.random() * 0.7, // no two particles share a brighten/fade rhythm
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

function makeWaveParticle(width) {
  return {
    x: Math.random() * width,
    xSpeed: 0.05 + Math.random() * 0.05,
    yJitter: (Math.random() - 0.5) * 1,
    r: 0.5 + Math.random() * 1.1,
    baseAlpha: 0.18 + Math.random() * 0.24,
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.5 + Math.random() * 0.8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

function drawGlowDot(ctx, x, y, r, color, alpha) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  grad.addColorStop(0, `rgba(${color},${alpha.toFixed(3)})`);
  grad.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = `rgba(${color},${Math.min(alpha * 1.6, 1).toFixed(3)})`;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// The "current" — a population of small glowing points whose vertical
// position rides a slow two-frequency sine band, rather than a single
// filled shape. This is what reads as "light carried by an invisible
// current" instead of a chart line or a water texture.
function drawWave(ctx, width, height, t, waveParticles) {
  const waveY = height * 0.82;
  const amplitude = height * 0.075;

  for (const wp of waveParticles) {
    wp.x += wp.xSpeed;
    if (wp.x > width + 6) wp.x = -6;
    const y =
      waveY +
      Math.sin(wp.x * 0.018 + t * 0.62) * amplitude * 0.6 +
      Math.sin(wp.x * 0.007 - t * 0.34) * amplitude * 0.4 +
      wp.yJitter;
    const pulse = 0.5 + 0.5 * Math.sin(t * wp.phaseSpeed + wp.phase);
    drawGlowDot(ctx, wp.x, y, wp.r, wp.color, wp.baseAlpha * (0.35 + 0.65 * pulse));
  }
}

export default function PerformanceAtmosphere() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const waveRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(rect.width, rect.height));
      waveRef.current = Array.from({ length: WAVE_PARTICLE_COUNT }, () => makeWaveParticle(rect.width));
    }
    resize();
    window.addEventListener("resize", resize);

    function drawFrame(t) {
      const rect = parent.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawWave(ctx, rect.width, rect.height, t, waveRef.current);
      for (const p of particlesRef.current) {
        const pulse = 0.5 + 0.5 * Math.sin(t * p.phaseSpeed + p.phase);
        drawGlowDot(ctx, p.x, p.y, p.r, p.color, p.baseAlpha * (0.3 + 0.7 * pulse));
      }
    }

    if (reduceMotion) {
      // Reduced motion: one static, calm frame — same visual design
      // (current + particles), just no continuous movement.
      drawFrame(0);
      return () => window.removeEventListener("resize", resize);
    }

    let raf = null;
    const start = performance.now();

    function tick(now) {
      const t = (now - start) / 1000;
      const rect = parent.getBoundingClientRect();

      for (const p of particlesRef.current) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < -4) p.x = rect.width + 4;
        if (p.x > rect.width + 4) p.x = -4;
        if (p.y < -4) {
          p.y = rect.height + 4;
          p.x = Math.random() * rect.width;
        }
      }

      drawFrame(t);
      raf = requestAnimationFrame(tick);
    }

    // Pause entirely when this tab/window isn't visible — no point
    // burning CPU/GPU animating a card nobody can see.
    function handleVisibility() {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf) {
        raf = requestAnimationFrame(tick);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        WebkitMaskImage: "radial-gradient(125% 100% at 20% 90%, black 0%, black 38%, rgba(0,0,0,0.55) 62%, transparent 92%)",
        maskImage: "radial-gradient(125% 100% at 20% 90%, black 0%, black 38%, rgba(0,0,0,0.55) 62%, transparent 92%)",
      }}
    />
  );
}
