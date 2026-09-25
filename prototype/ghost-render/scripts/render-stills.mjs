// Usage: node scripts/render-stills.mjs shots/states.json out [size]
// Each shot: { name, theme?: 'classic' | 'claude', pose?: {...see src/anim.js}, view?: [azimuth, elevation, distance] }
import fs from 'node:fs';
import { openPreview } from './lib.mjs';

const [shotsFile, outDir = 'out', size = '600'] = process.argv.slice(2);
const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const { page, close } = await openPreview(+size);
for (const s of shots) {
  await page.evaluate((s) => {
    if (s.theme) window.api.setTheme(s.theme);
    window.api.pose(s.pose || {});
    window.api.view(...(s.view || [30, 12, 320]));
  }, s);
  await page.screenshot({ path: `${outDir}/${s.name}.png`, omitBackground: true });
}
console.log(`rendered ${shots.length} stills to ${outDir}/`);
await close();
