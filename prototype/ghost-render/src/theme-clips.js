// Animation clips for the clawd-on-desk "destiny-ghost" theme (shot list agreed 2026-09-26).
// Each clip is rendered to one animated WebP. pose(t) returns a pose for window.api.pose():
//   open        mm every corner lifts off the core (number, or a function of the corner { ring, phase })
//   ringFront   degrees the front ring has turned CLOCKWISE, seen from the eye      (never decreases)
//   ringBack    degrees the back ring has turned COUNTER-CLOCKWISE, seen from the eye (never decreases)
//   tumble      optional function of the corner -> { axis: [x, y, z], angle: degrees } about its own centre
//   yaw/pitch/roll degrees, hover mm, zoom camera-distance factor (1 = normal, >1 pulls back)
//   eye/eyeIntensity eye colour and brightness; core glow of the light inside the shell (leaks through gaps)
//   sphere      optional energy sphere { intensity, radius mm, spin deg, flow cycles, color }
//   burst       optional energy burst { k: 0..1 progress, intensity }
//   scan        optional scan beam { k: 0..1 visibility, angle deg }
//
// Looping clips are seamless: periodic terms divide the clip length; ring turns are whole multiples
// of 90 degrees (360 when corners move differently); the sphere's flow advances whole cycles.
// One-shot clips start on BASE[from] and end on BASE[to], so clawd's hard cuts do not jump.

const TAU = Math.PI * 2;
const S = (t, period, phase = 0) => Math.sin(TAU * t / period + phase);
const C = (t, period, phase = 0) => Math.cos(TAU * t / period + phase);
const clamp01 = x => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const ramp = (t, t0, t1) => smooth((t - t0) / (t1 - t0));
const easeIn = (t, t0, t1) => clamp01((t - t0) / (t1 - t0)) ** 3;
const easeOut = (t, t0, t1) => 1 - (1 - clamp01((t - t0) / (t1 - t0))) ** 3;
const lerp = (a, b, k) => a + (b - a) * k;
const arc = (t, t0, t1) => (t <= t0 || t >= t1 ? 0 : Math.sin(Math.PI * (t - t0) / (t1 - t0)));
const bump = (t, t0, len) => arc(t, t0, t0 + len);
const lerpColor = (a, b, k) => {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const ch = (c, s) => (c >> s) & 255;
  const mix = s => Math.round(lerp(ch(a, s), ch(b, s), k)) << s;
  return mix(16) | mix(8) | mix(0);
};
const spin = deg => ({ ringFront: deg, ringBack: deg });

export const EYE = {
  cyan: 0x3fd4ff, amber: 0xffc233, green: 0x4cf08c, red: 0xff4a4a, sleep: 0x2a6f8a, white: 0xcff6ff,
};
export const ENERGY = 0x5b8cff;
// One camera for every clip. The canvas is 520 units; at distance 585 the resting Ghost keeps the pixel
// size it had on the old 320 canvas at distance 360, leaving room for the energy sphere (theme.json
// shows the body at 45% of the window height instead of 58%).
export const VIEW = { azimuth: 0, elevation: 4, distance: 585 };
export const CANVAS = 520;
// Measured from the STL kit (scripts/measure.mjs): the core ball reaches 31.2 mm from the centre, the
// corners' inner faces sit 29.8 mm out when closed (a corner lifted by L is 29.8 + L mm out) and their
// tips 67.3 mm out.
export const CORE_R = 31.2;
export const CORNER_IN = 29.8;
export const TIP_R = 67.3;
// Canvas width in mm at the Ghost (28 degree field of view); everyday lifts keep the tips inside 94% of it,
// anything further needs the camera to pull back (zoom).
const FIELD = 2 * VIEW.distance * Math.tan(14 * Math.PI / 180);
export const LIFT_MAX_DAILY = Math.floor(0.47 * FIELD - TIP_R);
// The energy sphere wraps the core with plenty of room (about 3x the core radius while working);
// the corners orbit just outside its surface. GAP is how far outside.
const GAP = 4;
const liftOutside = radius => radius + GAP - CORNER_IN;
const sphere = (radius, intensity, spinDeg, flow, color = ENERGY) => ({ intensity, radius, spin: spinDeg, flow, color });
// While the shell opens or closes the sphere tracks the corners (3 mm inside them) and fades out as it
// shrinks towards the core.
const sphereTracking = (minLift, maxRadius, intensity, spinDeg, flow, color = ENERGY) => {
  const radius = Math.min(maxRadius, CORNER_IN + minLift - 3);
  return sphere(Math.max(radius, CORE_R), intensity * ramp(radius, CORE_R + 4, CORE_R + 30), spinDeg, flow, color);
};

