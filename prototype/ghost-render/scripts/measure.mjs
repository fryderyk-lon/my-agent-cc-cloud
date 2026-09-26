// Diagnostic: how big the core is and how close the corners' inner faces sit, in the model frame (mm).
import { openPreview } from './lib.mjs';
const { page, close } = await openPreview(200);
const r = await page.evaluate(() => {
  const g = window.__ghost();
  window.api.pose({ open: 0 });
  g.root.rotation.set(0, 0, 0); g.root.position.set(0, 0, 0);
  g.root.updateMatrixWorld(true);
  const inv = g.model.matrixWorld.clone().invert();
  const v = new g.root.position.constructor();
  const dist = (obj, fn) => {
    let best = fn === 'max' ? 0 : Infinity;
    obj.traverse(o => {
      if (!o.isMesh || !o.geometry.attributes.position || o.geometry.attributes.along) return;   // skip the scan beam
      const m = inv.clone().multiply(o.matrixWorld), pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        const d = v.length();
        best = fn === 'max' ? Math.max(best, d) : Math.min(best, d);
      }
    });
    return best;
  };
  const coreMax = dist(g.core, 'max');
  const cornersMin = Math.min(...g.corners.map(c => dist(c.corner, 'min')));
  const cornersTip = Math.max(...g.corners.map(c => dist(c.corner, 'max')));
  const body = new g.root.constructor(); body.add(g.core.children[0].clone(), g.core.children[1].clone());
  body.children.forEach(m => { m.matrixWorld.copy(g.model.matrixWorld).multiply(m.matrix); });
  let ball = 0; for (const m of body.children) { const pos = m.geometry.attributes.position; for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrix); ball = Math.max(ball, v.length()); } }
  return { coreMax, ball, cornersMin, cornersTip };
});
console.log(JSON.stringify(r));
await close();
