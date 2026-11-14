import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm } from './world.js';

function foliageGeo(seed) {
  const R = rng(seed), P = [], U = [], Nn = [], I = [], C = [], S = 8, n = 12;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), y = 2.3 + f * 11.4, rad = 3.5 * Math.pow(1 - f, 0.9) + 0.55, rot = R() * 6.28, b = P.length / 3;
    const sh = 0.5 + 0.5 * f; P.push(0, y + rad * 0.36, 0); U.push(0.5, 0.5); Nn.push(0, 1, 0); C.push(0.3 * sh, 0.32 * sh, 0.3 * sh);
    for (let s = 0; s < S; s++) {
      const a = rot + s / S * 6.283, rr = rad * (0.85 + R() * 0.3), yy = y - rad * (0.2 + R() * 0.16);
      P.push(Math.cos(a) * rr, yy, Math.sin(a) * rr); U.push(0.5 + 0.53 * Math.cos(s / S * 6.283), 0.5 + 0.53 * Math.sin(s / S * 6.283));
      C.push(sh, sh, sh); const l = Math.hypot(rr, rr * 0.9); Nn.push(Math.cos(a) * rr / l, rr * 0.9 / l, Math.sin(a) * rr / l);
      I.push(b, b + 1 + (s + 1) % S, b + 1 + s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  return g;
}
function crossGeo(w, h, y0, planes = 2) {
  const gs = [];
  for (let i = 0; i < planes; i++) { const g = new THREE.PlaneGeometry(w, h); g.translate(0, y0 + h / 2, 0); g.rotateY(i * Math.PI / planes); const nn = g.attributes.normal; for (let k = 0; k < nn.count; k++) nn.setXYZ(k, 0, 1, 0); gs.push(g); }
  return mergeGeometries(gs);
}

export function createScenery(assets, world, scene) {
  const { T, M } = assets, R = rng(4242);
  for (const t of [T.whorl, T.firSide, T.fern]) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  // ---------- Bäume ----------
  const trunkG = new THREE.CylinderGeometry(0.1, 0.36, 15, 7, 1, true); trunkG.translate(0, 7.5, 0);
  T.bark.d.repeat.set(2, 5); T.bark.n.repeat.set(2, 5);
  const trunkM = new THREE.MeshStandardMaterial({ map: T.bark.d, normalMap: T.bark.n, roughness: 0.95, color: 0x8d8880 });
  const folM = new THREE.MeshStandardMaterial({ map: T.whorl, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.9, color: 0x869a82, vertexColors: true });
  const topM = new THREE.MeshStandardMaterial({ map: T.firSide, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.9, color: 0x7d9079 });
  const folG = [foliageGeo(1), foliageGeo(2)], topG = crossGeo(2.6, 4.2, 11.4);
  const chunks = new Map(), CH = 90, occ = new Set(), trees = [];
  let tries = 0;
  while (trees.length < 2300 && tries++ < 60000) {
    const x = (R() - 0.5) * 640, z = (R() - 0.5) * 640, h = world.getHeight(x, z);
    if (h < 3.1) continue;
    const fm = world.forestMask(x, z); if (R() > fm * 0.95 + 0.07) continue;
    const rn = world.roadNear(x, z); if (rn && rn.d < rn.s.w + 2.8) continue;
    if (!world.clearOfPois(x, z, 2.5)) continue;
    const sl = Math.abs(world.getHeight(x + 1.5, z) - h) + Math.abs(world.getHeight(x, z + 1.5) - h); if (sl > 2.2) continue;
    const ok = Math.round(x / 2.8) + ',' + Math.round(z / 2.8); if (occ.has(ok)) continue; occ.add(ok);
    const s = 0.62 + R() * 0.75 + (fm > 0.8 ? 0.15 : 0);
    const t = { x, z, y: h - 0.25, s, rot: R() * 6.28, v: R() < 0.5 ? 0 : 1, lean: (R() - 0.5) * 0.07 };
    trees.push(t); world.addCircle(x, z, 0.34 * s);
    const k = Math.floor(x / CH) + ',' + Math.floor(z / CH); (chunks.get(k) || chunks.set(k, []).get(k)).push(t);
  }
  const d = new THREE.Object3D(), col = new THREE.Color();
  const inst = (g, m, list, tint) => {
    const im = new THREE.InstancedMesh(g, m, list.length);
    list.forEach((t, i) => {
      d.position.set(t.x, t.y, t.z); d.rotation.set(t.lean, t.rot, t.lean * 0.6); d.scale.set(t.s * (t.w || 1), t.s, t.s * (t.w || 1)); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      if (tint) { const v = 0.72 + ((i * 37) % 17) / 17 * 0.38; im.setColorAt(i, col.setRGB(v, v * (0.96 + ((i * 13) % 7) / 80), v * 0.94)); }
    });
    im.computeBoundingSphere(); im.computeBoundingBox(); scene.add(im); return im;
  };
  for (const list of chunks.values()) {
    inst(trunkG, trunkM, list, false); inst(topG, topM, list, true);
    for (let v = 0; v < 2; v++) { const l = list.filter(t => t.v === v); if (l.length) inst(folG[v], folM, l, true); }
  }
  // ---------- Farne ----------
  const fernM = new THREE.MeshStandardMaterial({ map: T.fern, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, color: 0xa9b8a0 });
  const ferns = [];
  tries = 0;
  while (ferns.length < 2600 && tries++ < 30000) {
    const x = (R() - 0.5) * 620, z = (R() - 0.5) * 620, h = world.getHeight(x, z);
    if (h < 3 || world.forestMask(x, z) < 0.25 + R() * 0.5) continue;
    const rn = world.roadNear(x, z); if (rn && rn.d < rn.s.w + 0.6) continue;
    if (!world.clearOfPois(x, z, -2)) continue;
    ferns.push({ x, z, y: h - 0.05, s: 0.6 + R() * 0.9, rot: R() * 6.28, lean: 0 });
  }
  const fch = new Map(); ferns.forEach(f => { const k = Math.floor(f.x / 120) + ',' + Math.floor(f.z / 120); (fch.get(k) || fch.set(k, []).get(k)).push(f); });
  const fernG = crossGeo(1.5, 0.75, -0.04, 3);
  for (const l of fch.values()) inst(fernG, fernM, l, true);

  // ---------- Felsen ----------
  const rocks = [];
  const place = (model, x, z, s, ry, sink = 0.3) => {
    const o = M[model].clone(); o.scale.setScalar(s); o.rotation.y = ry; o.position.set(x, world.getHeight(x, z) - sink * s, z); scene.add(o);
    const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()); world.addCircle(x, z, Math.min(3.5, Math.max(sz.x, sz.z) * 0.36)); rocks.push(o); return o;
  };
  const RR = rng(99);
  let placed = 0, guard = 0;
  while (placed < 14 && guard++ < 4000) {
    const x = (RR() - 0.5) * 600, z = (RR() - 0.5) * 600, h = world.getHeight(x, z);
    const coast = h > 0.7 && h < 2.6, nearL = Math.hypot(x - world.LH.x, z - world.LH.y) < 55 && h > 2;
    if (!(coast || nearL)) continue;
    const rn = world.roadNear(x, z); if (rn && rn.d < rn.s.w + 5) continue; if (!world.clearOfPois(x, z, 4)) continue;
    place(placed % 2 ? 'rock_07' : 'rock_09', x, z, (placed % 2 ? 8 : 18) * (1 + RR() * 1.6), RR() * 6.28); placed++;
  }

  // ---------- Wasser ----------
  const WN = 256, data = new Uint8Array(WN * WN * 4), hh = new Float32Array(WN * WN);
  const waves = []; for (let i = 0; i < 26; i++) waves.push([Math.round((R() - 0.5) * 16), Math.round((R() - 0.5) * 16), R() * 6.28, 0.3 + R()]);
  for (let y = 0; y < WN; y++) for (let x = 0; x < WN; x++) { let s = 0; for (const w of waves) s += Math.sin((x * w[0] + y * w[1]) / WN * 6.2832 + w[2]) * w[3] / (1 + Math.hypot(w[0], w[1]) * 0.35); hh[y * WN + x] = s; }
  for (let y = 0; y < WN; y++) for (let x = 0; x < WN; x++) {
    const dx = hh[y * WN + (x + 1) % WN] - hh[y * WN + (x + WN - 1) % WN], dy = hh[((y + 1) % WN) * WN + x] - hh[((y + WN - 1) % WN) * WN + x];
    const v = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize(), k = (y * WN + x) * 4;
    data[k] = v.x * 127 + 128; data[k + 1] = v.y * 127 + 128; data[k + 2] = v.z * 127 + 128; data[k + 3] = 255;
  }
  const wn = new THREE.DataTexture(data, WN, WN); wn.wrapS = wn.wrapT = THREE.RepeatWrapping; wn.magFilter = THREE.LinearFilter; wn.minFilter = THREE.LinearMipmapLinearFilter; wn.generateMipmaps = true; wn.needsUpdate = true;
  wn.repeat.set(160, 160);
  const waterM = new THREE.MeshStandardMaterial({ color: 0x0e1c20, roughness: 0.16, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.9, 0.9) });
  const wg = new THREE.PlaneGeometry(2600, 2600); wg.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(wg, waterM); water.position.y = 0.0; water.frustumCulled = false; scene.add(water);

  // ---------- Himmel ----------
  const skyM = new THREE.MeshBasicMaterial({ map: assets.sky, side: THREE.BackSide, fog: false, depthWrite: false, transparent: true });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyM); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

  return {
    trees, sky, skyM, water, mats: { trunkM, folM, topM, fernM, waterM },
    update(t, cam) { sky.position.copy(cam.position); wn.offset.set(t * 0.004, t * 0.0027); water.position.y = Math.sin(t * 0.5) * 0.04; },
  };
}
