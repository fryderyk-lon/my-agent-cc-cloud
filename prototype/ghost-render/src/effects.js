// Energy effects around the Ghost: the energy sphere, the burst and the scan beam.
// All of it is additive light. Theme frames are matted from a black- and a white-background render
// (scripts/matte.py), which is what keeps additive glow correct on a transparent canvas.
import * as THREE from 'three';

// 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT), https://github.com/ashima/webgl-noise
const SNOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// ---- canvas textures for the burst
function canvasTexture(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const radial = stops => canvasTexture(256, (g, n) => {
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd; g.fillRect(0, 0, n, n);
});
// deterministic pseudo-random so every render of a frame is identical
const rand = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const raysTexture = () => canvasTexture(512, (g, n) => {
  const r = rand(7); g.translate(n / 2, n / 2); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2 + r() * 0.06, len = n * (0.18 + 0.32 * r() ** 2), wdt = 0.8 + 2.4 * r();
    const grd = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(0.35, 'rgba(150,205,255,0.55)'); grd.addColorStop(1, 'rgba(80,150,255,0)');
    g.strokeStyle = grd; g.lineWidth = wdt; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
  }
});
// soft core radiance: a bright blue-white centre with faint streaks thrown outwards
const radiantTexture = () => canvasTexture(512, (g, n) => {
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(235,250,255,1)'); grd.addColorStop(0.2, 'rgba(130,210,255,0.9)');
  grd.addColorStop(0.42, 'rgba(80,160,255,0.35)'); grd.addColorStop(0.72, 'rgba(60,120,255,0.08)'); grd.addColorStop(1, 'rgba(60,120,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, n, n);
  const r = rand(11); g.translate(n / 2, n / 2); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, len = n * (0.16 + 0.26 * r());
    const lg = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    lg.addColorStop(0, 'rgba(170,225,255,0.35)'); lg.addColorStop(1, 'rgba(90,160,255,0)');
    g.strokeStyle = lg; g.lineWidth = 2 + 5 * r(); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
  }
});
const ringTexture = () => canvasTexture(512, (g, n) => {
  const grd = g.createRadialGradient(n / 2, n / 2, n * 0.34, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(80,150,255,0)'); grd.addColorStop(0.55, 'rgba(110,170,255,0.3)');
  grd.addColorStop(0.8, 'rgba(225,242,255,0.95)'); grd.addColorStop(0.9, 'rgba(110,170,255,0.35)'); grd.addColorStop(1, 'rgba(80,150,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, n, n);
});

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
const deg = THREE.MathUtils.degToRad;

/** Energy sphere centred on the core. set({ intensity, radius, spin, flow, color }) or set(undefined). */
export function makeEnergySphere() {
  const mat = new THREE.ShaderMaterial({
    ...additive, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0x6aa8ff) }, uIntensity: { value: 0 }, uFlow: { value: 0 }, uSpin: { value: 0 } },
    vertexShader: `
      uniform float uFlow;
      varying vec3 vObj; varying vec3 vN; varying vec3 vV;
      ${SNOISE}
      void main() {
        float w = 6.28318530718 * uFlow;
        // a slightly restless surface: small bulges that drift and close after whole cycles
        vec3 p = position * (1.0 + 0.025 * snoise(position * 2.5 + vec3(cos(w), sin(w), 0.0) * 0.6));
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uIntensity; uniform float uFlow; uniform float uSpin;
      varying vec3 vObj; varying vec3 vN; varying vec3 vV;
      ${SNOISE}
      void main() {
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(1.0 - ndv, 2.6);
        float c = cos(uSpin), s = sin(uSpin);
        vec3 q = vec3(c * vObj.x - s * vObj.y, s * vObj.x + c * vObj.y, vObj.z);   // spin about the eye axis (+Z)
        float w = 6.28318530718 * uFlow;
        vec3 drift = vec3(cos(w), sin(w), 0.5 * cos(w)) * 0.5;
        // flowing streamlines: contour lines of a smooth field whose phase advances with the flow
        float field = snoise(q * 1.1 + drift) + 0.5 * snoise(q * 2.3 - drift);
        float lines = pow(abs(sin(field * 5.0 + w)), 18.0);
        float soft = 0.5 + 0.5 * snoise(q * 1.6 + drift * 1.7);
        float face = gl_FrontFacing ? 1.0 : 0.35;
        float a = (rim * 1.1 + lines * (0.12 + 0.5 * rim) * soft + 0.012 + 0.014 * soft) * face * 0.75;
        vec3 col = mix(uColor, vec3(0.92, 0.97, 1.0), clamp(rim * 0.55 + lines * 0.5, 0.0, 1.0));
        gl_FragColor = vec4(col * a * uIntensity, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat);
  // soft outer glow round the rim (camera-facing, scales with the sphere)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ ...additive, map: radial([
    [0, 'rgba(90,150,255,0)'], [0.6, 'rgba(90,150,255,0)'], [0.74, 'rgba(150,200,255,0.5)'],
    [0.8, 'rgba(120,180,255,0.22)'], [0.9, 'rgba(100,160,255,0.06)'], [1, 'rgba(90,150,255,0)'],
  ]) }));
  glow.scale.setScalar(2.6); glow.renderOrder = 11; mesh.add(glow);
  // bright blue radiance round the core inside the sphere; depth-tested so the core stays dark in front
  const radiance = new THREE.Sprite(new THREE.SpriteMaterial({ ...additive, depthTest: true, map: radiantTexture() }));
  radiance.renderOrder = 9; radiance.visible = false;
  mesh.visible = false; mesh.renderOrder = 10;
  return {
    mesh, radiance,
    set(s) {
      mesh.visible = !!s && s.intensity > 0.001;
      if (!mesh.visible) { radiance.visible = false; return; }
      mesh.scale.setScalar(s.radius);
      mat.uniforms.uIntensity.value = s.intensity;
      mat.uniforms.uFlow.value = s.flow ?? 0;
      mat.uniforms.uSpin.value = deg(s.spin ?? 0);
      mat.uniforms.uColor.value.setHex(s.color ?? 0x6aa8ff);
      glow.material.color.setHex(s.color ?? 0x6aa8ff);
      glow.material.opacity = Math.min(1, 0.8 * s.intensity);
      radiance.visible = true;
      radiance.scale.setScalar(1.9 * s.radius);
      radiance.material.opacity = Math.min(1, 1.0 * s.intensity);
    },
  };
}

const easeOut = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

// thin horizontal light streak (the anamorphic flare when the light condenses back into the Ghost)
const streakTexture = () => canvasTexture(512, (g, n) => {
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(170,220,255,0.6)'); grd.addColorStop(1, 'rgba(90,150,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, n, n);
});

/**
 * Energy burst, following the Destiny 2 revive and the usual real-time VFX layering: a puff of light
 * leaks from the shell, a spiky flare pops, sparks shoot out as stretched streaks, and a few hundred
 * mist particles spray outward — fast, then slowed by drag, swirling, growing, shifting white -> cyan
 * -> blue -> violet and dissolving through noise with a bright rim — until they have rushed out of the
 * window. The light then condenses into a glare on the Ghost with a horizontal streak.
 * set({ age: seconds since the burst began, intensity, scale }) or set(undefined).
 * Every particle is a closed-form function of its age, so re-rendering a frame gives the same image.
 */
export function makeBurst() {
  const group = new THREE.Group();
  const rnd = rand(1234);

  // ---- mist: soft noisy puffs that dissolve with a glowing edge
  const MIST = 180;
  const mistGeo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  const mDir = [], mRnd = [], mSpeed = [], mLife = [], mDelay = [], mSize = [];
  for (let i = 0; i < MIST; i++) {
    const a = rnd() * Math.PI * 2, z = (rnd() - 0.5) * 0.5;
    const d = new THREE.Vector3(Math.cos(a), Math.sin(a), z).normalize();
    mDir.push(d.x, d.y, d.z);
    mRnd.push(rnd(), rnd(), rnd(), rnd());
    mSpeed.push(380 + 640 * rnd() ** 1.3);            // mm/s at birth
    mLife.push(0.5 + 0.55 * rnd());
    mDelay.push(0.16 * rnd() ** 1.5);
    mSize.push(28 + 34 * rnd());
  }
  mistGeo.setAttribute('aDir', new THREE.InstancedBufferAttribute(new Float32Array(mDir), 3));
  mistGeo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(new Float32Array(mRnd), 4));
  mistGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(new Float32Array(mSpeed), 1));
  mistGeo.setAttribute('aLife', new THREE.InstancedBufferAttribute(new Float32Array(mLife), 1));
  mistGeo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(new Float32Array(mDelay), 1));
  mistGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(mSize), 1));
  mistGeo.instanceCount = MIST;
  // DoubleSide: stretching a quad along its motion mirrors it, which would otherwise cull it as a back face
  const mistMat = new THREE.ShaderMaterial({
    ...additive, depthTest: false, side: THREE.DoubleSide,
    uniforms: { uAge: { value: 0 }, uI: { value: 1 }, uScale: { value: 1 } },
    vertexShader: `
      uniform float uAge; uniform float uScale;
      attribute vec3 aDir; attribute vec4 aRnd; attribute float aSpeed; attribute float aLife; attribute float aDelay; attribute float aSize;
      varying vec2 vUv; varying float vLife; varying vec4 vRnd;
      void main() {
        float age = uAge - aDelay;
        float life = clamp(age / aLife, 0.0, 1.0);
        vUv = uv; vLife = life; vRnd = aRnd;
        float drag = 2.2, a = max(age, 0.0);
        float r0 = uScale * (24.0 + 40.0 * aRnd.y);                                 // born round the shell
        float s = r0 + uScale * aSpeed * (1.0 - exp(-drag * a)) / drag;              // fast, then slowed
        vec3 dir = aDir;
        float sw = (aRnd.x - 0.5) * 0.9 * life;                                      // slight swirl
        dir.xy = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * dir.xy;
        vec3 p = dir * s;
        float v = exp(-drag * a);                                                    // speed left, 0..1
        float size = uScale * aSize * (0.6 + 1.3 * pow(life, 0.6));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec2 d = normalize((modelViewMatrix * vec4(dir, 0.0)).xy + 1e-5);
        float len = size * (1.0 + 1.3 * v), wid = size * 0.8;                        // stretched along the motion
        mv.xy += d * position.y * len + vec2(-d.y, d.x) * position.x * wid;
        gl_Position = projectionMatrix * mv;
        if (age <= 0.0 || life >= 1.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);    // not born yet / gone
      }`,
    fragmentShader: `
      uniform float uI;
      varying vec2 vUv; varying float vLife; varying vec4 vRnd;
      ${SNOISE}
      void main() {
        vec2 c = vUv - 0.5; float r = length(c) * 2.0;
        float shape = exp(-r * r * 2.2) * (1.0 - smoothstep(0.75, 1.0, r));
        float n = 0.5 + 0.5 * (0.6 * snoise(vec3(c.x * 5.0 + vRnd.x * 11.0, c.y * 1.6 + vRnd.y * 7.0, vRnd.z * 6.0 + vLife * 1.8))
                             + 0.4 * snoise(vec3(c * vec2(10.0, 3.0) + vRnd.zw * 5.0, vRnd.w * 9.0 - vLife * 2.0)));
        float mask = shape * (0.35 + 0.65 * n);
        float th = 0.8 * pow(vLife, 1.3);                                            // tears apart as it goes
        float body = smoothstep(th, th + 0.45, mask) * mask;
        vec3 white = vec3(0.93, 0.98, 1.0), cyan = vec3(0.45, 0.82, 1.0), blue = vec3(0.2, 0.42, 1.0), violet = vec3(0.36, 0.4, 1.0);
        vec3 col = vLife < 0.2 ? mix(white, cyan, vLife / 0.2)
                 : vLife < 0.55 ? mix(cyan, blue, (vLife - 0.2) / 0.35) : mix(blue, violet, (vLife - 0.55) / 0.45);
        float bright = (0.2 * pow(1.0 - vLife, 1.2) + 0.035) * smoothstep(0.0, 0.1, vLife);   // quick fade-in
        vec3 outc = col * body * bright;
        gl_FragColor = vec4(outc * uI, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mist = new THREE.Mesh(mistGeo, mistMat);
  mist.frustumCulled = false; mist.renderOrder = 20; group.add(mist);

  // ---- sparks: thin streaks stretched along their motion
  const SPARKS = 140;
  const sparkGeo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  const sDir = [], sRnd = [], sSpeed = [], sLife = [], sDelay = [];
  for (let i = 0; i < SPARKS; i++) {
    const a = rnd() * Math.PI * 2, z = (rnd() - 0.5) * 0.35;
    const d = new THREE.Vector3(Math.cos(a), Math.sin(a), z).normalize();
    sDir.push(d.x, d.y, d.z); sRnd.push(rnd(), rnd(), rnd(), rnd());
    sSpeed.push(700 + 1300 * rnd()); sLife.push(0.3 + 0.45 * rnd()); sDelay.push(0.06 * rnd());
  }
  sparkGeo.setAttribute('aDir', new THREE.InstancedBufferAttribute(new Float32Array(sDir), 3));
  sparkGeo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(new Float32Array(sRnd), 4));
  sparkGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(new Float32Array(sSpeed), 1));
  sparkGeo.setAttribute('aLife', new THREE.InstancedBufferAttribute(new Float32Array(sLife), 1));
  sparkGeo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(new Float32Array(sDelay), 1));
  sparkGeo.instanceCount = SPARKS;
  const sparkMat = new THREE.ShaderMaterial({
    ...additive, depthTest: false, side: THREE.DoubleSide,
    uniforms: { uAge: { value: 0 }, uI: { value: 1 }, uScale: { value: 1 } },
    vertexShader: `
      uniform float uAge; uniform float uScale;
      attribute vec3 aDir; attribute vec4 aRnd; attribute float aSpeed; attribute float aLife; attribute float aDelay;
      varying vec2 vUv; varying float vLife;
      void main() {
        float age = uAge - aDelay, life = clamp(age / aLife, 0.0, 1.0);
        vUv = uv; vLife = life;
        float drag = 4.0, a = max(age, 0.0);
        vec3 p = aDir * uScale * aSpeed * (1.0 - exp(-drag * a)) / drag;
        float v = exp(-drag * a);                                                  // speed left, 0..1
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec2 d = normalize((modelViewMatrix * vec4(aDir, 0.0)).xy + 1e-5);
        float len = uScale * (10.0 + 70.0 * v) * (0.6 + 0.8 * aRnd.x), wid = uScale * (1.2 + 1.6 * aRnd.y);
        mv.xy += d * position.y * len + vec2(-d.y, d.x) * position.x * wid;
        gl_Position = projectionMatrix * mv;
        if (age <= 0.0 || life >= 1.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `
      uniform float uI;
      varying vec2 vUv; varying float vLife;
      void main() {
        float across = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
        float along = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));   // bright head, thin tail
        vec3 col = mix(vec3(1.0), vec3(0.5, 0.82, 1.0), vLife);
        gl_FragColor = vec4(col * across * along * (1.0 - vLife) * 1.6 * uI, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sparks = new THREE.Mesh(sparkGeo, sparkMat);
  sparks.frustumCulled = false; sparks.renderOrder = 21; group.add(sparks);

  // ---- flare, glare and streak sprites
  const sprite = map => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, ...additive, depthTest: false })); sp.renderOrder = 22; group.add(sp); return sp; };
  const flare = sprite(raysTexture());
  const glare = sprite(radial([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(210,240,255,0.9)'], [0.4, 'rgba(110,180,255,0.35)'], [1, 'rgba(70,130,255,0)']]));
  const streak = sprite(streakTexture());
  group.visible = false;
  return {
    group,
    set(b) {
      group.visible = !!b;
      if (!b) return;
      const { age, intensity = 1, scale = 1 } = b, I = intensity;
      for (const m of [mistMat, sparkMat]) { m.uniforms.uAge.value = age - 0.06; m.uniforms.uI.value = I; m.uniforms.uScale.value = scale; }
      // leak (0-0.06 s), flare (0.06-0.35 s), whiteout from overlapping mist, condensing glare (0.55-0.9 s)
      flare.scale.setScalar(scale * (60 + 360 * easeOut((age - 0.05) / 0.22)));
      flare.material.opacity = I * (age < 0.08 ? smooth((age - 0.04) / 0.04) : 1 - smooth((age - 0.1) / 0.28));
      flare.material.rotation = 0.35 * age;
      const leak = smooth(age / 0.04) * (1 - smooth((age - 0.06) / 0.08));
      const cond = smooth((age - 0.55) / 0.1) * (1 - smooth((age - 0.7) / 0.2));
      const flash = smooth((age - 0.05) / 0.05) * (1 - smooth((age - 0.12) / 0.22));
      glare.scale.setScalar(scale * (40 + 70 * leak + 90 * cond + 300 * flash));
      glare.material.opacity = Math.min(1, I * (leak + cond + flash));
      streak.scale.set(scale * 340, scale * 16, 1);
      streak.material.opacity = I * cond;
    },
  };
}

/** Flat wedge of light from the eye that sweeps up and down. Lives in the model frame (eye -> +X, up -> +Z). */
export function makeScan() {
  const R = 170, SEG = 24, HALF = deg(22);
  const pos = [0, 0, 0], along = [0];
  for (let i = 0; i <= SEG; i++) { const a = -HALF + (2 * HALF * i) / SEG; pos.push(R * Math.cos(a), R * Math.sin(a), 0); along.push(1); }
  const idx = [];
  for (let i = 1; i <= SEG; i++) idx.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    ...additive, side: THREE.DoubleSide,
    uniforms: { uK: { value: 0 }, uColor: { value: new THREE.Color(0x7fdcff) } },
    vertexShader: `attribute float along; varying float vAlong; varying vec3 vP;
      void main(){ vAlong = along; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uK; uniform vec3 uColor; varying float vAlong; varying vec3 vP;
      void main(){
        float d = length(vP.xy) / 170.0;
        float lines = 0.55 + 0.45 * step(0.5, fract(d * 18.0));
        float a = uK * pow(1.0 - d, 1.6) * lines * 0.8;
        gl_FragColor = vec4(uColor * a, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(28, 0, 0); mesh.visible = false; mesh.renderOrder = 15;
  return {
    mesh,
    set(s) {
      mesh.visible = !!s && s.k > 0.001;
      if (!mesh.visible) return;
      mat.uniforms.uK.value = s.k;
      mesh.rotation.set(0, -deg(s.angle ?? 0), 0);   // positive angle sweeps upward
    },
  };
}
