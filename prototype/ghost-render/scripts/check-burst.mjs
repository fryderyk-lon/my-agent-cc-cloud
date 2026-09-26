// Diagnostic: render only the burst layers at a given age and report how much light each adds.
import { openPreview } from './lib.mjs';
const age = +(process.argv[2] || 0.25);
const { page, close } = await openPreview(260);
const logs = [];
page.on('console', m => logs.push(`${m.type()}: ${m.text().slice(0, 300)}`));
const r = await page.evaluate(age => {
  const g = window.__ghost();
  window.api.clip('attention', 0.72 + age, 'black');
  g.root.visible = false;
  const scene = g.root.parent;
  const burst = scene.children.find(o => o.isGroup && o !== g.root && o.children.length >= 4);
  const gl = document.querySelector('canvas').getContext('webgl2');
  const measure = () => {
    window.api.view(0, 4, 585);
    const px = new Uint8Array(260 * 260 * 4);
    gl.readPixels(0, 0, 260, 260, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0; for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
    return sum;
  };
  const out = { children: burst.children.map(c => `${c.type}${c.geometry?.instanceCount ? ' x' + c.geometry.instanceCount : ''} vis=${c.visible}`) };
  out.all = measure();
  burst.children.forEach((c, i) => {
    const vis = burst.children.map(x => x.visible);
    burst.children.forEach((x, j) => { x.visible = j === i; });
    out['only_' + i] = measure();
    burst.children.forEach((x, j) => { x.visible = vis[j]; });
  });
  g.root.visible = true;
  return out;
}, age);
console.log(JSON.stringify(r, null, 1));
console.log(logs.filter(l => /error|warn/i.test(l)).slice(0, 5).join('\n') || 'no errors');
await close();
