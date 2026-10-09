# TeamMart promo — shot-by-shot plan

**Spec:** 40.0 s · 60 fps · 2,400 frames · 1920×1080 master + 1080×1920 vertical (same composition, layout adapts).
**Viewer:** head of operations at a supermarket chain. **Feeling:** "this would fix my daily chaos."
**Look:** near-black `#0A0B10`, one electric accent `#4F7CFF`, warm alert `#FFB547`. Inter (variable, optical sizing), tight tracking, soft glows, animated grain, depth-of-field, 1px-bordered glass.
**Motion rules:** spring() + interpolate() only, nothing linear, nothing floaty. Every element gets its own start frame (no two elements start on the same frame). Velocity-based directional motion blur on fast moves. 2.5D camera with per-layer parallax and depth-of-field.

Frame numbers are absolute (frame = seconds × 60). `SFX:` lines are the audio cue sheet; the same cues are marked in code comments and listed in `src/sfx.ts`.

---

## S1 · CHAOS — 0:00.00–0:06.00 (f0–f359)

| Shot | Frames | Time | Picture | SFX |
|---|---|---|---|---|
| 1A | f0–f20 | 0.00–0.33 | Black → first chat bubble pops in: *"who's covering Zone 3?"* (spring, overshoot). | notification pop |
| 1B | f12–f150 | 0.20–2.50 | Wave 1: 14 elements fly in from every edge — chat bubbles, sticky notes, missed-call chips — staggered 4–7 frames apart, motion-blurred on entry. | stacked whooshes + pops |
| 1C | f90–f300 | 1.50–5.00 | Waves 2–3: ~30 more — spreadsheet cells (`#REF!`, `TBD`, red error cells), email subject `RE: RE: FW: shift_schedule_v7_FINAL(2).xlsx`, `3 missed calls`, `99+` badges. Deterministic physics: drift, noise jitter, elastic collisions, soft walls. Three depth layers (back: small/blurred, mid: sharp, front: large/blurred passing the lens). Camera shake ramps 0 → 9 px, ±0.4°. | phone-vibration bed rising, dissonant pad |
| 1D | f200–f359 | 3.33–6.00 | The hero line *"who's covering Zone 3?"* swells into huge kinetic type with echo copies; missed-call counter ticks 3 → 27; background glow drifts warm (`#FFB547`) = alarm. Peak chaos at f350. | pad crescendo |

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

## S3 · STRUCTURE — 0:09.00–0:17.00 (f540–f1019)

Radial hierarchy blooming from the point of light: HQ → 3 Zones → 9 Markets → 36 Employees. Each ring sits on its own parallax plane.

| Shot | Frames | Time | Picture | SFX |
|---|---|---|---|---|
| 3A | f540–f570 | 9.00–9.50 | Light blooms into the HQ root node (glass, TeamMart mark); shockwave travels to ring 1. | deep bloom "whomp" |
| 3B | f560–f650 | 9.33–10.83 | **Zones:** 3 edges draw out (6 frames apart), zone nodes pop with overshoot. Headline: *Zones*. | 3 rising ticks |
| 3C | f620–f730 | 10.33–12.17 | **Markets:** 9 edges draw, 9 nodes pop clockwise 4 frames apart. Headline: *Zones → Markets*. | tick cascade |
| 3D | f690–f800 | 11.50–13.33 | **Employees:** 36 dots pop in a clockwise wave, 1–2 frames apart. Headline: *Zones → Markets → Employees*. Slow camera drift reveals parallax. | granular shimmer |
| 3E | f800–f860 | 13.33–14.33 | **Admin** badge lights; scope = the whole disc (fill + outer ring + one sweep beam). *Every zone.* | power-up chime |
| 3F | f860–f920 | 14.33–15.33 | **Regional Manager** badge; scope = the bottom zone's 120° wedge, the rest dims. *Their zone.* | chime, higher |
| 3G | f920–f980 | 15.33–16.33 | **Supervisor** badge; scope = one market's 40° wedge inside it. *Their market.* | chime, highest |
| 3H | f980–f1019 | 16.33–17.00 | Nested scopes hold together; camera starts pushing toward the bottom wedge. | riser |

