"""
Build the TeamMart brand kit (SVG) from the mark geometry, the brand tokens
and Inter. The wordmark is outlined to paths so it renders identically
everywhere without the font installed.

    pip install fonttools brotli uharfbuzz
    python3 brand/tools/build.py

Outputs brand/logo/*.svg, brand/favicon.svg and copies the files the app
uses into Frontend/src/assets/brand/ and Frontend/public/.
PNGs: node brand/tools/export-png.mjs (uses a local Chromium).
"""
import io
import json
import re
import shutil
import subprocess
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / 'brand'
OUT = BRAND / 'logo'
INTER = ROOT / 'promo/public/fonts/InterVariable-latin.woff2'

# Colors come from brand/tokens.mjs, the single source of truth.
tokens_js = (BRAND / 'tokens.mjs').read_text()
C = dict(re.findall(r"(\w+):\s*'(#[0-9A-Fa-f]{6})'", tokens_js))

WEIGHT = 720          # same as the film's wordmark
TRACKING = -0.045     # em, same as the film


def wordmark_paths(text_parts, size=100):
    """Shape `text_parts` with HarfBuzz (kerning on) and outline each part.

    Returns ([(part_index, svg_path_d)], advance_width, ascender, descender),
    in px for a font size of `size`, baseline at y=0.
    """
    font = TTFont(io.BytesIO(INTER.read_bytes()))
    axes = {a.axisTag for a in font['fvar'].axes}
    # Display optical size where the font has one (Inter 4 does).
    font = instancer.instantiateVariableFont(font, {'wght': WEIGHT, **({'opsz': 32} if 'opsz' in axes else {})})
    buf = io.BytesIO()
    font.flavor = None
    font.save(buf)
    blob = hb.Blob(buf.getvalue())
    face = hb.Face(blob)
    hbfont = hb.Font(face)
    upem = face.upem
    scale = size / upem

    text = ''.join(text_parts)
    hbuf = hb.Buffer()
    hbuf.add_str(text)
    hbuf.guess_segment_properties()
    hb.shape(hbfont, hbuf, {'kern': True, 'liga': False})

    glyph_set = font.getGlyphSet()
    order = font.getGlyphOrder()
    bounds = []
    acc = 0
    for i, p in enumerate(text_parts):
        bounds.append((acc, acc + len(p), i))
        acc += len(p)

    out = []
    x = 0.0
    track = TRACKING * upem
    for info, pos in zip(hbuf.glyph_infos, hbuf.glyph_positions):
        name = order[info.codepoint]
        part = next(i for a, b, i in bounds if a <= info.cluster < b)
        pen = SVGPathPen(glyph_set)
        # Font units are y-up; SVG is y-down.
        tpen = TransformPen(pen, (scale, 0, 0, -scale, (x + pos.x_offset) * scale, -pos.y_offset * scale))
        glyph_set[name].draw(tpen)
        d = pen.getCommands()
        if d:
            out.append((part, d))
        x += pos.x_advance + track
    width = (x - track) * scale
    hhea = font['hhea']
    return out, width, hhea.ascent * scale, hhea.descent * scale, font['OS/2'].sCapHeight * scale


def fmt(d):
    return re.sub(r'(\d+\.\d{2})\d+', r'\1', d)


# ── Mark ────────────────────────────────────────────────────────────────
# A "T" drawn as a tiny org chart: junction node on a bar with two end
# nodes and a stem down to the team (Zone → Market → Employee).
J, L, R, B = (50, 37), (26, 37), (74, 37), (50, 75)


def mark_group(x=0, y=0, s=1.0, mono=None, uid='m'):
    """The mark at (x, y), `s`× its 100-unit design size."""
    if mono:
        body = f'<rect width="100" height="100" rx="29" fill="{mono}"/>'
        fg, core = '#FFFFFF', mono
        defs = ''
    else:
        defs = (
            f'<defs>'
            f'<linearGradient id="{uid}-bg" x1="0.25" y1="0.07" x2="0.75" y2="0.93">'
            f'<stop offset="0" stop-color="#7FA0FF"/><stop offset="0.42" stop-color="{C["blue"]}"/><stop offset="1" stop-color="{C["blueDeep"]}"/>'
            f'</linearGradient>'
            f'<linearGradient id="{uid}-sheen" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="0.48" stop-color="#FFFFFF" stop-opacity="0"/>'
            f'</linearGradient>'
            f'</defs>'
        )
        body = f'<rect width="100" height="100" rx="29" fill="url(#{uid}-bg)"/><rect width="100" height="100" rx="29" fill="url(#{uid}-sheen)"/>'
        fg, core = '#FFFFFF', C['blue']
    lines = ''.join(f'<line x1="{J[0]}" y1="{J[1]}" x2="{p[0]}" y2="{p[1]}"/>' for p in (L, R, B))
    nodes = (
        f'<circle cx="{L[0]}" cy="{L[1]}" r="7"/><circle cx="{R[0]}" cy="{R[1]}" r="7"/>'
        f'<circle cx="{B[0]}" cy="{B[1]}" r="8"/><circle cx="{J[0]}" cy="{J[1]}" r="9.5"/>'
    )
    return (
        defs
        + f'<g transform="translate({x} {y}) scale({s})">{body}'
        + f'<g stroke="{fg}" stroke-width="7" stroke-linecap="round" fill="none">{lines}</g>'
        + f'<g fill="{fg}">{nodes}</g>'
        + f'<circle cx="{J[0]}" cy="{J[1]}" r="4.2" fill="{core}"/></g>'
    )


