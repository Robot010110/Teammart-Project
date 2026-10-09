# TeamMart brand kit

One logo and one palette for the app and the promo film.

![Lockup on dark](png/teammart-lockup-on-dark@2x.png)

## The mark

A **T** drawn as a tiny org chart: a junction node on a bar with two end
nodes and a stem down to the team. It is the Zone → Market → Employee
hierarchy the product is built around, compressed into a letter.

| File | Use |
| --- | --- |
| `logo/teammart-mark.svg` | Default mark (app icon, favicon, avatars) |
| `logo/teammart-mark-mono-white.svg` / `-mono-night.svg` | One-color, knocked out — for print, embossing, single-ink |
| `logo/teammart-lockup-on-dark.svg` / `-on-light.svg` | Mark + wordmark, horizontal |
| `logo/teammart-lockup-stacked-on-dark.svg` | Mark over wordmark (splash, social avatars) |
| `logo/teammart-wordmark-on-dark.svg` / `-on-light.svg` | Wordmark alone |
| `favicon.svg`, `png/*` | Favicon and raster exports (1024/512/192 px marks, 180 px touch icon, @2x lockups) |

The wordmark is Inter at weight 720 with −0.045 em tracking, outlined to
paths, so it looks the same everywhere with no font installed. "Team" takes
the text color and "Mart" the brand blue.

Clear space: keep at least the width of one end node (≈ 15 % of the mark)
empty around the lockup. Minimum size: 16 px for the mark, 96 px wide for
the horizontal lockup.

## Color roles

The app grew up orange; the promo was built blue. Rather than pick one,
each color now has a job:

| Role | Token | Hex | Used for |
| --- | --- | --- | --- |
| Identity | `blue` | `#4F7CFF` | Logo, data, charts, focus, "live" |
| | `blueSoft` / `blueDeep` | `#9BB3FF` / `#2F4FCC` | Highlights, gradients, blue on light |
| Action | `orange` | `#F47A20` | Primary buttons, active states, priority, alerts |
| | `orangeDeep` | `#C95C10` | Pressed states, gradients |
| Surfaces | `night` / `ink` / `navy` | `#0A0B10` / `#111A2E` / `#1D2D5C` | Canvas → raised cards |
| Status | `green` / `red` | `#34D399` / `#FF5D6C` | Done / error |

So in the film the call to action is orange and the brand and data are blue,
and in the app the buttons stay orange while the logo is blue.

`tokens.mjs` is the source of truth. The promo imports it directly; the app
mirrors it as `brand-*` colors in `Frontend/tailwind.config.js`.

## Rebuilding

```bash
pip install fonttools brotli uharfbuzz
python3 brand/tools/build.py        # SVGs + copies into Frontend/
python3 brand/tools/export_png.py   # PNGs (needs Chromium; set CHROME=/path if not found)
```

`build.py` copies the mark and wordmark into `Frontend/src/assets/brand/`
and the favicon into `Frontend/public/`. Don't edit those copies by hand.