## S4 · WORKFLOW — 0:17.00–0:27.00 (f1020–f1619)

One task's round trip. The phone UI is modelled 1:1 on the real TeamMart task screen (priority pill, title, location, due time, *Assigned by*, 3-step tracker, photo evidence, primary action).

| Shot | Frames | Time | Picture | SFX |
|---|---|---|---|---|
| 4A | f1020–f1080 | 17.00–18.00 | Camera push into the Regional Manager's zone node (zoom 1 → 2.1); rest of graph defocuses + dims. Chip **01 · Assign**. | push whoosh |
| 4B | f1060–f1120 | 17.67–18.67 | Task card springs out of the RM node: *Restock dairy shelf · Aisle 4 · High · Due 30 min*. | card pop + click |
| 4C | f1120–f1170 | 18.67–19.50 | Card collapses to a glowing packet and shoots **down** the edge to the Supervisor's market node (motion blur + light trail); camera follows. | zip down |
| 4D | f1170–f1210 | 19.50–20.17 | Impact ripple; a phone rises out of the node (scale + 3D tilt settle). Chip **02 · Complete**. | impact + rise whoosh |
| 4E | f1210–f1240 | 20.17–20.67 | Push notification drops in: *New task · Restock dairy shelf*. | notification chime |
| 4F | f1240–f1270 | 20.67–21.17 | Task detail staggers in (pill, title, meta, tracker). | UI ticks |
| 4G | f1270–f1300 | 21.17–21.67 | Tap **Start task** → ripple; tracker step 2 fills; timer starts. | tap + tick |
| 4H | f1300–f1345 | 21.67–22.42 | Photo evidence: shutter flash, restocked-shelf thumbnail pops in. | shutter click |
| 4I | f1345–f1380 | 22.42–23.00 | Tap **Mark complete** → step 3 turns green, button morphs to *Completed ✓*. | tap + positive blip |
| 4J | f1380–f1420 | 23.00–23.67 | The task card lifts off the screen and compresses into a packet. | lift swish |
| 4K | f1420–f1470 | 23.67–24.50 | Packet flies back **up** to the RM node; phone sinks into the market node; camera follows. Chip **03 · Approve**. | whoosh up |
| 4L | f1470–f1500 | 24.50–25.00 | Approval card at the RM node; *Approve* is pressed. | click |
| 4M | f1500–f1560 | 25.00–26.00 | **The check:** circle draws, check mark draws with overshoot, double ring ripple, 18-particle burst, the branch flashes green. *Approved.* | confirmation ding + soft sub |
| 4N | f1560–f1619 | 26.00–27.00 | Hold, then a fast motion-blurred pull-back (zoom 2.1 → 0.6). | big whoosh out |

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

## Vertical (1080×1920) adaptations
- **Chaos:** same simulation, walls fitted to the tall frame; hero line wraps to 2 lines.
- **Beat:** sentence breaks into 4 lines, slightly smaller type.
- **Structure:** radial graph unchanged (orientation-agnostic), headline above, role badges stacked below.
- **Workflow:** phone is larger; chips sit above the phone.
- **Dashboard:** 2-column tall grid instead of the wide 12-column grid.
- **Product reveal:** browser frame on top, three phones in a row beneath.
- **Close:** identical, scaled to width.

---

## Implementation notes
- Frame-exact beats are defined in code, not hand-placed: `src/scenes/graph/timeline.ts` (S3–S4), the `T` table in `src/scenes/dashboard/DashboardScene.tsx` (S5), and `sceneClock().at()` calls in each scene. A few beats moved by 2–6 frames from this plan where the motion read better (e.g. the "Start task" tap lands on f1274); the audio cue sheet in `src/sfx.ts` / README follows the final picture.
- All beats are authored at 60 fps against the default scene lengths and scale automatically if `TIMING.scenes` in `src/config.ts` changes.
