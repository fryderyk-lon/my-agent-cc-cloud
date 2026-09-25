// Parametric Ghost assembled from the polygoncollectibles "Generalist Ghost Shell" STL kit
// (CC BY-NC-ND 4.0 — the STL files are NOT in this repo; see ../README.md).
//
// STL frame: the eye looks down +X, up is +Z, units are mm. The kit is exported as an exploded
// display layout; the constants below put it back together (derived with boolean fit tests, see
// README). Each of the 8 corners is one rigid, gap-free unit (outer shell + inner base plate + tip cap) and
// only ever moves as a whole: it can lift off the core along its axis and orbit the eye axis.
import * as THREE from 'three';

export const PART_FILES = ['body_front', 'body_back', 'battery_body', 'battery_cap', 'eye', 'diffuser', 'lense',
  'wing', 'wing_front_top', 'wing_inside', 'cap'];

export const DEFAULT_THEME = { shell: 0xeceae6, inner: 0x4a4f58, core: 0x2f333a, eye: 0x3fd4ff };
export const CLAUDE_THEME = { shell: 0xf4f3ee, inner: 0xd97757, core: 0x333333, eye: 0xd97757 };

const deg = THREE.MathUtils.degToRad;
const rot = (axis, d) => new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...axis), deg(d));
const I4 = () => new THREE.Matrix4();

// The kit ships one copy of each repeated part in the back-bottom slot. The other corners are its
// images under the D2 group (180-degree turns about each axis) plus a -90 degree turn about X for
// the four side corners. The side corners are printed as two halves plus a spacer frame; their
// outer shape equals `wing` (mean deviation 0.4 mm), so the one-piece `wing` is used everywhere
// and no corner shows a seam.
const D2 = { bb: I4(), bt: rot([1, 0, 0], 180), fb: rot([0, 0, 1], 180), ft: rot([0, 1, 0], 180) };
const SIDE = rot([1, 0, 0], -90);
// Corner axis of the back-bottom slot: the common normal of the cap, the base plate and the
// shell's tip facet, 55.5 degrees from the eye axis. The seats below come from
// scripts/derive-assembly.py.
const CORNER_AXIS = new THREE.Vector3(-Math.cos(deg(55.5)), 0, -Math.sin(deg(55.5)));
const PLATE_SEAT = 19.5;   // mm the base plate moves out along the axis to line the shell's inner panel
// The tip cap's three pegs match the three holes in the shell's truncated tip; it sits on the tip
// facet (39.82 mm out along the axis plus a 3.8 mm sideways shift onto the holes).
const CAP_SEAT = [-25.70, 0, -30.65];
const REST_INSET = 37.15;  // mm each corner moves in from the kit layout: neighbours meet edge to edge
                           // at 37.18 and the core would be touched at 37.60

export function makeMaterials(theme = {}) {
  const t = { ...DEFAULT_THEME, ...theme };
  return {
    shell: new THREE.MeshStandardMaterial({ color: t.shell, roughness: 0.42, metalness: 0.08 }),
    inner: new THREE.MeshStandardMaterial({ color: t.inner, roughness: 0.38, metalness: 0.75 }),
    core: new THREE.MeshStandardMaterial({ color: t.core, roughness: 0.3, metalness: 0.85 }),
    eyePlate: new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.35, metalness: 0.7 }),
    // unlit so tone mapping cannot wash the state colour out to white
    eyeGlow: new THREE.MeshBasicMaterial({ color: t.eye, toneMapped: false }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false }),
    halo: new THREE.SpriteMaterial({ map: haloTexture(), color: t.eye, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5, toneMapped: false }),
  };
}

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.08)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * @param geoms map of part name (PART_FILES) -> BufferGeometry, in STL units (mm)
 * @param opts.theme colour overrides, see DEFAULT_THEME
 */
export function buildGhost(geoms, opts = {}) {
  const mats = makeMaterials(opts.theme);
  const root = new THREE.Group();            // three.js frame: eye -> +Z, up -> +Y
  const model = new THREE.Group();
  model.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  root.add(model);

  const mesh = (g, mat, m) => { const o = new THREE.Mesh(g, mat); o.matrixAutoUpdate = false; o.matrix.copy(m); return o; };

  const core = new THREE.Group(); model.add(core);
  core.add(mesh(geoms.body_front, mats.core, I4()));
  core.add(mesh(geoms.body_back, mats.core, I4()));
  core.add(mesh(geoms.battery_body, mats.inner, I4()));
  core.add(mesh(geoms.battery_cap, mats.inner, I4()));
  const eye = new THREE.Group(); core.add(eye);
  eye.add(mesh(geoms.diffuser, mats.eyeGlow, I4()));          // glows through the eye plate's cut-outs
  eye.add(mesh(geoms.eye, mats.eyePlate, I4()));
  eye.add(mesh(geoms.lense, mats.lens, rot([0, 1, 0], 90)));  // the kit exports the lens lying flat

  const halo = new THREE.Sprite(mats.halo);
  halo.position.set(26, 0, 0); halo.scale.set(46, 46, 1); core.add(halo);

  // Front and back rings of 4 corners, separate groups so they can orbit the eye axis.
  const rings = { front: new THREE.Group(), back: new THREE.Group() };
  model.add(rings.front, rings.back);
  const plateSeat = new THREE.Matrix4().makeTranslation(...CORNER_AXIS.clone().multiplyScalar(PLATE_SEAT).toArray());
  const capSeat = new THREE.Matrix4().makeTranslation(...CAP_SEAT);
  const corners = [];
  for (const [slot, M] of Object.entries(D2)) {
    for (const side of [false, true]) {
      const B = side ? M.clone().multiply(SIDE) : M.clone();
      const corner = new THREE.Group();      // one rigid piece; only its position changes
      corner.add(slot === 'ft' && !side ? mesh(geoms.wing_front_top, mats.shell, I4()) : mesh(geoms.wing, mats.shell, B));
      corner.add(mesh(geoms.wing_inside, mats.inner, B.clone().multiply(plateSeat)));
      corner.add(mesh(geoms.cap, mats.shell, B.clone().multiply(capSeat)));
      const dir = CORNER_AXIS.clone().applyMatrix4(new THREE.Matrix4().extractRotation(B));
      (slot[0] === 'f' ? rings.front : rings.back).add(corner);
      corners.push({ slot: slot + (side ? ':side' : ':top-bottom'), corner, dir });
    }
  }

  function setLift(mm) {
    const lift = Math.max(0, mm);             // corners cannot sink into each other or the core
    for (const c of corners) c.corner.position.copy(c.dir).multiplyScalar(lift - REST_INSET);
  }
  setLift(0);

  return {
    root, model, core, eye, halo, rings, corners, mats,
    /** how far (mm) every corner lifts off the core along its own axis; 0 = closed shell */
    setLift,
    /** intensity 0..1.5 scales the (unlit) eye colour and its halo */
    setEyeColor(hex, intensity = 1) {
      const k = Math.min(intensity, 1.5);
      mats.eyeGlow.color.setHex(hex).multiplyScalar(k);
      mats.halo.color.setHex(hex); mats.halo.opacity = 0.5 * k;
    },
  };
}
