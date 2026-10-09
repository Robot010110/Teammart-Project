# TeamMart promo — shot-by-shot plan

**Spec:** 40.0 s · 60 fps · 2,400 frames, plus 15 s and 6 s edits of the same master · 1920×1080, 1080×1920 and 1080×1080 from one composition (layout adapts) · English and Sorani Kurdish (RTL) · per-prospect structure and names via props.
**Viewer:** head of operations at a supermarket chain. **Feeling:** "this would fix my daily chaos."
**Look:** near-black `#0A0B10`, brand blue `#4F7CFF` for identity and data, brand orange `#F47A20` for action and alerts (`brand/tokens.mjs`). Inter (variable, optical sizing), tight tracking, soft glows, animated grain, depth-of-field, 1px-bordered glass.
**Motion rules:** spring() + interpolate() only, nothing linear, nothing floaty. Every element gets its own start frame (no two elements start on the same frame). Velocity-based directional motion blur on fast moves. 2.5D camera with per-layer parallax and depth-of-field.

Frame numbers are absolute (frame = seconds × 60). `SFX:` columns describe the soundtrack; the generator builds its cue sheet from the same beats in code (`src/timeline/cues.ts`), so sound and picture can't drift.

---

## S1 · CHAOS — 0:00.00–0:06.00 (f0–f359)

| Shot | Frames | Time | Picture | SFX |
|---|---|---|---|---|
| 1A | f0–f20 | 0.00–0.33 | Black → first chat bubble pops in: *"who's covering Zone 3?"* (spring, overshoot). | notification pop |
| 1B | f12–f150 | 0.20–2.50 | Wave 1: 14 elements fly in from every edge — chat bubbles, sticky notes, missed-call chips — staggered 4–7 frames apart, motion-blurred on entry. | stacked whooshes + pops |
| 1C | f90–f300 | 1.50–5.00 | Waves 2–3: ~30 more — spreadsheet cells (`#REF!`, `TBD`, red error cells), email subject `RE: RE: FW: shift_schedule_v7_FINAL(2).xlsx`, `3 missed calls`, `99+` badges. Deterministic physics: drift, noise jitter, elastic collisions, soft walls. Three depth layers (back: small/blurred, mid: sharp, front: large/blurred passing the lens). Camera shake ramps 0 → 9 px, ±0.4°. | phone-vibration bed rising, dissonant pad |
| 1D | f200–f359 | 3.33–6.00 | The hero line *"who's covering Zone 3?"* swells into huge kinetic type with echo copies; missed-call counter ticks 3 → 27; background glow drifts warm (brand orange) = alarm. Peak chaos at f350. | pad crescendo |

## S2 · BEAT — 0:06.00–0:09.00 (f360–f539)

| Shot | Frames | Time | Picture | SFX |
|---|---|---|---|---|
| 2A | f360 | 6.00 | **Hard freeze.** Everything stops dead, shake stops, quick exposure dip. | **LOW HIT** + tape-stop |
| 2B | f360–f378 | 6.00–6.30 | Frozen hold, slow push-in 1.00 → 1.03, elements desaturate. | room-tone silence |
| 2C | f378–f420 | 6.30–7.00 | **Snap:** elements accelerate into one point at center, staggered by distance (1–2 frames apart), heavy directional blur, scale → 0. The point of light brightens with each arrival. | reverse "suck" whoosh → bright tink |
| 2D | f420–f440 | 7.00–7.33 | Light flares, shockwave ring, settles to a small star. | shimmer |
| 2E | f432–f500 | 7.20–8.33 | Kinetic type: **"What if every market / ran like one team?"** Words rise blur→sharp with overshoot, 5-frame stagger; *one team?* in accent with a glow sweep. | soft tick per word, swell |
| 2F | f500–f522 | 8.33–8.70 | Hold. | — |
| 2G | f522–f539 | 8.70–9.00 | Words exit (scale down + blur, 2-frame stagger); light returns to center. | whoosh out |

## S3 · STRUCTURE — 0:09.00–0:16.00 (f540–f959) · real 3D

