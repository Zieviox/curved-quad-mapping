# Method guide

One place for the exact methods, in the order the data flows. Each part says what it does in plain words, the exact rule, and its status:
**checked** (built and measured), **replaced** (built, failed, don't use), or **not built** (worked out on paper only).
History and numbers are in [`rnd-log.md`](rnd-log.md); the intent and rules are in [`../CLAUDE.md`](../CLAUDE.md).

```
quads + normals → 1 handles → 2 arcs → 3 S-split → 4 rounded sharp edges → 5 pieces
               → 6 curved triangles → 7 which pixels → 8 pixel corner → 9 quad u, v → 10 coverage and depth
```

## 1. Input and handles — checked (step 8)

- **Plain:** a mesh of quads. Each quad corner has a position and a normal. The normal is a handle: its direction sets which way the surface faces there, its length sets how much the curve bulges.
- **Exact:** 4 positions + 4 face-corner normals per quad, taken as given, not normalized. Smooth vertex = the same normal on every face around it. Sharp edge = different normals on its two faces. A quad may read its neighbours' normals across a shared edge; nothing is solved mesh-wide.

## 2. Arc between two handles — checked (step 9a: gap 0 on every shared edge)

- **Plain:** one ellipse arc from corner to corner, leaving each corner at a right angle to that corner's normal.
- **Exact:** end points P0, P2. End tangent at each end = the chord (P2 − P0) projected onto the plane across that end's normal. Apex A = where the two tangent lines meet. Weight w = L·cos(φ/2), with L the average handle length and φ the angle the tangent turns through.
  Point at t in 0…1: b0 = (1−t)², b1 = 2·w·(1−t)·t, b2 = t², point = (b0·P0 + b1·A + b2·P2) / (b0 + b1 + b2).
- An arc depends only on its own two corners and their normals, so both quads on an edge compute the same arc. Compute it once and share it (arc cache, step 10).
- **Known limit:** handle length × 2 gives w > 1 (hyperbola arcs). The arcs are still valid; the old fill (part 6-old) broke on them.

## 3. S-curves and twists — checked (step 9a: 0 failures)

- **Plain:** if one arc can't do it (the curve has to bend back), put an extra handle in the middle and use two arcs.
- **Exact:** needed when the two tangent lines don't meet in front of both ends. Build the cubic through the two handles (control points P0…P3 from corners and normals). With m = n0 + n1, a = m·(P2 − 2·P1 + P0), b = m·(P3 − 2·P2 + P1): there is an inflection when a·b < 0, at t* = a / (a − b). Put the new point M on the cubic at t* (or at 0.5 if there is no inflection). Its tangent is (T0 × (M − P0)) × (T2 × (P2 − M)), which makes both halves flat arcs that join smoothly. Then part 2 on each half.

## 4. Sharp edges, rounded inside the quad — checked (step 9a: hard cube = exact rounded box)

- **Plain:** a blending distance turns each sharp edge into a small fillet and each sharp corner into a small rounded cap, all inside the quad's own border.
- **Exact:** per vertex, radius r = blending × average length of its edges, and a centre c at distance r from each distinct face plane around it (2 planes: direct; 3 or more: a 3 × 3 least-squares solve). Points used: contact = c + r·n̂(face); fillet middle = c + r·norm(n̂A + n̂B); corner point = c + r·norm(sum of n̂). Arcs between these points by part 2.

## 5. Pieces — checked (step 10)

- **Plain:** after part 4 a quad is cut into an inner piece, half a strip along each sharp edge, and a quarter cap at each sharp corner. A piece whose side got an extra handle (part 3) is cut there too.
- **Exact:** every piece is 4-sided with one arc per side. Each piece covers a known rectangle of the quad's u, v (inner piece: the middle; strips and caps: the margins of width = blending). Keep that rectangle with the piece; part 9 needs it.

## 6-old. One fitted quadric per piece — replaced (steps 9b–17)

Cannot hold 4 arbitrary arcs (two-point rule, step 7). Cracks on general meshes, pieces with no surface inside, per-piece u, v. Still exact and cheap **only** where the four arcs agree with one quadric (sphere, rounded box, extrusions); it may be kept for those pieces as a shortcut.

## 6. Surface inside a piece: curved triangles — not built (step 18e)

- **Plain:** cut the piece along one diagonal arc into two triangles. A triangle's surface is defined by its three arcs alone. Nothing is fitted, so edges always match.
- **Exact:** diagonal arc by part 2 from the two corner handles. For a triangle with corners V0, V1, V2 and arcs {A01, w01}, {A12, w12}, {A20, w20}, and b = (b0, b1, b2) with b0 + b1 + b2 = 1:
  - N(b) = b0²·V0 + b1²·V1 + b2²·V2 + 2·b0·b1·w01·A01 + 2·b1·b2·w12·A12 + 2·b2·b0·w20·A20
  - D(b) = b0² + b1² + b2² + 2·b0·b1·w01 + 2·b1·b2·w12 + 2·b2·b0·w20
  - point = N(b) / D(b). On b2 = 0 this is exactly the arc V0 → V1 with t = b1.
- **Option, 4 triangles:** add a centre point and four arcs from the corners to it. Sits closer to a sphere (about 1% low instead of 3.8% on the smooth cube). How to choose the centre point and its normal is open.
- **Not guaranteed:** smoothness across an edge or the diagonal (only at corners). Not measured.

## 7. Which pixels a triangle touches — crossing rule checked (step 14), use with triangles not built

- **Plain:** the triangle finds its own pixel rows and, on each row, where its arcs cross the row. Pixels between crossings are its span.
- **Exact:** work in camera coordinates (right r, down d, forward z); f = focal length in pixels, (cx, cy) = screen centre. Rows: from the smallest to the largest screen y of the 6 projected control points (the surface lies inside their hull when weights are positive). One arc against the row at screen y, with yc = y − cy:
  h0 = f·d0 − yc·z0, hb = w·(f·d1 − yc·z1), h2 = f·d2 − yc·z2; solve (h0 − 2·hb + h2)·t² + 2·(hb − h0)·t + h0 = 0; keep t in 0…1 (a straight side is linear). Screen x there = cx + f·r(t)/z(t). Sort the crossings; pairs are spans.
- **Open:** where the triangle turns edge-on inside (its outline), the span ends at the outline, not at an arc. No exact rule yet; corners past the outline just have no solution in part 8.

## 8. Pixel corner → point on the triangle — not built (step 18e)

- **Plain:** the vertical grid line through a pixel corner cuts the triangle along one curve, the horizontal grid line along another. Where the two curves meet is the surface point at that corner.
- **Exact:** for each camera coordinate k build the symmetric 3 × 3 matrix M_k: M_k[i][i] = coordinate k of V_i, M_k[i][j] = w_ij × coordinate k of A_ij.
  1. G = f·M_r − (x − cx)·M_z and H = f·M_d − (y − cy)·M_z. Wanted: b with bᵀ·G·b = 0 and bᵀ·H·b = 0.
  2. Cubic in λ: det(H)·λ³ + tr(G·adj(H))·λ² + tr(adj(G)·H)·λ + det(G) = 0. Take a real root (Cardano).
  3. K = G + λ·H is two straight lines. Let Q = −adj(K). If its diagonal is negative: no hit. Else take the largest diagonal entry Q[i][i], p = (column i of Q) / √Q[i][i]. Then K + cross-matrix(p) has rank 1: any non-zero row is one line, any non-zero column is the other.
  4. For each line l: pick two points on it, p1 = l × (the axis l is least aligned with), p2 = l × p1. Put b = p1 + s·p2 into bᵀ·G·b = 0: (p2ᵀGp2)·s² + 2·(p1ᵀGp2)·s + p1ᵀGp1 = 0. Up to 4 points in all.
  5. Keep points whose three b have the same sign (inside the triangle); scale so they sum to 1. Depth = bᵀ·M_z·b / D(b), must be positive. Keep the one facing the camera; if several, the nearest.
- Along a row only x changes: G changes by −M_z per pixel, so the cubic's four coefficients are polynomials in x and can be stepped by additions.
- Neighbouring pixels share corners: one corner solved per pixel.

## 9. The quad's own u, v — not built

- **Plain:** the answer of part 8 is a position inside a triangle; turn it into the piece's u, v, then into the quad's.
- **Exact:** lower triangle (piece corners (0,0), (1,0), (1,1)): u′ = b1 + b2, v′ = b2. Upper triangle ((0,0), (1,1), (0,1)): u′ = b1, v′ = b1 + b2. Quad u, v = the piece's rectangle (part 5) stretched by (u′, v′). Along every arc both sides use the arc's own t, so u, v is continuous across diagonals, pieces and quads, and it is attached to the surface: it cannot slide when the camera moves.
- The screen-drawn edge u, v of steps 13–15 is **replaced**: it slides on anything not flat.

## 10. Coverage and depth — not built for triangles

- **Plain:** a pixel has 4 corners. All 4 on the same quad: fully covered, and the 4 u, v values are its exact footprint in the texture. Some corners off: partly covered; the arc crossings on the pixel's sides (part 7's quadratic, also for vertical sides) say how much.
- **Depth:** keep the nearest per corner. This is the whole occlusion placeholder; nothing else should depend on it.

## Cost, so far

- Model cycles are best case; native measurement of the old pipeline was 1.5–2.3× the model (step 18f).
- Part 8 is one cubic, one square root, two quadratics per corner. Not measured. The only comparable measured method was 146 model cycles.
- Budget: 500 cycles per pixel, memory fetches included. Keep the pixels solved close to the pixels covered: every solved corner pays the full price.

## What to check first when part 6–9 is built

On the mixed cube, 12+ camera angles: gap on every edge and diagonal (expect 0), distance of each solved corner from its pixel, u, v slide under camera motion (expect 0), angle between neighbours' surfaces along edges, float32 against float64, native cycles per corner.
