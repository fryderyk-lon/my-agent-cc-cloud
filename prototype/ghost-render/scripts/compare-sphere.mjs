// One-off comparison: how big the working energy sphere can be.
//   A  400 canvas, Ghost at today's on-screen size, sphere ~2x the core radius
//   C  520 canvas (Ghost shown ~22% smaller in the same window), sphere ~3x the core radius
// Writes black/white pairs to build/compare/<name>_{b,w}.png for scripts/matte-pair.py.
import fs from 'node:fs';
import { openPreview } from './lib.mjs';
fs.mkdirSync('build/compare', { recursive: true });
const CORE_R = 31.2, CORNER_IN = 29.8, GAP = 4;
const options = [
  { name: 'A', size: 400, dist: 450, sphereR: 62 },
  { name: 'C', size: 520, dist: 585, sphereR: 94 },
];
for (const o of options) {
  const { page, close } = await openPreview(o.size);
  const lift = o.sphereR + GAP - CORNER_IN;
  for (const bg of ['black', 'white']) {
    await page.evaluate(([bg, lift, r, dist]) => {
      window.api.setBackground(bg);
      window.api.pose({ open: lift, ringFront: 35, ringBack: 35, eye: 0x3fd4ff, eyeIntensity: 1.3, core: 1.3,
        sphere: { intensity: 1.1, radius: r, spin: 40, flow: 0.3, color: 0x6aa8ff }, yaw: -18, pitch: 6 });
      window.api.view(0, 4, dist);
    }, [bg, lift, o.sphereR, o.dist]);
    await page.screenshot({ path: `build/compare/${o.name}_${bg[0]}.png` });
  }
  console.log(o.name, 'lift', lift.toFixed(1), 'mm, sphere', (o.sphereR / CORE_R).toFixed(1), 'x core');
  await close();
}
