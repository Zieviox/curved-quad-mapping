# Curved quads: the method, the concepts, and how we got here

This is the one document for the whole project. It is written for a person learning the method as much as for an assistant continuing it.

- **Part A** says what we are building and why.
- **Part B** is a learning path: the concepts in the order to learn them, each with its equation and where it is used.
- **Part C** is the current method, step by step, with every equation. It is the owner's method as agreed in talk (log steps 20 and 21).
- **Part D** explains every older method, what it found, and why it was kept or dropped.
- **Part E** lists what is decided, what is open, and a glossary.

Status words: **checked** = built and measured. **built** = runs, measured in one view only. **not built** = agreed or worked out, not yet run. **dropped** = tried, failed, do not reuse. **owner** = the owner's rule. **assistant** = a detail the assistant filled in; the owner may change it.
Notation: `·` dot product, `×` cross product, `|a|` length, `norm(a) = a / |a|`. Equations are in plain text so they read the same everywhere.

---

# Part A. What we are building

A quad mesh comes in. Every quad corner has a position and a normal. The normals are **handles**: they bend the straight edges into ellipses and the flat quads into curved surfaces. The result should **look like a subdivided or NURBS model** that passes through the mesh points (no shrinking) and follows the normals. It is drawn **directly**, on the CPU, in real time, without ever being turned into flat polygons.

For every **pixel corner** we want the quad there and the place on it (its own `u, v`, each 0 to 1). The 4 corners of a pixel then say exactly which patch of the quad that pixel covers, which is what texturing and anti-aliasing need.

**The owner's building block.** Two points, each with a normal as a handle, give one ellipse that passes through both and faces along each normal. If the two handles form an S, it becomes two ellipses joined at the middle. Where a straight line of sight or a knife meets an ellipse is one quadratic: closed-form access to coordinates. (The owner calls this building block an ellipsoid; it is one curve between two handles, never one shape stretched over a whole quad.)

**The owner's walk.** Stepping is on the screen, by the pixel:
1. Find which pixel the quad's starting point lands in.
2. Find where each corner of that pixel lands on the quad.
3. Go to the next pixel in the row. It shares two corners, so two new corners are found.
4. When the pixel is no longer on the quad, go to the next row.
5. Repeat until every pixel the quad covers is done.

**Rules that must not be bent**
1. Normals shape the surface. A normal belongs to one face's corner. Two faces have the same normal at a shared corner only where the surface is perfectly smooth.
2. The middle of a quad is made only of ellipses that come off the edge ellipses. No separate fitted shape, no invented points.
3. The surface is the source: a quad finds its own pixels and tests no others.
4. Pixel corners, not pixel centres.
5. The quad's own `u, v`.
6. CPU only. Formulas, not iteration.
7. Cost: about 500 processor cycles per pixel, 1,000 at most, memory fetches included. Real time.
8. Occlusion is only a small placeholder for the engine's own system.

---

# Part B. Learning path

Learn these in order. Each level only needs the ones before it. "Used in" points to Part C or D.

## Level 1. Points, directions and the camera

**1.1 Dot and cross product.** `a · b` tells how much two directions agree (0 = at right angles). `a × b` is a direction at right angles to both.
Used everywhere.

**1.2 A plane.** All points `x` with `n · x = h`. `n` is the plane's normal. The value `n · x − h` is positive on one side, negative on the other, zero on the plane.
Used in: pixel grid lines (1.5), the arc's plane (C2), side planes (D9).

**1.3 Normal and tangent plane.** At a point of a surface, the normal sticks straight out. The tangent plane is the flat sheet touching the surface there: all directions `t` with `t · n = 0`. A curve lying on the surface must leave the point along such a `t`.
Used in: how normals shape the arcs (C2).

**1.4 The camera.** The camera has a position and three directions at right angles: `right`, `down`, `forward`. A point `p` becomes camera coordinates
`r = (p − pos) · right`, `d = (p − pos) · down`, `z = (p − pos) · forward`.
It lands on the screen at
`x = cx + f · r / z`, `y = cy + f · d / z`
where `(cx, cy)` is the screen centre and `f = (width / 2) / tan(field of view / 2)`.
Used in: everything that touches pixels.

**1.5 A pixel grid line is a plane through the camera.** The screen column `x = k` is all points with `f · r − (k − cx) · z = 0`. That is a plane through the camera (a "knife"). Same for a row: `f · d − (k − cy) · z = 0`.
A **pixel corner** is where one column knife and one row knife meet: a line of sight. So "which surface point is at this pixel corner" and "where does this line of sight hit the surface" are the same question.
Used in: C3 to C6, and the reason for most of Part D.

## Level 2. Solving equations with a formula

