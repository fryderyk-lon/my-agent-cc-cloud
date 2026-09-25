// Render every clip in src/theme-clips.js to transparent PNG frames for the clawd theme.
// Usage: node scripts/build-clawd-theme.mjs [outDir=build/clawd-theme] [size=320] [theme=classic] [onlyClipIds]
//        onlyClipIds (comma-separated) re-renders just those clips and keeps the other frames.
// Then:  python3 scripts/pack-clawd-theme.py [outDir]   (encodes WebP, writes theme.json, zips)
import fs from 'node:fs';
import path from 'node:path';
import { openPreview } from './lib.mjs';
import { THEME_BINDINGS, VIEW } from '../src/theme-clips.js';

const [outDir = 'build/clawd-theme', sizeArg = '320', theme = 'classic', onlyArg] = process.argv.slice(2);
const size = +sizeArg;
const only = onlyArg ? new Set(onlyArg.split(',')) : null;
const framesRoot = path.join(outDir, 'frames');
if (!only) fs.rmSync(framesRoot, { recursive: true, force: true });

const { page, close } = await openPreview(size);
await page.evaluate(th => window.api.setTheme(th), theme);
const clips = await page.evaluate(() => window.api.clipList());
const manifest = { size, theme, view: VIEW, bindings: THEME_BINDINGS, clips: [] };
for (const clip of clips) {
  // loops stop one frame short of `duration` (that frame equals t = 0);
  // one-shots include it so they end exactly on the idle pose
  const count = Math.round(clip.duration * clip.fps) + (clip.loop ? 0 : 1);
  manifest.clips.push({ ...clip, frames: count });
  if (only && !only.has(clip.id)) continue;
  const dir = path.join(framesRoot, clip.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < count; i++) {
    await page.evaluate(([id, t]) => window.api.clip(id, t), [clip.id, i / clip.fps]);
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.png`), omitBackground: true });
  }
  console.log(`${clip.id.padEnd(18)} ${String(count).padStart(3)} frames @ ${clip.fps} fps${clip.loop ? '' : ' (one-shot)'}`);
}
fs.writeFileSync(path.join(framesRoot, 'manifest.json'), JSON.stringify(manifest, null, 1));
await close();