// ---------------------------------------------------------------- idle and base poses
const idle = t => ({
  open: 0.8 + 0.6 * S(t, 3),
  hover: 4 * S(t, 3),
  yaw: -14 + 10 * S(t, 6),
  pitch: 4 + 3 * C(t, 6),
  roll: 2 * S(t, 6),
  eye: EYE.cyan, eyeIntensity: 0.9 + 0.1 * S(t, 3), core: 0.4 + 0.1 * S(t, 3),
});
const REST = idle(0);

// sphere size (x core radius) per tier; the corners ride GAP mm outside it, breathing by +-1 mm
const WORK = [
  { ratio: 2.6, turn: 90, sphere: 0.9, eye: 1.2, core: 1.2, flow: 1 },    // turn: degrees per 2 s loop
  { ratio: 2.8, turn: 180, sphere: 1.1, eye: 1.3, core: 1.4, flow: 1 },
  { ratio: 2.95, turn: 270, sphere: 1.3, eye: 1.4, core: 1.6, flow: 2 },
];
const working = tier => t => {
  const w = WORK[tier], r = w.ratio * CORE_R, lift = liftOutside(r) + 1.0 * S(t, 1);
  return {
    open: lift, ...spin(w.turn * t / 2),
    sphere: sphere(r, w.sphere + 0.1 * S(t, 1), 360 * t / 2, w.flow * t / 2),
    eye: EYE.cyan, eyeIntensity: w.eye + 0.15 * S(t, 0.5), core: w.core,
    yaw: -18 + 6 * S(t, 2), pitch: 6 + 2 * S(t, 1), roll: 3 * S(t, 2) + (tier === 2 ? 3 * S(t, 1) : 0), hover: 2 * S(t, 2),
  };
};

const dozing = t => {
  const nod = Math.max(0, S(t, 3)) ** 3;
  return {
    open: 0.4, eye: EYE.cyan, eyeIntensity: 0.45 + 0.15 * S(t, 1.5) ** 2, core: 0.2,
    yaw: -22, pitch: -8 - 7 * nod, roll: 2 * S(t, 3), hover: -2 + S(t, 3),
  };
};
const sleeping = t => ({
  open: 0, eye: EYE.sleep, eyeIntensity: 0.25 + 0.2 * S(t, 5), core: 0.1,
  yaw: -30, pitch: -16 + 2 * S(t, 5), roll: 3 * S(t, 5), hover: -6 + 1.5 * S(t, 5),
});

export const BASE = { rest: REST, work: working(0)(0), doze: dozing(0), sleep: sleeping(0) };

// Blend two poses field by field (numbers, colours; open must be numeric on both sides).
function blend(a, b, k) {
  const out = {};
  for (const f of ['open', 'yaw', 'pitch', 'roll', 'hover', 'eyeIntensity', 'core', 'ringFront', 'ringBack']) {
    out[f] = lerp(a[f] ?? 0, b[f] ?? 0, k);
  }
  out.zoom = lerp(a.zoom ?? 1, b.zoom ?? 1, k);
  out.eye = lerpColor(a.eye ?? EYE.cyan, b.eye ?? EYE.cyan, k);
  return out;
}

