# Read this before doing anything

This is the owner's R&D. The owner sets the direction; you work inside it.
An earlier session drifted from the intent and reported results that didn't hold. Don't repeat that.

## The intent (do not change any of this without asking the owner first)

- Quad mesh in. Every edge is an ellipse arc (or two joined at the middle), shaped by the vertex normals used as handles.
- The curved surface is drawn directly on screen. It is never turned into flat polygons.
- CPU only. No GPU, on purpose.
- The surface is the source: each quad finds its own pixels from its own edges. No testing of pixels a quad doesn't touch.
- Pixel corners, not pixel centres (for exact coverage).
- Output per pixel corner: the quad's own u, v in 0…1 (for textures later). Not a per-piece u, v.
- It should look like a subdivided or NURBS model that passes through the mesh points and follows the normals. Real time.
- A formula is preferred over iteration. The real limit is cost: about 500 cycles per pixel, 1,000 at most, memory fetches included.
- Occlusion is only a placeholder for the engine's own system. Keep it tiny. It must not shape the design.

## Rules

1. Read `docs/method-guide.md` first (the goal, the concepts, the current method with what is built and what is not, and every older method). `docs/rnd-log.md` has the history and numbers.
2. If a result pushes against the intent, stop and ask the owner. Never switch direction on your own, and never call a switch a "revert" or an "optimization".
3. The owner cannot review code. Ask about concepts in plain words, one question at a time, with a concrete example. Report in plain words too.
4. Say only what you measured in this session. Give the number. If you didn't run it, say "not tested". Never fill a gap with a guess.
5. "It works" needs: the mixed cube (the mesh that fails), at least 12 camera angles, and seam and outline pixels counted. One view of an easy mesh proves nothing.
6. Don't test against an answer built from the same code you are testing.
7. Model cycles are a best case. Measured native cost was 1.5–2.3× the model. Say which one a number is.
8. Every step is a page the owner can open and look at, plus a short log entry. The owner wants to see it, not read tables.
9. Usage is limited. Small steps. Ask before a long run. Don't polish, don't rebuild what exists.
10. When a decision is made, write it in the log with who made it.

## Where things stand

The owner's method, agreed in talk (full detail: `docs/method-guide.md` Part A and Part C; log steps 20 and 21):

- Building block: two points, each with a normal as a handle, give one ellipse (two for an S). It is one curve between two handles, never one shape over a whole quad. The owner calls it an ellipsoid.
- The middle of a quad is made only of ellipses that come off the edge ellipses: a knife marks two edges, each mark inherits a normal from its edge, and the two marks give a new ellipse.
- A pixel corner is where the row knife's ellipse and the column knife's ellipse meet. u is read from one, v from the other.
- The walk is on the screen, pixel by pixel, starting from the pixel the quad lands in.
- A normal belongs to one face's corner; faces share it only where the surface is perfectly smooth.
- The look to reach: a subdivided or NURBS model, not shrunk, following the normals, in real time.

Built as test pages: examples 16 and 17. Exact on a ball and on flat faces, all quadratics.
Found: on general shapes (mixed cube, wave) the row ellipse and the column ellipse do not meet, and the picture wobbles when the camera turns, because the knives turn with the camera. The owner saw the wobble.
Set aside, not the owner's method: fitted quadrics (steps 4–17) and curved triangles with a centre point (example 14).

## Next step

The open problem (method guide C6): the middle of a quad must be one shape that does not move with the camera, made only of ellipses from handles, with a formula for a pixel corner. Talk it through with the owner before building anything. Do not add shapes, points or rules of your own to the middle of a quad; where a detail is missing, ask.

## Questions still open with the owner

1. How the middle of a quad becomes one fixed shape (see Next step).
2. Handle length when two lengths on one edge ask for different bulges (suggested: split in two like an S; not confirmed).
3. How bevel strips meet at a corner where several sharp edges come together.
