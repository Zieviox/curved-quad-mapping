# tools

- `stress-kernels.src.js`: every method tested by `examples/11-op-stress-test.html`, written once.
- `gen-kernels.js`: builds the page's three versions of those kernels (float64 as written, float32 with every operation rounded, counted with every operation tallied).
  Needs `acorn` and `escodegen` (`npm i acorn escodegen`). Usage: `node tools/gen-kernels.js tools/stress-kernels.src.js out.js`, then paste `out.js` into the page's script in place of the kernels block.