**2.1 Quadratic.** `a·x² + b·x + c = 0` has `x = (−b ± √(b² − 4ac)) / 2a`. The stable way to compute both roots: `q = −(b + sign(b)·√(b² − 4ac)) / 2`, then `x1 = q / a`, `x2 = c / q`.

**2.2 Cubic.** Has a formula too (Cardano; a version with cosines when there are three real roots). Costs a cube root or a cosine.

**2.3 Quartic.** Degree 4 still has a formula (Ferrari). It is long and touchy with rounding.

**2.4 Degree 5 and above: no formula exists.** This is a theorem, not a gap in our knowledge. Only iteration (repeat until close enough) works there.

**2.5 Counting the degree before building anything.** If the surface point is described by two parameters and each knife gives an equation of degree `(a, b)` in them, two such equations meet in up to `a·d + b·c` points, and that number is the degree of the equation to solve. **This single count decides whether a surface can be used at all.**

| Surface | Degree for a pixel corner | Formula? |
|---|---|---|
| Flat quad with straight sides (bilinear) | 2 | yes |
| Quadric (sphere, ellipsoid, cylinder…) | 2 | yes |
| An ellipse inside a knife (Part C) | 2 | yes |
| Curved triangle from 3 arcs (D16) | 4 | yes |
| Straight lines between two opposite arcs | 4 | yes |
| A quad curved both ways with 4 free curved edges | 8 | **no** |
| Smoother classic patches (PN, B-spline) | 18 | no |

Used in: the whole direction of the project (D3, D7, Part C).

## Level 3. Arcs

**3.1 The arc we use.** An ellipse arc (in general a conic arc) is given by 4 things: start `P0`, end `P2`, **apex** `A`, and a **weight** `w`.
The apex is where the two end tangent lines meet: the arc leaves `P0` heading for `A` and arrives at `P2` coming from `A`.
The point at `t` (0 at the start, 1 at the end):

```
b0 = (1−t)²      b1 = 2·w·(1−t)·t      b2 = t²
point = (b0·P0 + b1·A + b2·P2) / (b0 + b1 + b2)
```

**3.2 The weight is the fullness.** `w = 0`: the straight line. Small `w`: hugs the straight line. Large `w`: pushed out toward the apex. `w < 1` ellipse, `w = 1` parabola, `w > 1` hyperbola. With equal distances `|A − P0| = |A − P2|` and `w = cos(turn / 2)` (turn = the angle the direction turns through), the arc is exactly a **circle** arc.

**3.3 An arc is flat.** `P0`, `A`, `P2` span one plane and the whole arc stays in it. Consequence: an arc exists only if the two end directions and the edge lie in one plane. If they don't, one arc cannot do it.

**3.4 Two facts used later.** At `t = 0.5` the arc's direction is parallel to `P2 − P0`. Reversing an arc (swap `P0` and `P2`) gives the same curve with `t` turned into `1 − t`.

**3.5 The helper cubic.** A cubic curve can leave `P0` along `T0` and arrive at `P2` along `T2` for any directions, flat or not. With `L = |P2 − P0|`, its middle point and direction there are

```
M  = (P0 + P2)/2 + (T0 − T2) · L/8
ct = norm( (P2 − P0) − (T0 + T2) · L/3 )
```

We never draw the cubic. We only use it to place the middle point when one ellipse is not enough (C2, C5).

## Level 4. Surfaces

**4.1 Two ways to describe a surface.** *By parameters:* a rule that turns `(u, v)` into a point. Easy to walk along, hard to hit with a line of sight. *By an equation:* all points where some `Q(x) = 0`. Easy to hit with a line of sight, but has no built-in `u, v` and no edges.

**4.2 Quadric.** `Q(x) = x·A·x + g·x + k = 0` (sphere, ellipsoid, cylinder, cone, saddle…). It has 9 free numbers. A line of sight hits it in a quadratic. It was the heart of the old method (D4–D17).

**4.3 The two-point rule.** Two arcs in different planes can lie on one quadric only if they meet the line where their planes cross at the same two points. Two edges of a quad meet at one corner only. So **one quadric cannot hold four independent edge arcs.** (D7)

**4.4 Barycentric coordinates.** A position inside a triangle is three numbers `b = (b0, b1, b2)` with `b0 + b1 + b2 = 1`, all ≥ 0. `(1,0,0)` is corner 0. `b2 = 0` is the side from corner 0 to corner 1.

**4.5 The curved triangle.** Three corners and three arcs define a surface with no other input (D16). On each side it *is* that side's arc. A line of sight meets it in a degree-4 problem, which has a formula.

## Level 6. Cost

**6.1 Operation model.** Count the additions, multiplications, divisions and square roots per pixel and price them (the log uses an Intel Skylake table). It is a **best case**: it assumes the processor overlaps everything perfectly.

