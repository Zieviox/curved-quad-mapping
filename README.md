# curved-quad-mapping

`pixel-walk-test.html` — standalone test of the CPU pixel-step walker for curved quads (Nagata, Phong, PN-quad). Open it in any browser, including a phone. It walks each patch in one-pixel (u, v) steps, compares the emitted pixels against a dense resample of the same surface, and reports gaps, overdraw, steps/rows per patch, clamps, gap causes and JS timing. Tap a pixel to inspect it; "Copy report" puts a text summary on the clipboard.
