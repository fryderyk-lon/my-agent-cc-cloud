// Usage: node scripts/render-anim.mjs shots/sequence.json frames [size] [fps] [theme]
// sequence.json: [[state, seconds], ...] -> transparent PNG frames fNNNN.png (+ frames.json with the state per frame)
import fs from 'node:fs';
import { openPreview } from './lib.mjs';

const [seqFile, outDir = 'frames', size = '256', fps = '15', theme = 'classic'] = process.argv.slice(2);
const seq = JSON.parse(fs.readFileSync(seqFile, 'utf8'));
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const { page, close } = await openPreview(+size);
await page.evaluate(th => window.api.setTheme(th), theme);
const index = [];
for (const [state, secs] of seq) {
  for (let i = 0; i < Math.round(secs * fps); i++) {
    await page.evaluate(([s, t]) => { window.api.anim(s, t); window.api.view(0, 4, 320); }, [state, i / fps]);
    const name = `f${String(index.length).padStart(4, '0')}.png`;
    await page.screenshot({ path: `${outDir}/${name}`, omitBackground: true });
    index.push({ frame: name, state });
  }
}
fs.writeFileSync(`${outDir}/frames.json`, JSON.stringify({ fps: +fps, frames: index }, null, 1));
console.log(`rendered ${index.length} frames to ${outDir}/`);
await close();