**6.2 Measured against the model.** For the old pixel pass, natively: model 12 cycles per pixel, measured 17–20 with everything in cache, 18–28 with real screen buffers. So multiply any model number by 1.5–2.3.

**6.3 Memory.** A 64-byte block already in the nearest cache is free. A block the processor's read-ahead has ready is nearly free; that needs a long run of consecutive blocks. Any other block costs on the order of 100 cycles. Short rows pay the most. Texture reads at scattered positions cost 115–545 cycles each: they must be kept close together.

**6.4 Solved versus covered.** Every pixel corner a quad *tries* pays the full price, hit or miss. The old pipeline tried 2.3–4.2 for each one it covered. This ratio matters more than memory.

---

# Part C. The current method

```
quads + normals → C1 ends → C2 edge ellipses → C3 a knife marks two edges → C4 each mark inherits a normal
               → C5 a new ellipse between the marks → C6 the corner: where the row ellipse and the column ellipse meet
               → C7 u, v → C8 the walk → C9 the pixel
```

Status in one line: C1 to C5 and cutting one ellipse with a flat knife are **built** (example 16). C6 as agreed (two ellipses meeting), C7's final rule and C8 are **not built**.

## C1. The two ends of an edge

Each end of an edge has the normals of the (up to two) faces on that edge.

- **Smooth end:** both faces have the same normal `n` there. The arc may leave in any direction at right angles to `n`.
- **Sharp end:** the normals `nA`, `nB` differ. The edge lies on both faces, so its direction must be at right angles to both: `T = ± norm(nA × nB)`. No choice is left.

The sign is always taken so the direction points along the edge (`T · (P2 − P0) ≥ 0`).

## C2. The edge arc

Let `d = P2 − P0`.

**The plane (both ends smooth).** Stand a sheet on the edge, leaning the way the two normals lean on average:

```
m  = norm( d × (n0 + n2) )            the sheet's normal
T0 = ± norm( m × n0 )                 direction leaving P0
T2 = ± norm( m × n2 )                 direction arriving at P2
```

Both directions lie in the sheet and are at right angles to their normals. With one sharp end the sheet is instead the one through `d` and the forced direction: `m = norm(d × T_sharp)`. With two sharp ends both directions are forced.

**One arc.** Find where the two tangent lines meet: `P0 + s·T0 = P2 − r·T2`. With `a = T0·T0`, `b = T0·T2`, `c = T2·T2`, `p = T0·d`, `q = T2·d`:

```
s = (p·c − q·b) / (a·c − b²)        r = (a·q − b·p) / (a·c − b²)
A = P0 + s·T0                       the apex
w = cos(turn / 2) = √( (1 + T0·T2) / 2 )
```

Accepted when the lines really meet and `s` and `r` are both at least 2% of `|d|` (the apex is in front of both ends). If both directions run along the edge, the edge is straight: `A` = the midpoint, `w = 1`.

**Two arcs joined at the middle.** When one arc is not accepted (an S-shape, or directions not in one plane), use the helper cubic (3.5) for the middle point `M`, and

```
Tm = norm( (T0 × (M − P0)) × (T2 × (P2 − M)) )
```

the one direction lying in both halves' planes (if that is zero because everything is already in one plane, use the cubic's direction `ct`). Then one arc from `P0, T0` to `M, Tm`, and one from `M, Tm` to `P2, T2`. The halves join without a kink.

An arc uses only its own edge's data. In the test pages one arc is computed per mesh edge and shared by the two quads on it (**assistant**). How a sharp edge, where the two faces have different normals, should be handled is the owner's to decide (see Part E).

Status: **built**. The sheet rule for the plane, the 2% rule and the middle-point rule are the **assistant**'s; the owner has not confirmed them.

**Not yet in:** handle length (the owner wants it). The plan is `w = L · cos(turn / 2)` with `L` from the normals' lengths. Open question: an arc has one fullness number but an edge has two handles; either average the two lengths, or use two arcs with one length each.

## C3. A knife marks two edges — built (owner)

A knife is the flat sheet from the camera through a row of pixel corners (or a column). Where it crosses one of the quad's edge ellipses is a **mark**. With the edge's three control points in camera coordinates `(r, d, z)` and weight `w`, the row knife at screen height `y` (`yc = y − cy`) crosses at the `t` solving

```
h0 = f·d0 − yc·z0      h1 = w·(f·d1 − yc·z1)      h2 = f·d2 − yc·z2
(h0 − 2·h1 + h2)·t² + 2·(h1 − h0)·t + h0 = 0          keep 0 ≤ t < 1
```

A column knife at screen `x` is the same with `r` in place of `d` and `xc = x − cx`. A knife that passes through the quad crosses its border twice, so it leaves two marks (four if the outline folds; they are paired in order along the knife, **assistant**).

