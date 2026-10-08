# R&D log

Newest entries at the bottom. Costs use the Skylake float32 scalar table from the original handoff (ADD/MUL/FMA latency 4, throughput 0.5; SQRT 12/3; DIV 11/3).

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

## Prior art

Collected from memory; not checked against the papers yet.

| Piece | Status | Where it comes from |
|---|---|---|
| Ray vs ellipsoid or other quadric, by stretching to a unit sphere | Textbook | Classic ray tracing (1980s); quadric primitives in CSG ray tracers |
| Rendering scenes made of quadrics or ellipsoids | Existing | Sigg, Weyrich, Botsch, Gross 2006, "GPU-Based Ray-Casting of Quadratic Surfaces"; EWA splatting (Zwicker et al. 2001) and 3D Gaussian Splatting (Kerbl et al. 2023), where each ellipsoid projects to an exact screen ellipse |
| Smooth surfaces built from quadric pieces | Existing | Sederberg 1985, piecewise algebraic surface patches; Dahmen 1989, "Smooth piecewise quadric surfaces"; Bajaj et al., A-patches (low-degree implicit patches) |
| Ray vs bilinear patch in closed form (quadratic) | Existing | Ramsey, Potter, Hansen 2004, "Ray Bilinear Patch Intersections"; Reshetov 2019, "Cool Patches" (Ray Tracing Gems) |
| A scan line as a plane through the camera, cutting a parametric patch | Existing, 1978–1980 | Blinn, Whitted, Lane, Carpenter: "Scan line methods for displaying parametrically defined surfaces" (CACM 1980). They hit the same wall: on bicubic patches the cut has no closed form, so they track it with Newton's method. |
| Pixel edges as planes (edge functions) | Standard | Every triangle rasterizer; homogeneous rasterization (Olano & Greer 1997) |

Not found yet: using quadric pieces per quad specifically so that pixel rows, columns and corners map to (u, v) in closed form on the CPU, with no frame buffer. This needs a real literature search before calling it new.
