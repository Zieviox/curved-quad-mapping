# tools

- `stress-kernels.src.js`: every method tested by `examples/11-op-stress-test.html`, written once.
- `gen-kernels.js`: builds the page's three versions of those kernels (float64 as written, float32 with every operation rounded, counted with every operation tallied).
  Needs `acorn` and `escodegen` (`npm i acorn escodegen`). Usage: `node tools/gen-kernels.js tools/stress-kernels.src.js out.js`, then paste `out.js` into the page's script in place of the kernels block.

## mem-test (step 18)

The step 17 pixel pass compiled natively (float32) to time it in processor cycles and to count its memory fetches.

- `export.js`: writes each mesh's packed per-piece numbers from `examples/12-coverage-check.html` into `data/` (needs `playwright`). Run it from this folder after `mkdir data`.
- `span.inc`: the pixel pass for one row of one piece, the same arithmetic as `spanRay` mode 4. Included three times by `memtest.c`: timed, counted (every fetch reported to a cache model), and arithmetic only (one-row buffer).
- `memtest.c`: `gcc -O2 -march=native -ffp-contract=fast -o memtest memtest.c -lm && ./memtest data > result.json`. The cache sizes in `main` are the test server's; change them for another machine.
  The numbers in the log's step 18 come from an earlier run of this program with a simpler fetch counter (third consecutive block onward counted as ready). The version saved here counts several warm-up lengths and has not been run to the end.
