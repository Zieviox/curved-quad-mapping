const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('file://'+require('path').resolve(__dirname,'../../examples/12-coverage-check.html'), { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1000);
  for (const mesh of [0, 1, 3]) for (const c of [34, 68, 135, 270, 540, 1080, 2160]) {
    const r = await p.evaluate(([mesh, W]) => { const S = loadMesh(mesh), cam = makeCamera(W, S.centre, S.yaw0 + 0.75, Math.max(-1.3, Math.min(1.3, S.pitch0 + 0.3)), 3.6 * S.radius), Fr = { S, cam, W, rec: S.pieces.map(P => frameRecord(P, cam)) }, B = packFrame(Fr);
      const pipe = { key: 'B', mode: 4, walk: 'box', margin: 1 }, o = runPacked(Fr, B, pipe, K64); let cov = 0; for (let k = 0; k < o.pid.length; k++) if (o.pid[k] >= 0) cov++;
      for (const k in OPS) OPS[k] = 0; runPacked(Fr, B, pipe, KC); const ops = {}; for (const k in OPS) ops[k] = OPS[k] / o.walked;
      return { B: Array.from(new Float32Array(B)), valid: Fr.rec.map(r => r ? 1 : 0), walked: o.walked, cov, pid: Array.from(o.pid), ops, model: model(ops) }; }, [mesh, c]);
    fs.writeFileSync(`data/m${mesh}_c${c}.bin`, Buffer.from(new Float32Array(r.B).buffer));
    fs.writeFileSync(`data/m${mesh}_c${c}.pid`, Buffer.from(new Int16Array(r.pid).buffer));
    fs.writeFileSync(`data/m${mesh}_c${c}.json`, JSON.stringify({ n: r.valid.length, valid: r.valid, walked: r.walked, cov: r.cov, ops: r.ops, model: r.model }));
    console.log(mesh, c, r.valid.length, r.walked, r.cov, r.model.toFixed(2), JSON.stringify(Object.fromEntries(Object.entries(r.ops).map(([k, v]) => [k, +v.toFixed(2)]))));
  }
  await b.close();
})();
