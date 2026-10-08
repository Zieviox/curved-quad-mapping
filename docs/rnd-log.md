# R&D log

Newest entries at the bottom.

**Closed form, as used here:** a fixed recipe with a fixed, known number of operations. Solving a fixed-size linear system (Gauss elimination, a quadratic formula, Cardano) counts. Anything that repeats until the error is small enough (Newton's method) doesn't; it appears only where a page draws something for display and says so. Costs use the Skylake float32 scalar table from the original handoff (ADD/MUL/FMA latency 4, throughput 0.5; SQRT 12/3; DIV 11/3).

## Starting point

- Surfaces: Nagata, Phong (α = 0.75) and PN-quad patches built from 4 corners + 4 vertex normals, all polynomial in (u, v).
- Original direction: surface → pixel, walking (u, v) in steps sized from the local derivative so each step moves about one pixel.
- Pixel → surface (a ray through a pixel vs the patch) was ruled out: no closed form (see "Degrees" below).

## 1. Derivative-step walker (example 01)

Step size at the current (u, v): screen speed along u is `f·|(Xu·Z − X·Zu, Yu·Z − Y·Zu)| / Z²` pixels per unit u, so `du = 1 / speed`. Same for v; rows advance by the smallest `dv` seen on the row.

Measured (cube, Phong, 256², back-face reject on, desktop Chromium):

| Safety | Edge snap | Gaps | Interior | Border | Sliver | Overdraw |
|---|---|---|---|---|---|---|
| 1.0 | off | 782 (2.54%) | 472 | 167 | 134 | 1.46 |
| 0.7 | off | 218 (0.71%) | 0 | 105 | 113 | 2.92 |
| 0.7 | on | 88 (0.29%) | 0 | 0 | 88 | 2.94 |

Findings:

- One-pixel steps along u and along v don't bound the diagonal spacing between rows, so pixels get skipped. 0.7 (about 1/√2) removed every interior gap in all 12 mesh/surface/safety combinations tested.
- The step is a local, straight-line guess. It can overshoot on curved surfaces.
- At silhouettes the screen speed drops to 0, so the step grows instead of shrinking.
- On the cube, Nagata and Phong (α = 0.75) give the same surface.

Decision: the derivative step was an early test. Safety factors and edge snapping are error-covering and are dropped. Focus on an exact core mechanism.

## 2. Exact crossings along one row (example 02)

A pixel edge (screen line `x = k` or `y = k`) is a plane through the camera. On a row (fixed v) the curve's X, Z are polynomials in u, and the crossing `f·X(u) − (k − cx)·Z(u) = 0` has the same degree as the row curve:

| Surface | Row curve in u | Crossing |
|---|---|---|
| Nagata, Phong | degree 2 | quadratic formula |
| PN-quad | degree 3 | cubic formula |

This gives the exact u interval of every pixel the row passes through. Cost per crossing (Nagata/Phong, one new line per crossing, divides merged): 4 ADD, 4 MUL, 1 FMA, 1 SQRT, 1 DIV, 3 COMISS, 1 sign-bit op, 1 MIN. That is 6.5 cycles of ALU throughput, 6 cycles on the divider, and a 54-cycle latency chain.

Limit: a row is a 1D line, so it only touches the pixels it crosses. Choosing which v values to use is still open.

Side result: a ray (point + direction) vs an ellipse or ellipsoid is a quadratic. Stretch space so the ellipse becomes a unit circle, then intersect a line with the circle. The forward hit costs 3 ADD, 7 MUL, 7 FMA, 1 SQRT, 1 DIV, 1 COMISS, with a 51-cycle latency chain.

## 3. Pixel rows and columns as slices (in progress)

Proposal: iterate over the **pixel** rows and columns instead of patch rows. Every pixel grid line is a plane through the camera, and it slices the patch along a curve. A pixel row is the strip of the patch between two horizontal slices. A pixel is the piece between two horizontal and two vertical slices.

### Degrees

Each slice is a curve in (u, v): `f·X(u,v) − s·Z(u,v) = 0`. For Nagata and Phong it is degree 2 in u and degree 2 in v. At any fixed v the curve gives u from a quadratic, and at any fixed u it gives v from a quadratic, so tracing one slice is closed form.

Where a horizontal slice meets a vertical slice is a pixel corner on the patch. That is the ray through the corner hitting the patch. Two curves of degree (a, b) and (c, d) in (u, v) meet at most `a·d + b·c` times:

| Patch | Degree in (u, v) | Corner equation | Closed form? |
|---|---|---|---|
| Flat bilinear quad | (1, 1) | 2 | yes, quadratic |
| Quadric (sphere, ellipsoid, …) | — | 2 | yes, quadratic; every slice is a conic |
| Nagata, Phong | (2, 2) | 8 | no |
| PN-quad, B-spline | (3, 3) | 18 | no |

Example 03 shows this for Phong, an ellipsoid piece and a twisted bilinear quad, with all three in the same camera:

- **Ellipsoid piece:** a corner is a ray vs ellipsoid. Stretch space so the ellipsoid is a unit sphere, solve the quadratic in t, then get (u, v) back from the hit point's angles.
- **Bilinear quad:** a corner is two knife planes, each giving `A + B·u + C·v + D·uv = 0`. Eliminating u leaves a quadratic in v.
- **Phong:** corners are found with Newton's method, only for drawing.
- **Check:** for the ellipsoid and bilinear patches, every closed-form corner of every covered pixel lands within 1e-14 px of the true pixel corner when reprojected (124 and 100 corners).

Open question: is the target exact pixel corners (needs a quadric or bilinear patch), or exact slices without corners?

## 4. Ellipsoid quad from corners and normals (example 00)

The surface lab (example 00) gets a fifth surface: one quadric per quad, `Q(x) = x·A·x + g·x + k`.

- **Fit:**
  - Hard constraints: passes through the 4 corners.
  - Least-squares targets: gradient parallel to each vertex normal (2 conditions per corner, 8 in total).
  - Scale fixed by trace(A) = 1.
  - Solved as one 15 × 15 linear system: fixed size, no iteration. As implemented (plain Gauss-Jordan), that's 210 DIV and about 2,300 FMA per quad, run only when the mesh changes.
- **Patch point:** the bilinear base point pushed onto the quadric. When the fit is an ellipsoid, the push follows the ray from the quadric's center. Otherwise it follows the quad's averaged normal, taking the nearest root.
- **Pixel corner → (u, v):** both steps are closed form.
  1. The camera ray hits the quadric: a quadratic.
  2. The ray from the center (or along the fixed direction) through that hit meets the bilinear base: another quadratic.
- **Displacement:** all three lab modes work on it unchanged (no map, map as baked along its own normal, converted vector map).

Measured (error vs the Catmull-Clark target, % of average cage edge):

| Mesh | Fit | Normals off (max) | No map | Map as baked | Converted |
|---|---|---|---|---|---|
| Cube | 6/6 ellipsoids (one shared sphere, radius √3) | 0.0° | max 55.1, mean 43.1 | max 43.9, mean 43.1 | 0.0 |
| Wave | 0/8 ellipsoids | 38.6° | max 44.4, mean 21.9 | max 36.1, mean 20.8 | 0.0 |

Findings:

- **Normals as handles:** a quadric has 9 degrees of freedom. 4 corners + 8 normal conditions = 12, so the normals are matched exactly only when all four agree with one quadric. That holds on the cube: every face lands on the same sphere, so it is also watertight there.
- **Wave:** peak and trough normals are parallel, so the best fit degenerates to two flat planes (the peaks' plane and the troughs' plane). The patch becomes a step with near-vertical walls. This is the same parallel-normal weakness as Nagata and Phong, in a different form.
- **Cracks:** each quad has its own quadric, so neighbours only meet along an edge if they share the quadric. Every cut is a conic, so there are no S-bends.
- **More room, still closed form:** a ray hits an implicit surface of degree n in a degree-n equation. That is closed form up to degree 4 (quadratic, Cardano, Ferrari). A cubic surface has 19 degrees of freedom and a quartic 34, enough to match all 4 normals exactly and leave room for edge conditions with neighbours.

## 5. S-curves by splitting at the inflection (example 00)

Idea: where a curve starts to invert, add an artificial point, and give the inverted part its own quadric.

- **Where:** each quad edge gets its PN cubic, built from its 2 corners + 2 normals. Its inflection is where the curvature along the averaged normal `m = n0 + n1` changes sign. `m·B''(t)` is linear in t, so `t* = a / (a − b)` with `a = m·(P2 − 2P1 + P0)` and `b = m·(P3 − 2P2 + P1)`. There is an inflection when `a·b < 0`. This is closed form, one DIV.
- **Artificial point:** the cubic at t*. Its normal is the interpolated normal with the tangent part removed. It uses edge data only, so both quads on an edge get the same point.
- **Split:** cut along the line between the artificial points: 2 pieces, or 4 when both directions inflect. The centre point of a 4-way split comes from the PN-quad. Each piece gets its own quadric. Piece (u′, v′) → quad (u, v) is closed form.

**New finding (applies to every quadric fit):** corners and normals do not pin down a quadric. On coplanar corners, `Q + k·M²` (M = the plane through the corners) fits all of them exactly for every k, and so do two flat planes. The first wave fit landed on two planes, which gave the staircase. The fit now adds a weak shoulder point (PN-quad midpoint, weight 0.1) that picks one member of that family.

Measured after the shoulder rule (error vs the Catmull-Clark target, % of average cage edge, no map):

| Mesh | Ellipsoid quad | Ellipsoid + S-split |
|---|---|---|
| Cube | max 57.3, mean 45.6 · normals 0.0° · 6/6 ellipsoids · faces crease (no longer one shared sphere) | same (no inflections, no split) |
| Wave | max 31.5, mean 12.9 · normals off ≤ 30.2° · 0/8 ellipsoids · nearly straight | max 37.0, mean 16.9 · 8 quads → 16 pieces · normals 0.0° · real S-curve |

- The S-split matches every normal exactly on the wave and shows the S. Its pieces are cylinder-like quadrics, not ellipsoids, which is expected for an extruded profile.
- The shoulder rule costs the cube its shared sphere. Each face now picks its own ellipsoid, so the faces crease where they meet. Which point the shoulder comes from is a design choice; the PN-quad midpoint is just the first one tried.

### Cost: pixel-corner pipeline (per piece, Skylake throughput)

| Stage | Runs | Ops | Cycles |
|---|---|---|---|
| 1. Fit quadric | piece × mesh change | 53 ADD, 428 MUL, 2189 FMA, 8 SQRT, 21 DIV, 114 COMISS | 1,407 |
| 1a. Shoulder source (PN build + 1 point) | quad × mesh change | 132 ADD, 56 MUL, 157 FMA | 173 |
| 1b. Inflection test | edge × mesh change | 13 ADD, 5 MUL, 26 FMA, 1 DIV, 1 COMISS | 23 |
| 1c. Artificial edge point | inflected edge × mesh change | 11 ADD, 24 MUL, 27 FMA, 1 SQRT, 2 DIV | 33 |
| 1d. Centre point (4-way split) | quad × mesh change | 14 ADD, 9 MUL, 94 FMA, 1 SQRT, 2 DIV | 61 |
| 2. View transform | piece × frame | 7 ADD, 18 MUL, 36 FMA | 31 |
| 3. Pixel-row setup | piece × pixel row | 2 ADD, 3 MUL, 19 FMA | 13 |
| **4. Pixel corner** | piece × corner | 8 ADD, 19 MUL, 20 FMA, 2 SQRT, 3 DIV, 6 COMISS, 5 logic | **29** (ports), **39** if latency-bound |
| 4s. Split mapping | corner on a split quad | ≤ 2 SUB, 6 MUL, 3 FMA, 1 DIV | 3 (1-way) / 7 (4-way) |

- **Pixel corner:** 137-cycle latency chain, 63 uops, so 3.5 corners fit in a 224-entry reorder buffer. A corner on a split quad is tried on each piece until one accepts it.
- **Comparison:** the step walk needed about 76 cycles per covered pixel (26 per step × 2.92 pairs per pixel at safety 0.7) and still left sliver gaps.

## 6. Neighbour trim, option A (example 00) — fails

Goal: no cracks between pieces. Each piece keeps its own quadric, and its border becomes the line where its quadric crosses the neighbour's.

- **Rule:** near each side, a point stays on this piece only if it is on this piece's side of the neighbour's shape.
  - Convex edge → keep it outside the neighbour (union).
  - Concave edge → keep it inside the neighbour (intersection).
  - Convexity is the sign of `(c_B − c_A)·(n_B − n_A)`. Both pieces use the same rule, so in theory they meet exactly.
- **Required fix (worth keeping):** a quadric is a whole closed (or infinite) shape. A neighbour's far side reached over the middle of this piece and cut it. The test now applies only where the point maps back into the neighbour's own patch area (inverse map: one quadratic, same as the pixel corner).
- **Measured:**
  - Cube: 7.4% of grid points owned by a neighbour, 796 margin hits.
  - Wave: 10.6% owned by a neighbour, 1151 margin hits.
  - Both show holes and ribbons. Adding the edge midpoints from the PN cubic as extra fit targets (weights 0.3–3) changed nothing.
- **Why it fails:** neighbours that match the shared vertex normals are tangent at the shared corners, so there they touch instead of cross. Between the two corners, one shape usually stays above the other, so no crossing line runs along the edge. The cleaner the normals, the worse this gets.
- **Cost if it had worked:** a neighbour test is the inverse map plus one quadric sign check, about 31 cycles. There are up to 2 tests per pixel corner near an edge.

Result: dropped. Watertight pieces need shared edge curves (each shared edge one exact curve that both pieces contain). One curve fixes 5 of a quadric's 9 numbers, so that needs more pieces per quad, as in Dahmen's piecewise quadrics.

## 7. Literature check: shared edge curves

Goal: every quad edge carries one exact curve, and both neighbouring pieces contain it, so there are no cracks.

**Rule (confirmed):** two conics in different planes lie on one quadric only if they meet the line where their planes cross at the same two points. Cayley states the "if" direction ("touching conics … have two points of intersection, and consequently lie on the same quadric surface"). The converse follows by restricting the quadric to that line.

So two edge curves that meet only at their shared corner can't sit on one quadric. A single quadric per quad can't hold all four of its edge curves. The pieces have to be split.

What the literature does (from abstracts and citing papers; the full texts weren't reachable from here):

| Work | Pieces | Notes |
|---|---|---|
| Dahmen 1989, "Smooth piecewise quadric surfaces" (Lyche & Schumaker eds., pp. 181–193) | each face split into micro quadric patches, Powell-Sabin style | Tangent-plane continuous and interpolates the vertices. Exact piece count not confirmed. Standard Powell-Sabin splits give 6 or 12 pieces per triangle. |
| "Representation of arbitrary shapes using implicit quadrics" (Springer, BF01908449) | 1 per triangle, no split | Only if the prescribed tangent planes satisfy a condition, not visible in the abstract. Then a local construction exists. |
| Bajaj & Ihm 1992, "Smoothing polyhedra using implicit algebraic splines" | 1 per face | Implicit surfaces of degree up to 5. A ray vs degree 5 has no closed form. |
| Bajaj et al., A-patches (cubic implicit patches) | 1 per face (triangle) | Degree 3, so a ray hit is a cubic, which has a closed form (Cardano). |
| 2025, "What smooth surfaces can be constructed from total degree 2 splines?" (CAGD) | — | Warns that the least-degree Powell-Sabin polynomial construction already fails to give G1 surfaces on an octahedron. |

What this means here, counted on our own quads (triangle-based methods need each quad cut into triangles first):

- **Quadric pieces, split:** 2 or 4 triangles per quad × 6 (or 12) pieces each = 12 to 48 pieces per quad. Per pixel corner it stays 29 cycles, plus a cheap test to pick the piece. The fit cost scales with the piece count. The construction details need the Dahmen chapter.
- **No-split quadrics:** the condition on the tangent planes is unknown. It might rule out our free vertex normals.
- **One cubic implicit patch per face:** fewer pieces, and the ray hit is still closed form (Cardano), but each pixel corner costs more. Not counted yet.

## 8. Design decisions: handles, arcs, blending (agreed, not built yet)

- **Input:** quads only. Each quad has 4 corner positions and 4 face-corner normals, taken from the source as they are. Smooth vertices simply have identical normals on every face corner; sharp edges have different ones.
- **No mesh-wide steps:** each quad is built on its own. It may read a neighbour's corner normals across a shared edge, but nothing global (no topology edits, no global solves).
  - *Note for later (optimization, not a limit on the design):* neighbour reads should become a packed/cached layout, e.g. shared per-edge data stored once and read by both quads.
- **Normals are not normalized.** The direction is the handle direction (sets the tangent); the length is the handle reach (how far the curve bulges near that corner). Formulas that assume unit normals (`(d·n)·n`) get rewritten to use direction and length separately.
- **Curves:** between every two handles there is an ellipse arc (a conic). Two end points plus two end tangents leave exactly one free number, the bulge, and the handle lengths set it.
- **S-curves:** where an arc would curve back, place an artificial handle at the exact inflection and split into two arcs (step 5's rule).
- **Blending (bevel inside each quad):**
  - A blending distance (user-controlled; default tiny, so almost sharp with faintly rounded edges) shifts the quad's handles inwards along its edges.
  - The quad then holds an inner piece, its half of each edge strip, and its quarter of each corner piece, all inside its own border. On a sharp edge, both quads read both normals and build the same fillet arc, so the border matches.
  - Check case: a cube with blending should come out as an exact rounded box (flat faces, quarter-cylinder strips, sphere-octant corners), crack = 0.
- **Open:**
  - Cracks: does each piece's quadric contain all its border arcs exactly? (Two-point rule.)
  - At a sharp vertex shared by 4 quads, the corner point depends on all 4 face normals, but a quad only shares an edge with 2 of them.

## 9a. Border network: handles and arcs (example 04)

Built from step 8's design. Each quad works alone and reads its neighbours' normals only so that shared borders agree.

- **Arc between two handles:** a rational quadratic (conic) with end points P0, P2, apex A (where the end tangents meet) and weight `w = L·cos(φ/2)`, where L is the average handle length and φ is how far the tangent turns. With L = 1 and equal sides it is a circular arc. End tangents are the chord projected onto each handle's tangent plane.
- **Split:** if the tangent lines don't meet in front of both ends (S-curve or twist), one artificial handle is placed on the handle cubic: at its inflection if it has one, otherwise halfway. Its tangent is `(T0 × (M−P0)) × (T2 × (P2−M))`, the only direction lying in both end planes, so each half is a flat conic and the halves meet smoothly.
- **Sharp edges with blending:**
  - Each vertex gets a rounding radius `r = blending × average incident edge length` and a centre c at distance r from every distinct tangent plane around it. Two planes have a closed form; three or more use a 3 × 3 least-squares solve.
  - Points used by each quad: contact = c + r·n̂(this face); fillet middle = c + r·norm(n̂_A + n̂_B); corner point = c + r·norm(Σ n̂).
  - Each quad then holds: an inner piece, a half edge strip per sharp edge, and a corner quarter per sharp vertex.

Checks (all closed form, every mesh and setting tried):

| Check | Result |
|---|---|
| Shared borders: gap between the two quads' curves | 0 on every edge (cube, hard cube, mixed cube, wave; blending 0 / 3% / 25%; length × 1 / × 2) |
| Hard cube, length 1: distance from the exact rounded box | 0 at every blending |
| Smooth cube, length 1: distance of the borders from the sphere of radius √3 | 0. This is the route back from the step-5 cube regression: the arcs give the sphere with no extra rule. |
| Length × 2 | bulges more, as intended (smooth cube: 0.121 off the sphere) |
| S and twist splits | mixed cube 8, wave 16, failures 0 |

Next (9b): fill each piece with an ellipsoid that follows its border arcs, then measure the cracks.

## 9b. Pieces: one quadric per piece, fitted to its border arcs (example 04)

- **Pieces per quad:** an inner piece, an edge-strip half per sharp edge, and a corner quarter per sharp vertex. Zero-size pieces (no blending) are skipped.
- **S rule on pieces:** an artificial handle on a side also splits the piece, so each part gets its own ellipsoid. If the opposite side has no handle, its conic is cut exactly in the middle (homogeneous de Casteljau) to give a matching point. A piece that needs a split in both directions isn't supported yet and is counted.
- **Fit:**
  - Hard constraints: the piece's corners.
  - Least-squares targets: 5 points along each border arc (Q = 0) and the corner handle directions.
  - Scale fixed by trace(A) = 1. One fixed-size solve.
  - The piece surface is its bilinear base, pushed onto the quadric (from the centre for ellipsoids, else along the averaged handle direction).
- **Crack:** the largest two-way distance between the edge of a piece's surface and its border arc. Neighbours share the arcs, so this bounds the gap between pieces. Values under 0.001% are the measurement floor (dense polylines).

Measured (blending 3%):

| Mesh | Length × 1 | Length × 2 |
|---|---|---|
| Smooth cube | 6 pieces, all ellipsoids (the sphere), crack 0.00054% (floor) | crack 21.9%, push misses |
| Hard cube | 54 pieces (rounded box), crack 0.00048% (floor) | crack 0.309%, push misses |
| Wave | 16 pieces (S-split), crack 0.0025% | 0.0049% |
| Mixed cube | 18 pieces, crack **36.2%** | 52.1% |

**Finding:** a piece has 4 border arcs, and one quadric can hold all 4 only when they're compatible (two-point rule). Box, sphere and wave borders are compatible, or nearly. On the mixed cube's lower side pieces (diagonal handles below, horizontal above) they aren't, and the best single quadric misses by 36% of an edge. Lengths other than 1 hit the same wall.

**Open (asked):** how to fill pieces whose border arcs don't fit one quadric.

### 9c. Drawing fix: the plane-pencil mapping

The first drawing flattened each piece to its straight-edged corner quad and pushed it onto the quadric. Straight edges pushed like that don't land on curved border arcs. On the mixed cube's worst piece the arcs were only 6.8% from the quadric, but the drawn edge was 36% off.

New mapping, still closed form:
- Every border arc lies in a plane. u blends the planes of the u = 0 and u = 1 arcs, and v blends those of the v = 0 and v = 1 arcs.
  - A straight side uses the plane through it and the surface normal (the handle direction where the slope is ~0, as on a doubled plane).
  - A collapsed side uses the tangent plane.
- Forward (u, v) → point: the two blended planes meet in a line, and the line hits the quadric in a quadratic. Of its two hits, take the one closer to a Coons blend of the 4 border arcs. That blend is only a reference for picking, never drawn.
- The u = 0/1 and v = 0/1 curves are then exactly the border arcs, whenever the arcs lie on the quadric.
- A line that misses the quadric is drawn as a hole and counted; nothing hides it.

Measured after the fix (blending 3%):

| Mesh | Length × 1 | Length × 2 |
|---|---|---|
| Smooth cube | crack 0.00054% (floor) | borders 0.0012%, but piece interiors miss the quadric (222 holes, spikes) |
| Hard cube | 0.00048% (floor), no holes | holes at the corner pieces |
| Wave | 0.0021% | 0.0048% |
| Mixed cube | **8.35%** (fit error 6.8%) | 13.7% |

**Pixel pipeline effect (counted, not built yet):** going back from a hit point to (u, v) becomes 4 plane values, updated by forward differences along the pixel row, plus one shared reciprocal. That replaces the second quadratic.
- Per pixel corner per piece: 13 ADD, 4 MUL, 5 FMA, 1 SQRT, 2 DIV, 5 COMISS → **15 cycles** (was 29). Latency chain 69 cycles; about 32 uops, so 7 corners fit in the reorder buffer.
- Pixel-row setup gains 4 MUL and 8 FMA per piece.

Also: the surface lab (example 00) now opens in Converted displacement mode.

## 10. Clean-slate conversion and "split further" (example 05)

The conversion (quads → arcs → pieces → surfaces) was rewritten from scratch. The math was copied unchanged from example 04: arcs and their splits, conic halving, fillet points, the fit, the plane-pencil mapping.

New structure:
1. Lookups (a quad may read anything).
2. Vertex rounding.
3. **Arc cache:** one curve per pair of handles, computed once, so every piece using it gets the identical curve. This is also the first piece of the caching note from step 8.
4. Quad → pieces (inner, edge-strip halves, corner quarters).
5. Splits: first at artificial handles (original pieces only), then **further**. A piece whose crack is above the measurement precision is cut across the middles of two opposite sides (alternating directions). The cut is an arc between the two new handles, up to a depth limit.
6. Measurement: edge crack, holes (lines that miss the quadric, counted at every sampled point), and spikes (interior points farther from the piece's arc blend than the piece's own size).

Crack below 0.001% of an edge counts as closed: that's the precision of the measurement.

| Mesh | Length × 1 | Length × 2 |
|---|---|---|
| Smooth cube | closed (0.00043%) | edges closed (0.00034%), but 126 holes inside the pieces |
| Hard cube | closed (rounded box) | holes in the corner pieces |
| Wave | closed (0.00023%) | closed (0.00028%) |
| Mixed cube | depth 0: 8.35%, depth 1: **3.44%**, depth 2+: holes | holes at every depth |

Findings:
- The clean conversion fixed the smooth cube at length × 2 *along the edges* (04 had a 21.9% crack there). The insides still have holes.
- Splitting further helps once (mixed cube 8.35% → 3.44%), then smaller pieces start to get fits the lines miss (holes).
- Splitting can't make a piece exact where it keeps two arcs that meet only at its corner (two-point rule); it only makes that piece smaller.
- Chaining artificial-handle splits on the new cut arcs made the piece count explode (728 at depth 2). They now apply to the original pieces only.

Status: stuck on exactness for incompatible borders, as agreed: move on. Example 05 defaults to depth 1.

### 10b. Lab update

- **Old ellipsoid views (single, S-split, trim):** when the push misses the quadric, the lab used to fall back silently to the flat quad point. It now leaves a hole: cells touching it aren't drawn, error is measured only where there is a surface, and misses are counted.
- **New view "Ellipsoid pieces (handles & arcs, step 10)":** example 05's conversion, embedded unchanged as a module (blending 3%, split depth 1). It works in all three displacement modes. "Map as baked" takes the quad (u, v) of each piece corner from the quad's flat base. Pieces have their own (u, v), so this view's error is the distance from each target point to the nearest point on the surface.
  - Cube: the sphere, mean 43.1% / max 54.8% (no map), edge crack 0.
  - Wave: mean **12.2%** / max 27.9% (no map), mean 10.3% (map as baked), edge crack 0. That's the lowest mean of all surfaces in the lab.

## 11. Pixel corners → (piece, u, v) (example 06)

The first pixel pipeline for the current design. The pieces come from step 10 unchanged; one added line hands each piece's fitted quadric and its 4 side planes to the pixel step.

- **Per pixel corner:**
  1. A ray from the camera.
  2. For every piece whose screen box contains the corner: ray vs the piece's quadric, one quadratic.
  3. The 4 side planes decide whether a hit is inside the piece and give (u, v) directly.
  4. The nearest in-piece hit wins.
  Neighbouring pixels share corners: one corner per pixel.
- **Far sheet:** the wedge between a piece's planes can cut its quadric twice, e.g. the back of a sphere. A hit is kept only if the piece's own forward map at that (u, v) lands on it. That costs one forward evaluation per accepted hit in this test page; a cheaper rule (such as a sign test) is open.
- **Reference:** the same pieces projected densely, about 4.5 samples per pixel along each piece's longest side, giving 4 × 4 sub-pixel coverage.
  - **Hole:** a corner inside the footprint (all 4 surrounding pixels fully covered) that hits nothing. A crack, as the pixels see it.
  - **Interior gap:** a pixel inside the outline with no corner hit.
  - **Outline gap:** a pixel on the outline where the surface's tip passes between the corners. That's the limit of sampling at corners.
  - A **12-view check** orbits the camera, since a crack only shows when it opens toward the camera.

Results (128², or 64² for the 12-view check; blending 3%, hard cube 10%):

| Mesh | One view | 12 views: holes | Holes inside pieces (sampled points) |
|---|---|---|---|
| Smooth cube | 0 holes, 0 gaps | 0 of 22,716 corners | 0 |
| Hard cube (rounded box) | 0 holes, 0 gaps | 0 of 13,164 | 156, at collapsed piece corners |
| Wave | 0 holes, 0 interior gaps, 3 outline gaps | 0 of 6,942 | 0 |
| Mixed cube, depth 1 | 0 holes, 1 outline gap | **14 of 19,252** (its 3.44% cracks) | 0 |
| Mixed cube, depth 0 | 0 holes | 35 of 19,952 | 34,010 |
| Smooth cube, length × 2 | 0 holes | 0 of 9,740 | 250,420: piece interiors have no surface |

Cost:
- Pieces tested per corner after screen-box culling: 0.8 (wave) to 2.2 (hard and mixed cube).
- Using step 9c's 15 cycles per tested piece, that is about **12–34 cycles per corner**, i.e. per pixel.
- In this browser (JavaScript float64, including the far-sheet check): 560–1,150 ns per tested piece. Only good for comparing settings.

Open:
- Cracks where a piece's arcs don't fit one quadric (mixed cube).
- Pieces with no surface inside (length × 2).
- A cheaper far-sheet rule.
- How pixels use the (u, v) of their 4 corners downstream (the occlusion system).

### 11b. Occlusion map, and a depth bug it exposed

- **Occlusion map** (your design): one cell per pixel, starting at 0 (empty).
  - Each piece, in any order, writes the normalized distance of its nearest corner hit in each pixel it covers: `(t − near) / (far − near)`, with near/far from a sphere around the mesh.
  - A write lands only if the cell is empty or farther (the depth pass). t is view depth, because the ray direction has a forward component of exactly 1.
  - Mip chain: each coarser cell keeps the **farthest** of its 4 children, with empty counting as farthest. Anything behind a cell's value is hidden for sure.
  - Rounded box at 128²: 5,118 cells written, 12,042 depth tests, 3,657 writes lost to something nearer, 8 mip levels (128² → 1²).
- **Bug found by the map:** hit distances were computed in each piece's own scaled local units. Small pieces (scaled up about 10×) reported t ≈ 48 instead of ≈ 5 and lost the "nearest wins" test, so the back of the cube showed through at its front corner.
  - Fixed by scaling the ray direction with the piece, so every t is in world units.
  - Step 11's hole counts were unaffected (they count misses). Which piece counted as nearest was wrong before the fix.
- **New check, see-through pixels:** a fully covered pixel whose mapped surface is more than 10% of the scene depth behind the nearest reference surface. The front is missing and something behind shows through; coverage alone can't see this.

12 views, after the fix:

| Mesh | Holes | See-through pixels |
|---|---|---|
| Smooth cube | 0 of 22,716 | 0 |
| Rounded box | 0 of 13,164 | 0 |
| Wave | 0 of 6,942 | 0 |
| Mixed cube, depth 1 | 14 of 19,252 | 2 |
| Mixed cube, depth 0 | 35 of 19,952 | 40 |
| Smooth cube, length × 2 | 0 of 9,740 | 8 |

## 12. Open problems explained (example 07)

Three pictures, the first two computed live from the real pieces:

1. **Cracks** (mixed cube, depth 0). Piece A's real edge leaves the shared arc by up to 8.35% of an edge; its neighbour B stays within 0.37%. Each piece's single ellipsoid can't hold all 4 of its arcs (two-point rule), and the two neighbours miss the shared arc differently, which opens the gap.
2. **No surface inside** (smooth cube, length × 2). Arc weights above 1 make every arc a hyperbola piece. The best quadric through 4 such arcs has two branches with empty space between them, and the piece's middle runs through that space. 69 of 81 sample points have no surface, and 3 of 5 lines through the middle miss.
3. **Far side** (2D diagram). A piece's side planes don't meet at the quadric's centre, so the region between them widens with depth and also contains the far hit.
   - Current fix: run the forward map at the hit's (u, v) and compare. That's one extra line-vs-quadric per accepted hit.
   - Candidate cheap rule, not yet tested: the sign of ∇Q · (pencil line direction) at the hit, about 6 FMA.

## 13. Option (b): (u, v) from the screen, and how it slides (example 08)

Question: take (u, v) straight from the projected side arcs (option b), which is crack-free by construction. Does that (u, v) stay on the same surface point when the camera moves?

- Each side arc {P0, A, P2, w} projects to a 2D rational quadratic with weight w' = w·zA / √(z0·z2). With barycentric coordinates b0, b1, b2 of the screen triangle (p0, a, p2):
  - **full conic** K = b1² − 4w'²·b0·b2;
  - **arc only** K = b1 − 2w'·√(b0·b2), which is 0 on the arc and not on the rest of the ellipse.
- u = K3 / (K3 + K1), v = K0 / (K0 + K2). Each K is scaled to 1 at the piece's projected centre, so the centre gets (0.5, 0.5).
- **Slide** = for a surface point the camera sees, its distance to the surface point that its screen (u, v) names, in % of the average edge length.

**Finding 1:** the full conic doesn't work as written. Each projected arc is part of a whole ellipse, and on the smooth cube the ellipse's other half runs back across the face. There K3 = 0 again, and u falls to 0 in the wrong place: average slide 44%, worst 114%. The arc-only form avoids this but costs a square root per side per corner.

**Finding 2:** with the arc-only form, the (u, v) slides on every curved piece. Flat pieces are exact. Quad 2 of each mesh, depth 0, default camera (0.75 rad yaw and 0.3 rad pitch away from straight on):

| Mesh | Slide at marker (0.3, 0.65) | Average slide | Worst slide | Marker path over 25 camera angles |
|---|---|---|---|---|
| Smooth cube | 17.6% | 19.6% | 49.6% | 21.3% |
| Smooth cube, straight on | 12.8% | 8.85% | 13.4% | |
| Rounded box (flat inner piece) | 0% | 0.36% | 2.42% (fillets) | 0% |
| Mixed cube | 6.16% | 6.60% | 18.3% | 19.0% |
| Wave (quad 1) | 3.25% | 2.80% | 15.7% | 6.92% |

- A flat piece is exact: on a plane, the screen-to-surface map is a projective map, and scaling each K at the centre fixes its one free ratio.
- On curved pieces the screen spacing isn't the surface spacing (foreshortening), so even straight on, the smooth cube slides 12.8% at the marker.

**Finding 3: folds.** When part of the quad turns away from the camera, a projected side arc runs back across the visible part. Those surface points get a screen (u, v) outside 0…1 (red in the page), even though the camera sees them.

**13b. Cost and speed** (the page now runs the pass as the method would: per piece, per row, forward differences along the row; checked against direct evaluation: same owner on every pixel, (u, v) within 3·10⁻⁸)

| Part (arc-only form) | Ops | Cycles (Skylake model) |
|---|---|---|
| One pixel vs one piece, 4 curved sides | 18 ADD, 4 MAX, 3 MIN, 4 SQRT, 2 DIV, 1 CMP (32 FLOPs) | 18, divider-bound (4 SQRT + 2 DIV) |
| One pixel vs one piece, 4 straight sides | 6 ADD, 3 MIN, 2 DIV, 1 CMP | 6 |
| Row start, per piece | 4 ADD, 12 MUL, 32 FMA, 2 CMP | 24 |
| Frame setup, per piece | 85 ADD, 63 MUL, 90 FMA, 8 SQRT, 21 DIV | 119 |

- Smooth cube quad at 200² (one piece), over the auto orbit: 0.56–0.69 piece tests per pixel, 10–13 cycles per pixel, 135–165 µs per frame at 3 GHz on one core.
- The square roots make it divider-bound. RSQRT (4/1) + MUL instead of SQRT would move the bound back to the ALU ports. Not done.
- The page shows a live FPS counter (frames drawn, plus the pixel pass time in JavaScript) and an auto orbit.
- **Camera fix:** pages 01, 06 and 08 orbit the camera and turned the shape the wrong way on a sideways drag. Now dragging right turns the front to the right, as on the other pages.

**13c. Whole mesh, with depth.** The edges decide which pieces contain a pixel and give its (u, v). Depth works as in step 11: each such piece shoots the pixel's ray at its own quadric, and the nearest wins and writes the occlusion map.
- **Root choice:** of the quadric's two hits, take t = (−b − s·√D) / 2a with s = σ·f.
  - σ: whether the quadric's gradient points outward at the piece centre (fixed per piece).
  - f: whether the piece centre faces the camera (per frame).
  - This is the "sign of ∇Q · ray" rule from step 12, problem 3.
- **Check against step 11** (which piece wins each pixel), default camera, 200²:

| Mesh | Same piece as step 11 | Different piece | Only step 11 covers | Only (b) covers |
|---|---|---|---|---|
| Smooth cube | 53.7% | 12,282 | 1,434 | 0 |
| Rounded box | 99.3% | 130 | 3 | 0 |
| Mixed cube | 93.8% | 705 | 442 | 440 |
| Wave | 100% | 0 | 0 | 0 |

- **Folds are the blocker.** A piece that curves past the silhouette projects its far edge back across its own visible part. Pixels the camera really sees on it then fall outside its edges and go to the piece behind.
  - Each smooth-cube face is one piece spanning 90° of the sphere, so it folds at most views.
  - The wave matches exactly at all 7 test angles when nothing folds; when parts fold, up to 173 pixels differ.
- **Cost** (rounded box, 54 pieces, 200²):
  - edge test 13 cycles per piece tested (2.27 per pixel);
  - depth + (u, v) 12 cycles per piece whose edges contain the pixel (0.93 per pixel);
  - about 20 cycles per pixel and 265 µs per frame at 3 GHz.

## 14. Two-pass map (example 09)

**Pass 1, build (per piece).** Each piece touches only the pixels it covers.
- Project its 4 edge arcs. On each pixel row, an edge's crossing with the row is one quadratic: f·down(t) − (Y − W/2)·forward(t) = 0, using the arc's control points in camera coordinates. A straight edge gives a linear equation.
- The sorted crossings give the spans the piece covers on that row.
- Along a span, for each pixel:
  - u, v from the edges (step 13, arc-only K, stepped along the row);
  - the 3D point P(u, v) from the step 10 forward map;
  - its distance along the view direction.
- The piece appends (piece, u, v, distance) to that pixel's list.

**Pass 2, resolve (per pixel).** The closest entry of the pixel's list wins. It is written to the final arrays (piece, u, v, distance, occlusion map), and the pixel is coloured from them.

Every value is computed once from a formula; no piece tests pixels outside its spans.

**Cost** (Skylake model, one core, 200²):

| | Cycles per pixel | Share of a 1,000-cycle budget |
|---|---|---|
| Smooth cube | 103–111 | about 11% |
| Rounded box | 71–78 | |
| Mixed cube | 94–97 | |
| Wave | 15–27 | |

- One written pixel costs 124 cycles: 6 SQRT and 10 DIV. P(u, v) alone is 108 of those, and half of that is picking the root against the blend of the 4 edge arcs.
- Pass 1 is almost all of it. Pass 2 is about 2.5 cycles per pixel.

**Same piece as step 11** (4 camera angles, pitch 0.45):

| Mesh | Same piece |
|---|---|
| Wave | 98.2–100% |
| Rounded box | 99.3–99.6% |
| Smooth cube | 80–87% |
| Mixed cube | 72–76% |

**Finding 1: a folded piece fails as a whole.**
- When part of a piece turns more than about 90° from the camera, its far edge projects inside its own visible image.
- The piece's projected centre then lies on the wrong side of that edge. The K scaled to 1 at the centre has the wrong sign, and u or v leaves 0…1 almost everywhere on the piece.
- Example: smooth cube face +x at yaw 0.3. 1,162 of its 1,190 visible pixels have u or v outside 0…1. At one of them the edges give u = −1.58 where the surface's (u, v) is (0.12, 0.995).
- Each smooth-cube face spans 90° of the sphere, so at an oblique view 2 of the 3 visible faces fail this way.

**Code rewrite (same results).** The page code was rewritten as named stages: set up each piece → pass 1 → pass 2 → shade.
- Each edge is projected once, and that one description serves the row crossings, its K and the row stepping.
- Removed: the unused full-conic form and the helpers copied over from 08.
- Checked against the previous version on 4 meshes × 4 camera angles: the same piece on every pixel and the same number of list entries. Distances agree within 3·10⁻⁵, u and v within 10⁻⁷ except one pixel at 1.2·10⁻⁴.

**Finding 2: step 11 drops flat pieces at random pixels.**
- On a flat piece the quadric is a doubled plane, so the ray's two roots are nearly equal.
- Step 11's check re-runs the forward map and compares within 10⁻⁶, and that comparison sometimes fails. The face behind then shows through.
- The isolated "different piece" dots on the rounded box are these. The two-pass map has the correct piece there: same distance as the ray, 5.1118.
- Not changed (step 11's math).

## 15. Closed-form depth only (example 10)

A test page that does only the closed form and stores depth, then prints the depth array as numbers. No lists, no colours, no checks.

- **Same math as step 14:** per row one quadratic per edge; u, v from the edges; P(u, v) from the step 10 forward map; the distance along the view direction.
- **Written as plain arithmetic, with no temporary arrays.** Example 09 created about 60 small arrays per P(u, v).
- **Depth:** each pixel keeps the nearest distance as it is written (0 = empty).
- **Checked against example 09, same camera:**
  - the same pixels covered on all 4 meshes;
  - depth equal within 1.8·10⁻⁵ (float32 storage);
  - P(u, v) equal to the conversion's own `pc.eval` within 2·10⁻¹⁵.

Measured in the browser (JavaScript float64, 200², median of 25 runs):

| Mesh | Frame | Per written pixel | P(u, v) alone | Example 09 (with allocations) |
|---|---|---|---|---|
| Smooth cube | 5.4 ms | 154 ns | 120 ns | 43 ms, P(u, v) 620 ns |
| Hard cube | 4.3 ms | 166 ns | 109 ns | 25 ms, P(u, v) 1,020 ns |
| Mixed cube | 6.4 ms | 210 ns | 122 ns | |
| Wave | 1.4 ms | 237 ns | 122 ns | |

- The page in step 14 spent its time on allocation, not arithmetic: 6–8× faster without it.
- In cycles at 3 GHz, P(u, v) is now about 330–370 against 108 in the float32 model. That's JavaScript float64 without SIMD.

## 16. Operation stress test (example 11)

Every method we have, measured on real pieces and a real camera (200²). Each method is written once; the page builds three versions from that source:
- **float64:** as written; this is the version that is timed.
- **float32:** every + − × ÷, √, ∛, cos and acos rounded to float32; a × b ± c is rounded once (fused).
- **counted:** every operation tallied, which feeds the Skylake cycle model.

**Answer key** (independent of all methods):
- Each piece's surface is sampled densely and splatted to pixels.
- Detection errors are counted only at "decided" pixels, where a piece covers or misses the whole 3 × 3 block around the pixel.
- Exact u, v and depth come from the winning piece's quadric along the pixel's ray, at the root that matches the sampled depth.

**Solving** (smooth cube, oblique view):

| Method | Measured | Model | Accuracy (float64) |
|---|---|---|---|
| Edge K ratios, arc only | 59 ns | 27 cycles | slide 38% avg, 130% max; 2,268 pixels with u or v outside 0…1 |
| Edge K ratios, full conic | 66 ns | 27 | slide 47% avg; 11,988 outside 0…1 |
| Same level (quartic, Ferrari) | 575 ns | 146 | slide 20% avg, 100% max; 4,306 of 19,191 pixels with no answer |
| P(u, v), given the exact u, v | 553–575 ns | 111 | exact (float32: 1.6·10⁻⁵ % of an edge) |
| Ray × ellipsoid + side planes | 293–302 ns | 23 | exact (float32: Δu, v ≤ 8·10⁻⁶, depth ≤ 5·10⁻⁴ %) |
| Same + forward-map check (step 11) | 1,003 ns | 145 | exact |
| Ray, sign rule + side planes | 284 ns | 23 | 148 pixels on the wrong hit (slide up to 63%) |

**Which hit counts:**

| Case | Nearest hit inside the side planes | Forward-map check | Sign rule |
|---|---|---|---|
| Smooth cube, oblique | right everywhere | right everywhere | 148 wrong |
| Smooth cube, glancing | right everywhere | right everywhere | 4,147 wrong, 941 no hit |
| Hard cube, straight on | right everywhere | 95 no hit (flat pieces) | right everywhere |
| Wave, oblique | 569 wrong (far side) | right everywhere | right everywhere |
| Mixed cube, oblique | 52 wrong | 52 wrong | 1,822 wrong |

- **The forward-map check fails in float32.** Its 10⁻⁶ tolerance is below float32 precision.
  - Hard cube: 9,996 of 9,996 pixels get no hit.
  - Wave: 4,772 of 7,852.
- **The sign rule fails on pieces that turn away from the camera partway.** It uses one facing sign per piece, so a piece that is partly front-facing and partly back-facing gets the wrong hit on one part.

**Detection** (smooth cube, oblique):

| Test | Cost | Accuracy |
|---|---|---|
| Screen box from the edges' control points | 4 compares | misses 365 pixels (bulges outside the box) |
| Edge K signs | — | 399 pixels wrongly in, 2,296 wrongly out |
| Ray + side planes | — | right everywhere |
| Row crossings | 57 cycles per row | 2,562 pixels wrongly out |

**Who wins a pixel:**

| | Time per frame | Memory |
|---|---|---|
| Nearest depth kept at write | 3.1 ms | 14 bytes per pixel |
| Per-pixel lists, then resolve | 5.0 ms | 33 bytes per pixel |

**Whole frames** (smooth cube, measured in JavaScript):

| Pipeline | 1000² frame | Per pixel |
|---|---|---|
| A, now: spans → edge u, v → P(u, v) | 648 ms | 648 ns |
| B: spans → ray, sign rule | 250 ms | 250 ns |
| B′: spans → ray + forward-map check | 953 ms | 953 ns |
| C, step 11: boxes → ray + check | 1,459 ms | 1,459 ns |

**16b. Packed (cache layout).**
- All pieces' numbers go in one flat array. Each piece's block is ordered by how often a number is used: per pixel (ray, quadric, side planes: 43 numbers = 172 bytes = 3 cache lines in float32) → per span (edge K) → per row (crossings) → per frame (box) → P(u, v). That's 240 numbers per piece.
- At a span's first pixel, the values that change along the row are set up once; every further pixel only adds fixed steps. Nothing is read from the array inside a span.
- Output is separate arrays: depth float32, piece 16-bit, u and v 16-bit fixed point. That's 10 bytes per pixel.

| Pipeline (smooth cube, oblique, 400²) | Objects → packed, ns per pixel walked | Model cycles per pixel, packed | Same result |
|---|---|---|---|
| A (now): edge u, v → P(u, v) | 803 → 179 (4.5×) | 132 | yes |
| B: ray, sign rule | 300 → 71 (4.2×) | 16 | yes |
| B′: ray + forward-map check | 1,227 → 220 (5.6×) | 141 | yes |

- "Same result" means the same piece on every pixel, depth within 10⁻⁵ %, and u, v within 7.7·10⁻⁶ (the 16-bit step).
- Whole frames at 1000²: B packed takes 44 ms (44 ns per pixel); unpacked B takes 294 ms.
- The output row: nearest depth at write with the packed output takes 1.65 ms per frame at 10 bytes per pixel, against 3.06 ms at 14 bytes.
- Lists packed by count, then running sum, then contiguous blocks are written down as a backup only, not implemented.

**16c. Per-pixel facing rule, and pictures.** Of the ray's two hits, take the one where the surface faces the camera: t = (−b − σ·√D)/2a.
- σ is the quadric's orientation, fixed per piece. There is no per-piece facing flag, so this is the sign rule without f.
- Cost: 23 model cycles direct, 14 packed and stepped. That's the cheapest of the four rules.

Which hit counts (wrong / no hit, float64; float32 gives the same numbers for this rule):

| Case | Nearest inside planes | Forward-map check | Sign rule | Per-pixel facing |
|---|---|---|---|---|
| Smooth cube, straight on | 0 / 0 | 0 / 0 | 3,960 / 0 | 0 / 0 |
| Smooth cube, oblique | 0 / 0 | 0 / 0 | 148 / 0 | 0 / 0 |
| Smooth cube, glancing | 0 / 0 | 0 / 0 | 4,147 / 941 | 0 / 0 |
| Hard cube, straight on | 0 / 0 | 0 / 95 (float32: all) | 0 / 0 | 0 / 0 |
| Mixed cube, oblique | 52 / 0 | 52 / 0 | 1,822 / 10 | 0 / 430 |
| Wave, oblique | 569 / 0 | 0 / 0 (float32: 4,772 no hit) | 0 / 0 | 0 / 0 |

- **Pictures** (each rule's whole frame next to the answer key; red = wrong piece or depth) show what's left. Smooth cube, oblique: every rule has the same 3,379 red pixels. Wave: the same 527 across the three non-nearest rules.
- **That remainder comes from coverage, not the hit choice.** The pixels a piece walks come from its edges' row crossings. Where a piece bulges past its edges (folds at the outline, seams), those pixels are never walked.
- **Detection note:** per-pixel facing reports pieces hidden behind others as not covering (16,478 "wrongly out" on the smooth cube). Only visible coverage matters for the depth map.

**16d. Option 1: bulge box.**
- Inside a piece, its picture can only reach furthest left, right, up or down at an outline point, where the tangent plane passes through the camera.
- The planes through the camera and a pixel column touch the quadric where πᵀ·C·π = 0. C is the adjugate of the quadric's 4 × 4 matrix (fixed per piece), and the condition is a quadratic in the screen x. The touch point is C·π.
- Rows work the same way. The box is the control-point box, widened by every touch point inside the piece's side planes.
- Every pixel in the box is walked with ray + side planes + per-pixel facing.

| Case | Box misses (control points → bulge box) | Red pixels (spans → bulge box) | Pixels walked |
|---|---|---|---|
| Smooth cube, oblique | 365 → 0 | 3,379 → 2,025 | ≈ 1.8× |
| Smooth cube, glancing | 435 → 0 | 4,499 → 1,895 | ≈ 2.2× |
| Smooth cube, straight on | 0 → 0 | 3,738 → 2,050 | ≈ 2.2× |
| Hard cube, straight on | 0 → 0 | 0 → 0 | ≈ 1.1× |
| Mixed cube, oblique | 129 → 0 | 2,400 → 1,080 | ≈ 1.9× |
| Wave, oblique | 0 → 0 | 527 → 527 | ≈ 2.2× |

- Packed cost: about 12 model cycles per pixel walked (a miss exits early).
- Whole frame at 1000²: 20 ns per pixel measured, against 24 with spans. There are no row crossings to solve.
- What's left on the smooth cube is a band on the top face. Every piece's quadric is the same sphere, and every piece's side planes pass through its centre. So for a back piece, the facing hit is the antipodal point on the front, inside its own planes, at the same depth as the true front piece. The first piece written keeps the pixel (the bottom face over the top face).
- The wave's band at the seam is the same for every rule and every walk; not yet explained.

## 17. Coverage check (example 12), and a measurement fix

An interactive page with the full working pipeline: bulge box + outline margin, ray × quadric with per-pixel facing (+ optional cube fix), side planes, packed, nearest depth at write. Camera orbit, FPS, and a check against the answer key.

**Measurement fix.** The answer key kept the *nearest* sample anywhere in a pixel. Near the outline, depth changes by more than 1% across one pixel, so correct pixel-centre depths were flagged.
- The check now accepts any depth within the winning piece's own depth range inside the pixel (±0.5%).
- With that, the "remaining" smooth-cube band (2,025 pixels) and the wave seam band (527) were artifacts. Every one had the right piece with the right centre depth.

Default view, margin 1 px:

| Mesh | Wrong pixels | Pixels walked / covered |
|---|---|---|
| Smooth cube | 0 of 37,721 | 65,333 / 19,800 |
| Rounded box | 0 of 36,871 | 58,030 / 12,585 |
| Mixed cube | 170 of 37,272 | 60,699 / 16,241 |
| Wave | 0 of 37,602 | 22,450 / 9,028 |

The cube fix (normal at the hit points the piece's way, one stepped multiply-add per pixel) changes nothing here; the antipode tie it was meant for came from the same measurement artifact.

Open items for the next session: [`wrap-up.md`](wrap-up.md).

## Prior art

Collected from memory at first. Step 7 checked the shared-edge part against abstracts and citing papers.

| Piece | Status | Where it comes from |
|---|---|---|
| Ray vs ellipsoid or other quadric, by stretching to a unit sphere | Textbook | Classic ray tracing (1980s); quadric primitives in CSG ray tracers |
| Rendering scenes made of quadrics or ellipsoids | Existing | Sigg, Weyrich, Botsch, Gross 2006, "GPU-Based Ray-Casting of Quadratic Surfaces"; EWA splatting (Zwicker et al. 2001) and 3D Gaussian Splatting (Kerbl et al. 2023), where each ellipsoid projects to an exact screen ellipse |
| Smooth surfaces built from quadric pieces | Existing | Sederberg 1985, piecewise algebraic surface patches; Dahmen 1989, "Smooth piecewise quadric surfaces"; Bajaj et al., A-patches (low-degree implicit patches) |
| Ray vs bilinear patch in closed form (quadratic) | Existing | Ramsey, Potter, Hansen 2004, "Ray Bilinear Patch Intersections"; Reshetov 2019, "Cool Patches" (Ray Tracing Gems) |
| A scan line as a plane through the camera, cutting a parametric patch | Existing, 1978–1980 | Blinn, Whitted, Lane, Carpenter: "Scan line methods for displaying parametrically defined surfaces" (CACM 1980). They hit the same wall: on bicubic patches the cut has no closed form, so they track it with Newton's method. |
| Pixel edges as planes (edge functions) | Standard | Every triangle rasterizer; homogeneous rasterization (Olano & Greer 1997) |

Not found yet: using quadric pieces per quad specifically so that pixel rows, columns and corners map to (u, v) in closed form on the CPU, with no frame buffer. This needs a real literature search before calling it new.