Each mark knows three things: its point on the edge ellipse, its `u, v` (the edge's end `u, v` blended at `t`), and a normal (C4).

## C4. Each mark inherits a normal — built (owner; the straightening is the assistant's)

A new point on an edge inherits its normal from that edge's two end normals (this face's normals):

```
n = norm( (1 − t)·n0 + t·n1 )
n = norm( n − (n · T)·T )          T = the edge's direction at that point
```

The second line keeps the normal at a right angle to the edge, because the edge lies on the surface.

## C5. A new ellipse between the two marks — built (owner)

Two points with two handles: the building block again. The new ellipse lies **in the knife**. With `m` the knife's own normal,

```
row knife:      m = norm( right × ( down·(y − cy) + forward·f ) )
column knife:   m = norm( down  × ( right·(x − cx) + forward·f ) )

Ta = ± norm( m × na )        direction leaving mark a
Tb = ± norm( m × nb )        direction arriving at mark b
```

Each direction lies in the knife and is at a right angle to its inherited normal. From `Pa, Ta, Pb, Tb` the ellipse is built exactly as in C2 (apex where the two tangent lines meet, weight `cos(turn / 2)`); if the handles form an S, two ellipses joined at a middle point.

This ellipse bulges the way the handles say. It can reach past the quad's edges on screen: that is how the side of a ball gets its round outline.

**Measured (example 16, one view):** on the smooth cube every point lies on the exact ball to within 0.0005% of the radius. Flat faces match the exact flat answer to 3.0e-8. No ellipse failed to build on any of the four meshes.

## C6. The pixel corner: where the row ellipse and the column ellipse meet — agreed with the owner, not built

A pixel corner has two knives through it, one row knife and one column knife. Each gives an ellipse across the quad (C3 to C5). **The corner is where those two ellipses meet.**

What is known:
- Both ellipses pass through the corner's line of sight, because that line is where the two knives cross. Finding where an ellipse passes through it is one quadratic (the other knife against the ellipse, same equation as C3).
- On the smooth cube both pass through it at the same point (measured: both on the exact ball).
- On other shapes the two may pass each other with a small gap along the line of sight. How big is **not measured**.

What example 16 does instead: it uses one ellipse cut by the other *flat knife*, runs rows and columns separately, and keeps the nearer point. Rows alone cannot bulge above or below the quad's edges; columns alone cannot bulge at the sides. Both together close the outline but bring two different `u, v` (speckle). C6 as agreed replaces that.

To settle when it is built:
1. Where the two pass with a gap: which point is the corner's (one of them, or halfway)?
2. At a bulge past the edges only one knife has marks, so only one ellipse exists there. The corner then comes from that one alone.

## C7. The quad's own u, v — final rule not built

Every mark has an exact `u, v` on the quad's border (C3). The agreed idea: **u is read from one ellipse and v from the other**, so there is one answer per corner.

Two ways to read it, to be compared when built:
- **From the marks:** in the quad's `u, v` square, join the row ellipse's two marks with a line and the column ellipse's two marks with another; the corner is where the lines cross. Example 15 did this: exact on flat faces (3.0e-8).
- **Along the ellipses:** each ellipse blends its two marks' `u, v` by how far along it the corner is. Example 16 did this with one ellipse at a time.

Whether the checker stays put on curved faces when the camera moves is **not measured** for either.

## C8. The walk — owner, not built

As in Part A. Examples 15 and 16 visit every knife that passes through the screen box of a quad's edges and every corner between a knife's marks, which finds the same corners but is not yet the step-by-step walk from the quad's starting pixel.

## C9. From corners to a pixel — not built

A pixel has 4 corners. The test pages average the `u, v` of the corners on the nearest quad and fade the pixel by the share of corners that hit. Exact coverage of a partly covered pixel is not built.

## What is built and measured so far

| Page | What it tested | Result (one run, default view, 240 × 240, JavaScript) |
|---|---|---|
| Example 15 (step 20) | Marks only, straight lines in the `u, v` square, nothing in the middle | Flat faces exact. A ball is cut off at each face's edges (no bulge). 10–73 ms |
| Example 16 (step 21) | C3 to C5, one ellipse cut by a flat knife | Ball exact to 0.0005% of the radius; flat exact; 5–25 ms per knife direction. Needs both directions; they disagree on `u, v` |
| Example 17 (step 23) | C6 as a blend of the row ellipse and the column ellipse, each counting most near its own marks | Ball and flat: the two meet exactly. Mixed cube and wave: they pass more than 2% of the radius apart over large areas, so the blend averages two different shapes. 55–166 ms |

Everything in Part C is quadratics. Times are JavaScript in a browser, not the target; see 6.1 to 6.4 for what cost numbers mean.

---

# Part D. The older methods, in order

