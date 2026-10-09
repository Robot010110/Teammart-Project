"""
Rasterize the brand SVGs to PNG with a headless Chromium.

    CHROME=/path/to/chrome python3 brand/tools/export_png.py

Writes brand/png/ and the app's touch icon (Frontend/public/).
"""
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOGO = ROOT / 'brand/logo'
PNG = ROOT / 'brand/png'
CHROME = os.environ.get('CHROME') or shutil.which('chromium') or shutil.which('google-chrome') or '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'

JOBS = [
    # (svg, out name, width, height, background)
    ('teammart-mark.svg', 'teammart-mark-1024.png', 1024, 1024, None),
    ('teammart-mark.svg', 'teammart-mark-512.png', 512, 512, None),
    ('teammart-mark.svg', 'teammart-mark-192.png', 192, 192, None),
    ('teammart-mark.svg', 'apple-touch-icon.png', 180, 180, '#0A0B10'),
    ('teammart-lockup-on-dark.svg', 'teammart-lockup-on-dark@2x.png', 1200, None, None),
    ('teammart-lockup-on-light.svg', 'teammart-lockup-on-light@2x.png', 1200, None, None),
    ('teammart-lockup-stacked-on-dark.svg', 'teammart-lockup-stacked-on-dark@2x.png', 800, None, None),
]


def view_box(svg_path):
    import re
    vb = re.search(r'viewBox="([^"]+)"', svg_path.read_text()).group(1).split()
    return float(vb[2]), float(vb[3])


def main():
    PNG.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for svg, name, w, h, bg in JOBS:
            src = LOGO / svg
            vw, vh = view_box(src)
            h = h or round(w * vh / vw)
            # The apple touch icon is a full-bleed square: iOS rounds it itself.
            inner = f'<img src="{src.as_uri()}" style="display:block;width:{w}px;height:{h}px">'
            if bg:
                inner = f'<div style="width:{w}px;height:{h}px;background:{bg};display:grid;place-items:center"><img src="{src.as_uri()}" style="width:{w * 0.8}px;height:{h * 0.8}px"></div>'
            page = Path(tmp) / 'p.html'
            page.write_text(f'<html><body style="margin:0;background:transparent">{inner}</body></html>')
            subprocess.run(
                [CHROME, '--no-sandbox', '--hide-scrollbars', '--default-background-color=00000000', f'--window-size={w},{h}', f'--screenshot={PNG / name}', page.as_uri()],
                check=True,
                capture_output=True,
            )
            print(f'brand/png/{name}  {w}×{h}')
    shutil.copy(PNG / 'apple-touch-icon.png', ROOT / 'Frontend/public/apple-touch-icon.png')


if __name__ == '__main__':
    main()
