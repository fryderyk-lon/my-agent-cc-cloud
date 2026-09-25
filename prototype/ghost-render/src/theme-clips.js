// Animation clips for the clawd-on-desk "destiny-ghost" theme.
// Each clip is rendered to one animated WebP. pose(t) returns a pose for window.api.pose()
// (see anim.js for the fields); `open` may also be a function of the corner ({ ring, phase }).
//
// Looping clips are seamless: every periodic term divides the clip length, and ring spins are
// whole multiples of 90 degrees (each ring of 4 identical corners maps onto itself). Clips whose
// lift pattern differs per corner spin their rings by whole turns instead.
// One-shot clips start and end on the idle pose at t = 0, so they blend back into idle.

const TAU = Math.PI * 2;
const S = (t, period, phase = 0) => Math.sin(TAU * t / period + phase);
const C = (t, period, phase = 0) => Math.cos(TAU * t / period + phase);
const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const ramp = (t, t0, t1) => smooth((t - t0) / (t1 - t0));
const lerp = (a, b, k) => a + (b - a) * k;
const arc = (t, t0, t1) => (t <= t0 || t >= t1 ? 0 : Math.sin(Math.PI * (t - t0) / (t1 - t0)));
const lerpColor = (a, b, k) => {
  const ch = (c, s) => (c >> s) & 255;
  const mix = s => Math.round(lerp(ch(a, s), ch(b, s), k)) << s;
  return mix(16) | mix(8) | mix(0);
};

export const EYE = {
  cyan: 0x3fd4ff, amber: 0xffc233, green: 0x4cf08c, red: 0xff4a4a, sleep: 0x2a6f8a, white: 0xcff6ff,
};
// One camera for every clip, so the Ghost never jumps between states.
export const VIEW = { azimuth: 0, elevation: 4, distance: 360 };

// Idle loop; its t = 0 pose is where every one-shot starts and ends.
const idle = t => ({
  open: 0.8 + 0.8 * S(t, 3),
  hover: 4 * S(t, 3),
  yaw: -14 + 10 * S(t, 6),
  pitch: 4 + 3 * C(t, 6),
  roll: 2 * S(t, 6),
  eye: EYE.cyan, eyeIntensity: 0.85 + 0.12 * S(t, 3),
});
const REST = idle(0);

