// Proxy benchmark for clawd's renderer (also Chromium): play one animated WebP in headless Chrome at the
// size clawd would show it and measure the CPU of the whole browser process tree.
// Usage: node scripts/bench-cpu.mjs <file.webp> <displayPx> [seconds=10]
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const [file, px, secs = '10'] = process.argv.slice(2);
const data = fs.readFileSync(file).toString('base64');
// a throw-away profile dir marks every process of this browser, so they can be found by command line
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-bench-'));
const browser = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, args: ['--use-angle=metal'], viewport: { width: 400, height: 400 } });
const page = browser.pages()[0] || await browser.newPage();
await page.setContent(`<body style="margin:0;background:transparent"><img style="width:${px}px;height:${px}px" src="data:image/webp;base64,${data}"></body>`);
await page.waitForTimeout(2500);
const pids = execSync(`pgrep -f ${profile}`).toString().trim().split('\n').filter(Boolean);
const args = pids.map(p => `-pid ${p}`).join(' ');
const out = execSync(`top -l ${Math.ceil(+secs / 5) + 1} -s 5 -stats pid,cpu ${args}`).toString();
const samples = []; let sum = null;
for (const line of out.split('\n')) {
  if (line.startsWith('PID')) { if (sum !== null) samples.push(sum); sum = 0; continue; }
  const m = line.trim().match(/^(\d+)\s+([\d.]+)/); if (m && sum !== null) sum += +m[2];
}
samples.push(sum);
const used = samples.slice(1);
console.log(`${file.split('/').pop()} @ ${px}px: ${(used.reduce((a, b) => a + b, 0) / used.length).toFixed(1)}% CPU (${used.map(v => v.toFixed(1)).join(', ')})`);
await browser.close();