Each entry: the idea, its equation, what was found, and the verdict. Numbers are from `rnd-log.md`.

**D0. The starting surfaces (lab, example 00).** Classic patches built from 4 corners and 4 normals: Nagata, Phong, PN-quad. All are polynomials in `(u, v)`.
Verdict: fine to walk along, but a pixel corner on them is degree 8 or 18 (2.5). **Dropped** as the surface.

**D1. Walking the surface one pixel at a time (example 01).** Step `u` by `du = 1 / speed`, where the speed on screen is `f · |(Xu·Z − X·Zu, Yu·Z − Y·Zu)| / Z²` pixels per unit `u`.
Found: steps of one pixel in `u` and in `v` still skip pixels diagonally (2.54% gaps); shrinking the step to 0.7 fixes the inside but doubles the work and still leaves slivers at the outline.
Verdict: **dropped**. A local guess, not exact.

**D2. Exact crossings along a row (example 02).** Fix `v`. The patch row is a curve in `u`, and where it crosses the screen column `x = k` solves `f·X(u) − (k − cx)·Z(u) = 0`, a quadratic for Nagata and Phong.
The same idea gives where an **arc** crosses a pixel row, with `yc = y − cy` and the arc's control points in camera coordinates `(r, d, z)`:

```
h0 = f·d0 − yc·z0     hb = w·(f·d1 − yc·z1)     h2 = f·d2 − yc·z2
(h0 − 2·hb + h2)·t² + 2·(hb − h0)·t + h0 = 0
```

Verdict: exact but one-dimensional. **Kept as a tool**: it is how a triangle should find its spans (C5).

**D3. The pixel grid as knives (example 03).** Turn it around: every grid line is a plane through the camera and cuts the patch along a curve; a pixel corner is where two cuts meet. Counting degrees (2.5) gave the table that steers everything.
Verdict: the central idea. **Kept**.

**D4. One quadric per quad (lab).** Fit `Q(x) = x·A·x + g·x + k` through the 4 corners with the normals as targets: one 15 × 15 linear solve.
Found: 9 free numbers against 12 conditions, so the normals are only matched when they happen to agree with one quadric. Neighbouring quads get different quadrics and crack.
Verdict: **dropped** as a general fill.

