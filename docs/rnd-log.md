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
