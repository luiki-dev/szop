# Brand source

The masters of Szop's brand mark. **The app never serves or imports these files**: its own brand files are made from them once and committed where the app uses them ([visual-design.md, section 4](../../visual-design.md#4-icons-and-brand)).

- `szop.png`: the owner's original artwork, the raccoon's head on a transparent background, 1254 × 1254 px.
- `szop-trace.svg`: the same head traced to SVG, without a tile. The vector master for later uses of the large raccoon, such as a splash screen.

## How the app's files were made

The trace (PH-14b, [spec](../../../superpowers/specs/2026-10-25-PH-14b-app-shell-design.md#the-brand-mark)):

1. **Snap the colors.** Every pixel of `szop.png` with alpha ≥ 128 is set to the nearest (by RGB distance) of five tones, fully opaque: `#F9F7F2`, `#B4BCC5`, `#6C7882`, `#3A4654`, `#141C2B`; every other pixel becomes fully transparent. A short Python script with Pillow.
2. **Trace** with vtracer 0.6 (`uv run --python 3.12 --with vtracer`; its wheel crashed on Python 3.14): `colormode="color"`, `hierarchical="stacked"`, `mode="spline"`, `filter_speckle=12`, `color_precision=8`, `layer_difference=8`, `corner_threshold=60`, `length_threshold=4.0`, `max_iterations=10`, `splice_threshold=45`, `path_precision=1`. Each traced fill is snapped to the nearest of the five tones again. The result is `szop-trace.svg`.
3. **Put it on the tile.** viewBox `0 0 1254 1254`, a full-size `<rect>` with `rx="188"` in `sage-500` (`#5F9273`) under the head, the paths in `<g transform="translate(627 627) scale(1.06) translate(-626.5 -578)">`: the head's bounding box is x 68–1185, y 153–1003, so it is centered on the tile and enlarged by 6%.

The app's files, from that tiled SVG:

- `apps/web/src/brand/logo.svg` and `apps/web/public/favicon.svg`: optimized with `pnpm dlx svgo@4 --multipass --precision 0` (whole pixels on a 1254 px canvas; no visible change at 560 px), 12.7 KB.
- `apps/web/public/favicon.ico`: the logo rendered at 256 px with a transparent background (`google-chrome --headless=new --default-background-color=00000000 --window-size=256,256 --screenshot` on a page showing only the image), then saved by Pillow with the sizes 16 and 32.
- `apps/web/public/apple-touch-icon.png`: 180 × 180 px, rendered the same way from a copy of the logo without the tile's `rx`, since iOS rounds the corners itself and would fill transparent ones with black.