**D5. S-curves by splitting (lab).** A quadric cannot bend back. Find where an edge's cubic changes its bend: with `m = n0 + n1`, `a = m·(P2 − 2·P1 + P0)`, `b = m·(P3 − 2·P2 + P1)`, there is such a point when `a·b < 0`, at `t* = a / (a − b)`. Split there.
Verdict: the idea of a middle point **kept** (C2 now places it at the cubic's middle); the per-side quadrics dropped.

**D6. Trimming at the neighbour (lab).** Let each quad's surface end where it crosses its neighbour's.
Found: neighbours that share normals touch at the corners instead of crossing. Holes and ribbons.
Verdict: **dropped**.

**D7. Literature check.** Confirmed the two-point rule (4.3). Published methods that use quadrics split every face into many small pieces.
Verdict: the rule is **kept as a law**; it is why quadric fills fail.

**D8. Handles and arcs (example 04).** The owner's design: normals as handles, an arc between every two handles, sharp edges rounded by a blending distance.
Old arc rule: each end's direction = the edge flattened onto that end's tangent plane; `w = L·cos(turn/2)`, `L` = average handle length. Works when the two directions fall in one plane, else two arcs.
Rounding: per vertex a radius `r = blending × average edge length` and a centre `c` at distance `r` from each face plane around it; contact point `c + r·n̂`, fillet middle `c + r·norm(n̂A + n̂B)`, corner point `c + r·norm(sum of n̂)`.
Found: shared edges match exactly on every mesh; the hard cube becomes an exact rounded box; the smooth cube's arcs lie exactly on a sphere.
Verdict: the idea is **the foundation**. C2 changed the direction rule (the sheet); the rounding and handle length are **not yet in** the new build.

**D9. One quadric per piece, and the plane-pencil u, v (examples 04, 05).** Fill each piece with a quadric fitted to its four arcs. For `u, v`: each side arc lies in a plane; with `s0…s3` the signed distances of a point from the four side planes,
`u = s3 / (s3 − s1)`, `v = s0 / (s0 − s2)`.
Found: closes on sphere, rounded box and wave (their arcs agree with one quadric). The mixed cube misses by 8% of an edge, 3.4% after one more split, and further splits open holes. Handle length × 2 leaves pieces with no surface inside.
Verdict: **dropped** as the general fill (two-point rule). The plane-pencil `u, v` was per piece, not per quad.

**D10. Pixel corners by line of sight against the quadric (example 06).** One quadratic for the hit, the four side planes for inside/outside and `u, v`. Added a per-pixel depth ("occlusion map").
Found: clean where D9 closes; holes where it cracks. A bug where depths were in each piece's own units was found and fixed.
Verdict: the solve was right, the surface under it was not.

**D11. `u, v` from the edges as drawn on screen (examples 08–10).** For each projected side arc a value `K = b1 − 2·w'·√(b0·b2)` that is zero on the arc (`w' = w·zA / √(z0·z2)`); then `u = K3 / (K3 + K1)`, `v = K0 / (K0 + K2)`. Cheap, and crack-free by construction.
Found: exact on flat pieces only. On curved ones the `u, v` slides when the camera moves (smooth cube: 17.6% of an edge), and pieces that turn past the outline fail completely.
Why: a pixel is a line of sight; which surface point it sees depends on depth, and a flat drawing of the edges has no depth.
Verdict: **dropped**. What the owner wanted from it (u, v from the edges alone) is delivered by C4–C7, where the edges define the surface in 3D.

**D12. Which hit counts (example 11).** A line of sight meets a quadric twice. Rules tried: nearest hit inside the side planes (takes the far side on the wave); re-running the forward map and comparing (fails in float32); one facing sign per piece (fails on pieces that turn away partway); **per-pixel facing**, `t = (−b − σ·√D) / 2a`, which was the best.
Verdict: no longer needed. C6 keeps every verified hit and the nearest wins.

**D13. Bulge box and the packed layout (examples 11, 12).** The screen box of a quadric piece from its outline: planes through the camera that touch the quadric satisfy `πᵀ·C·π = 0`, with `C` the adjugate of the quadric's 4 × 4 matrix. All of a piece's numbers in one flat array; nothing read inside a row.
Verdict: the box is exact but belongs to quadrics. The layout idea (**no memory read per pixel inside a row**) is **kept** for any future pixel pass.

**D14. The step 17 pipeline and its review (example 12, log step 18).** Box + line of sight per pixel centre + per-pixel facing. Reported "0 wrong pixels" on three meshes.
Review over 48 camera angles: smooth cube and rounded box clean; wave wrong in 10 views; mixed cube wrong in all 48, with 5% holes. float32 broke flat pieces. And it had drifted from the requirements: pixel centres, pixels as the source, per-piece `u, v`.
Verdict: **replaced**.

**D15. Memory fetches (example 13, log step 18f).** See 6.2–6.4. **Kept** as the way to judge cost.

**D16. Curved triangles from the arcs (example 14, log step 19).** Built by the assistant before the owner's method was understood. It breaks rule 2 of Part A (an invented centre point; triangles not made of ellipses from handles) and was not what the owner meant. Kept here because it works as a fixed shape and its solve is a different closed form (degree 4).
Verdict: **set aside**. Not the owner's method.

### Cutting a quad into curved triangles

The quad's border is its 4 corners plus the middle point of every edge that became two arcs: 4 to 8 **border points**, joined by single arcs.

Each border point needs a normal. A corner uses the quad's normal there. A middle point uses the average of the edge's two end normals, straightened to be at right angles to the curve: `nM = norm( n̄ − (n̄ · Tm)·Tm )` with `n̄ = n0 + n2`.

**Arc between two points that each have one normal** (used for everything inside the quad): the same sheet rule as C2. Sheet through the chord and the average of the two normals; end directions where the sheet meets each tangent plane; then one arc.

**The centre point.** Take the middle of each of the 4 edges (for a single arc: its point at `t = 0.5`). Build one arc from the bottom middle to the top middle and one from the right middle to the left middle. Then

```
C  = halfway between the middle points of those two arcs
nC = norm( direction of the first at its middle × direction of the second at its middle )
```

turned to point the same way as the corner normals.

**The spokes.** One arc from every border point to `C`. Border point `i`, border point `i+1` and `C` make one curved triangle with three single arcs as sides.

**Known gap:** a spoke can be S-shaped and need its own middle point. That is not built; such a spoke is drawn straight and counted (16 on the wave).

### The surface of a curved triangle

Corners `V0, V1, V2`; arcs `{A01, w01}`, `{A12, w12}`, `{A20, w20}`. For `b = (b0, b1, b2)`:

```
N(b) = b0²·V0 + b1²·V1 + b2²·V2 + 2·b0·b1·w01·A01 + 2·b1·b2·w12·A12 + 2·b2·b0·w20·A20
D(b) = b0² + b1² + b2²         + 2·b0·b1·w01     + 2·b1·b2·w12     + 2·b2·b0·w20
point = N(b) / D(b)
```

Put `b2 = 0` and this is exactly the arc of 3.1 from `V0` to `V1` with `t = b1`. So the surface contains its three arcs by construction. Nothing is fitted; neighbours cannot crack apart. **Checked:** the largest gap between a triangle's surface and its arcs is 5e-16 on all four meshes.

What it does not promise: neighbours meet along an arc, but they need not be equally steep there. They agree at the corners only. A faint crease along an arc is possible; not measured.

### Which pixel corners a triangle tries

With positive weights the surface lies inside the hull of its 6 control points (3 corners, 3 apexes). So their positions on screen bound it. Example 14 tries every pixel corner in the screen box around those 6 points.
This is simple and safe but tries too many (2.5 for each hit on the mixed cube). Narrowing it to the triangle's exact spans, using where its arcs cross each pixel row (D2's quadratic), is **not built**.