// ---------------------------------------------------------------- clips
export const CLIPS = [
  { id: 'idle', fps: 30, duration: 6, loop: true, pose: idle },

  // random idle extras (from rest, back to rest)
  { id: 'idle-look', fps: 30, duration: 5, loop: false, from: 'rest', to: 'rest', pose: t => {
    let yaw;
    if (t < 1.0) yaw = lerp(REST.yaw, -48, ramp(t, 0, 1.0));
    else if (t < 2.0) yaw = -48;
    else if (t < 3.0) yaw = lerp(-48, 24, ramp(t, 2.0, 3.0));
    else if (t < 3.8) yaw = 24;
    else yaw = lerp(24, REST.yaw, ramp(t, 3.8, 5.0));
    const curious = arc(t, 0, 5);
    return { ...REST, yaw, pitch: REST.pitch + 4 * curious, open: REST.open + 1.2 * curious,
      eyeIntensity: REST.eyeIntensity + 0.3 * curious, hover: 2 * S(t, 2.5) * curious };
  } },
  { id: 'idle-scan', fps: 30, duration: 4, loop: false, from: 'rest', to: 'rest', pose: t => {
    const k = ramp(t, 0.2, 0.8) - ramp(t, 3.2, 3.8);
    return { ...REST, open: REST.open + 5 * k, ...spin(90 * ramp(t, 0.2, 3.8)),
      pitch: REST.pitch + 3 * k, eyeIntensity: REST.eyeIntensity + 0.5 * k, core: REST.core + 0.4 * k,
      scan: { k, angle: 20 * S(t - 0.8, 1.2) * ramp(t, 0.6, 1.0) } };
  } },
  { id: 'idle-shuffle', fps: 30, duration: 4, loop: false, from: 'rest', to: 'rest', pose: t => {
    // each corner twitches in turn: front ring round, then back ring round
    const order = c => (c.ring === 'front' ? 0 : 4) + Math.round((((c.phase % 360) + 360) % 360) / 90);
    const twitch = c => bump(t, 0.4 + order(c) * 0.36, 0.34);
    const lookY = [0, 1, 2, 3, 4, 5, 6, 7].reduce((a, i) => a + Math.sin(i * Math.PI / 2) * bump(t, 0.4 + i * 0.36, 0.34), 0);
    const lookX = [0, 1, 2, 3, 4, 5, 6, 7].reduce((a, i) => a + Math.cos(i * Math.PI / 2) * bump(t, 0.4 + i * 0.36, 0.34), 0);
    return { ...REST, open: c => REST.open + 5 * twitch(c), yaw: REST.yaw + 6 * lookX, pitch: REST.pitch + 6 * lookY };
  } },
  { id: 'idle-stretch', fps: 30, duration: 5, loop: false, from: 'rest', to: 'rest', pose: t => {
    const k = arc(t, 0.3, 4.2), roll = 360 * ramp(t, 1.0, 3.6);
    return { ...REST, open: REST.open + 5 * k, roll: roll >= 360 - 1e-9 ? 0 : roll,
      pitch: REST.pitch + 6 * k, hover: 6 * k, eyeIntensity: REST.eyeIntensity - 0.4 * bump(t, 0.3, 1.2) + 0.3 * bump(t, 3.4, 1.0) };
  } },

  { id: 'thinking', fps: 30, duration: 3, loop: true, pose: t => {
    const lift = 6 + 1.5 * S(t, 1.5), flash = Math.max(0, S(t, 3)) ** 4;
    return { open: lift, ...spin(90 * t / 3),
      eye: EYE.cyan, eyeIntensity: 1.0 + 0.3 * S(t, 1.5), core: 0.8 + 0.3 * S(t, 1.5) + 1.2 * flash,
      yaw: -10 + 6 * S(t, 3), pitch: 10 + 2 * S(t, 3), roll: 3 * S(t, 3), hover: 2 * S(t, 3) };
  } },

  // working tiers: 1 / 2 / 3+ concurrent sessions — open shell, counter-rotating rings, energy sphere
  { id: 'working', fps: 30, duration: 2, loop: true, pose: working(0) },
  { id: 'working-2', fps: 30, duration: 2, loop: true, pose: working(1) },
  { id: 'working-3', fps: 30, duration: 2, loop: true, pose: working(2) },

  // subagents: a lift wave runs round the rings outside the sphere. The wave lives in space (it follows
  // where a corner is now, not which corner it is), so a 2 s loop closes after a quarter or half turn.
  ...[{ id: 'juggling', period: 1, amp: 10, turn: 90, sphere: 0.9 }, { id: 'juggling-2', period: 0.5, amp: 12, turn: 180, sphere: 1.1 }]
    .map(j => ({ ...j, r: 2.6 * CORE_R, lo: liftOutside(2.6 * CORE_R) - 2.5 }))
    .map(j => ({ id: j.id, fps: 30, duration: 2, loop: true, pose: t => {
      const turn = j.turn * t / 2;
      const pos = c => (c.ring === 'front' ? c.phase - turn : c.phase + turn) * Math.PI / 180;
      return {
        open: c => j.lo + j.amp * (0.5 + 0.5 * Math.sin(TAU * t / j.period - pos(c) + (c.ring === 'back' ? Math.PI : 0))),
        ...spin(turn),
        sphere: sphere(j.r, j.sphere + 0.1 * S(t, 1), 360 * t / 2, t / 2),
        eye: EYE.cyan, eyeIntensity: 1.2, core: 1.2,
        yaw: -16 + 6 * S(t, 2), pitch: 8, roll: 2 * S(t, 2), hover: 2 * S(t, 2),
      };
    } })),

  // needs approval: faces you, pops open with a quarter twist, amber eye flashes, head tilts
  { id: 'notification', fps: 30, duration: 2.4, loop: true, pose: t => ({
    open: 3 + 7 * bump(t, 0, 0.55), ...spin(90 * easeOut(t, 0, 0.5)),
    eye: EYE.amber, eyeIntensity: 0.8 + 0.6 * (0.5 + 0.5 * S(t, 0.6, -Math.PI / 2)), core: 0.9,
    yaw: -4, pitch: -2, roll: 8 * S(t, 2.4), hover: 3 * S(t, 1.2) ** 2,
  }) },

  // task done — the resurrection beat: sphere spins up, shell contracts and holds, cracks open,
  // the energy bursts out (blue-white), the eye turns green, then everything settles to rest
  { id: 'attention', fps: 30, duration: 3.2, loop: false, from: 'work', to: 'rest', pose: t => {
    const W0 = BASE.work;
    // phase timings (s), paced on the Destiny 2 revive: spin-up, contraction, a held beat, the shell cracks,
    // light leaks, the burst sprays out and whites out, condenses back into the Ghost, mist thins out
    const SPIN_END = 0.4, SHUT = 0.55, CRACK0 = 0.72, CRACK1 = 0.78, BURST_END = 2.35, CALM_END = 2.7, END = 3.2;
    const shut = easeIn(t, SPIN_END, SHUT);                       // 0 -> 1 contraction
    const crack = easeOut(t, CRACK0, CRACK1) * (1 - ramp(t, CALM_END, END));
    let lift = lerp(W0.open, 0, shut);
    if (t >= CRACK0) lift = lerp(8, 3, ramp(t, CRACK1, CALM_END)) * crack + REST.open * ramp(t, CALM_END, END);
    const turn = 270 * (0.55 * easeIn(t, 0, SPIN_END) + 0.45 * ramp(t, SPIN_END, SHUT + 0.05));
    // the sphere spins up, then shrinks with the contracting shell and fades into it
    const sphereK = lerp(W0.sphere.intensity, 1.4, ramp(t, 0, SPIN_END));
    const green = ramp(t, 0.85, 0.95) * (1 - ramp(t, CALM_END, END));   // changes under the whiteout
    const eye = lerpColor(EYE.cyan, EYE.green, green);
    const settle = ramp(t, CALM_END, END);
    const zoom = 1 + 0.06 * arc(t, CRACK1, CALM_END);
    return {
      open: lift, ...spin(turn), zoom,
      sphere: t < SHUT ? sphereTracking(lift, W0.sphere.radius, sphereK, 360 * easeIn(t, 0, SHUT) * 1.5, 0.5 * easeIn(t, 0, SHUT)) : undefined,
      burst: t >= CRACK0 && t < BURST_END ? { age: t - CRACK0, intensity: 1 } : undefined,
      eye, eyeIntensity: lerp(lerp(W0.eyeIntensity, 0.6, shut), 1.5, ramp(t, CRACK0, CRACK1)) * (1 - settle) + REST.eyeIntensity * settle,
      core: (1 - settle) * (lerp(W0.core, 0.3, shut) + 6 * bump(t, CRACK0, 0.3)) + REST.core * settle,
      yaw: lerp(W0.yaw, REST.yaw, ramp(t, 0.3, 1.2)), pitch: lerp(W0.pitch, REST.pitch, ramp(t, 0.3, 1.2)),
      roll: 0, hover: 6 * arc(t, CRACK1, CALM_END + 0.3),
    };
  } },

  // error: clench, two red flashes, a shake, then a slump that recovers into the next loop
  { id: 'error', fps: 30, duration: 3.2, loop: true, pose: t => {
    const shake = t < 0.8 ? (1 - t / 0.8) * S(t, 0.1) : 0;
    const flash = bump(t, 0.02, 0.18) + bump(t, 0.3, 0.18);
    const droop = arc(t, 0.6, 3.2);
    return { open: 3 * (1 - ramp(t, 0, 0.1)) + 3 * ramp(t, 2.6, 3.2),
      eye: EYE.red, eyeIntensity: 1.0 + 0.6 * flash, core: 0.6 + 0.8 * flash,
      yaw: -12 + 8 * shake, pitch: -6 - 6 * droop, roll: -6 - 4 * droop, hover: -2 - 3 * droop };
  } },

  // context compaction: rings turn while the shell squeezes in and out; the sphere breathes with it
  { id: 'sweeping', fps: 30, duration: 2, loop: true, pose: t => {
    const k = 0.5 - 0.5 * C(t, 2), r = (2.2 + 0.6 * k) * CORE_R, lift = liftOutside(r);
    return { open: lift, ...spin(180 * t / 2),
      sphere: sphere(r, 0.6 + 0.4 * k, 360 * t / 2, t / 2, 0xa9e8ff),
      eye: EYE.white, eyeIntensity: 1.1 + 0.2 * k, core: 1.0 + 0.3 * k,
      yaw: -14, pitch: 6, roll: 4 * S(t, 2), hover: 2 * S(t, 2) };
  } },

  // worktree / update download: leaning into a purposeful glide
  { id: 'carrying', fps: 30, duration: 2, loop: true, pose: t => ({
    open: 4 + S(t, 1), ...spin(90 * t / 2),
    eye: EYE.cyan, eyeIntensity: 1.2, core: 0.8,
    yaw: 28 + 4 * S(t, 2), pitch: -10, roll: -5 + 2 * S(t, 1), hover: 4 * S(t, 1),
  }) },

  // free-roam walk, drawn facing right (clawd mirrors it for leftward walks)
  { id: 'roam', fps: 30, duration: 1.2, loop: true, pose: t => ({
    open: 1.5 + 0.5 * S(t, 0.6), eye: EYE.cyan, eyeIntensity: 0.95, core: 0.4,
    yaw: 38, pitch: -6, roll: -6 + 2 * S(t, 0.6), hover: 3 * S(t, 0.6),
  }) },

  // ---- sleep sequence (full): yawning -> dozing -> collapsing -> sleeping, then waking
  { id: 'yawning', fps: 30, duration: 2.6, loop: false, from: 'rest', to: 'doze', pose: t => {
    const open = ramp(t, 0.1, 1.2), close = ramp(t, 1.6, 2.6);
    const base = blend(REST, BASE.doze, close);
    return { ...base, open: lerp(REST.open, 14, open) * (1 - close) + BASE.doze.open * close,
      ...spin(90 * ramp(t, 0.1, 2.4)),
      pitch: base.pitch + 10 * open * (1 - close), eyeIntensity: base.eyeIntensity - 0.2 * open * (1 - close) };
  } },
  { id: 'dozing', fps: 30, duration: 3, loop: true, pose: dozing },
  { id: 'collapsing', fps: 30, duration: 1.5, loop: false, from: 'doze', to: 'sleep', pose: t => {
    const k = ramp(t, 0, 1.5), sink = easeIn(t, 0.2, 1.5);
    const p = blend(BASE.doze, BASE.sleep, k);
    return { ...p, hover: lerp(BASE.doze.hover, BASE.sleep.hover, sink) };
  } },
  { id: 'sleeping', fps: 30, duration: 5, loop: true, pose: sleeping },
  { id: 'waking', fps: 30, duration: 2.2, loop: false, from: 'sleep', to: 'rest', pose: t => {
    const wake = ramp(t, 0, 0.3), spread = easeOut(t, 0.3, 0.8), shut = easeIn(t, 1.1, 1.35);
    const pop = bump(t, 1.35, 0.3), settle = ramp(t, 1.5, 2.2);
    const lift = liftOutside(2.6 * CORE_R) * spread * (1 - shut) + 3 * pop + REST.open * settle;
    const up = blend(BASE.sleep, REST, ramp(t, 0.1, 1.6));
    return { ...up, open: lift, ...spin(360 * ramp(t, 0.3, 1.3)),
      sphere: spread * (1 - shut) > 0.001 ? sphereTracking(lift, 2.6 * CORE_R, 1.1, 360 * ramp(t, 0.3, 1.3), ramp(t, 0.3, 1.3)) : undefined,
      burst: t >= 1.3 && t < 2.2 ? { age: t - 1.3, intensity: 0.6, scale: 0.45 } : undefined,
      eye: lerpColor(EYE.sleep, EYE.cyan, wake), eyeIntensity: lerp(lerp(0.25, 1.3, wake), REST.eyeIntensity, settle),
      core: lerp(lerp(0.1, 1.2, wake) + 1.5 * pop, REST.core, settle) };
  } },

  // ---- click / drag reactions
  { id: 'react-drag', fps: 30, duration: 1.2, loop: true, pose: t => ({
    open: 5 + 2 * S(t, 0.6), eye: EYE.cyan, eyeIntensity: 1.2, core: 0.8,
    yaw: -14 + 4 * S(t, 1.2), pitch: -8, roll: 12 * S(t, 1.2),
  }) },
  // dragged left: corners trail to the right (and vice versa), swinging with inertia
  ...[['left', 1], ['right', -1]].map(([side, s]) => ({
    id: `react-drag-${side}`, fps: 30, duration: 1.2, loop: true, pose: t => ({
      open: c => 1.5 + 3 * Math.max(0, s * Math.cos(c.phase * Math.PI / 180)) + 2.5 * (0.5 + 0.5 * S(t, 0.6)),
      eye: EYE.cyan, eyeIntensity: 1.2, core: 0.8,
      yaw: -14 - s * 14, pitch: -6, roll: s * (10 + 5 * S(t, 1.2)), hover: 2 * S(t, 0.6),
    }),
  })),
  // double-click on one side: that side flinches in, the body jerks away, the eye blinks
  ...[['left', 1], ['right', -1]].map(([side, s]) => ({
    id: `react-poke-${side}`, fps: 30, duration: 1.6, loop: false, from: 'rest', to: 'rest', pose: t => {
      const hit = bump(t, 0, 0.5), bounce = t > 0.5 ? 2 * Math.sin(TAU * (t - 0.5) / 0.6) * (1 - ramp(t, 0.5, 1.6)) : 0;
      return { ...REST,
        open: c => REST.open + 5 * hit * Math.max(0, s * Math.cos(c.phase * Math.PI / 180)) * 1.2
          - REST.open * hit * Math.max(0, -s * Math.cos(c.phase * Math.PI / 180)),
        yaw: REST.yaw + s * 18 * hit, roll: -s * 10 * hit, hover: REST.hover + bounce,
        eyeIntensity: REST.eyeIntensity * (1 - 0.8 * bump(t, 0.05, 0.25)) };
    },
  })),
  { id: 'react-annoyed', fps: 30, duration: 1.6, loop: false, from: 'rest', to: 'rest', pose: t => {
    const env = arc(t, 0, 1.6);
    return { ...REST, open: c => REST.open + 3 * env * Math.abs(Math.sin(TAU * (t * 6) + c.phase * Math.PI / 90)),
      yaw: REST.yaw + 6 * env * S(t, 0.2), eyeIntensity: REST.eyeIntensity - 0.3 * env };
  } },
  // four quick clicks: the camera pulls back, the shell explodes, corners tumble, then snap back together
  { id: 'react-double', fps: 30, duration: 3.5, loop: false, from: 'rest', to: 'rest', pose: t => {
    const clench = bump(t, 0, 0.35), out = easeOut(t, 0.3, 0.75), back = easeIn(t, 2.2, 2.7);
    const zoom = 1 + 0.7 * ramp(t, 0.1, 0.6) * (1 - ramp(t, 2.3, 2.9));
    const far = 105 * out * (1 - back);
    const settle = t > 2.7 ? 2.5 * Math.sin(TAU * (t - 2.7) / 0.5) * (1 - ramp(t, 2.7, 3.5)) : 0;
    const tumbleK = ramp(t, 0.3, 2.7);
    const axes = [[1, 0.3, 0], [0, 1, 0.4], [0.5, 0, 1], [1, 1, 0], [0, 0.6, 1], [1, 0, 0.8], [0.3, 1, 1], [1, 0.5, 0.5]];
    const idx = c => (c.ring === 'front' ? 0 : 4) + Math.round((((c.phase % 360) + 360) % 360) / 90) % 4;
    return { ...REST, zoom,
      open: c => Math.max(0, REST.open * (1 - clench) + far + (far > 0 ? 6 * Math.sin(TAU * (t - 0.75) / 1.5 + idx(c)) * out * (1 - back) : 0) + settle),
      tumble: c => ({ axis: axes[idx(c)], angle: 360 * tumbleK * (1 + (idx(c) % 2)) }),   // whole turns: upright at the end
      ...spin(180 * ramp(t, 0.3, 2.7)),
      sphere: out * (1 - back) > 0.001 ? sphereTracking(far - 6, 2.6 * CORE_R, 0.8 * out * (1 - back), 180 * ramp(t, 0.3, 2.7), ramp(t, 0.3, 2.7)) : undefined,
      eye: lerpColor(EYE.cyan, EYE.white, out * (1 - back)), eyeIntensity: REST.eyeIntensity + 0.6 * out * (1 - back),
      core: REST.core + 1.2 * out * (1 - back), hover: REST.hover + settle };
  } },
];

