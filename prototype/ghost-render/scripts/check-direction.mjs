// Diagnostic: render one ring at a time at two moments of the "working" clip to confirm which way
// each ring turns on screen. Usage: node scripts/check-direction.mjs [outFile=build/check-rings.png]
import { openPreview } from './lib.mjs';
const out = process.argv[2] || 'build/check-rings.png';
const { page, close } = await openPreview(400);
const shots = [];
for (const ring of ['front', 'back']) {
  for (const t of [0, 0.25]) {
    const buf = await page.evaluate(([r, tt]) => {
      window.api.clip('working', tt, 'black');
      const g = window.__ghost();
      g.rings.front.visible = r === 'front'; g.rings.back.visible = r === 'back';
      g.root.rotation.set(0, 0, 0);                     // face the camera squarely for the check
      window.api.view(0, 0, 450);
      const url = document.querySelector('canvas').toDataURL('image/png');
      g.rings.front.visible = g.rings.back.visible = true;
      return url;
    }, [ring, t]);
    shots.push({ ring, t, buf });
  }
}
import fs from 'node:fs';
fs.writeFileSync(out.replace(/\.png$/, '.json'), JSON.stringify(shots.map(s => ({ ring: s.ring, t: s.t }))));
shots.forEach((s, i) => fs.writeFileSync(out.replace(/\.png$/, `-${i}.png`), Buffer.from(s.buf.split(',')[1], 'base64')));
console.log('wrote', shots.length, 'shots');
await close();