### Pixel corner → point on the triangle

In camera coordinates, write each coordinate `k` (right, down, forward) of `N` as a symmetric matrix, and `D` as one more:

```
M_k = [[ V0k      , w01·A01k , w20·A20k ],
       [ w01·A01k , V1k      , w12·A12k ],
       [ w20·A20k , w12·A12k , V2k      ]]

M_1 = [[1, w01, w20], [w01, 1, w12], [w20, w12, 1]]
```

so that coordinate `k` of the point is `bᵀ·M_k·b / bᵀ·M_1·b`.

For the pixel corner `(x, y)`, the column knife and the row knife (1.5) become two conics in `b`:

```
G = f·M_right − (x − cx)·M_forward        column knife
H = f·M_down  − (y − cy)·M_forward        row knife
wanted: b with  bᵀ·G·b = 0  and  bᵀ·H·b = 0
```

Solve with the appendix (two conics):

1. Cubic in `λ` (coefficients in the appendix). Try each real root.
2. `K = G + λ·H`. Take `−adj(K)`; if its largest diagonal entry is not positive, this root gives no real lines. Else `p` = that column divided by the square root of that entry.
3. `K + crossmatrix(p)`: its largest entry's row is one line `l`, its column the other.
4. For each line: two points on it, `q1 = l × e` (e = the axis `l` is least along) and `q2 = l × q1`. Put `b = τ·q1 + s·q2` into the other conic `O` (use `G` if `|λ| > 1`, else `H`): with `a = q2ᵀOq2`, `h = q1ᵀOq2`, `c = q1ᵀOq1`, `q = −(h + sign(h)·√(h² − a·c))`, the two answers are `b = a·q1 + q·q2` and `b = q·q1 + c·q2`.
5. Scale each `b` to sum 1. Keep it if all three are ≥ 0 (inside the triangle), `D(b) > 0`, and the depth `z = bᵀ·M_forward·b / D(b)` is positive.
6. **Safety check:** project the point back to the screen. Keep it only if it lands within 0.001 px of the pixel corner. Nothing unverified is ever written.
7. Of everything kept, across all triangles, the nearest wins. There is no facing rule.

**Measured:** kept points land within 8e-7 px of their corner on every mesh.

### The quad's own u, v

Every border point has a `u, v`: corners `(0,0) (1,0) (1,1) (0,1)`, an edge's middle point halfway between its corners, the centre `(0.5, 0.5)`. Inside a triangle:

```
(u, v) = b0·uv0 + b1·uv1 + b2·uv2
```

Along an arc both neighbours use the arc's own `t`, so `u, v` is continuous across triangles and across quads. It is a fixed map on the surface: it cannot slide when the camera moves.

### From corners to a pixel