// How the clips plug into clawd's theme.json.
export const THEME_BINDINGS = {
  states: {
    idle: 'idle', thinking: 'thinking', working: 'working', juggling: 'juggling',
    error: 'error', attention: 'attention', notification: 'notification', sweeping: 'sweeping',
    carrying: 'carrying', roam: 'roam',
    yawning: 'yawning', dozing: 'dozing', collapsing: 'collapsing', sleeping: 'sleeping', waking: 'waking',
  },
  workingTiers: [[3, 'working-3'], [2, 'working-2'], [1, 'working']],
  jugglingTiers: [[2, 'juggling-2'], [1, 'juggling']],
  idleAnimations: ['idle-look', 'idle-scan', 'idle-shuffle', 'idle-stretch'],
  reactions: {
    drag: { file: 'react-drag', fileLeft: 'react-drag-left', fileRight: 'react-drag-right' },
    clickLeft: 'react-poke-left', clickRight: 'react-poke-right', annoyed: 'react-annoyed', double: 'react-double',
  },
  // clawd's built-in display hints -> our clips
  displayHints: {
    'clawd-working-typing.svg': 'working', 'clawd-working-building.svg': 'working-3',
    'clawd-headphones-groove.svg': 'juggling', 'clawd-working-juggling.svg': 'juggling',
    'clawd-working-conducting.svg': 'juggling-2', 'clawd-working-thinking.svg': 'thinking',
  },
};
