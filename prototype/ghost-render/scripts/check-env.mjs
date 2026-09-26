// Smoke test for the render environment: prints the WebGL renderer, times a few clip frames
// and saves one idle frame for a visual comparison with the shipped theme.
// Usage: node scripts/check-env.mjs [size=320] [outFile=build/check-idle.png]
import fs from 'node:fs';
import path from 'node:path';
import { openPreview } from './lib.mjs';

const [size = '320', outFile = 'build/check-idle.png'] = process.argv.slice(2);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const t0 = Date.now();
const { page, close } = await openPreview(+size);
const gl = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const ext = c && c.getExtension('WEBGL_debug_renderer_info');
  return ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log(`renderer: ${gl}   (page ready in ${Date.now() - t0} ms)`);
const t1 = Date.now();
for (let i = 0; i < 10; i++) {
  await page.evaluate(t => window.api.clip('working', t), i / 15);
  await page.screenshot({ omitBackground: true });
}
console.log(`10 frames in ${Date.now() - t1} ms`);
await page.evaluate(() => window.api.clip('idle', 0));
await page.screenshot({ path: outFile, omitBackground: true });
console.log(`saved ${outFile}`);
await close();
