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
- A formula is preferred over iteration. The real limit is cost: about 500 cycles per pixel, 1,000 at most, memory fetches included.
- Occlusion is only a placeholder for the engine's own system. Keep it tiny. It must not shape the design.

## Rules

1. Read `docs/method-guide.md` (the exact methods, in order, with what is checked and what is not) and `docs/rnd-log.md` step 18 first. It has the confirmed intent, what went wrong before, and the next thing to build with its recipe.
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

- Solid: the edge arcs (steps 8–9a). Shared edges match exactly.
- Broken: filling a quad with one fitted shape. It cracks on general meshes (mixed cube: holes at every angle).
- Proven: a whole quad with four free arc edges has no formula for a pixel corner (degree 8).
- Next to test: two (or four) curved triangles per quad, each spanned by three arcs. No fitting, edges exact, one formula per pixel corner, u, v attached to the surface. Built in example 14 (log step 19): closed on the mixed cube in one view; not yet checked over many angles.

## Next step

Example 14 (log step 19) is the clean build of the curved-triangle method, made from zero. Work from it, not from examples 00–12.
First ask the owner what they see in it and whether they accept the three decisions listed in step 19. Then, in this order: check it over 12+ camera angles with seam and outline pixels counted; fix the centre arcs that fail on the wave; replace the control-point box with exact spans.

## Questions still open with the owner

1. Is a faint crease along a quad edge or the diagonal acceptable?
2. If curved triangles fail, is a fixed number of correction steps allowed?
3. What does the engine's real occlusion system need from this?