export const CLIPS = [
  { id: 'idle', fps: 12, duration: 6, loop: true, pose: idle },

  // random idle extras
  { id: 'idle-look', fps: 12, duration: 5, loop: false, pose: t => {
    let yaw;
    if (t < 1.0) yaw = lerp(-14, -48, ramp(t, 0, 1.0));
    else if (t < 2.0) yaw = -48;
    else if (t < 3.0) yaw = lerp(-48, 24, ramp(t, 2.0, 3.0));
    else if (t < 3.8) yaw = 24;
    else yaw = lerp(24, -14, ramp(t, 3.8, 5.0));
    const curious = arc(t, 0, 5);
    return { ...REST, yaw, pitch: REST.pitch + 4 * curious, open: 0.8 + 1.2 * curious,
      eyeIntensity: 0.85 + 0.3 * curious, hover: 2 * S(t, 2.5) * curious };
  } },
  { id: 'idle-scan', fps: 15, duration: 4, loop: false, pose: t => {
    const k = ramp(t, 0.2, 0.9) - ramp(t, 3.0, 3.8);
    const spin = ramp(t, 0.8, 3.0);
    return { ...REST, open: 0.8 + 7 * k, ringFront: 90 * spin, ringBack: -90 * spin,
      pitch: REST.pitch + 3 * k, eyeIntensity: 0.85 + 0.5 * k * (0.5 + 0.5 * S(t, 0.5)) };
  } },

  { id: 'thinking', fps: 15, duration: 3, loop: true, pose: t => ({
    open: 3 + S(t, 1.5), ringFront: 90 * t / 3, ringBack: -90 * t / 3,
    eye: EYE.cyan, eyeIntensity: 1.0 + 0.25 * S(t, 1.5),
    yaw: -10 + 6 * S(t, 3), pitch: 12 + 2 * S(t, 3), roll: 3 * S(t, 3), hover: 2 * S(t, 3),
  }) },

  // working tiers: 1 / 2 / 3+ concurrent sessions
  { id: 'working', fps: 15, duration: 2, loop: true, pose: t => ({
    open: 9 + 1.5 * S(t, 1), ringFront: 180 * t / 2, ringBack: -90 * t / 2,
    eye: EYE.cyan, eyeIntensity: 1.2 + 0.15 * S(t, 0.5),
    yaw: -20 + 6 * S(t, 2), pitch: 6, hover: 2 * S(t, 2),
  }) },
  { id: 'working-2', fps: 15, duration: 2, loop: true, pose: t => ({
    open: 11 + 2 * S(t, 1), ringFront: 360 * t / 2, ringBack: -180 * t / 2,
    eye: EYE.cyan, eyeIntensity: 1.3 + 0.15 * S(t, 0.5),
    yaw: -20 + 10 * S(t, 2), pitch: 6 + 3 * S(t, 1), hover: 3 * S(t, 2),
  }) },
  { id: 'working-3', fps: 15, duration: 2, loop: true, pose: t => ({
    open: 13 + 2 * S(t, 0.5), ringFront: 540 * t / 2, ringBack: -360 * t / 2,
    eye: EYE.cyan, eyeIntensity: 1.4,
    yaw: -20 + 12 * S(t, 2), pitch: 8, roll: 6 * S(t, 1), hover: 3 * S(t, 1),
  }) },

  // subagents: the rings take turns lifting off; with 2+ a wave runs round each ring
  { id: 'juggling', fps: 15, duration: 2, loop: true, pose: t => {
    const front = 2 + 9 * (0.5 + 0.5 * S(t, 1));
    const back = 2 + 9 * (0.5 - 0.5 * S(t, 1));
    return { open: c => (c.ring === 'front' ? front : back), ringFront: 90 * t / 2, ringBack: -90 * t / 2,
      eye: EYE.cyan, eyeIntensity: 1.15, yaw: -18 + 8 * S(t, 2), pitch: 8, hover: 2 * S(t, 1) };
  } },
  { id: 'juggling-2', fps: 15, duration: 2, loop: true, pose: t => ({
    open: c => 2 + 10 * (0.5 + 0.5 * Math.sin(TAU * (t / 1 - c.phase / 360) + (c.ring === 'back' ? Math.PI : 0))),
    ringFront: 360 * t / 2, ringBack: -360 * t / 2,
    eye: EYE.cyan, eyeIntensity: 1.25, yaw: -18 + 8 * S(t, 2), pitch: 8, hover: 2 * S(t, 1),
  }) },

  { id: 'notification', fps: 15, duration: 1.4, loop: true, pose: t => ({
    open: 1.5 + 3 * Math.max(0, S(t, 0.7)),
    eye: EYE.amber, eyeIntensity: 0.75 + 0.55 * (0.5 + 0.5 * S(t, 0.7)),
    yaw: -4, roll: 10 * S(t, 1.4), pitch: -2, hover: 5 * Math.abs(S(t, 1.4)),
  }) },

  { id: 'attention', fps: 15, duration: 2.4, loop: true, pose: t => {
    const k = smooth(t / 1.1), a = arc(t, 0, 1.1);
    const bounce = t > 1.1 ? 3 * Math.sin(TAU * (t - 1.1) / 1.3) : 0;
    return { open: 12 * a, ringFront: 360 * k, ringBack: 360 * k,
      eye: EYE.green, eyeIntensity: 1.3 - 0.35 * ramp(t, 1.1, 2.4),
      yaw: -16 - 18 * a, pitch: 4 + 4 * a, hover: 10 * a + bounce };
  } },

  { id: 'error', fps: 15, duration: 1.6, loop: true, pose: t => {
    const shake = Math.max(0, 1 - t / 0.7), droop = Math.sin(Math.PI * t / 1.6);
    return { open: 0, eye: EYE.red, eyeIntensity: 1.1 + 0.3 * S(t, 0.4),
      yaw: -12 + 8 * shake * S(t, 0.1), roll: -8, pitch: -6 - 2 * droop, hover: -2 * droop };
  } },

  // context compaction: the whole shell turns while it squeezes in and out
  { id: 'sweeping', fps: 15, duration: 2, loop: true, pose: t => ({
    open: 7 * (0.5 - 0.5 * C(t, 1)), ringFront: 180 * t / 2, ringBack: 180 * t / 2,
    eye: EYE.white, eyeIntensity: 1.1 + 0.2 * S(t, 1),
    yaw: -14, pitch: 6, roll: 4 * S(t, 2), hover: 2 * S(t, 2),
  }) },

  // worktree creation: leaning into a purposeful glide
  { id: 'carrying', fps: 15, duration: 2, loop: true, pose: t => ({
    open: 4 + S(t, 1), ringFront: 90 * t / 2, ringBack: -90 * t / 2,
    eye: EYE.cyan, eyeIntensity: 1.2,
    yaw: 28 + 4 * S(t, 2), pitch: -10, roll: -5 + 2 * S(t, 1), hover: 4 * S(t, 1),
  }) },

  { id: 'sleeping', fps: 10, duration: 5, loop: true, pose: t => ({
    open: 0, eye: EYE.sleep, eyeIntensity: 0.25 + 0.2 * S(t, 5),
    yaw: -30, pitch: -16 + 2 * S(t, 5), roll: 3 * S(t, 5), hover: -6 + 1.5 * S(t, 5),
  }) },
  { id: 'waking', fps: 15, duration: 1.5, loop: false, pose: t => {
    const k = smooth(t / 1.5), flash = arc(t, 0.3, 1.2);
    return { open: 5 * flash, eye: lerpColor(EYE.sleep, EYE.cyan, ramp(t, 0, 0.6)),
      eyeIntensity: lerp(0.25, REST.eyeIntensity, k) + 0.6 * flash,
      yaw: lerp(-30, REST.yaw, k), pitch: lerp(-16, REST.pitch, k), hover: lerp(-6, REST.hover, k) };
  } },

  // click / drag reactions
  { id: 'react-drag', fps: 15, duration: 1.2, loop: true, pose: t => ({
    open: 5 + 1.5 * S(t, 0.6), eye: EYE.cyan, eyeIntensity: 1.2,
    yaw: -14 + 4 * S(t, 1.2), pitch: -8, roll: 12 * S(t, 1.2),
  }) },
  ...['left', 'right'].map(side => ({
    id: `react-poke-${side}`, fps: 15, duration: 1.6, loop: false, pose: t => {
      const a = arc(t, 0, 0.9), bounce = t > 0.9 ? 3 * Math.sin(TAU * (t - 0.9) / 0.7) : 0;
      return { ...REST, yaw: REST.yaw + (side === 'left' ? 360 : -360) * smooth(t / 0.9),
        open: REST.open + 6 * a, eyeIntensity: REST.eyeIntensity + 0.5 * a, hover: bounce };
    },
  })),
  { id: 'react-double', fps: 15, duration: 3.5, loop: false, pose: t => {
    const a = arc(t, 0, 2.4), spin = smooth(t / 2.4);
    const bounce = t > 2.4 ? 3 * Math.sin(TAU * (t - 2.4) / 1.1) : 0;
    return { ...REST, open: REST.open + 14 * a, ringFront: 180 * spin, ringBack: -180 * spin,
      eye: lerpColor(EYE.cyan, EYE.white, a), eyeIntensity: REST.eyeIntensity + 0.65 * a,
      yaw: REST.yaw + 12 * S(t, 2.4) * a, hover: 6 * a + bounce };
  } },

  // free-roam walk, drawn facing right (clawd mirrors it for leftward walks)
  { id: 'roam', fps: 15, duration: 1.2, loop: true, pose: t => ({
    open: 1.5 + 0.5 * S(t, 0.6), eye: EYE.cyan, eyeIntensity: 0.95,
    yaw: 38, pitch: -6, roll: -6 + 2 * S(t, 0.6), hover: 3 * S(t, 0.6),
  }) },
];

// How the clips plug into clawd's theme.json.
export const THEME_BINDINGS = {
  states: {
    idle: 'idle', thinking: 'thinking', working: 'working', juggling: 'juggling',
    error: 'error', attention: 'attention', notification: 'notification', sweeping: 'sweeping',
    carrying: 'carrying', sleeping: 'sleeping', waking: 'waking', roam: 'roam',
  },
  workingTiers: [[3, 'working-3'], [2, 'working-2'], [1, 'working']],
  jugglingTiers: [[2, 'juggling-2'], [1, 'juggling']],
  idleAnimations: ['idle-look', 'idle-scan'],
  reactions: { drag: 'react-drag', clickLeft: 'react-poke-left', clickRight: 'react-poke-right', double: 'react-double' },
  // clawd's built-in display hints -> our clips (same pairing as the Calico theme)
  displayHints: {
    'clawd-working-typing.svg': 'working', 'clawd-working-building.svg': 'working-3',
    'clawd-headphones-groove.svg': 'juggling', 'clawd-working-juggling.svg': 'juggling',
    'clawd-working-conducting.svg': 'juggling-2', 'clawd-working-thinking.svg': 'thinking',
  },
};
