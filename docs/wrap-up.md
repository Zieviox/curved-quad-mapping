# Wrap-up: where the R&D stands (after step 17)

Saved so the work can resume in a new session. Details and numbers for every step are in [`rnd-log.md`](rnd-log.md).

## The pipeline that works now (example 12, Coverage Check)

Per frame, per piece (closed form, no iteration):

1. **Bulge box.** The box of the piece's edges (projected control points), widened by its outline points. Those are the points where the surface turns edge-on to the camera: the planes through the camera and a screen column (or row) that touch the quadric satisfy πᵀ·C·π = 0, with C the adjugate of the quadric's 4 × 4 matrix (fixed per piece). That's one quadratic per screen axis, and the touch point is C·π. Plus an outline margin in pixels.
2. **Every pixel in the box:**
   - the ray against the piece's quadric: one quadratic, with a, b and the plane terms stepped along the row;
   - take the hit that faces the camera: t = (−b − σ√D)/2a, σ = the quadric's orientation;
   - optional cube fix: the normal at the hit points the piece's way;
   - the 4 side planes → inside or not, then u = s3/(s3−s1), v = s0/(s0−s2), and depth.
3. **Nearest depth kept at write.** Packed output: depth float32, piece 16-bit, u and v 16-bit fixed point (10 bytes per pixel).

**Measured against the answer key** (each piece's surface sampled densely), at the default view: 0 wrong pixels on the smooth cube, rounded box and wave; 170 on the mixed cube (its cracks).

**Cost:**
- about 12 model cycles per pixel walked (Skylake float32, packed);
- about 2× more pixels walked than covered;
- about 20 ns per pixel in the browser at 1000².

## Decisions made

- The mapping is per frame (u, v don't need to stay fixed between frames).
- **Edge-based u, v (steps 13–15) is dropped.** It's exact on the edges only; inside, it slides 38% of an edge on average and breaks completely on folded pieces.
- u, v and depth come from the surface: ray × quadric + side planes (exact).
- Per-pixel facing picks the hit. The forward-map check fails in float32; the sign rule fails on pieces that turn away partway.
- Packed flat array per piece, ordered by use; nothing is read inside a span.
- Nearest depth at write. Per-pixel lists are a backup note only: count per pixel → running sum → contiguous blocks.

## Open items, in order

1. **Option 2: the outline conic as an extra edge.** Seen from the camera, the quadric's outline is a planar conic (quadric ∩ polar plane of the eye), so its projection is a conic. Adding it to the row crossings would make the spans exact, walking only covered pixels instead of the whole box.
2. **The cube fix (normal agrees with the piece)** is in, as a toggle, but has had no visible effect so far. The antipode tie it targets didn't show up once the check was corrected; keep it until a case needs it, or drop it.
3. **Mixed cube:**
   - 170 wrong pixels (cracks: one quadric can't hold 4 incompatible edges);
   - 430 pixels with no hit under per-pixel facing.
   - Ideas: split further, the hybrid seam handling, or a better fit.
4. **Length × 2 (hyperbolic arcs):** pieces with no surface inside (step 12, problem 2).
5. **float32:** check the whole new pipeline in float32. The stress test's generator already builds float32 kernels; add the bulge box and per-pixel facing rows.
6. **Odin prototype:** port the packed kernels (`tools/stress-kernels.src.js`, functions `spanRay`, `crossRowP`, `pointAtP`) and the bulge box.
7. Wave seam band and the remaining smooth-cube band: **resolved**. They were a measurement artifact (the answer key kept the nearest sample in a pixel, not the pixel centre).

## Where things are

- Pages: `examples/` 00–12. The current one is `12-coverage-check.html`; the measurements are in `11-op-stress-test.html`.
- Kernels (written once): `tools/stress-kernels.src.js`. Generator for the float32 and counted versions: `tools/gen-kernels.js`.
- Log: `docs/rnd-log.md` (steps 1–17). Screenshots: `docs/img/`.
