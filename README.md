# curved-quad-mapping

R&D for a CPU-only, closed-form mapping between curved quad patches and screen pixels: `(quad, u, v) ↔ (pixel x, pixel y)`. No frame buffer and no GPU. The final prototype will be written in Odin.

- [`docs/rnd-log.md`](docs/rnd-log.md): what was tried, what was measured, what was decided, in order.
- [`examples/`](examples): standalone HTML pages, one per step. Open any of them in a browser, including on a phone.

| Example | What it shows |
|---|---|
| [`00-curved-quad-lab.html`](examples/00-curved-quad-lab.html) | Surface lab: Nagata, Phong, PN-quad and ellipsoid quads vs a Catmull-Clark target, with the displacement test (no map, map as baked, converted vector map) and the cost tables. |
| [`01-pixel-walk-test.html`](examples/01-pixel-walk-test.html) | First test: walks patches in derivative-sized one-pixel steps and measures gaps against a dense reference. Tap-to-inspect zoom, gap causes, copyable report. |
| [`02-row-explainer.html`](examples/02-row-explainer.html) | One patch on a 14 × 14 pixel grid. One row (fixed v) solved exactly against every pixel edge, and the pixel cells drawn in the patch's (u, v) square. |
| [`03-pixel-slices.html`](examples/03-pixel-slices.html) | Pixel grid lines as planes (knives) through the camera, cutting the patch. Shows each pixel's row strip and pixel piece in (u, v), and its corners: closed form (quadratic) for an ellipsoid piece and a bilinear quad, degree 8 for Phong. |
