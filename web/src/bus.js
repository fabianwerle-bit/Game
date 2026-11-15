import * as THREE from 'three';

export function createBus(scene, world, assets) {
  const g = new THREE.Group(); scene.add(g);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xa9a598, roughness: 0.42, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.35 });
  const black = new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.75 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.95 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x070a0b, roughness: 0.04, metalness: 0.2, clearcoat: 1 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x4d4b47, roughness: 0.95 });
  const liner = new THREE.MeshStandardMaterial({ color: 0x8a867c, roughness: 1 });
  const dash = new THREE.MeshStandardMaterial({ color: 0x26272a, roughness: 0.85 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0x3d4650, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ map: assets.T.weathered_planks.d, roughness: 0.8, color: 0xc9b392 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xaeb2b5, roughness: 0.3, metalness: 0.9 });
  const box = (w, h, d, m, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };

  // --- Karosserie (Seitenprofil extrudiert) ---
  const sh = new THREE.Shape();
  sh.moveTo(2.34, 0.42); sh.lineTo(1.87, 0.42); sh.absarc(1.46, 0.42, 0.41, 0, Math.PI, false); sh.lineTo(-1.05, 0.42); sh.absarc(-1.46, 0.42, 0.41, 0, Math.PI, false);
  sh.lineTo(-2.31, 0.42); sh.lineTo(-2.35, 0.85); sh.lineTo(-2.33, 1.5); sh.lineTo(-2.2, 1.9); sh.lineTo(0.92, 1.93); sh.lineTo(1.7, 1.12); sh.lineTo(2.22, 0.99); sh.lineTo(2.35, 0.78); sh.lineTo(2.34, 0.42);
  const bodyG = new THREE.ExtrudeGeometry(sh, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 });
  bodyG.rotateY(-Math.PI / 2); bodyG.translate(0.85, 0, 0); bodyG.computeVertexNormals();
  const body = new THREE.Mesh(bodyG, paint); g.add(body);
  for (const s of [-1, 1]) { for (const z of [1.21, 0.22, -1.11]) box(0.012, 0.66, 0.022, black, s * 0.905, 0.79, z); box(0.012, 0.03, 1.2, black, s * 0.905, 0.95, -0.45); box(0.02, 0.05, 0.14, black, s * 0.91, 1.0, 0.36); }
  box(1.5, 0.5, 4.4, black, 0, 0.6, 0);                                   // Unterboden / Radkästen
  box(1.86, 0.2, 0.16, black, 0, 0.5, 2.36); box(1.86, 0.2, 0.16, black, 0, 0.5, -2.36); // Stoßstangen
  box(1.0, 0.16, 0.04, black, 0, 0.84, 2.345);                             // Grill
  const lampM = new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff0c0, emissiveIntensity: 0, roughness: 0.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x5a0a08, emissive: 0xff1a10, emissiveIntensity: 0, roughness: 0.3 });
  for (const s of [-1, 1]) {
    box(0.34, 0.17, 0.05, lampM, s * 0.66, 0.84, 2.35); box(0.16, 0.38, 0.05, tailM, s * 0.78, 1.05, -2.37);
    box(0.05, 0.13, 0.17, black, s * 1.0, 1.2, 1.42);                      // Spiegel
    // Fenster außen
    const mk = (pts) => { const ge = new THREE.BufferGeometry(); const v = []; const P = pts.map(p => [s * 0.918, p[1], p[0]]); const tri = s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]; tri.forEach(i => v.push(...P[i])); ge.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); ge.computeVertexNormals(); g.add(new THREE.Mesh(ge, glass)); };
    mk([[1.5, 1.14], [0.28, 1.14], [0.28, 1.78], [0.9, 1.78]]); mk([[0.16, 1.14], [-1.05, 1.14], [-1.05, 1.78], [0.16, 1.78]]); mk([[-1.17, 1.14], [-2.12, 1.14], [-2.06, 1.78], [-1.17, 1.78]]);
  }
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.98), glass); ws.position.set(0, 1.535, 1.335); ws.rotation.x = -Math.atan2(0.78, 0.81); g.add(ws);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), glass); rw.position.set(0, 1.5, -2.385); rw.rotation.y = Math.PI; rw.rotation.x = 0.12; g.add(rw);
  // --- Räder ---
  const wheels = [], wg = new THREE.CylinderGeometry(0.33, 0.33, 0.23, 18); wg.rotateZ(Math.PI / 2);
  const hg = new THREE.CylinderGeometry(0.19, 0.19, 0.24, 12); hg.rotateZ(Math.PI / 2);
  for (const [x, z] of [[0.8, 1.46], [-0.8, 1.46], [0.8, -1.46], [-0.8, -1.46]]) {
    const piv = new THREE.Group(); piv.position.set(x, 0.33, z); g.add(piv);
    const w = new THREE.Group(); piv.add(w); w.add(new THREE.Mesh(wg, rubber)); w.add(new THREE.Mesh(hg, chrome)); box(0.25, 0.05, 0.3, black, 0, 0, 0, w);
    wheels.push({ piv, w, front: z > 0 });
  }
  // --- Innenraum ---
  for (const s of [-1, 1]) {
    box(0.04, 0.72, 3.9, inner, s * 0.83, 0.78, -0.25); box(0.04, 0.16, 3.2, inner, s * 0.83, 1.85, -0.65);
    for (const z of [0.22, -1.11, -2.2]) box(0.05, 0.7, 0.13, inner, s * 0.83, 1.45, z);
    const ap = box(0.07, 1.14, 0.09, inner, s * 0.8, 1.52, 1.31); ap.rotation.x = -Math.atan2(0.78, 0.81);
  }
  box(1.66, 0.72, 0.04, inner, 0, 0.78, -2.27); box(1.66, 0.2, 0.04, inner, 0, 1.84, -2.2);
  const rl = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 3.2), liner); rl.rotation.x = Math.PI / 2; rl.position.set(0, 1.875, -0.65); g.add(rl);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 4.2), black); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.5, -0.2); g.add(fl);
  box(1.66, 0.2, 0.78, dash, 0, 1.04, 1.34); box(1.66, 0.5, 0.3, dash, 0, 0.72, 1.12);
  box(0.46, 0.12, 0.22, dash, 0.42, 1.18, 1.12);
  const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.035), new THREE.MeshBasicMaterial({ color: 0xb85a14 })); gauge.position.set(0.42, 1.18, 1.005); gauge.rotation.y = Math.PI; g.add(gauge);
  box(0.2, 0.06, 0.03, dash, 0, 1.76, 0.98); box(0.18, 0.045, 0.005, chrome, 0, 1.76, 0.962); for (const x of [-0.5, 0, 0.5]) box(0.22, 0.012, 0.1, black, x - 0.1, 1.142, 1.5);
  const sw = new THREE.Group(); sw.position.set(0.42, 1.2, 0.86); sw.rotation.x = 1.02; g.add(sw);
  sw.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.017, 8, 24), black)); box(0.36, 0.035, 0.02, black, 0, 0, 0, sw); box(0.035, 0.19, 0.02, black, 0, -0.095, 0, sw);
  const col = box(0.05, 0.05, 0.4, black, 0.42, 1.1, 1.0); col.rotation.x = -0.55;
  for (const x of [0.42, -0.42]) { box(0.5, 0.14, 0.5, fabric, x, 0.86, 0.4); const b = box(0.48, 0.66, 0.12, fabric, x, 1.24, 0.13); b.rotation.x = -0.12; box(0.24, 0.2, 0.1, fabric, x, 1.66, 0.08); }
  const M = assets.M, put = (name, x, y, z, ry = 0, s = 1) => { const o = M[name].clone(); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); return o; };
  box(1.18, 0.34, 1.6, wood, -0.22, 0.67, -1.42); box(1.15, 0.13, 1.57, new THREE.MeshStandardMaterial({ color: 0x5d2a23, roughness: 1 }), -0.22, 0.9, -1.42); // Bett
  put('throw_pillows_01', -0.25, 1.1, -2.0, 0.2, 0.55);
  box(0.36, 0.78, 1.15, wood, 0.63, 0.89, -1.0); box(0.38, 0.03, 1.17, chrome, 0.63, 1.29, -1.0);   // Küchenzeile
  put('vintage_electric_kettle', 0.63, 1.35, -1.3, 0.6, 0.5); put('russian_food_cans_01', 0.6, 1.305, -0.95, 0.4, 1.6);
  box(0.24, 0.02, 0.24, black, 0.63, 1.31, -1.3); box(0.2, 0.04, 0.2, new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.4, metalness: 0.8 }), 0.63, 1.33, -1.3); // Kocher
  box(0.34, 0.3, 1.5, wood, 0.66, 1.68, -1.1); box(1.5, 0.26, 0.3, wood, -0.05, 1.7, -2.08);          // Hängeschränke
  for (const z of [-1.55, -0.65]) box(0.012, 0.22, 0.4, chrome, 0.487, 1.68, z);
  const todo = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.24), new THREE.MeshStandardMaterial({ color: 0xd9d2bd, roughness: 0.9 })); todo.position.set(0.484, 1.62, -1.1); todo.rotation.y = -Math.PI / 2; todo.rotation.z = 0.06; g.add(todo);
  put('vintage_oil_lamp', 0.62, 1.305, -0.6, 0, 0.5);
  for (const [x, z, w] of [[-0.845, -0.45, 1.1], [0.845, -1.6, 0.8]]) { const c = box(0.01, 0.62, w * 0.35, new THREE.MeshStandardMaterial({ color: 0x6d5f3a, roughness: 1, side: THREE.DoubleSide }), x * 0.975, 1.46, z + w * 0.4); c.userData.curtain = 1; }
  // Zettel außen an der Windschutzscheibe
  const wsNote = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), new THREE.MeshStandardMaterial({ color: 0xe0d9c4, roughness: 0.9, side: THREE.DoubleSide })); wsNote.position.set(0.3, 1.5, 1.375); wsNote.rotation.x = -Math.atan2(0.78, 0.81); wsNote.rotation.z = 0.12; wsNote.visible = false; g.add(wsNote);
  // weicher Bodenschatten
  { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 6, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); sm.rotation.x = -Math.PI / 2; sm.position.y = 0.06; g.add(sm); }
  // Details außen
  box(0.5, 0.11, 0.02, new THREE.MeshStandardMaterial({ color: 0xd8d8cc, roughness: 0.6 }), 0, 0.62, 2.445); box(0.5, 0.11, 0.02, new THREE.MeshStandardMaterial({ color: 0xd8d8cc, roughness: 0.6 }), 0, 0.72, -2.385);
  const amber = new THREE.MeshStandardMaterial({ color: 0xc86a10, roughness: 0.3 }); for (const s of [-1, 1]) { box(0.12, 0.1, 0.05, amber, s * 0.86, 0.84, 2.34); box(1.84, 0.16, 0.02, black, 0, 0.5, 0).rotation.y = Math.PI / 2; }
  for (const s of [-1, 1]) { box(0.03, 0.03, 2.9, chrome, s * 0.62, 2.0, -0.5); } for (const z of [0.7, -0.5, -1.7]) box(1.3, 0.025, 0.03, chrome, 0, 2.0, z);
  box(1.1, 0.22, 1.5, new THREE.MeshStandardMaterial({ color: 0x33383a, roughness: 0.9 }), 0, 2.12, -1.0);
  // --- Scheibenwischer ---
  const wip = [];
  for (const x of [0.38, -0.34]) { const p = new THREE.Group(); p.position.set(x, 1.145, 1.725); p.rotation.x = -Math.atan2(0.78, 0.81); g.add(p); const a = new THREE.Group(); p.add(a); box(0.02, 0.56, 0.02, black, 0, 0.28, 0.015, a); a.rotation.z = 1.35; wip.push(a); }
  // --- Licht ---
  const head = new THREE.SpotLight(0xfff0cf, 0, 85, 0.5, 0.55, 1.3); head.position.set(0, 0.95, 2.3); g.add(head); head.target.position.set(0, 0.2, 14); g.add(head.target);

  const st = { x: 0, z: 0, y: 0, heading: 0, v: 0, steer: 0, pitch: 0, roll: 0, lights: false, wipe: 0, fuel: 60, dist: 0 };
  const obox = { x: 0, z: 0, hw: 0.98, hd: 2.42, c: 1, s: 0 }; world.boxes.push(obox);
  const probe = { x: 0, z: 0 };
  const settle = (dt) => {
    const sn = Math.sin(st.heading), cs = Math.cos(st.heading);
    const hF = world.ground(st.x + sn * 1.46, st.z + cs * 1.46), hR = world.ground(st.x - sn * 1.46, st.z - cs * 1.46);
    const hL = world.ground(st.x + cs * 0.8, st.z - sn * 0.8), hRi = world.ground(st.x - cs * 0.8, st.z + sn * 0.8);
    const k = dt >= 1 ? 1 : Math.min(1, dt * 7);
    st.y += ((hF + hR) / 2 - st.y) * k; st.pitch += (Math.atan2(hF - hR, 2.92) - st.pitch) * k; st.roll += (Math.atan2(hL - hRi, 1.6) - st.roll) * k;
    g.position.set(st.x, st.y, st.z); g.rotation.set(-st.pitch, st.heading, st.roll, 'YXZ');
    obox.x = st.x; obox.z = st.z; obox.c = Math.cos(st.heading); obox.s = Math.sin(st.heading);
  };
  st.place = (x, z, heading) => { st.x = x; st.z = z; st.heading = heading; st.v = 0; settle(1); };
  st.group = g; st.box = obox; st.wsNote = wsNote;
  // Blickziele im Wohnbereich (lokale Koordinaten)
  st.spots = [{ id: 'bed', p: new THREE.Vector3(-0.22, 0.95, -1.5), label: 'Schlafen' }, { id: 'cook', p: new THREE.Vector3(0.63, 1.3, -1.25), label: 'Kochen' }, { id: 'todo', p: new THREE.Vector3(0.49, 1.62, -1.1), label: 'Zettel lesen' }, { id: 'seat', p: new THREE.Vector3(0.42, 1.25, 0.6), label: 'Ans Steuer' }, { id: 'exit', p: new THREE.Vector3(-0.85, 1.2, -0.3), label: 'Aussteigen' }, { id: 'lock', p: new THREE.Vector3(-0.85, 1.55, -0.95), label: 'Verriegeln' }, { id: 'tape', p: new THREE.Vector3(0.62, 1.34, -0.9), label: 'Kassette hören' }];
  // Gestalt im Rückspiegel + Zusatzscheinwerfer
  const mf = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.04), new THREE.MeshBasicMaterial({ color: 0x000000 })); mf.position.set(0.03, 1.757, 0.9585); mf.rotation.y = Math.PI; mf.visible = false; g.add(mf); st.mirrorFig = mf;
  const lb = new THREE.Group(); lb.visible = false; g.add(lb); box(1.0, 0.05, 0.06, black, 0, 2.03, 1.0, lb); for (const x of [-0.36, -0.12, 0.12, 0.36]) box(0.16, 0.12, 0.05, lampM, x, 2.1, 1.02, lb); st.lightbar = lb;
  put('portable_cassette_player', 0.62, 1.37, -0.9, 0.5, 1.5).rotation.x = -Math.PI / 2;
  // gas: 0..1, brake: 0..1, steerIn: -1..1 (links +)
  st.update = (dt, gas, brake, steerIn, driving, rain) => {
    if (driving) {
      const road = world.onRoad(st.x, st.z), vmax = st.flat ? 4.2 : road === 1 ? 15.5 : road > 0 ? 10.5 : 6.2;
      if (st.fuel <= 0) gas = 0;
      if (gas > 0 && st.v < vmax) st.v += gas * (st.v < 0 ? 7 : 3.4) * dt;
      if (brake > 0) { if (st.v > 0.4) st.v -= brake * 10 * dt; else if (st.v > -4) st.v -= brake * 2.6 * dt; }
      st.v -= st.v * (road ? 0.12 : 0.5) * dt + Math.sign(st.v) * 0.35 * dt;
      if (st.v > vmax) st.v -= (st.v - vmax) * 2 * dt;
      if (!gas && !brake && Math.abs(st.v) < 0.3) st.v = 0;
      const maxS = 0.6 - 0.36 * Math.min(1, Math.abs(st.v) / 14);
      st.steer += (steerIn * maxS - st.steer) * Math.min(1, dt * 5);
      st.heading += st.v / 2.92 * Math.tan(st.steer + (st.flat ? 0.05 * Math.sin(performance.now() * 0.02) + 0.03 : 0)) * dt;
      const sn = Math.sin(st.heading), cs = Math.cos(st.heading), ox = st.x, oz = st.z;
      st.x += sn * st.v * dt; st.z += cs * st.v * dt;
      let hit = false; obox.x = 1e6; // sich selbst ignorieren
      for (const o of [1.55, 0, -1.55]) { probe.x = st.x + sn * o; probe.z = st.z + cs * o; const px = probe.x, pz = probe.z; if (world.collide(probe, 0.95)) { st.x += probe.x - px; st.z += probe.z - pz; hit = true; } }
      const fh = world.ground(st.x + sn * 2 * Math.sign(st.v || 1), st.z + cs * 2 * Math.sign(st.v || 1));
      if (fh < 0.55) { st.x = ox; st.z = oz; hit = true; }
      if (hit) { st.bump = Math.abs(st.v); st.v *= -0.15; }
      const moved = Math.hypot(st.x - ox, st.z - oz); st.dist += moved; st.fuel = Math.max(0, st.fuel - moved * 0.0085 - gas * dt * 0.01);
    } else st.v = 0;
    settle(dt);
    for (const w of wheels) { w.w.rotation.x += st.v * dt / 0.33; if (w.front) w.piv.rotation.y = st.steer; }
    sw.rotation.z = -st.steer * 4.2;
    const on = st.lights ? 1 : 0;
    head.intensity = on * (st.lightbar.visible ? 900 : 420); head.angle = st.lightbar.visible ? 0.72 : 0.5; head.distance = st.lightbar.visible ? 120 : 85; lampM.emissiveIntensity = on * 4; tailM.emissiveIntensity = on * 1.5 + (driving && brake > 0 ? 3 : 0);
    if (rain > 0.05 && driving) st.wipe += dt * (2.2 + rain * 2.4); 
    const a = 1.35 - (0.5 - 0.5 * Math.cos(st.wipe)) * 1.9 * (rain > 0.05 || (st.wipe % 6.283) > 0.1 ? 1 : 0);
    wip[0].rotation.z = a; wip[1].rotation.z = a;
    g.position.y += driving && st.fuel > 0 ? Math.sin(performance.now() * 0.045) * 0.0025 : 0;
  };
  return st;
}
