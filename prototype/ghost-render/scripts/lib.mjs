// Shared helpers: a tiny static server for the preview page and a headless browser —
// the installed Chrome on the GPU by default, or Chromium with software WebGL (GHOST_GL=swiftshader).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };

export async function openPreview(size, query = '') {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  // Default: the installed Google Chrome on the GPU (fast, no browser download).
  // GHOST_GL=swiftshader keeps the original software path for machines without a GPU or Chrome.
  const soft = process.env.GHOST_GL === 'swiftshader';
  const browser = await chromium.launch(soft
    ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
    : { channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  page.on('pageerror', e => console.error('[page]', e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?w=${size}&h=${size}${query}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  return { page, close: async () => { await browser.close(); server.close(); } };
}