The point of light becomes the HQ of a **three.js** org chart lying on a disc: HQ → 3 Zones → 9 Markets → 36 Employees (or the prospect's own structure). Perspective camera, lit glass nodes with hot cores, arcing edges, a polar floor grid, true sub-frame motion blur, bloom and depth of field. Labels are DOM, pinned to nodes through the same camera.

| Shot | Frames | Time | Picture | SFX |
|---|---|---|---|---|
| 3A | f540–f570 | 9.00–9.50 | HQ blooms where the light was, camera tight overhead (72°). | bloom "whomp" |
| 3B | f564–f600 | 9.40–10.00 | **Zones:** edges arc out 7 frames apart, nodes pop; camera pulls back and tilts. Headline *Zones*. | one bell per zone |
| 3C | f610–f660 | 10.17–11.00 | **Markets** grow clockwise 3.4 frames apart; the framing slides right to make room for type. Headline *Zones → Markets*. | tick cascade |
| 3D | f662–f713 | 11.03–11.88 | **Employees** ripple in, ~1 frame apart; camera settles into a wide 3/4 view with a slow orbit. Headline complete. | granular shimmer |
| 3E | f752–f806 | 12.53–13.43 | **Admin** badge; the whole disc lights. | chime |
| 3F | f806–f860 | 13.43–14.33 | **Regional Manager**; their zone's sector lights, other zones dim, camera eases toward it. | chime, higher |
| 3G | f860–f928 | 14.33–15.47 | **Supervisor**; one market's sector, camera closer. | chime, highest |
| 3H | f928–f959 | 15.47–16.00 | Overlays clear; riser into the push. | riser |

## S4 · WORKFLOW — 0:16.00–0:27.00 (f960–f1619) · the real app

One task's real round trip, filmed from the running app by `scripts/record-flows.cjs`. Each phone plays a screen recording, cut at the recorded taps (`src/recordings/events.json`) and sped up ~2–3× (the phone says so). What the steps claim is what the product does: Supervisors assign sudden tasks; employees start and complete them with photo evidence; logged work goes to the Supervisor's Review Queue for approval.

| Shot | Frames | Time | Picture | SFX |
|---|---|---|---|---|
| 4A | f934–f1008 | 15.57–16.80 | Camera dives low to the Supervisor's market node; stepper **01 Assign**. | big whoosh |
| 4B | f984–f1174 | 16.40–19.57 | A phone rises out of the node (leader line to the node, world defocuses): **real Supervisor UI** — *Assign Task*, title typed, submitted, task appears in the list. | phone rise, taps, success |
| 4C | f1166–f1218 | 19.43–20.30 | The task, a glowing packet with a comet tail, races down the edge to the employee; camera follows. | zip down, land |
| 4D | f1198–f1400 | 19.97–23.33 | **02 Complete.** Employee phone: open the task → *Start Task* → camera → photo → *Complete Task* → *Task Completed*. | taps, shutter, success |
| 4E | f1392–f1440 | 23.20–24.00 | Packet back up to the market. | zip up, land |
| 4F | f1426–f1558 | 23.77–25.97 | **03 Approve.** Supervisor's **Review Queue**: open the logged refill → *Approve* → *Save Decision* → *Approved.* | taps |
| 4G | f1554–f1612 | 25.90–26.87 | **The check** bursts on the market node: *Approved · Visible to Zone 3 and HQ*; the news climbs to the zone and HQ with ring pulses. | approval ding + sub, rising arpeggio |
| 4H | f1606–f1672 | 26.77–27.87 | Pull-back; the world fades under the arriving dashboard. | big whoosh |

## S5 · DASHBOARD — 0:27.00–0:35.00 (f1620–f2099)

All figures are sample values and the panel is labelled **Illustrative data**.

| Shot | Frames | Time | Picture | SFX |
|---|---|---|---|---|
| 5A | f1620–f1660 | 27.00–27.67 | Graph shrinks into a blurred constellation far behind; glass dashboard springs in. Header *Operations · Live* + live dot + *Illustrative data* tag. | whoosh settle |
| 5B | f1650–f1790 | 27.50–29.83 | Panels assemble 5 frames apart: 4 KPI counters tick up, weekly line chart draws with area fill, per-market bars grow with spring stagger, 3 completion rings fill, activity feed rows slide in. | rapid soft ticks, per-panel whooshes |
| 5C | f1790–f1900 | 29.83–31.67 | "Live" beat: *Restock dairy shelf · Approved* pushes into the feed (callback), a KPI pops +1, a bar ticks up. Gentle parallax drift. | tick + chime |
| 5D | f1900–f1960 | 31.67–32.67 | **Real product reveal:** camera pulls back, a light sweep wipes across and the **real TeamMart Admin dashboard** (captured from the running app) materialises in a browser frame. Caption *Real screens · demo data*. | shimmer sweep |
| 5E | f1940–f2040 | 32.33–34.00 | Three phones slide in from depth (8 frames apart) with **real screenshots**: Regional Manager, Supervisor, Employee — each role-labelled. | 3 staggered whooshes |
| 5F | f2040–f2099 | 34.00–35.00 | Drift; everything begins converging to center. | riser |

## S6 · CLOSE — 0:35.00–0:40.00 (f2100–f2399)

| Shot | Frames | Time | Picture | SFX |
|---|---|---|---|---|
| 6A | f2100–f2150 | 35.00–35.83 | Devices rush to center and fall out of focus; point of light flares (callback to the beat). | whoosh in + light LOW HIT |
| 6B | f2140–f2200 | 35.67–36.67 | Logo builds from the light: glass badge springs in, node-"T" lines draw outward, 4 nodes pop. | crystalline build |
| 6C | f2180–f2230 | 36.33–37.17 | Wordmark **TeamMart** rises letter by letter (2-frame stagger), tracking settles tight, *Mart* in accent. | soft ticks |
| 6D | f2230–f2290 | 37.17–38.17 | Tagline **"Run every market like one team."** springs in word by word. | swell |
| 6E | f2290–f2340 | 38.17–39.00 | CTA pill *Book a demo →* rises; one shimmer pass. | soft click |
| 6F | f2340–f2399 | 39.00–40.00 | Hold, glow breathes, last 12 frames fade to black. | reverb tail |

---

## Always-on layers
Background `#0A0B10` with slow-drifting radial glows · far bokeh dust on a deep parallax plane (DoF-blurred) · animated film grain (overlay, ~6%) · vignette.

## Vertical (1080×1920) and square (1080×1080) adaptations
- **Chaos:** same simulation, walls fitted to the frame; hero line wraps to 2 lines.
- **Beat:** sentence breaks into 4 lines, slightly smaller type.
- **Structure:** the 3D camera frames the disc lower (9:16) or right (1:1); headline above, role badges stacked below (9:16) or in a compact column (1:1).
- **Workflow:** stepper becomes pills on top (9:16) or a compact column (1:1); the phone is larger in 9:16.
- **Dashboard:** 2-column tall grid (9:16), a 2×2 grid with the live feed next to the chart (1:1).
- **Product reveal:** browser on top with three phones beneath (9:16); phones overlap the browser's lower edge with role tags on the devices (1:1), since captions own the bottom band.
- **Close:** lockup stacks vertically; tagline breaks into two balanced lines.
- **Kurdish:** everything mirrors (overlay columns move right, the 3D framing flips), Noto Sans Arabic without tracking; the brand lockup stays left-to-right.

## Cutdowns (`src/timeline/edits.ts`)
Each is a list of master shots with a playback speed; cut points sit on the 120 BPM grid (30 frames per beat).

| Edit | Shots (master frames @ speed) |
|---|---|
| 15 s · 900 f | chaos f20–335 @1.75 · beat f380–530 · 3D hierarchy f600–900 @2 (flash) · employee completes f1218–1398 · approved f1530–1590 · real product f1950–2040 @1.5 (flash) · close f2110–2380 @2.25 |
| 6 s · 360 f | chaos peak f150–345 @1.625 · snap into the light f360–420 · real product f1950–2040 @1.5 (flash) · close f2125–2395 @2.25 |

---

## Implementation notes
- Frame-exact beats are defined in code, not hand-placed: `src/scenes/graph3d/beats.ts` (S3–S4), the `T` table in `src/scenes/dashboard/DashboardScene.tsx` (S5), and `sceneClock().at()` calls in each scene. The 3D camera is keyframed in `src/scenes/graph3d/choreo.ts`.
- All beats are authored at 60 fps against the design scene lengths (6 / 3 / 7 / 11 / 8 / 5 s) and scale automatically if `TIMING.scenes` in `src/config.ts` changes.