A pixel has 4 corners. Example 14 takes the quad of the nearest corner, averages the `u, v` of the corners on that quad, and fades the pixel by the share of corners that hit. Exact coverage (how much of the pixel the quad's edge cuts off) is **not built**.

### Measured (one run, default view, 240 × 240)

| Mesh | Triangles | Edges: one arc / two | Arcs not built | Corners tried / hit | Frame |
|---|---|---|---|---|---|
| Smooth cube | 24 | 12 / 0 | 0 | 143,705 / 55,960 | 92 ms |
| Mixed cube | 32 | 8 / 4 | 0 | 116,537 / 46,461 | 76 ms |
| Wave | 48 | 10 / 12 | 16 spokes | 34,112 / 9,055 | 74 ms |
| Hard cube | 24 | 12 / 0 | 0 | 91,304 / 38,194 | 105 ms |

The mixed cube, which every older method cracked on, draws closed in that view. Times are JavaScript in a browser, not the target.

### Appendix to D16: curves in a plane as 3 × 3 matrices

Needed only for the curved-triangle solve.

**a. A conic as a matrix.** With `b` a triple of numbers, `bᵀ·G·b = 0` (G a symmetric 3 × 3 matrix) is a conic in the plane of `b`. Only the direction of `b` matters, not its size.

**b. The adjugate.** For a symmetric `M = [[m00,m01,m02],[m01,m11,m12],[m02,m12,m22]]`:

```
adj(M) = [[ m11·m22−m12² , m02·m12−m01·m22 , m01·m12−m02·m11 ],
          [      ·       , m00·m22−m02²    , m01·m02−m00·m12 ],
          [      ·       ,       ·         , m00·m11−m01²    ]]
det(M) = m00·adj00 + m01·adj01 + m02·adj02
```

**c. A conic that is really two straight lines.** Happens exactly when `det = 0`. Then `−adj(K) = p·pᵀ`, where `p` is the point the two lines share. Adding the cross-product matrix of `p` to `K` leaves a matrix of rank 1 whose rows all describe one line and whose columns all describe the other.

**d. Where two conics meet.** Take conics `G` and `H`. Every mix `G + λ·H` passes through the same (up to 4) common points. For the right `λ` the mix is two straight lines (c), and those lines pass through the common points. Finding `λ` is a cubic:

```
det(H)·λ³ + tr(G·adj(H))·λ² + tr(adj(G)·H)·λ + det(G) = 0
```

Then each line against one conic is a quadratic. So: one cubic, one square root, two quadratics. This is the closed form behind the curved-triangle solve.

**D17. Edge marks only (example 15, log step 20).** Only the edge ellipses exist. A corner's two knives mark the edges, and in the `u, v` square the line between the row marks crosses the line between the column marks.
Found: exact on flat faces, all quadratics, fast. But between the marks it is flat: a face cannot bulge past its edges, so a ball is cut into lobes.
Verdict: the marks are **kept** (C3); going straight between them is **dropped** in favour of an ellipse from inherited normals (C4, C5). Its `u, v` rule is one of the two candidates in C7.

---

# Part E. Where things stand

## Decided by the owner

- Part A: the goal, the building block, the walk and the rules.
- A new point on an edge inherits its normal (C4), and two such points give a new ellipse (C5).
- A pixel corner is where the row ellipse and the column ellipse meet (C6).
- Handle length must act as bulge (not in any page yet).

## Filled in by the assistant, for the owner to confirm or change

1. The plane of an edge ellipse: through the edge and the average of its two end normals (C2).
2. When one ellipse becomes two: the tangent lines must meet at least 2% of the length in front of both ends; the middle point is the middle of a helper cubic (C2).
3. Sharp ends: the edge leaves along the one direction both faces allow, and one arc per mesh edge is shared by both quads (C1, C2). Rounding of sharp edges is left out.
4. Keeping an inherited normal at a right angle to its edge (C4).
5. Pairing a knife's marks in order along the knife (C3).

## Answered by the owner (log step 22)

- **The ellipse's size:** it may be positioned, scaled and squashed however needed and may be far bigger than the edge. Only an S needs two. (The pages still split curves that go the long way round an ellipse; to fix.)
- **Sharp edges:** a bevel-like strip between the two faces' handles, rounded along the normals; one user value sets how far it spreads inwards.
- **Row and column ellipses with a gap:** the corner never comes from only one of them. The combining rule is to be proposed.
- **Occlusion:** the real system needs the XYZ of each pixel corner on the surface; not now. For now, cull back faces.

## Open questions for the owner

1. An ellipse has one free number left after its two points and two directions. When the two handle lengths on an edge disagree, what sets it?
2. How the row ellipse and the column ellipse are combined (proposal pending).
3. How bevel strips meet at a corner where several sharp edges come together.

## Not done yet, in order

1. Build C6 and C7: the corner where the two ellipses meet, with one `u, v`. Measure the gap between the two ellipses on the mixed cube and the wave.
2. Check over 12 or more camera angles, counting seam and outline pixels, and whether the checker stays put when the camera moves.
3. Handle length.
4. The walk exactly as in Part A (C8), then exact coverage of partly covered pixels (C9).
5. float32, then native cost against the 500-cycle budget.

## Glossary

- **Apex:** the point where an ellipse arc's two end tangent lines meet.
- **Building block:** two points with two handles give one ellipse (two for an S).
- **Closed form:** a fixed recipe with a known number of operations; no "repeat until close enough".
- **Handle:** a normal at a point, used to shape the ellipses that leave that point.
- **Inherited normal:** the normal a new point on an edge takes from that edge's two end normals.
- **Knife:** the flat sheet from the camera through a row or a column of pixel corners.
- **Line of sight:** the straight line from the camera through one pixel corner; where a row knife and a column knife cross.
- **Mark:** a point where a knife crosses one of a quad's edge ellipses.
- **Normal:** the direction sticking straight out of a surface at a point. It belongs to one face's corner.
- **Pixel corner:** a point where four pixels meet.
- **Quadric:** a surface of degree 2 (sphere, ellipsoid, cylinder…). Used by the older methods.
- **u, v:** a quad's own two coordinates, each 0 to 1.
- **Weight:** the one number that says how full an ellipse arc is.
