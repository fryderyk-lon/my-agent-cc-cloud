// Invariants for the clawd theme clips (src/theme-clips.js). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS, THEME_BINDINGS, BASE, LIFT_MAX_DAILY, CORE_R, CORNER_IN } from '../src/theme-clips.js';

// Corners as the renderer sees them: ring + phase (angle round the eye axis).
const CORNERS = ['front', 'back'].flatMap(ring => [0, 90, 180, 270].map(phase => ({ ring, phase })));
const lifts = p => CORNERS.map(c => (typeof p.open === 'function' ? p.open(c) : p.open ?? 0));
const perCorner = p => typeof p.open === 'function' || p.tumble !== undefined;
const times = clip => {
  const n = Math.round(clip.duration * clip.fps);
  return Array.from({ length: n + 1 }, (_, i) => Math.min(i / clip.fps, clip.duration));
};
const mod = (x, m) => ((x % m) + m) % m;
const angleClose = (a, b, m) => Math.min(mod(a - b, m), mod(b - a, m)) < 0.5;

// Fields that must match wherever two poses meet (loop seam, entry, exit).
function assertSamePose(a, b, where, ringModulo) {
  assert.ok(lifts(a).every((v, i) => Math.abs(v - lifts(b)[i]) < 0.5), `${where}: lift ${lifts(a)} vs ${lifts(b)}`);
  for (const f of ['yaw', 'pitch', 'roll', 'hover']) {
    assert.ok(Math.abs((a[f] ?? 0) - (b[f] ?? 0)) < 0.5, `${where}: ${f} ${a[f]} vs ${b[f]}`);
  }
  assert.ok(Math.abs((a.zoom ?? 1) - (b.zoom ?? 1)) < 0.01, `${where}: zoom ${a.zoom} vs ${b.zoom}`);
  assert.ok(Math.abs((a.eyeIntensity ?? 1) - (b.eyeIntensity ?? 1)) < 0.05, `${where}: eyeIntensity ${a.eyeIntensity} vs ${b.eyeIntensity}`);
  assert.equal(a.eye, b.eye, `${where}: eye colour`);
  const sa = a.sphere?.intensity ?? 0, sb = b.sphere?.intensity ?? 0;
  assert.ok(Math.abs(sa - sb) < 0.05, `${where}: sphere intensity ${sa} vs ${sb}`);
  for (const f of ['ringFront', 'ringBack']) {
    assert.ok(angleClose(a[f] ?? 0, b[f] ?? 0, ringModulo), `${where}: ${f} ${a[f]} vs ${b[f]} (mod ${ringModulo})`);
  }
}

test('every clip renders at 30 fps', () => {
  for (const c of CLIPS) assert.equal(c.fps, 30, c.id);
});

test('front ring only turns clockwise and back ring only counter-clockwise', () => {
  // ringFront > 0 means clockwise and ringBack > 0 counter-clockwise, seen from the eye.
  for (const c of CLIPS) {
    const ts = times(c);
    for (let i = 1; i < ts.length; i++) {
      const p0 = c.pose(ts[i - 1]), p1 = c.pose(ts[i]);
      assert.ok((p1.ringFront ?? 0) >= (p0.ringFront ?? 0) - 1e-6, `${c.id}: front ring reverses at t=${ts[i]}`);
      assert.ok((p1.ringBack ?? 0) >= (p0.ringBack ?? 0) - 1e-6, `${c.id}: back ring reverses at t=${ts[i]}`);
    }
  }
});

test('clips that open the shell turn both rings', () => {
  for (const c of CLIPS) {
    const ts = times(c);
    const maxLift = Math.max(...ts.flatMap(t => lifts(c.pose(t))));
    if (maxLift <= 8) continue;
    const first = c.pose(0), last = c.pose(c.duration);
    assert.ok((last.ringFront ?? 0) - (first.ringFront ?? 0) >= 45, `${c.id}: front ring barely turns`);
    assert.ok((last.ringBack ?? 0) - (first.ringBack ?? 0) >= 45, `${c.id}: back ring barely turns`);
  }
});

// Where each corner sits round the eye axis (degrees, seen from the eye; phase grows counter-clockwise):
// the front ring turns clockwise, the back ring counter-clockwise.
const positionOf = (p, c) => mod(c.ring === 'front' ? c.phase - (p.ringFront ?? 0) : c.phase + (p.ringBack ?? 0), 360);
// A loop closes when the same positions hold corners with the same lifts, whichever corner is where.
const layout = p => CORNERS.map(c => ({ key: `${c.ring}@${Math.round(positionOf(p, c)) % 360}`, lift: typeof p.open === 'function' ? p.open(c) : p.open ?? 0 }))
  .sort((x, y) => (x.key < y.key ? -1 : 1));
const sameLayout = (a, b) => a.every((x, i) => x.key === b[i].key && Math.abs(x.lift - b[i].lift) < 0.5);

