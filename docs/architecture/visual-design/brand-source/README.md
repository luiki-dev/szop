# Brand source

The masters of Szop's brand mark. **The app never serves or imports these files**: its own brand files are made from them once and committed where the app uses them ([visual-design.md, section 4](../../visual-design.md#4-icons-and-brand)).

- `szop.png`: the owner's original artwork, the raccoon's head on a transparent background, 1254 × 1254 px.
- `szop-trace.svg`: the same head traced to SVG, without a tile (the second trace, below). The vector master for later uses of the large raccoon, such as a splash screen.

## How `szop-trace.svg` was made

The second trace (PH-14b), which follows the artwork's edges closely: smooth curves, sharp tips on the fur and the mask, no seams between colors. Python 3.12 with Pillow, NumPy and potracer (a pure-Python port of potrace), through `uv run --python 3.12 --with pillow --with numpy --with potracer`:

1. **Enlarge** `szop.png` 3× (3762 px) with bicubic resampling, so the edges between colors fall between the original pixels.
2. **Snap the colors.** Every pixel with alpha ≥ 128 gets the nearest (by RGB distance) of the five tones `#F9F7F2`, `#B4BCC5`, `#6C7882`, `#3A4654`, `#141C2B`; the rest is transparent.
3. **Clean the edges.** A majority filter (Pillow's `ModeFilter(7)`, twice) over the map of tones replaces the thin strips that the in-between pixels on an edge snap to (a grey seam between white and the dark mask, ragged steps on the fur), and leaves every real shape.
4. **Trace each tone** with potrace (`turdsize=60`, `alphamax=1.0`, `opticurve=True`, `opttolerance=0.2`), stacked from the bottom: `#6C7882` over the whole head, then `#3A4654`, `#B4BCC5`, `#F9F7F2` and `#141C2B`, each layer's shape being its own tone together with every tone above it, so the layers overlap and no gap shows between them. The coordinates are divided by 3, back to a 1254 px viewBox.
5. **Optimize** with `pnpm dlx svgo@4 --multipass --precision 1`: 43 KB, with no visible change at 2× zoom.

The first trace, with vtracer, rounded the sharp tips and left the edges wavy; it is kept as the spec's [`logo-approved.svg`](../../../superpowers/specs/2026-10-25-PH-14b-app-shell/logo-approved.svg), with the tile.

## How the app's files were made

From `szop-trace.svg`, put on the tile: viewBox `0 0 1254 1254`, a full-size `<rect>` with `rx="188"` in `sage-500` (`#5F9273`) under the head, the paths in `<g transform="translate(627 627) scale(1.06) translate(-626.5 -578)">`. The head's bounding box is x 68–1185, y 153–1003, so it is centered on the tile and enlarged by 6%.

- `apps/web/src/brand/logo.svg` and `apps/web/public/favicon.svg`: that tiled SVG optimized with `pnpm dlx svgo@4 --multipass --precision 0` (whole pixels on a 1254 px canvas; no visible change at 3× zoom), 16.3 KB.
- `apps/web/public/favicon.ico`: the logo rendered at 256 px with a transparent background (`google-chrome --headless=new --default-background-color=00000000 --window-size=256,256 --screenshot` on a page showing only the image), then saved by Pillow with the sizes 16 and 32.
- `apps/web/public/apple-touch-icon.png`: 180 × 180 px, rendered the same way from the tiled SVG without the tile's `rx`, since iOS rounds the corners itself and would fill transparent ones with black.
