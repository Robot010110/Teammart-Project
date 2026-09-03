import { useId } from "react";
import storefrontPhoto from "../../assets/login/role-select-storefront.jpg";
import employeePhoto from "../../assets/login/employee-aisle.jpg";
import staffPhoto from "../../assets/login/staff-lobby.jpg";

// CinematicBackground.jsx — the login flow's own visual identity,
// deliberately distinct from every other screen's flat #050A18 (see
// AppShell.jsx). Now backed by the three real photographs supplied for
// this flow (see assets/login/) instead of a CSS/SVG approximation —
// each is a real TeamMart-branded night scene, not a generic stock
// photo, so it's composited with a dark gradient/vignette on top
// (identical treatment to the login card everywhere else) purely to
// keep white text and glass cards readable, never to hide the image.
//
// `variant` maps each of the three login screens to its own photo, per
// the design brief's instruction that Employee/Staff/role-select
// shouldn't share one identical background:
//   storefront   Stage 1 (Who's logging in?) — the TeamMart storefront
//                at night, neon sign lit.
//   produce      Employee login — the in-market grocery aisle.
//   aisles       Staff login — the TeamMart office lobby/boardroom.
// Each photo's object-position is tuned per breakpoint: mobile crops
// the wide axis (the phone is narrower than the photo), desktop crops
// the tall axis (the photo is narrower than the screen) — so the same
// full-bleed cover fill keeps its subject in frame at both extremes
// instead of centering blindly.
//
// `zoomedOut: true` (storefront only) swaps that full-bleed crop for a
// fully-visible building shot at near-full scale — the whole storefront
// stays in frame, "further away" than a tight crop but not shrunk down
// small, instead of the tight crop every other screen uses. A blurred,
// darkened copy of the same photo still fills the full frame behind it
// as ambient colour, so the edges of the screen are never flat black.
// Legibility of the text on top comes mostly from that text's own
// shadow now (see RoleSelectScreen.jsx) rather than heavily darkening
// the photo — the photo is the point, it should stay visible.
const VARIANTS = {
  // TEAMMART sign sits ~28-45% down the storefront photo.
  storefront: { photo: storefrontPhoto, focusMobile: "50% 32%", focusDesktop: "48% 30%", zoomedOut: true },
  // Produce stands sit lower-left in the aisle photo.
  produce: { photo: employeePhoto, focusMobile: "45% 55%", focusDesktop: "40% 45%" },
  // TM logo/wordmark sits right-of-centre in the lobby photo.
  aisles: { photo: staffPhoto, focusMobile: "68% 45%", focusDesktop: "58% 45%" },
};

export default function CinematicBackground({ variant = "storefront" }) {
  const uid = useId();
  const cfg = VARIANTS[variant] ?? VARIANTS.storefront;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050810]" aria-hidden="true">
      {cfg.zoomedOut ? (
        <>
          <img
            src={cfg.photo}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60"
            style={{ objectPosition: cfg.focusDesktop }}
          />
          {/* The sharp foreground copy is masked (opaque centre fading
              to transparent at the edges) so its boundary dissolves
              into the blurred backdrop above instead of reading as a
              pasted-on rectangle. */}
          <img
            src={cfg.photo}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              transform: "scale(0.96)",
              maskImage: "radial-gradient(ellipse 72% 72% at 50% 50%, black 60%, transparent 94%)",
              WebkitMaskImage: "radial-gradient(ellipse 72% 72% at 50% 50%, black 60%, transparent 94%)",
            }}
          />
          {/* Light scrim over the middle band only — just enough to keep
              the photo's own baked-in signage from reading as crisp as
              the real heading text on top of it (which carries its own
              text-shadow for legibility, see RoleSelectScreen.jsx). The
              photo itself should stay clearly visible, not hidden. */}
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse 70% 40% at 50% 44%, rgba(2,4,10,0.5) 0%, transparent 80%)" }}
          />
        </>
      ) : (
        <>
          {/* Full-bleed on every breakpoint — object-position differs
              mobile vs. desktop (see VARIANTS above) so the photo's
              subject stays framed whichever axis ends up cropped. */}
          <img
            src={cfg.photo}
            alt=""
            className="absolute inset-0 w-full h-full object-cover sm:hidden"
            style={{ objectPosition: cfg.focusMobile }}
          />
          <img
            src={cfg.photo}
            alt=""
            className="absolute inset-0 w-full h-full object-cover hidden sm:block"
            style={{ objectPosition: cfg.focusDesktop }}
          />
        </>
      )}

      {/* Dark gradient scrim — top-to-bottom plus a stronger wash behind
          where the header/card actually sit, so the real photo stays
          visible as atmosphere without fighting the UI on top of it. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-black/85" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#02040A]/90 via-transparent to-[#02040A]/50" />

      {/* Vignette — keeps the edges (and therefore the eye) on the
          centred glass card rather than the environment. */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(2,4,10,0.7) 100%)" }}
      />

      {/* Fine grain — extremely subtle, breaks up gradient banding over
          the photo without reading as visible noise. */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.035] mix-blend-overlay">
        <filter id={`${uid}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${uid}-grain)`} />
      </svg>
    </div>
  );
}
