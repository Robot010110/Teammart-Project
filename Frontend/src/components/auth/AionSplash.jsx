import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import aionIntro from "../../assets/splash/aion-intro.mp4";

// AionSplash.jsx — the one-time AION brand reveal shown before the
// existing "Who's logging in?" experience (see App.jsx: rendered first,
// unconditionally, on every fresh mount of the app — logging out and
// returning to /login within the same tab does NOT remount <App>, so it
// never replays there; only an actual fresh page load does). Purely
// presentational: it owns no auth/session state and takes only
// `onComplete`, which App.jsx uses to swap over to the real login flow.
//
// Replaces the canvas-animated reveal built for the app's former name,
// which turned out to be taken; the brand is now AION. The clip is a
// complete logo animation — it spells AION itself (the ring is the "O")
// — so this component deliberately adds NO wordmark of its own over it;
// doing so would print the name twice. The old starfield/gold-wave
// canvas system is gone for the same reason: the footage is the reveal.
//
// The clip is fitted (`object-contain`) at EVERY size, never cropped.
// It is landscape (1344x768) and carries two pieces of branding that are
// part of the footage itself — the AION logo, which spans nearly the
// full width, and the "POWERED BY AION" line in the bottom-right — so
// any crop risks slicing one of them off: a phone's portrait crop would
// leave only the ring, and `cover` on a non-16:9 desktop window trims
// whichever axis overflows, which is exactly where the powered-by line
// sits. Fitting guarantees the composed frame is always seen as it was
// designed; on a typical 16:9 screen the clip's 1.75 aspect is close
// enough that the letterbox is a few pixels, and it blends into the
// same near-black field the page already sits on.
//
// Two guarantees this file must never lose:
//   1. A hard SAFETY_TIMEOUT_MS always fires onComplete, even if the
//      video 404s, stalls, uses an unsupported codec, or its `ended`
//      event never arrives — a broken splash must never block login.
//      A real `error` exits sooner still, rather than making someone
//      wait out the full timeout for a clip that will never play.
//   2. Sound is never required to proceed. Browsers block autoplay with
//      audio until a user has interacted with the page, so playback is
//      attempted unmuted first and silently falls back to muted the
//      instant that's refused, surfacing a tap-to-unmute control rather
//      than stalling or asking permission before anything can happen.
const FADE_OUT_MS = 750;
// Generous outer bound: long enough for a slow connection to finish a
// ~1.8MB clip, short enough that a genuinely broken load doesn't feel
// like the app hung. Deliberately far longer than the clip's own ~7.5s
// runtime — it is a stuck-download backstop, not a playback deadline.
// Only ever reached when `ended` doesn't arrive.
const SAFETY_TIMEOUT_MS = 20000;

const REDUCED_HOLD_MS = 1500;
const REDUCED_FADE_MS = 400;

// Letterbox/backdrop colour behind the fitted video. Matches the app's
// own near-black field so the bars read as page background, not as bars.
//
// The generator burned a "MINIMAX | Hailuo AI" watermark into the clip's
// bottom-right. That is NOT handled here any more: covering it with a
// flat CSS rectangle was visible, because the footage behind it is a
// moving gradient with changing lighting, and no single colour can track
// that. It is now removed from the asset itself — each frame's watermark
// box is reconstructed by interpolating that same frame's surrounding
// pixels (ffmpeg `delogo`), so the gradient, lighting and diagonal light
// sweep carry through it — and "POWERED BY AION" is composited into the
// same corner as part of the footage. Nothing in this component knows
// about the corner at all, which is why the measuring/patch code that
// used to live here is gone.
const SPLASH_BG = "#05080F";

export default function AionSplash({ onComplete }) {
  const videoRef = useRef(null);
  const [fadingOut, setFadingOut] = useState(false);
  // True once the browser has refused unmuted autoplay and we've fallen
  // back to muted — drives the tap-to-unmute control.
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const reduceMotionRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timers = [];

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete?.();
    };
    const beginExit = () => {
      if (doneRef.current) return;
      setFadingOut(true);
      timers.push(setTimeout(finish, reduceMotionRef.current ? REDUCED_FADE_MS : FADE_OUT_MS));
    };

    // Guarantee #1 — see this file's top comment. Fires no matter what
    // the video does.
    timers.push(setTimeout(finish, SAFETY_TIMEOUT_MS));

    if (reduceMotionRef.current) {
      timers.push(setTimeout(beginExit, REDUCED_HOLD_MS));
      return () => timers.forEach(clearTimeout);
    }

    // Guarantee #2 — try with sound, fall back to muted the moment the
    // browser refuses, so playback always starts either way.
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      const attempt = video.play();
      if (attempt?.catch) {
        attempt.catch(() => {
          video.muted = true;
          setNeedsUnmute(true);
          // If even muted playback is refused, the safety timeout above
          // still carries the user through to login.
          video.play().catch(() => {});
        });
      }
    }

    const onEnded = () => beginExit();
    // A decode/network failure is a definite signal — no reason to make
    // someone sit out the full SAFETY_TIMEOUT_MS for a clip that is
    // never going to play.
    const onError = () => beginExit();
    video?.addEventListener("ended", onEnded);
    video?.addEventListener("error", onError);

    return () => {
      video?.removeEventListener("ended", onEnded);
      video?.removeEventListener("error", onError);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reduceMotion = reduceMotionRef.current;

  function handleUnmute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.play().catch(() => {});
    setNeedsUnmute(false);
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center transition-opacity ease-out"
      style={{
        backgroundColor: SPLASH_BG,
        opacity: fadingOut ? 0 : 1,
        transitionDuration: `${reduceMotion ? REDUCED_FADE_MS : FADE_OUT_MS}ms`,
      }}
      role="status"
      aria-label="Loading AION"
    >
      {/* The reveal itself. Skipped entirely under prefers-reduced-motion
          — that path gets the static wordmark below instead. */}
      {!reduceMotion && (
        <video
          ref={videoRef}
          src={aionIntro}
          autoPlay
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-contain"
          aria-hidden="true"
        />
      )}

      {/* Reduced-motion path only: with no footage playing, the name
          still has to be shown, so the wordmark stands in for it. */}
      {reduceMotion && (
        <div className="relative flex flex-col items-center px-6">
          <h1
            className="font-display font-extrabold"
            style={{
              fontSize: "clamp(52px, 13vw, 104px)",
              letterSpacing: "0.06em",
              backgroundImage:
                "linear-gradient(155deg, #6b7280 0%, #cfd3dc 22%, #ffffff 42%, #ffffff 50%, #d7dbe4 58%, #8a90a0 78%, #b7bcc7 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.6)) drop-shadow(0 0 26px rgba(220,225,238,0.35))",
            }}
          >
            AION
          </h1>
        </div>
      )}

      {/* Tap-to-unmute — only appears when the browser actually refused
          sound, and never gates the splash: ignoring it plays the clip
          through silently and continues to login exactly the same. */}
      {needsUnmute && !fadingOut && (
        <button
          type="button"
          onClick={handleUnmute}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2.5 text-[12px] font-medium text-white/90 backdrop-blur-md transition-all duration-200 hover:bg-black/65 hover:border-white/25 active:scale-95"
        >
          <VolumeX size={15} /> Tap for sound
        </button>
      )}
      {!needsUnmute && !reduceMotion && !fadingOut && (
        <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/25" aria-hidden="true">
          <Volume2 size={15} />
        </span>
      )}
    </div>
  );
}