test('looping clips are seamless', () => {
  for (const c of CLIPS.filter(x => x.loop)) {
    const a = c.pose(0), b = c.pose(c.duration);
    if (perCorner(a)) assert.ok(sameLayout(layout(b), layout(a)), `${c.id} loop seam: corner layout differs ${JSON.stringify(layout(b))} vs ${JSON.stringify(layout(a))}`);
    assertSamePose({ ...a, open: 0 }, { ...b, open: 0 }, `${c.id} loop seam`, 90);
    if (a.sphere || b.sphere) {
      const df = (b.sphere?.flow ?? 0) - (a.sphere?.flow ?? 0);
      assert.ok(Math.abs(df - Math.round(df)) < 1e-6, `${c.id}: sphere flow must advance whole cycles`);
      assert.ok(angleClose(a.sphere?.spin ?? 0, b.sphere?.spin ?? 0, 360), `${c.id}: sphere spin must close`);
    }
  }
});

test('one-shot clips start and end on their declared base poses', () => {
  for (const c of CLIPS.filter(x => !x.loop)) {
    assert.ok(BASE[c.from] && BASE[c.to], `${c.id}: needs from/to base poses (got ${c.from} -> ${c.to})`);
    assertSamePose(c.pose(0), BASE[c.from], `${c.id} start`, 90);
    assertSamePose(c.pose(c.duration), BASE[c.to], `${c.id} end`, 90);
  }
});

test('everyday clips stay within the daily lift limit unless the camera pulls back', () => {
  for (const c of CLIPS) {
    for (const t of times(c)) {
      const p = c.pose(t);
      const limit = LIFT_MAX_DAILY * (p.zoom ?? 1);
      assert.ok(Math.max(...lifts(p)) <= limit + 1e-6, `${c.id}: lift ${Math.max(...lifts(p))} > ${limit} at t=${t}`);
    }
  }
});

test('every state in the shot list has a clip', () => {
  const ids = new Set(CLIPS.map(c => c.id));
  const b = THEME_BINDINGS;
  const need = [
    ...Object.values(b.states), ...b.workingTiers.map(x => x[1]), ...b.jugglingTiers.map(x => x[1]), ...b.idleAnimations,
    ...Object.values(b.reactions).flatMap(r => (typeof r === 'string' ? [r] : Object.values(r))),
  ];
  for (const id of need) assert.ok(ids.has(id), `missing clip ${id}`);
  for (const s of ['idle', 'thinking', 'working', 'juggling', 'notification', 'attention', 'error', 'sweeping',
    'carrying', 'roam', 'yawning', 'dozing', 'collapsing', 'sleeping', 'waking']) {
    assert.ok(b.states[s], `state ${s} is not bound`);
  }
  assert.equal(b.workingTiers.length, 3);
  assert.equal(b.jugglingTiers.length, 2);
  assert.equal(b.idleAnimations.length, 4);
  for (const r of ['drag', 'clickLeft', 'clickRight', 'annoyed', 'double']) assert.ok(b.reactions[r], `reaction ${r}`);
  assert.ok(b.reactions.drag.fileLeft && b.reactions.drag.fileRight, 'drag needs left/right files');
});

// The energy sphere wraps the core ball; the corners orbit just outside it with a small gap.
const sphereOn = p => p.sphere && p.sphere.intensity > 0.05;
const innerGap = p => Math.min(...lifts(p).map(l => CORNER_IN + l)) - p.sphere.radius;

test('looping clips keep the energy sphere well clear of the core', () => {
  for (const c of CLIPS.filter(x => x.loop)) {
    for (const t of times(c)) {
      const p = c.pose(t);
      if (!sphereOn(p)) continue;
      assert.ok(p.sphere.radius >= 2 * CORE_R, `${c.id}: sphere radius ${p.sphere.radius.toFixed(1)} at t=${t}`);
    }
  }
});

test('the working sphere is about three times the core', () => {
  for (const id of ['working', 'working-2', 'working-3']) {
    const c = CLIPS.find(x => x.id === id);
    for (const t of times(c)) {
      const r = c.pose(t).sphere.radius / CORE_R;
      assert.ok(r >= 2.5 && r <= 3.1, `${id}: sphere ${r.toFixed(2)}x core at t=${t}`);
    }
  }
});

test('corners never cut into the energy sphere', () => {
  for (const c of CLIPS) {
    for (const t of times(c)) {
      const p = c.pose(t);
      if (!sphereOn(p)) continue;
      assert.ok(innerGap(p) >= 1, `${c.id}: corner ${innerGap(p).toFixed(2)} mm from the sphere at t=${t}`);
    }
  }
});

test('while working the corners ride close outside the sphere', () => {
  for (const id of ['working', 'working-2', 'working-3']) {
    const c = CLIPS.find(x => x.id === id);
    const gaps = times(c).map(t => innerGap(c.pose(t)));
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    assert.ok(mean >= 2 && mean <= 7, `${id}: mean gap ${mean.toFixed(2)} mm`);
  }
});

test('tumbling corners end exactly upright', () => {
  // tumble(c) returns { axis: [x, y, z], angle: degrees }; a one-shot must finish on whole turns
  for (const c of CLIPS.filter(x => !x.loop)) {
    const end = c.pose(c.duration);
    if (!end.tumble) continue;
    for (const corner of CORNERS) {
      const r = end.tumble(corner);
      assert.ok(Array.isArray(r.axis) && r.axis.length === 3, `${c.id}: tumble must be axis-angle`);
      assert.ok(Math.abs(mod(r.angle + 180, 360) - 180) < 0.5, `${c.id}: corner ends ${r.angle.toFixed(1)} deg off`);
    }
  }
});
