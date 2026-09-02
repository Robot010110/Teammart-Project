import { useEffect, useRef } from "react";

// PerformanceAtmosphere.jsx — the Home tab's Performance card ambient
// "golden dust flowing through a dark blue atmosphere" effect. Canvas
// 2D, not DOM particles: every particle lives in a plain ref array and
// is mutated in place frame-to-frame, so this never triggers a React
// re-render and never allocates per frame — the whole animation is
// isolated from React's render cycle by design (see the brief's own
// performance requirements). One requestAnimationFrame loop, cancelled
// on unmount; a CSS mask on the canvas itself handles the
// strongest-near-the-ring / faintest-near-the-text falloff (section 8
// of the brief) so this component never needs to know where the
// PerformanceCircle/text actually sit in the DOM.
//
// Continuity: positions/phases are driven by `t` (seconds since mount,
// via performance.now() — never React state), and every oscillation
// here is a plain sine/cosine of `t`. A sine function has no "restart" —
// there is no moment this loops back to a visibly different frame 0,
// which is what makes the motion read as one continuous environment
// rather than a repeating clip, satisfying the "seamless, seconds vs.
// minutes on the page" requirement without literally resetting anything
// every 3s.
const PARTICLE_COUNT = 42;
// Warm amber/gold/champagne only — deliberately no bright yellow (see
// the brief's own color guidance).
const COLORS = ["244,180,90", "230,160,60", "255,214,153", "214,150,80"];

function makeParticle(width, height) {
  return {
    x: Math.random() * width,
    y: height * (0.3 + Math.random() * 0.7), // biased toward the lower area, where the ring/wave live
    r: 0.6 + Math.random() * 1.6,
    baseAlpha: 0.12 + Math.random() * 0.28,
    speedX: (Math.random() - 0.5) * 0.05,
    speedY: -(0.015 + Math.random() * 0.035),
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.35 + Math.random() * 0.55, // ~ a few seconds per brighten/fade cycle
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

function drawParticle(ctx, p, alpha) {
  ctx.beginPath();
  ctx.fillStyle = `rgba(${p.color},${alpha.toFixed(3)})`;
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
}

// The flowing wave — two overlaid slow sine ripples filled with a soft
// low-opacity gradient, not a literal chart line and not a water
// texture. `t` in seconds; the ripple's own period is intentionally
// irrational-looking (two different frequencies summed) so it never
// reads as a mechanical repeating loop even though it mathematically is
// one.
function drawWave(ctx, width, height, t) {
  const waveY = height * 0.8;
  const amplitude = height * 0.05;
  const grad = ctx.createLinearGradient(0, waveY - amplitude * 2, 0, height);
  grad.addColorStop(0, "rgba(230,160,60,0)");
  grad.addColorStop(0.55, "rgba(230,160,60,0.05)");
  grad.addColorStop(1, "rgba(230,160,60,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += 10) {
    const y =
      waveY +
      Math.sin(x * 0.018 + t * 0.5) * amplitude * 0.6 +
      Math.sin(x * 0.007 - t * 0.28) * amplitude * 0.4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
}

export default function PerformanceAtmosphere() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);

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
    }
    resize();
    window.addEventListener("resize", resize);

    if (reduceMotion) {
      // Reduced motion: one static, calm frame — same visual design
      // (wave + particles), just no continuous movement.
      const rect = parent.getBoundingClientRect();
      drawWave(ctx, rect.width, rect.height, 0);
      for (const p of particlesRef.current) drawParticle(ctx, p, p.baseAlpha);
      return () => window.removeEventListener("resize", resize);
    }

    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const t = (now - start) / 1000;
      const rect = parent.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      drawWave(ctx, rect.width, rect.height, t);

      for (const p of particlesRef.current) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < -4) p.x = rect.width + 4;
        if (p.x > rect.width + 4) p.x = -4;
        if (p.y < -4) {
          p.y = rect.height + 4;
          p.x = Math.random() * rect.width;
        }
        const pulse = 0.5 + 0.5 * Math.sin(t * p.phaseSpeed + p.phase);
        drawParticle(ctx, p, p.baseAlpha * (0.45 + 0.55 * pulse));
      }

      raf = requestAnimationFrame(tick);
    });

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        WebkitMaskImage: "radial-gradient(115% 95% at 18% 88%, black 0%, black 30%, rgba(0,0,0,0.45) 58%, transparent 88%)",
        maskImage: "radial-gradient(115% 95% at 18% 88%, black 0%, black 30%, rgba(0,0,0,0.45) 58%, transparent 88%)",
      }}
    />
  );
}
