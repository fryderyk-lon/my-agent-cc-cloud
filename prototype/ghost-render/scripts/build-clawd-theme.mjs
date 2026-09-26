// Render every clip in src/theme-clips.js to transparent PNG frames for the clawd theme.
// Usage: node scripts/build-clawd-theme.mjs [outDir=build/clawd-theme] [size=520] [theme=classic] [onlyClipIds]
//        onlyClipIds (comma-separated) re-renders just those clips and keeps the other frames.
// Each frame is rendered on black and on white; scripts/matte.py turns the pair into one RGBA frame,
// which keeps additive glow (eye, energy sphere, burst) correct on a transparent canvas.
// Then:  python3 scripts/pack-clawd-theme.py [outDir]   (encodes WebP, writes theme.json, zips)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openPreview } from './lib.mjs';
import { THEME_BINDINGS, VIEW, CANVAS } from '../src/theme-clips.js';

const [outDir = 'build/clawd-theme', sizeArg = String(CANVAS), theme = 'classic', onlyArg] = process.argv.slice(2);
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
    const n = String(i).padStart(4, '0');
    for (const bg of ['black', 'white']) {
      await page.evaluate(([id, t, b]) => window.api.clip(id, t, b), [clip.id, i / clip.fps, bg]);
      await page.screenshot({ path: path.join(dir, `${bg[0]}_f${n}.png`) });
    }
  }
  console.log(`${clip.id.padEnd(18)} ${String(count).padStart(3)} frames @ ${clip.fps} fps${clip.loop ? '' : ' (one-shot)'}`);
}
fs.writeFileSync(path.join(framesRoot, 'manifest.json'), JSON.stringify(manifest, null, 1));
await close();
execFileSync('python3', [path.join(path.dirname(fileURLToPath(import.meta.url)), 'matte.py'), framesRoot, onlyArg ?? ''], { stdio: 'inherit' });
