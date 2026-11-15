import * as THREE from 'three';
import { texBox } from './buildings.js';

function boardTex(text, fg, bg, size = 44, w = 512, h = 96) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 5; x.strokeRect(5, 5, w - 10, h - 10);
  x.fillStyle = fg; x.font = `bold ${size}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Straßendetails (Mittellinie, Leitpfosten, Strommasten, Schilder) und Tiere
export function createDetails(world, scene, fx) {
  const loop = world.roads[0].pts, n = loop.length, white = new THREE.MeshStandardMaterial({ color: 0xc9c9c0, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const tan = i => { const a = loop[(i + 1) % n], b = loop[(i - 1 + n) % n]; const l = Math.hypot(a.x - b.x, a.z - b.z) || 1; return [(a.x - b.x) / l, (a.z - b.z) / l]; };
  // --- Mittellinie (gestrichelt) + Randlinien auf der Hauptstraße ---
  { const P = [], I = []; const quad = (p, q, off, hw) => { const [tx, tz] = [q.x - p.x, q.z - p.z], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l, b = P.length / 3;
      P.push(p.x + nx * (off - hw), p.y + 0.125, p.z + nz * (off - hw), p.x + nx * (off + hw), p.y + 0.125, p.z + nz * (off + hw), q.x + nx * (off + hw), q.y + 0.125, q.z + nz * (off + hw), q.x + nx * (off - hw), q.y + 0.125, q.z + nz * (off - hw)); I.push(b, b + 2, b + 1, b, b + 3, b + 2, b, b + 1, b + 2, b, b + 2, b + 3); };
    const J = []; for (let j = 1; j < world.roads.length; j++) { const r = world.roads[j].pts; J.push(r[0], r[r.length - 1]); } const nearJ = p => J.some(q => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 81);
    for (let i = 0; i < n; i++) { const p = loop[i], q = loop[(i + 1) % n], j = nearJ(p); if (i % 4 < 2 && !j) quad(p, q, 0, 0.07); if (!j) { quad(p, q, 2.85, 0.05); quad(p, q, -2.85, 0.05); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
    const m = new THREE.Mesh(g, white); m.frustumCulled = false; scene.add(m); }
  // --- Leitpfosten ---
  const d = new THREE.Object3D();
  { const list = []; for (let i = 0; i < n; i += 9) for (const s of [-1, 1]) { const [tx, tz] = tan(i), p = loop[i], x = p.x - tz * s * 3.9, z = p.z + tx * s * 3.9; if (world.clearOfPois(x, z, 2)) list.push([x, world.getHeight(x, z), z, Math.atan2(tx, tz)]); }
    const pg = new THREE.BoxGeometry(0.1, 0.95, 0.05); pg.translate(0, 0.47, 0); const im = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xd6d6d0, roughness: 0.6 }), list.length);
    const rg = new THREE.BoxGeometry(0.105, 0.14, 0.055); rg.translate(0, 0.78, 0); const ir = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd0a0, emissiveIntensity: 0.25, roughness: 0.3 }), list.length);
    list.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.rotation.set(0, p[3], 0); d.scale.setScalar(1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); ir.setMatrixAt(i, d.matrix); }); im.frustumCulled = ir.frustumCulled = false; scene.add(im, ir); }
  // --- Strommasten mit Leitungen entlang der Hauptstraße ---
  { const list = []; for (let i = 4; i < n; i += 13) { const [tx, tz] = tan(i), p = loop[i], x = p.x - tz * 6.2, z = p.z + tx * 6.2; if (world.clearOfPois(x, z, 4) && world.getHeight(x, z) > 2) list.push([x, world.getHeight(x, z), z, Math.atan2(tx, tz)]); }
    const pole = new THREE.CylinderGeometry(0.11, 0.15, 8, 6); pole.translate(0, 4, 0); const bar = new THREE.BoxGeometry(0.12, 0.12, 2.0); bar.translate(0, 7.5, 0);
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 0.95 }), ip = new THREE.InstancedMesh(pole, wood, list.length), ib = new THREE.InstancedMesh(bar, wood, list.length), L = [];
    list.forEach((p, i) => { d.position.set(p[0], p[1] - 0.2, p[2]); d.rotation.set(0, p[3] + Math.PI / 2 + Math.PI / 2, (i % 5 - 2) * 0.012); d.updateMatrix(); ip.setMatrixAt(i, d.matrix); ib.setMatrixAt(i, d.matrix); world.addCircle(p[0], p[2], 0.2);
      const q = list[(i + 1) % list.length]; if (Math.hypot(q[0] - p[0], q[2] - p[2]) < 60) for (const s of [-0.9, 0.9]) { const ax = p[0] - Math.cos(p[3]) * s, az = p[2] + Math.sin(p[3]) * s, bx = q[0] - Math.cos(q[3]) * s, bz = q[2] + Math.sin(q[3]) * s; for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6, sag = t => -1.1 * 4 * t * (1 - t); L.push(ax + (bx - ax) * t0, p[1] + 7.3 + (q[1] - p[1]) * t0 + sag(t0), az + (bz - az) * t0, ax + (bx - ax) * t1, p[1] + 7.3 + (q[1] - p[1]) * t1 + sag(t1), az + (bz - az) * t1); } } });
    ip.frustumCulled = ib.frustumCulled = false; scene.add(ip, ib);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(L, 3)); const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x0a0a0a })); ls.frustumCulled = false; scene.add(ls); }
  // --- Schilder ---
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b9094, roughness: 0.5, metalness: 0.7 });
  const signpost = (x, z, ry, text, bg = '#e8d040', fg = '#15151a', w = 1.7, hgt = 2.1) => {
    const g = new THREE.Group(), y = world.getHeight(x, z); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, hgt + 0.3, 6), steel); post.position.y = (hgt + 0.3) / 2; g.add(post);
    const t = boardTex(text, fg, bg, text.length > 12 ? 40 : 52);
    for (const s of [0, Math.PI]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.19), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); b.position.set(0, hgt, s ? -0.03 : 0.03); b.rotation.y = s; g.add(b); }
    world.addCircle(x, z, 0.12);
  };
  const round = (x, z, ry, text) => { const g = new THREE.Group(), y = world.getHeight(x, z); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), steel); post.position.y = 1.2; g.add(post);
    const c = document.createElement('canvas'); c.width = c.height = 128; const cx = c.getContext('2d'); cx.fillStyle = '#b8231a'; cx.beginPath(); cx.arc(64, 64, 62, 0, 7); cx.fill(); cx.fillStyle = '#e8e4d8'; cx.beginPath(); cx.arc(64, 64, 46, 0, 7); cx.fill(); cx.fillStyle = '#15151a'; cx.font = 'bold 56px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 64, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const b = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide })); b.position.set(0, 2.25, 0.04); g.add(b); world.addCircle(x, z, 0.12); };
  // Wegweiser an jedem Abzweig: Tafel zeigt in Richtung des Ziels
  for (const r of world.roads) {
    if (!r.name) continue; const a = r.pts[0], b = r.pts[Math.min(7, r.pts.length - 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, len = Math.round(r.pts.length * 2 / 10) * 10;
    const x = a.x + dx / l * 7 - dz / l * (r.width / 2 + 1.4), z = a.z + dz / l * 7 + dx / l * (r.width / 2 + 1.4);
    signpost(x, z, Math.atan2(dx, dz) + Math.PI / 2, `${r.name}  ${len} m`, r.name === 'GRAUWIK' ? '#e8d040' : '#e4e0d2', '#15151a', 2.1, 2.2);
  }
  { const v = world.pois.village, r = world.roads[2].pts, i = Math.max(0, r.length - 26), p = r[i], q = r[i + 2], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1; signpost(p.x - dz / l * 4.2, p.z + dx / l * 4.2, Math.atan2(dx, dz) + Math.PI, 'GRAUWIK', '#e8d040', '#15151a', 1.9, 1.9); }
  for (const i of [30, 135, 240, 345]) { const [tx, tz] = tan(i), p = loop[i]; round(p.x - tz * 4.4, p.z + tx * 4.4, Math.atan2(tx, tz) + Math.PI, i % 2 ? '50' : '70'); }
  { const st = world.pois.station; signpost(st.x + Math.sin(st.face) * 15 + Math.cos(st.face) * 14, st.z + Math.cos(st.face) * 15 - Math.sin(st.face) * 14, st.face, 'TANKEN · LADEN', '#1c2c3c', '#e8e4d8', 2.0, 2.6); }

  // --- Tiere ---
  const dark = new THREE.MeshBasicMaterial({ color: 0x08080a, side: THREE.DoubleSide }), pale = new THREE.MeshBasicMaterial({ color: 0xc9c9c4, side: THREE.DoubleSide });
  const birdGeo = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, -0.5, 0, 0, 0, 0, -0.1, 0, 0, 0.12, 0, 0, -0.1, 0.5, 0, 0], 3)); return g; };
  const hb = world.pois.harbor, gulls = []; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(birdGeo(), pale); m.userData = { a: i * 0.7, r: 14 + i * 3.1, h: 9 + (i % 4) * 3, s: 0.25 + (i % 3) * 0.06 }; scene.add(m); gulls.push(m); }
  // Reh (einfach, nur aus der Ferne zu sehen – flieht)
  const deerM = new THREE.MeshStandardMaterial({ color: 0x5a4534, roughness: 1 }), deer = [];
  const mkDeer = () => { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.7, 3, 8), deerM); body.rotation.x = Math.PI / 2; body.position.y = 0.85; g.add(body); const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), deerM); neck.position.set(0, 1.2, 0.5); neck.rotation.x = 0.5; g.add(neck); const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.14, 3, 6), deerM); head.rotation.x = Math.PI / 2; head.position.set(0, 1.45, 0.68); g.add(head);
    for (const [x, z] of [[-0.1, 0.35], [0.1, 0.35], [-0.1, -0.35], [0.1, -0.35]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.7, 5), deerM); l.position.set(x, 0.35, z); g.add(l); } scene.add(g); return g; };
  for (let i = 0, tries = 0; i < 3 && tries < 400; tries++) { const p = loop[(tries * 47) % n], l = Math.hypot(p.x, p.z), x = p.x - p.x / l * (16 + tries % 9), z = p.z - p.z / l * (16 + tries % 9); const rn = world.roadNear(x, z); if (world.getHeight(x, z) > 4 && rn && rn.d > 10 && world.clearOfPois(x, z, 25)) { const g = mkDeer(); g.position.set(x, world.getHeight(x, z), z); g.rotation.y = i * 2; deer.push({ g, run: 0, vx: 0, vz: 0 }); i++; tries += 60; } }
  // tote Vögel auf der Straße (ab Tag 4), Krähen (ab Tag 4, sitzen auf dem Bus)
  const dead = []; for (const i of [22, 95, 171, 263, 318, 390]) { const p = loop[i % n], m = new THREE.Mesh(birdGeo(), dark); m.scale.setScalar(0.45); m.position.set(p.x + 1.1, p.y + 0.1, p.z + 0.4); m.rotation.y = i; m.visible = false; scene.add(m); dead.push(m); }
  const crows = []; for (let i = 0; i < 4; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), dark); b.rotation.x = Math.PI / 2 - 0.5; b.position.y = 0.1; g.add(b); const w = new THREE.Mesh(birdGeo(), dark); w.scale.setScalar(0.5); w.position.y = 0.13; w.visible = false; g.add(w); g.userData = { w, fly: 0, vx: 0, vz: 0 }; g.visible = false; scene.add(g); crows.push(g); }
  const v3 = new THREE.Vector3();
  return {
    crowsFlew: false,
    // ctx: { t, dt, day, px, pz, bus, playing }
    update(c) {
      const gv = c.day <= 2 ? 1 : c.day === 3 ? 0.4 : 0;
      gulls.forEach((m, i) => { m.visible = i < gulls.length * gv; if (!m.visible) return; const u = m.userData, a = u.a + c.t * u.s; m.position.set(hb.x + Math.cos(a) * u.r, hb.y + u.h + Math.sin(c.t * 0.7 + i) * 1.2, hb.z + Math.sin(a) * u.r); m.rotation.y = -a; m.scale.set(1.3, 1, 1.3); const f = Math.sin(c.t * 7 + i) * 0.35; const pa = m.geometry.attributes.position; pa.setY(1, f); pa.setY(5, f); pa.needsUpdate = true; });
      for (const dd of deer) { dd.g.visible = c.day <= 2 || dd.run > 0; if (!dd.g.visible) continue; const dx = dd.g.position.x - c.px, dz = dd.g.position.z - c.pz, dist = Math.hypot(dx, dz);
        if (!dd.run && dist < 30 && c.playing) { dd.run = 0.01; dd.vx = dx / dist; dd.vz = dz / dist; dd.g.rotation.y = Math.atan2(dx, dz); }
        if (dd.run) { dd.run += c.dt; dd.g.position.x += dd.vx * 9 * c.dt; dd.g.position.z += dd.vz * 9 * c.dt; dd.g.position.y = world.getHeight(dd.g.position.x, dd.g.position.z) + Math.abs(Math.sin(dd.run * 9)) * 0.35; if (dd.run > 7) { dd.g.visible = false; dd.run = 0; dd.g.position.y = -50; } } }
      for (const m of dead) m.visible = c.day >= 4;
      crows.forEach((g, i) => { const u = g.userData;
        if (c.day < 4) { g.visible = false; return; }
        if (!u.fly) { g.visible = !this.crowsFlew; if (!g.visible) return; v3.set(-0.45 + i * 0.3, 2.24, -0.6 - (i % 2) * 0.7); c.bus.group.localToWorld(v3); g.position.copy(v3); g.rotation.y = i * 1.7;
          if (c.playing && Math.hypot(c.px - c.bus.x, c.pz - c.bus.z) < 7.5 && Math.hypot(c.px - c.bus.x, c.pz - c.bus.z) > 0.5) { u.fly = 0.01; u.vx = Math.sin(i * 2.1) * 3; u.vz = Math.cos(i * 2.1) * 3; u.w.visible = true; this.cawed = true; if (i === crows.length - 1) this.crowsFlew = true; } }
        else { u.fly += c.dt; g.position.x += u.vx * c.dt; g.position.z += u.vz * c.dt; g.position.y += (2.5 + u.fly) * c.dt; const pa = u.w.geometry.attributes.position, f = Math.sin(u.fly * 18) * 0.4; pa.setY(1, f); pa.setY(5, f); pa.needsUpdate = true; if (u.fly > 6) { g.visible = false; u.fly = 0; u.w.visible = false; } } });
    },
    resetDay() { this.crowsFlew = false; },
  };
}
