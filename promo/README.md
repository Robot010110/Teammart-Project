# TeamMart — 40-second promo (Remotion)

A 40 s motion-graphic promo for **TeamMart**, built entirely from shapes, type and UI components in
[Remotion](https://www.remotion.dev) (React). One composition drives both cuts:

| Composition | Size | FPS | Frames |
|---|---|---|---|
| `TeamMartPromo` | 1920×1080 (16:9 master) | 60 | 2,400 |
| `TeamMartPromoVertical` | 1080×1920 (9:16) | 60 | 2,400 |

No stock footage. The only bitmaps are **real screenshots of the TeamMart app**, captured from
the running app with its seeded demo data (see [Real screenshots](#real-screenshots)).

**Story:** chaos → freeze → *"What if every market ran like one team?"* → Zone → Markets →
Employees hierarchy with role scopes → one task's round trip (assign → complete on the phone →
approve) → a live dashboard → the real product → logo, tagline, call to action.
The shot-by-shot plan with exact frames is in **[PLAN.md](PLAN.md)**.

---

## Install

Requires Node 18+ (tested on Node 22).

```bash
cd promo
npm install
```

The first render downloads Remotion's headless Chrome automatically. On a locked-down network,
point it at any installed Chrome/Chromium instead:

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome   # optional
```

## Preview

```bash
npm run dev          # = npx remotion studio
```

Opens the Remotion Studio. Pick `TeamMartPromo` or `TeamMartPromoVertical` in the sidebar; each
scene appears as a named sequence on the timeline (`S1 Chaos + snap`, `S2 Beat`, …).

Quick stills of key frames (one per shot in PLAN.md) without opening the Studio:

```bash
npm run stills                              # 16:9 → out/stills/
npm run stills -- TeamMartPromoVertical     # 9:16
npm run stills -- TeamMartPromo 600 1300    # specific frames
```

## Render

```bash
# 16:9 master (H.264, CRF 18 — high quality, ~15 Mbps)
npx remotion render TeamMartPromo out/teammart-promo-16x9.mp4

# 9:16 vertical
npx remotion render TeamMartPromoVertical out/teammart-promo-9x16.mp4
```

Or via npm scripts:

| Script | What it does |
|---|---|
| `npm run render` | 16:9 master → `out/teammart-promo-16x9.mp4` |
| `npm run render:vertical` | 9:16 → `out/teammart-promo-9x16.mp4` |
| `npm run render:all` | both |
| `npm run render:web` | both at CRF 23 (smaller files for sharing) |
| `npm run render:draft` | 16:9 at half resolution, fast, for review |

Useful flags: `--frames=1020-1619` (render one scene), `--concurrency=8`, `--crf=16`,
`--codec=prores --prores-profile=4444` (for an editing master). Defaults live in
[`remotion.config.ts`](remotion.config.ts). A full 16:9 render takes ~30 min on 4 CPU cores.

---

## Edit colors, copy and timing — `src/config.ts`

Everything you'd normally want to change is in **one file**:

| Block | Controls |
|---|---|
| `COLORS` | `bg` `#0A0B10`, `accent` `#4F7CFF`, `warm` `#FFB547` (alerts), text tints. `COLORS.app` holds TeamMart's real product tokens (orange/navy) used inside the phone UI so it matches the real screenshots. |
| `COPY` | Every on-screen word: chaos messages, the beat line (and which words are highlighted), level names, role badges, the task, dashboard labels & sample numbers, reveal caption, tagline, CTA, optional URL. |
| `SCREENS` | Which screenshot appears in which device. |
| `TIMING.scenes` | Seconds per scene (default 6 / 3 / 8 / 10 / 8 / 5 = 40 s). Beats inside a scene scale with it, springs keep their snap, and SFX cues move with the picture. |
| `LOOK` | Grain, vignette, motion blur on/off, shutter angle, max blur length, fade-out frames. |
| `SFX` | Turn sound cues on once you've added audio files (below). |

Dashboard figures are **sample values** and the panel always shows an *Illustrative data* tag.

## How the vertical cut works

There is no second edit. Every scene calls `useLayout()` (`src/lib/util.ts`) and adapts: the
chaos simulation is re-run for the tall frame, the beat line re-wraps to four lines, the radial
graph (orientation-agnostic by design) gets its headline above and role badges below, the phone
is larger, the dashboard switches to a 2-column grid, and the product reveal stacks the browser
above three phones.

---

## Motion system

| Technique | Where |
|---|---|
| **spring() + interpolate() only** | `src/lib/motion.ts` — five spring presets (`snap`, `pop`, `settle`, `heavy`, `camera`) tuned for fast attack and slight overshoot; easing curves for camera moves. |
| **Unique stagger** | `stagger()` adds a golden-ratio sub-frame offset so no two elements ever start on the same frame (Remotion's `spring()` accepts fractional frames; time is quantised to ¼ frame to keep its cache small). |
| **Directional motion blur** | `src/components/MotionBlur.tsx` — velocity-based: rotate into the direction of travel, one-axis Gaussian blur, rotate back. Length = velocity × 180° shutter. Used on chaos entries, the snap, kinetic type, the task packet, the phone, device fly-ins. Fast camera zooms get a speed-scaled smear. |
| **2.5D camera + parallax** | `src/lib/camera.ts` — each layer has a parallax factor; `screen = center + (world − cam·p) · zoom^p`. The hierarchy is a shallow pyramid (HQ nearest the lens, employees farthest), so every push, drift and roll reveals depth. |
| **Depth of field** | Per-plane blur from distance to the focus plane, with a rack focus as the task travels from the Regional Manager to the Supervisor. |
| **Deterministic physics** | `src/scenes/chaos/sim.ts` — the chaos is a precomputed, seeded simulation (drift, noise jitter, AABB collisions, soft walls), so any frame renders in isolation on Remotion's parallel renderer. |
| **Grain, glow, glass** | Animated Gaussian grain tiles (overlay blend, sized to survive H.264), radial glows, glass cards with a gradient 1px border via `mask-composite`. |

## Sound design — cue sheet

Cues live in [`src/sfx.ts`](src/sfx.ts) (anchored to scene beats, so they follow `TIMING`), and
each is also marked as a `SFX:` comment in the scene code. To hear them: drop files with these
names into `public/sfx/`, set `SFX.enabled = true` in `config.ts`, and render — Remotion mixes them
into the MP4. (Every listed file must exist once enabled; delete cues you don't want.)

| Time | Frame | File | Cue |
|---|---|---|---|
| 0:00.03 | 2 | `notification-pop.wav` | First bubble pops in |
| 0:00.20 | 12 | `whoosh-small.wav` | Wave 1 entries begin (layer one whoosh+pop per element, f12–f292) |
| 0:00.67 | 40 | `vibration-bed.wav` | Phone-vibration bed, rising with the camera shake |
| 0:02.00 | 120 | `dissonant-pad.wav` | Pad swells with the warm alarm glow |
| 0:03.33 | 200 | `hero-thud.wav` | "who's covering Zone 3?" slams in |
| 0:06.00 | 360 | `low-hit.wav` | **THE FREEZE** — low hit + tape-stop |
| 0:06.30 | 378 | `reverse-suck.wav` | Everything snaps into the point of light |
| 0:07.00 | 420 | `light-tink.wav` | Light flares; shockwave |
| 0:07.20 | 432 | `word-ticks.wav` | Soft tick per word of "What if every market ran like one team?" |
| 0:08.70 | 522 | `whoosh-out.wav` | Words exit |
| 0:09.00 | 540 | `bloom-whomp.wav` | Light blooms into the HQ node |
| 0:09.33 | 560 | `tick-rise-3.wav` | Three zones pop |
| 0:10.33 | 620 | `tick-cascade.wav` | Nine markets pop clockwise |
| 0:11.50 | 690 | `granular-shimmer.wav` | 36 employees ripple in |
| 0:13.33 | 800 | `chime-1.wav` | Admin badge — whole disc lights |
| 0:14.33 | 860 | `chime-2.wav` | Regional Manager badge — zone wedge |
| 0:15.33 | 920 | `chime-3.wav` | Supervisor badge — market wedge |
| 0:16.33 | 980 | `riser-short.wav` | Riser into the push-in |
| 0:16.70 | 1002 | `push-whoosh.wav` | Camera pushes into the Regional Manager node |
| 0:17.67 | 1060 | `card-pop.wav` | Task card springs out |
| 0:18.70 | 1122 | `zip-down.wav` | Task packet shoots down to the Supervisor |
| 0:19.50 | 1170 | `impact-rise.wav` | Packet lands, phone rises |
| 0:20.20 | 1212 | `notification-chime.wav` | Push notification |
| 0:21.23 | 1274 | `ui-tap.wav` | Tap "Start task" |
| 0:21.73 | 1304 | `camera-shutter.wav` | Photo evidence captured |
| 0:22.50 | 1350 | `ui-tap-positive.wav` | Tap "Mark complete" — positive blip |
| 0:23.33 | 1400 | `lift-swish.wav` | Task lifts off the phone |
| 0:23.70 | 1422 | `whoosh-up.wav` | Packet flies back up |
| 0:24.97 | 1498 | `ui-click.wav` | Approve pressed |
| 0:25.27 | 1516 | `approve-ding.wav` | **THE CHECK** — confirmation ding + soft sub |
| 0:26.07 | 1564 | `whoosh-big-out.wav` | Fast pull-back |
| 0:27.03 | 1622 | `ui-swell.wav` | Dashboard settles in |
| 0:27.50 | 1650 | `counter-ticks.wav` | Counters tick up, panels whoosh in (staggered) |
| 0:29.83 | 1790 | `tick-chime.wav` | Live update: the approved task lands in the feed |
| 0:31.83 | 1910 | `shimmer-sweep.wav` | Light sweep reveals the real product |
| 0:32.43 | 1946 | `whoosh-device-1.wav` | Phone 1 slides in |
| 0:32.57 | 1954 | `whoosh-device-2.wav` | Phone 2 slides in |
| 0:32.70 | 1962 | `whoosh-device-3.wav` | Phone 3 slides in |
| 0:34.00 | 2040 | `riser-short.wav` | Riser into the close |
| 0:35.00 | 2100 | `whoosh-in.wav` | Devices converge to the light |
| 0:35.50 | 2130 | `low-hit-soft.wav` | Lighter low hit as the logo forms |
| 0:35.67 | 2140 | `logo-build.wav` | Crystalline build of the mark |
| 0:37.17 | 2230 | `tagline-swell.wav` | Tagline |
| 0:38.17 | 2290 | `soft-click.wav` | CTA appears |
| 0:39.00 | 2340 | `reverb-tail.wav` | Tail |

---

## Real screenshots

`public/screens/` holds four screenshots taken from the real TeamMart app (this repo's
`Frontend/` + `backend/`) running locally with the seed's demo accounts:

| File | Role / route | Appears in |
|---|---|---|
| `admin-dashboard.png` | Admin · `/admin/home` (1440×900 @2x) | Browser frame, shot 5D |
| `regional-manager-home.png` | Regional Manager · `/rm/profile` (390×844 @3x) | Phone 1, shot 5E |
| `supervisor-home.png` | Supervisor · `/supervisor/home` | Phone 2, shot 5E |
| `employee-tasks.png` | Employee · `/me/tasks` | Phone 3, shot 5E |

They show demo data only, and the film captions them as such. The animated phone in the workflow
(shots 4D–4J) is a rebuild of the app's real task-detail screen (same layout, tokens and icons),
so it can animate through Assigned → In progress → Completed.

To refresh them after UI changes, run the app locally (see the root README), then:

```bash
npm i --no-save playwright@1.56.1 && npx playwright install chromium
node scripts/capture-screens.cjs                  # capture
node scripts/capture-screens.cjs --seed-activity  # first create a "lived-in" day via the API
```

`--seed-activity` checks the demo Supervisor in and assigns a few sudden tasks through the app's
own API — only run it against a local/demo database.

## Project structure

```
promo/
  PLAN.md                     shot-by-shot plan (exact frames)
  remotion.config.ts          render defaults (H.264, CRF 18, JPEG frames)
  public/
    fonts/                    Inter variable (wght + opsz), OFL license
    grain/                    deterministic Gaussian grain tiles
    screens/                  real TeamMart screenshots
  scripts/
    render-stills.mjs         key-frame stills, one bundle + one browser
    capture-screens.cjs       re-capture the real screens with Playwright
  src/
    config.ts                 ← colors, copy, timing, look, SFX switch
    Root.tsx / index.ts       the two compositions
    Promo.tsx                 scene windows, background, grain, vignette, fade
    sfx.ts                    sound cue sheet + optional audio track
    lib/                      timing, springs/easing, 2.5D camera, fonts, utils
    components/               motion blur, atmosphere, glass, kinetic type,
                              logo, phone/browser frames, check burst + taps
    scenes/
      chaos/                  S1 — physics sim + messy UI fragments
      Beat.tsx                S2 — freeze, snap, point of light, kinetic line
      graph/                  S3+S4 — hierarchy model, camera timeline, world,
                              overlays (headline, badges, stepper), phone UI
      dashboard/              S5 — panels + real-product reveal
      Close.tsx               S6 — logo, tagline, CTA
```

## Licensing notes

- **Remotion** is free for individuals and companies of up to 3 people; larger for-profit
  organisations need a [company license](https://www.remotion.pro) to render with it.
- **Inter** — SIL Open Font License 1.1 (`public/fonts/OFL-Inter.txt`).
- **Lucide** icons (`lucide-react`, the same icon set the TeamMart app uses) — ISC License.
