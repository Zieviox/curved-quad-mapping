# curved-quad-mapping

R&D for a CPU-only, closed-form mapping between curved quad patches and screen pixels: `(quad, u, v) ↔ (pixel x, pixel y)`. No frame buffer and no GPU. The output feeds a spatial occlusion system. The final prototype will be written in Odin.

**Live pages:** https://zieviox.github.io/curved-quad-mapping/ (needs GitHub Pages: Settings → Pages → deploy from `main`, folder `/`).
GitHub itself shows HTML files as source code, so each example below also has a **Preview** link through [htmlpreview.github.io](https://htmlpreview.github.io), which runs it straight from the repo (public repo only).

- [`docs/rnd-log.md`](docs/rnd-log.md): every step in order: what was tried, the numbers, what was decided.
- [`examples/`](examples): one standalone HTML page per step. Works in any browser, phone or desktop.
- [`index.html`](index.html): the same steps as a gallery page.

![Gallery of the R&D steps](docs/img/gallery.png)

## Steps

### 0 · Surface lab — [Preview](https://htmlpreview.github.io/?https://github.com/Zieviox/curved-quad-mapping/blob/main/examples/00-curved-quad-lab.html) · [Source](examples/00-curved-quad-lab.html)

Nagata, Phong, PN-quad and the ellipsoid variants side by side against a Catmull-Clark target, with the displacement-map test and the cost tables. The ellipsoid views were added in steps 4–6.

![Surface lab on the wave mesh](docs/img/00-lab.png)

### 1 · Derivative-step walker (dropped) — [Preview](https://htmlpreview.github.io/?https://github.com/Zieviox/curved-quad-mapping/blob/main/examples/01-pixel-walk-test.html) · [Source](examples/01-pixel-walk-test.html)

Walks each patch in steps of about one projected pixel and measures gaps against a dense reference. It leaves gaps (2.54% on the cube at 256²). Fixing them nearly doubles the work. Dropped for an exact mechanism.

![Pixel walk test: pixel map and gap inspector](docs/img/01-walk-test.png)

### 2 · Exact crossings along a row — [Preview](https://htmlpreview.github.io/?https://github.com/Zieviox/curved-quad-mapping/blob/main/examples/02-row-explainer.html) · [Source](examples/02-row-explainer.html)

A pixel edge is a plane through the camera. Where a patch row crosses it is a quadratic for Nagata and Phong. That's exact along a row, but rows are 1D.

![Row explainer: screen and (u, v) square](docs/img/02-row-explainer.png)

### 3 · Pixel grid as knives — [Preview](https://htmlpreview.github.io/?https://github.com/Zieviox/curved-quad-mapping/blob/main/examples/03-pixel-slices.html) · [Source](examples/03-pixel-slices.html)

Each pixel edge slices the patch. A pixel corner on the patch has a closed form (a quadratic) on a quadric or a bilinear patch. On Phong and Nagata it's degree 8, so no closed form.

![Pixel slices: knives in 3D and the pixel's piece in (u, v)](docs/img/03-pixel-slices.png)

### 4–6 · Ellipsoid quads, S-split, neighbour trim — in the [surface lab](examples/00-curved-quad-lab.html)

- **4:** one quadric per quad, fitted to its corners and normals. Pixel corner → (u, v) is two quadratics.
- **5:** S-bends from an artificial point where an edge inverts, with one quadric per side. Pixel corner: 29 cycles per piece.
- **6:** trimming at the neighbour's crossing. Failed: neighbours that share normals touch at the corners instead of crossing.

Details and numbers are in the [R&D log](docs/rnd-log.md).