def mark_only(fg_mono=None):
    """Mark on its own; `fg_mono` = flat one-color version."""
    if fg_mono:
        # Knock-out: the nodes are cut out of a solid tile.
        lines = ''.join(f'<line x1="{J[0]}" y1="{J[1]}" x2="{p[0]}" y2="{p[1]}"/>' for p in (L, R, B))
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            '<defs><mask id="k"><rect width="100" height="100" fill="#fff"/>'
            f'<g stroke="#000" stroke-width="7" stroke-linecap="round">{lines}</g>'
            f'<g fill="#000"><circle cx="{L[0]}" cy="{L[1]}" r="7"/><circle cx="{R[0]}" cy="{R[1]}" r="7"/><circle cx="{B[0]}" cy="{B[1]}" r="8"/><circle cx="{J[0]}" cy="{J[1]}" r="9.5"/></g>'
            f'<circle cx="{J[0]}" cy="{J[1]}" r="4.2" fill="#fff"/></mask></defs>'
            f'<rect width="100" height="100" rx="29" fill="{fg_mono}" mask="url(#k)"/></svg>\n'
        )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{mark_group()}</svg>\n'


def lockup(team_color, mart_color, mono=None, stacked=False):
    glyphs, width, asc, desc, cap = wordmark_paths(['Team', 'Mart'])
    colors = [team_color, mart_color]
    word = ''.join(f'<path fill="{colors[p]}" d="{fmt(d)}"/>' for p, d in glyphs)
    if stacked:
        mark_s = 1.36
        mark_px = 100 * mark_s
        gap = 34
        W = max(width, mark_px)
        H = mark_px + gap + cap
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H + 2:.1f}">'
            + mark_group((W - mark_px) / 2, 0, mark_s, mono)
            + f'<g transform="translate({(W - width) / 2:.2f} {mark_px + gap + cap:.2f})">{word}</g></svg>\n'
        )
    # Horizontal: mark height ≈ 1.46 × cap height, centered on the caps.
    mark_px = cap * 1.46
    gap = mark_px * 0.26
    W = mark_px + gap + width
    H = mark_px
    base = (H + cap) / 2
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H:.1f}">'
        + mark_group(0, 0, mark_px / 100, mono)
        + f'<g transform="translate({mark_px + gap:.2f} {base:.2f})">{word}</g></svg>\n'
    )


def wordmark_only(team_color, mart_color):
    glyphs, width, asc, desc, cap = wordmark_paths(['Team', 'Mart'])
    colors = [team_color, mart_color]
    word = ''.join(f'<path fill="{colors[p]}" d="{fmt(d)}"/>' for p, d in glyphs)
    pad = 2
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {-cap - pad:.1f} {width:.1f} {cap + pad * 2 + 0.5:.1f}">{word}</svg>\n'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        'teammart-mark.svg': mark_only(),
        'teammart-mark-mono-white.svg': mark_only('#FFFFFF'),
        'teammart-mark-mono-night.svg': mark_only(C['night']),
        'teammart-lockup-on-dark.svg': lockup(C['text'], C['blue']),
        'teammart-lockup-on-light.svg': lockup(C['night'], C['blueDeep']),
        'teammart-lockup-stacked-on-dark.svg': lockup(C['text'], C['blue'], stacked=True),
        'teammart-wordmark-on-dark.svg': wordmark_only(C['text'], C['blue']),
        'teammart-wordmark-on-light.svg': wordmark_only(C['night'], C['blueDeep']),
    }
    for name, svg in files.items():
        (OUT / name).write_text(svg)
    (BRAND / 'favicon.svg').write_text(files['teammart-mark.svg'])

    # The app ships its own copies (its build only sees Frontend/).
    app_assets = ROOT / 'Frontend/src/assets/brand'
    app_assets.mkdir(parents=True, exist_ok=True)
    for name in ('teammart-mark.svg', 'teammart-wordmark-on-dark.svg'):
        shutil.copy(OUT / name, app_assets / name)
    public = ROOT / 'Frontend/public'
    public.mkdir(exist_ok=True)
    shutil.copy(BRAND / 'favicon.svg', public / 'favicon.svg')
    print('\n'.join(sorted(str(p.relative_to(ROOT)) for p in OUT.iterdir())))


if __name__ == '__main__':
    main()
