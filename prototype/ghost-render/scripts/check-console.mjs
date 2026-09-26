// Diagnostic: render one clip frame and print any WebGL/shader errors from the page console.
import { chromium } from 'playwright';
import { openPreview } from './lib.mjs';
const [clip = 'attention', t = '0.95'] = process.argv.slice(2);
const { page, close } = await openPreview(260);
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 600)}`); });
await page.evaluate(([c, tt]) => window.api.clip(c, +tt, 'black'), [clip, t]);
await page.waitForTimeout(300);
console.log(logs.length ? logs.join('\n') : 'no console errors');
await close();
