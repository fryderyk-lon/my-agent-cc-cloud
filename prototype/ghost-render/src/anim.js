// Deterministic state animations for the Ghost pet.
// pose(state, t) -> pose for window.api.pose(); t = seconds since the state was entered.
// `open` is how far (mm) every corner lifts off the core (0 = closed shell); corners stay rigid.
// `ringFront`/`ringBack` orbit the front/back ring of corners about the eye axis (degrees);
// the two rings never touch, so any combination is collision-free.
// `hover` moves the whole Ghost up/down (mm); yaw/pitch/roll turn it (degrees).
const TAU = Math.PI * 2;
const smooth = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);

export const STATES = ['idle', 'working', 'permission', 'done', 'error', 'sleep'];
export const EYE = { idle: 0x3fd4ff, working: 0x3fd4ff, permission: 0xffc233, done: 0x4cf08c, error: 0xff4a4a, sleep: 0x2a6f8a };

/** @param themeEye eye colour of the current shell theme, used by the calm states (idle/working) */
export function pose(state, t, themeEye = EYE.idle) {
  const bob = Math.sin(t * TAU / 3.2) * 4;
  switch (state) {
    case 'idle':          // hovering, corners "breathe" a hair off the core, looking around
      return { open: 0.8 + Math.sin(t * TAU / 4) * 0.8, eye: themeEye, eyeIntensity: 0.85 + 0.15 * Math.sin(t * TAU / 4),
        yaw: -16 + Math.sin(t * TAU / 7) * 14, pitch: 5 + Math.sin(t * TAU / 5) * 4, hover: bob };
    case 'working':       // corners lift off and the two rings counter-rotate, like the in-game scan
      return { open: 9 + Math.sin(t * TAU * 0.9) * 2, ringFront: t * 160, ringBack: -t * 110,
        eye: themeEye, eyeIntensity: 1.15 + 0.2 * Math.sin(t * TAU * 2), yaw: -22 + Math.sin(t * TAU / 2.5) * 10, pitch: 8, hover: bob * 0.5 };
    case 'permission': {  // faces the user, amber eye pulses, corners flutter, head-tilt wobble
      const pulse = 0.5 + 0.5 * Math.sin(t * TAU * 1.4);
      return { open: 1.5 + Math.max(0, Math.sin(t * TAU * 1.4)) * 3, eye: EYE.permission, eyeIntensity: 0.75 + 0.55 * pulse,
        yaw: -4, roll: Math.sin(t * TAU * 0.7) * 12, pitch: -2, hover: Math.abs(Math.sin(t * TAU * 0.7)) * 6 };
    }
    case 'done': {        // corners pop out, whole shell twirls once, then snaps shut
      const k = smooth(t / 1.1), arc = Math.sin(Math.min(t / 1.1, 1) * Math.PI);
      return { open: arc * 12, ringFront: k * 360, ringBack: k * 360, eye: EYE.done, eyeIntensity: 1.3 - 0.4 * k,
        yaw: -16 - (1 - k) * 20, pitch: 4, hover: arc * 10 };
    }
    case 'error':         // shell snaps shut, red eye, short shake
      return { open: 0, eye: EYE.error, eyeIntensity: 1.1 + 0.3 * Math.sin(t * TAU * 3),
        yaw: -12 + Math.sin(t * TAU * 11) * 6 * Math.max(0, 1 - t / 0.8), roll: -8, pitch: -6 };
    case 'sleep':         // closed shell, dim slow "breathing" eye, drifting low
      return { open: 0, eye: EYE.sleep, eyeIntensity: 0.25 + 0.2 * Math.sin(t * TAU / 5),
        yaw: -30, pitch: -16, hover: bob * 0.4 - 6 };
    default:
      throw new Error(`unknown state: ${state}`);
  }
}
