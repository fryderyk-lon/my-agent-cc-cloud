// Diagnostic: try variants of the mist vertex shader to find why instanced particles draw nothing.
import { openPreview } from './lib.mjs';
const { page, close } = await openPreview(260);
const r = await page.evaluate(() => {
  const g = window.__ghost();
  window.api.clip('attention', 0.97, 'black');
  g.root.visible = false;
  const scene = g.root.parent;
  const burst = scene.children.find(o => o.isGroup && o !== g.root && o.children.length >= 4);
  const mist = burst.children[0];
  burst.children.forEach((x, j) => { x.visible = j === 0; });
  const gl = document.querySelector('canvas').getContext('webgl2');
  const measure = () => { window.api.view(0, 4, 585); const px = new Uint8Array(260 * 260 * 4); gl.readPixels(0, 0, 260, 260, gl.RGBA, gl.UNSIGNED_BYTE, px); let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i] + px[i + 1] + px[i + 2]; return s; };
  const out = { uAge: mist.material.uniforms.uAge.value, instanceCount: mist.geometry.instanceCount, attrs: Object.keys(mist.geometry.attributes), index: !!mist.geometry.index, drawRange: JSON.stringify(mist.geometry.drawRange) };
  out.original = measure();
  const vs0 = mist.material.vertexShader;
  // variant 1: no culling line
  mist.material.vertexShader = vs0.replace(/if \(age <= 0\.0 \|\| life >= 1\.0\)[^\n]*\n/, '');
  mist.material.needsUpdate = true; out.noCull = measure();
  // variant 2: plain fixed-size billboard at the particle position
  mist.material.vertexShader = vs0.replace(/mv\.xy \+= d \* position\.y \* len[^\n]*\n/, 'mv.xy += position.xy * 40.0;\n').replace(/if \(age <= 0\.0 \|\| life >= 1\.0\)[^\n]*\n/, '');
  mist.material.needsUpdate = true; out.plainBillboard = measure();
  // variant 2b: stretched with the direction but fixed length/width
  mist.material.vertexShader = vs0.replace(/mv\.xy \+= d \* position\.y \* len[^\n]*\n/, 'mv.xy += d * position.y * 40.0 + vec2(-d.y, d.x) * position.x * 40.0;\n');
  mist.material.needsUpdate = true; out.dirFixed = measure();
  // variant 2c: direction from aDir without the view matrix
  mist.material.vertexShader = vs0.replace(/vec2 d = normalize\([^\n]*\n/, 'vec2 d = normalize(dir.xy + vec2(1e-5));\n');
  mist.material.needsUpdate = true; out.dirNoMatrix = measure();
  // variant 2d: original stretch, length/width only
  mist.material.vertexShader = vs0.replace(/mv\.xy \+= d \* position\.y \* len[^\n]*\n/, 'mv.xy += position.xy * vec2(wid, len);\n');
  mist.material.needsUpdate = true; out.lenWidOnly = measure();
  // variant 3: fragment forced white
  mist.material.fragmentShader = 'void main(){ gl_FragColor = vec4(1.0); }';
  mist.material.needsUpdate = true; out.whiteFrag = measure();
  return out;
});
console.log(JSON.stringify(r, null, 1));
await close();
