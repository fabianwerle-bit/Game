import * as THREE from 'three';

// Eskalation pro Tag: [Nebel, Regen, Licht, Vögel, Sturm]
const DAYS = [
  { fog: 0.0028, rain: 0.0, light: 1.0, birds: 1.0, storm: 0, warm: 1 },
  { fog: 0.0060, rain: 0.12, light: 0.85, birds: 0.5, storm: 0, warm: 0.5 },
  { fog: 0.0125, rain: 0.5, light: 0.66, birds: 0.0, storm: 0, warm: 0 },
  { fog: 0.0210, rain: 0.75, light: 0.5, birds: 0, storm: 0.3, warm: 0 },
  { fog: 0.0310, rain: 1.0, light: 0.36, birds: 0, storm: 1, warm: 0 },
  { fog: 0.0420, rain: 1.0, light: 0.26, birds: 0, storm: 1, warm: 0 },
];
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createWeather(scene, renderer, world, scenery) {
  scene.fog = new THREE.FogExp2(0x9aa4a8, 0.003);
  const hemi = new THREE.HemisphereLight(0xcfd8de, 0x4a4f44, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.5); sun.position.set(-0.5, 0.75, 0.35); scene.add(sun);
  // Regen
  const COUNT = 2600, L = 26, HH = 16;
  const base = new Float32Array(COUNT * 2 * 3), end = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) { const x = Math.random() * L, y = Math.random() * HH, z = Math.random() * L; for (let k = 0; k < 2; k++) { base.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(base, 3)); rg.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const ru = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAlpha: { value: 0.3 }, uCol: { value: new THREE.Color(0xaab4bc) }, uWind: { value: new THREE.Vector2(0.22, 0.1) } };
  const rm = new THREE.ShaderMaterial({
    uniforms: ru, transparent: true, depthWrite: false,
    vertexShader: `attribute float aEnd; uniform float uTime; uniform vec3 uCam; uniform vec2 uWind; varying float vA;
      void main(){ vec3 p = position; float sp = 17.0 + fract(p.x*7.3+p.z*3.1)*7.0;
        p.y = mod(p.y - uTime*sp, ${HH.toFixed(1)});
        p.xz += uWind * (${HH.toFixed(1)} - p.y);
        p.xz = mod(p.xz - uCam.xz, ${L.toFixed(1)}) - ${(L / 2).toFixed(1)} + uCam.xz;
        p.y += uCam.y - ${(HH * 0.45).toFixed(1)};
        p += vec3(-uWind.x, 1.0, -uWind.y) * aEnd * 0.55;
        vec4 mv = modelViewMatrix * vec4(p,1.0); vA = (1.0 - aEnd*0.8) * smoothstep(${(L / 2).toFixed(1)}, ${(L / 2 - 5).toFixed(1)}, -mv.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uAlpha; uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, uAlpha*vA); }`,
  });
  const rain = new THREE.LineSegments(rg, rm); rain.frustumCulled = false; rain.renderOrder = 5; scene.add(rain);

  const dayFog = new THREE.Color(), nightFog = new THREE.Color(0x030506), tmp = new THREE.Color();
  const st = { fog: 0.003, rain: 0, light: 1, daylight: 1, birds: 1, storm: 0, flash: 0, nextFlash: 20, thunder: null, indoor: 0, vis: 300 };
  const params = day => DAYS[Math.min(DAYS.length - 1, day - 1)];

  st.update = (dt, t, day, hour, cam, indoor, cave, ov) => {
    if (hour >= 24) hour -= 24;
    const p = params(day);
    // Tag 2: Nieselregen erst am Nachmittag. Abends immer etwas mehr Nebel.
    const eve = sstep(15, 20, hour);
    const rainNow = ov && ov.rain >= 0 ? ov.rain : day === 1 ? 0 : (day === 2 ? p.rain * sstep(13, 16, hour) : p.rain);
    const daylight = sstep(5.5, 8, hour) * (1 - sstep(18.3, 21.3, hour));
    st.daylight = daylight; st.rain = rainNow; st.birds = p.birds * daylight * (1 - eve * 0.7); st.storm = p.storm; st.light = p.light;
    st.fog = (p.fog * (1 + eve * 0.7) + (1 - daylight) * 0.004) * (ov ? ov.fog : 1);
    st.vis = Math.min(400, 2.6 / st.fog);
    const lum = p.light * (0.04 + 0.96 * daylight);
    // Blitze
    if (p.storm > 0) {
      st.nextFlash -= dt * p.storm;
      if (st.nextFlash <= 0) { st.nextFlash = 14 + Math.random() * 30; st.flash = 1; st.thunder = 0.6 + Math.random() * 2.5; }
    }
    let fl = 0;
    if (st.flash > 0) { st.flash -= dt * 2.4; const f = st.flash; fl = (f > 0.82 || (f < 0.6 && f > 0.48)) ? 1 : 0.0; }
    dayFog.setRGB(0.60, 0.645, 0.67).lerp(tmp.setRGB(0.80, 0.72, 0.62), p.warm * eve * 0.8).multiplyScalar(0.25 + 0.75 * p.light);
    scene.fog.color.copy(nightFog).lerp(dayFog, Math.min(1, lum / Math.max(0.01, p.light) * 1.0));
    if (fl) scene.fog.color.lerp(tmp.setRGB(0.75, 0.8, 0.9), 0.55);
    scene.fog.density = st.fog;
    scene.background = scene.fog.color;
    renderer.setClearColor(scene.fog.color);
    scene.environmentIntensity = 0.03 + lum * (0.95 - 0.3 * p.warm) + fl * 1.2;
    hemi.intensity = 0.04 + lum * (0.5 - 0.25 * p.warm) + fl * 2.5;
    sun.intensity = daylight * p.warm * 3.2 + daylight * Math.max(0, p.light - 0.5) * 1.0;
    sun.color.setRGB(1, 0.93 - eve * 0.25, 0.84 - eve * 0.45);
    sun.position.set(-0.5 - eve * 0.6, 0.8 - eve * 0.62, 0.35);
    scenery.skyM.opacity = Math.max(0, 1 - st.fog * 36);
    scenery.skyM.color.setScalar(Math.min(1, lum * (0.55 + 0.45 * p.warm) + fl));
    world.wet.value += ((rainNow > 0.05 || day > 2 ? 0.35 + 0.65 * Math.min(1, rainNow * 1.5) : 0) - world.wet.value) * Math.min(1, dt * 0.2);
    for (const m of world.wetMats) m.roughness = 0.9 - 0.62 * world.wet.value;
    scenery.mats.waterM.color.setRGB(0.05 * lum + 0.004, 0.105 * lum + 0.006, 0.12 * lum + 0.008);
    ru.uTime.value = t; ru.uCam.value.copy(cam.position);
    ru.uAlpha.value = (0.16 + 0.3 * lum + fl * 0.4) * Math.min(1, rainNow * 1.3);
    ru.uWind.value.set(0.12 + 0.3 * p.storm + Math.sin(t * 0.3) * 0.06, 0.08 + Math.cos(t * 0.23) * 0.06);
    rain.visible = rainNow > 0.01 && !indoor;
    rg.setDrawRange(0, Math.floor(COUNT * Math.min(1, 0.25 + rainNow)) * 2);
    st.lum = lum;
    if (cave) { // unter Tage: völlige Dunkelheit
      scene.fog.color.setRGB(0, 0, 0); scene.fog.density = 0.075; scene.environmentIntensity = 0.004; hemi.intensity = 0.012; sun.intensity = 0; scenery.skyM.opacity = 0; rain.visible = false; st.lum = 0.02; st.vis = 60; st.cave = true;
    } else st.cave = false;
  };
  return st;
}
