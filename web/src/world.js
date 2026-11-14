import * as THREE from 'three';

// ---------- Rauschen ----------
const SEED = 1337;
function hash(ix, iz) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + SEED * 1013;
  n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}
const sm = t => t * t * (3 - 2 * t);
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = sm(x - ix), fz = sm(z - iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export function fbm(x, z, o = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < o; i++) { s += a * vnoise(x, z); n += a; x = x * 2.03 + 17.1; z = z * 2.03 - 9.7; a *= 0.5; }
  return s / n;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- Inselform ----------
export const SIZE = 720, SEG = 288, CELL = SIZE / SEG, N = SEG + 1;
function coastR(th) { return 205 + 95 * fbm(Math.cos(th) * 1.5 + 10, Math.sin(th) * 1.5 + 10, 3); }
const polar = (deg, d) => { const th = deg * Math.PI / 180, r = coastR(th) * d; return new THREE.Vector2(Math.cos(th) * r, Math.sin(th) * r); };
const LH = polar(118, 0.84); // Leuchtturm-Landzunge
function rawHeight(x, z) {
  const r = Math.hypot(x, z), th = Math.atan2(z, x), d = r / coastR(th);
  if (d >= 1) return Math.max(-14, -1.0 - (d - 1) * 34);
  const t = 1 - d;
  const hills = fbm(x * 0.0075, z * 0.0075, 4);
  let h = -1.0 + 2.9 * sstep(0, 0.09, t) + sstep(0.08, 0.5, t) * (3 + 46 * Math.pow(hills, 1.9));
  h += sstep(0.08, 0.3, t) * (fbm(x * 0.045, z * 0.045, 3) - 0.5) * 2.2;
  const dl = Math.hypot(x - LH.x, z - LH.y);
  h += 11 * Math.exp(-dl * dl / (2 * 30 * 30)) * sstep(0, 0.04, t);
  return h;
}

export function createWorld(assets, scene) {
  const { T } = assets;
  const H = new Float32Array(N * N);
  const gx = i => -SIZE / 2 + i * CELL;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = rawHeight(gx(i), gx(j));
  const sampleH = (x, z) => {
    const fx = Math.min(N - 1.001, Math.max(0, (x + SIZE / 2) / CELL)), fz = Math.min(N - 1.001, Math.max(0, (z + SIZE / 2) / CELL));
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * N + i;
    return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N] * (1 - u) + H[k + N + 1] * u) * v;
  };

  // ---------- Straßen ----------
  const loopPts = [];
  const LD = [0.60, 0.56, 0.52, 0.55, 0.62, 0.60, 0.55, 0.57, 0.62, 0.58, 0.60, 0.63];
  for (let k = 0; k < 12; k++) { const p = polar(k * 30, LD[k]); loopPts.push(new THREE.Vector3(p.x, 0, p.y)); }
  const loop = new THREE.CatmullRomCurve3(loopPts, true, 'catmullrom', 0.5);
  const mkRoad = (curve, n, width, closed, dirt) => {
    const pts = curve.getSpacedPoints(n); if (closed) pts.pop();
    const h = pts.map(p => Math.max(1.7, sampleH(p.x, p.z)));
    for (let pass = 0; pass < 3; pass++) {
      const c = h.slice(), W = 7;
      for (let i = 0; i < h.length; i++) {
        let s = 0, m = 0;
        for (let d = -W; d <= W; d++) { let q = i + d; if (closed) q = (q + h.length) % h.length; else if (q < 0 || q >= h.length) continue; s += c[q]; m++; }
        h[i] = s / m;
      }
    }
    pts.forEach((p, i) => p.y = h[i]);
    return { pts, width, closed, dirt };
  };
  const roads = [mkRoad(loop, 420, 6.4, true, false)];
  const nearestOnLoop = (x, z) => { let b = 0, bd = 1e9; roads[0].pts.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; b = i; } }); return roads[0].pts[b]; };
  const onLoop = deg => { const p0 = polar(deg, 0.58), a = nearestOnLoop(p0.x, p0.y); return new THREE.Vector2(a.x, a.z); };
  // offene Straße durch Punkte; Enden werden in der Höhe an vorhandene Straßen angeglichen
  const road = (pts2, width, dirt) => {
    const c = new THREE.CatmullRomCurve3(pts2.map(p => new THREE.Vector3(p.x, 0, p.y)), false, 'catmullrom', 0.5);
    const r = mkRoad(c, Math.round(c.getLength() / 2), width, false, dirt);
    for (const end of [0, r.pts.length - 1]) {
      const e = r.pts[end]; let best = null, bd = 144;
      for (const o of roads) for (const q of o.pts) { const d = (q.x - e.x) ** 2 + (q.z - e.z) ** 2; if (d < bd) { bd = d; best = q; } }
      if (best) { const dir = end === 0 ? 1 : -1; for (let i = 0; i < 8; i++) { const p = r.pts[end + dir * i]; if (p) p.y = best.y + (p.y - best.y) * (i / 8); } }
    }
    roads.push(r); return r;
  };
  const endInfo = r => { const e = r.pts[r.pts.length - 1], q = r.pts[r.pts.length - 5]; return { x: e.x, z: e.z, y: e.y, face: Math.atan2(q.x - e.x, q.z - e.z) }; };

  // ---------- Orte ----------
  const out = (deg, off) => { // Punkt neben der Ringstraße, off>0 = nach außen
    const p0 = polar(deg, 0.58), a = nearestOnLoop(p0.x, p0.y), l = Math.hypot(a.x, a.z);
    return { x: a.x + a.x / l * off, z: a.z + a.z / l * off, y: a.y, face: Math.atan2(-a.x * Math.sign(off), -a.z * Math.sign(off)) };
  };
  const V2 = (p) => new THREE.Vector2(p.x, p.y);
  const vil = polar(238, 0.31), cab = polar(62, 0.27), harb = polar(252, 0.9);
  const rHarbor = road([onLoop(252), polar(252, 0.76), harb], 5.6, false);
  const rVillage = road([onLoop(252), polar(246, 0.45), vil], 5.6, false);
  road([vil, polar(215, 0.13), polar(40, 0.1), polar(55, 0.36), onLoop(55)], 4.6, false);     // quer über die Insel
  const rCabin = road([polar(55, 0.36), cab], 3.4, true);
  const rLight = road([onLoop(118), polar(119, 0.72), new THREE.Vector2(LH.x, LH.y)], 3.8, true);
  road([vil, polar(196, 0.4), onLoop(168)], 3.8, true);                                         // Westweg
  const pois = {
    station: { ...out(300, 21), r: 20 },
    camp: { ...out(205, -17), r: 12 },
    cabin: { ...endInfo(rCabin), r: 9 },
    light: { ...endInfo(rLight), r: 10 },
    harbor: { ...endInfo(rHarbor), r: 25 },
    village: { ...endInfo(rVillage), r: 37 },
  };

  // ---------- Einebnen ----------
  const B = 24, bk = new Map(), samples = [];
  for (const r of roads) r.pts.forEach(p => samples.push({ x: p.x, z: p.z, y: p.y, w: r.width / 2, dirt: r.dirt }));
  samples.forEach(s => { const k = Math.floor(s.x / B) + ',' + Math.floor(s.z / B); (bk.get(k) || bk.set(k, []).get(k)).push(s); });
  const roadNear = (x, z) => {
    let best = null, bd = 1e9; const cx = Math.floor(x / B), cz = Math.floor(z / B);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = bk.get((cx + a) + ',' + (cz + b)); if (!l) continue;
      for (const s of l) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
    }
    return best ? { s: best, d: Math.sqrt(bd) } : null;
  };
  const roadMask = new Float32Array(N * N); // 1 = Straße/Platz (keine Bäume), für Splat
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = gx(i), z = gx(j), k = j * N + i;
    for (const key in pois) {
      const p = pois[key], d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r + 9) { const t = 1 - sstep(p.r, p.r + 9, d); H[k] += (p.y - H[k]) * t; roadMask[k] = Math.max(roadMask[k], t * (key === 'station' || key === 'harbor' ? 1 : 0.7)); }
    }
    const rn = roadNear(x, z);
    if (rn && rn.d < rn.s.w + 9) {
      const t = 1 - sstep(rn.s.w + 1.2, rn.s.w + 9, rn.d);
      H[k] += (rn.s.y - H[k]) * t;
      roadMask[k] = Math.max(roadMask[k], 1 - sstep(rn.s.w, rn.s.w + 2.5, rn.d));
    }
  }

  // ---------- Geländemesh ----------
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let k = 0; k < N * N; k++) pos.setY(k, H[k]);
  geo.computeVertexNormals();
  const nor = geo.attributes.normal, splat = new Float32Array(N * N * 4);
  const forestMask = (x, z) => sstep(0.3, 0.44, fbm(x * 0.011 + 50, z * 0.011 + 50, 3));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = gx(i), z = gx(j), h = H[k], ny = nor.getY(k);
    const sand = 1 - sstep(1.5, 2.9, h + (fbm(x * 0.08, z * 0.08, 2) - 0.5) * 1.2);
    const rock = sstep(0.80, 0.66, ny);
    let forest = Math.max(forestMask(x, z) * 0.85, roadMask[k] * 0.9);
    let grass = 1 - forest;
    const land = 1 - Math.max(sand, rock);
    splat[k * 4] = grass * land; splat[k * 4 + 1] = forest * land; splat[k * 4 + 2] = sand * (1 - rock); splat[k * 4 + 3] = rock + 0.001;
  }
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  const rep = SIZE / 5;
  for (const t of [T.leafy_grass, T.forest_ground_04, T.coast_sand_01, T.mossy_rock]) { t.d.repeat.set(rep, rep); t.n.repeat.set(rep, rep); }
  const wet = { value: 0 };
  const tmat = new THREE.MeshStandardMaterial({ map: T.leafy_grass.d, normalMap: T.leafy_grass.n, roughness: 0.96, metalness: 0 });
  tmat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tF: { value: T.forest_ground_04.d }, tS: { value: T.coast_sand_01.d }, tR: { value: T.mossy_rock.d }, nF: { value: T.forest_ground_04.n }, nS: { value: T.coast_sand_01.n }, nR: { value: T.mossy_rock.n }, uWet: wet });
    sh.vertexShader = 'attribute vec4 splat;\nvarying vec4 vSplat;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat;');
    sh.fragmentShader = 'uniform sampler2D tF,tS,tR,nF,nS,nR;\nuniform float uWet;\nvarying vec4 vSplat;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec4 sw = vSplat / (vSplat.x + vSplat.y + vSplat.z + vSplat.w);
        vec3 tcol = texture2D(map, vMapUv).rgb * vec3(0.6, 0.84, 0.5) * sw.x + texture2D(tF, vMapUv).rgb * sw.y + texture2D(tS, vMapUv).rgb * sw.z + texture2D(tR, vMapUv * 0.35).rgb * sw.w;
        float macro = texture2D(tF, vMapUv * 0.043).g + texture2D(tF, vMapUv * 0.0117).g;
        tcol *= 0.55 + 1.1 * macro;
        tcol *= mix(1.0, 0.62, uWet);
        diffuseColor.rgb *= tcol;`)
      .replace('#include <normal_fragment_maps>', `
        vec3 mapN = (texture2D(normalMap, vNormalMapUv).xyz * sw.x + texture2D(nF, vNormalMapUv).xyz * sw.y + texture2D(nS, vNormalMapUv).xyz * sw.z + texture2D(nR, vNormalMapUv * 0.35).xyz * sw.w) * 2.0 - 1.0;
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * mix(1.0, 0.5, uWet);');
  };
  const terrain = new THREE.Mesh(geo, tmat); terrain.frustumCulled = false; scene.add(terrain);

  // ---------- Straßenbänder ----------
  const roadMat = (t, tile) => { const m = new THREE.MeshStandardMaterial({ map: t.d, normalMap: t.n, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); m.userData.tile = tile; return m; };
  const asphalt = roadMat(T.asphalt_02, 4), dirt = roadMat(T.brown_mud_leaves_01, 3);
  dirt.color.set(0x5d5a56);
  const wetMats = [asphalt, dirt];
  for (const r of roads) {
    const n = r.pts.length, cnt = r.closed ? n + 1 : n, P = [], U = [], I = [];
    let len = 0;
    for (let i = 0; i < cnt; i++) {
      const p = r.pts[i % n], q = r.pts[(i + 1) % n] || p, o = r.pts[(i - 1 + n) % n];
      const a = (r.closed || i < n - 1) ? q : p, b = (r.closed || i > 0) ? o : p;
      let tx = a.x - b.x, tz = a.z - b.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      if (i > 0) len += Math.hypot(p.x - r.pts[(i - 1) % n].x, p.z - r.pts[(i - 1) % n].z);
      const hw = r.width / 2;
      P.push(p.x - tz * hw, p.y + 0.07, p.z + tx * hw, p.x + tz * hw, p.y + 0.07, p.z - tx * hw);
      const tile = r.dirt ? 3 : 4; U.push(0, len / tile, r.width / tile, len / tile);
      if (i < cnt - 1) I.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    // Flächen müssen nach oben zeigen
    if (g.attributes.normal.getY(0) < 0) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = t; } g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, r.dirt ? dirt : asphalt); m.frustumCulled = false; scene.add(m);
  }

  // ---------- Kollision ----------
  const circles = new Map(), boxes = [], CB = 8;
  const addCircle = (x, z, r) => { const k = Math.floor(x / CB) + ',' + Math.floor(z / CB); (circles.get(k) || circles.set(k, []).get(k)).push({ x, z, r }); };
  const addBox = (x, z, hw, hd, rot) => boxes.push({ x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot) });
  // schiebt Kreis (p.x,p.z,rad) aus Hindernissen; gibt true zurück wenn berührt
  const collide = (p, rad) => {
    let hit = false; const cx = Math.floor(p.x / CB), cz = Math.floor(p.z / CB);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = circles.get((cx + a) + ',' + (cz + b)); if (!l) continue;
      for (const c of l) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad; if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; hit = true; } }
    }
    for (const o of boxes) {
      const dx = p.x - o.x, dz = p.z - o.z; if (Math.abs(dx) + Math.abs(dz) > (o.hw + o.hd + rad) * 1.5) continue;
      const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      const qx = Math.max(-o.hw, Math.min(o.hw, lx)), qz = Math.max(-o.hd, Math.min(o.hd, lz));
      let ex = lx - qx, ez = lz - qz; const d = Math.hypot(ex, ez);
      if (d < rad) {
        let nx, nz, pen;
        if (d > 1e-4) { nx = ex / d; nz = ez / d; pen = rad - d; }
        else { const px = o.hw - Math.abs(lx), pz = o.hd - Math.abs(lz); if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; pen = px + rad; } else { nx = 0; nz = Math.sign(lz) || 1; pen = pz + rad; } }
        const wx = nx * o.c + nz * o.s, wz = -nx * o.s + nz * o.c;
        p.x += wx * pen; p.z += wz * pen; hit = true;
      }
    }
    return hit;
  };

  const platforms = [];
  const ground = (x, z) => {
    let h = sampleH(x, z);
    for (const o of platforms) { const dx = x - o.x, dz = z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hw && Math.abs(lz) < o.hd) h = Math.max(h, o.y); }
    return h;
  };
  // ---------- Wegenetz (für den Verfolger) ----------
  const nodes = [];
  for (const r of roads) {
    const base = nodes.length;
    r.pts.forEach((p, i) => { nodes.push({ x: p.x, z: p.z, y: p.y, dirt: r.dirt, nb: [] }); if (i > 0) { nodes[base + i].nb.push(base + i - 1); nodes[base + i - 1].nb.push(base + i); } });
    if (r.closed) { nodes[base].nb.push(nodes.length - 1); nodes[nodes.length - 1].nb.push(base); }
    r.base = base;
  }
  for (const r of roads) if (!r.closed) for (const e of [r.base, r.base + r.pts.length - 1]) {
    let best = -1, bd = 196; const n = nodes[e];
    nodes.forEach((m, i) => { if (i >= r.base && i < r.base + r.pts.length) return; const d = (m.x - n.x) ** 2 + (m.z - n.z) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { n.nb.push(best); nodes[best].nb.push(e); }
  }
  const nearestNode = (x, z) => { let b = 0, bd = 1e9; for (let i = 0; i < nodes.length; i++) { const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2; if (d < bd) { bd = d; b = i; } } return b; };
  const pathTo = (from, to) => { // Breitensuche
    const prev = new Int32Array(nodes.length).fill(-1), q = [to]; prev[to] = to;
    for (let h = 0; h < q.length; h++) { const c = q[h]; if (c === from) break; for (const n of nodes[c].nb) if (prev[n] < 0) { prev[n] = c; q.push(n); } }
    const path = []; if (prev[from] < 0) return path; let c = from; while (c !== to) { c = prev[c]; path.push(c); if (path.length > 2000) break; } return path;
  };
  // ---------- Innenräume ----------
  const zones = [];
  const indoor = (x, z) => { for (const o of zones) { const dx = x - o.x, dz = z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hw && Math.abs(lz) < o.hd) return o; } return null; };
  // ---------- Höhen-/Grasdichte-Textur (für Gras im Vertex-Shader) ----------
  const hd = new Uint16Array(N * N * 4), toHalf = THREE.DataUtils.toHalfFloat;
  for (let k = 0; k < N * N; k++) { const land = 1 - Math.max(splat[k * 4 + 2], Math.min(1, splat[k * 4 + 3])); hd[k * 4] = toHalf(H[k]); hd[k * 4 + 1] = toHalf(Math.max(0, (splat[k * 4] * 0.95 + splat[k * 4 + 1] * 0.22) * land * (1 - Math.min(1, roadMask[k] * 1.6)) * (H[k] > 2.4 ? 1 : 0))); hd[k * 4 + 3] = toHalf(1); }
  const heightTex = new THREE.DataTexture(hd, N, N, THREE.RGBAFormat, THREE.HalfFloatType); heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
  const world = { nodes, nearestNode, pathTo, zones, indoor, heightTex, H, getHeight: sampleH, ground, platforms, boxes, roads, pois, roadNear, forestMask, wet, wetMats, collide, addCircle, addBox, terrain, LH };
  world.onRoad = (x, z) => { const r = roadNear(x, z); return r && r.d < r.s.w + 0.5 ? (r.s.dirt ? 0.75 : 1) : 0; };
  world.clearOfPois = (x, z, extra = 0) => { for (const k in pois) if (Math.hypot(x - pois[k].x, z - pois[k].z) < pois[k].r + extra) return false; return true; };
  return world;
}
