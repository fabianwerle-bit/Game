import * as THREE from 'three';

// Dunkle Gestalt (auch für Erscheinungen im Nebel benutzt)
export function makeFigure(withFace) {
  const m = new THREE.MeshBasicMaterial({ color: 0x020203 }), g = new THREE.Group(), limbs = [];
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.25, 4, 8), m); b.position.y = 1.35; g.add(b);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m); h.position.y = 2.3; g.add(h);
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.33, 1.95, 0); const am = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 1.15, 3, 6), m); am.position.y = -0.62; a.add(am); a.rotation.z = s * 0.06; g.add(a);
    const l = new THREE.Group(); l.position.set(s * 0.13, 0.95, 0); const lm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.8, 3, 6), m); lm.position.y = -0.5; l.add(lm); g.add(l); limbs.push([a, l, s]);
  }
  if (withFace) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 80; const x = c.getContext('2d');
    x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, 64, 80); const gr = x.createRadialGradient(32, 38, 4, 32, 40, 34); gr.addColorStop(0, '#b9b3a6'); gr.addColorStop(0.75, '#6d685f'); gr.addColorStop(1, '#0a0a0a'); x.fillStyle = gr; x.beginPath(); x.ellipse(32, 40, 24, 34, 0, 0, 7); x.fill();
    x.fillStyle = '#000'; x.beginPath(); x.ellipse(21, 32, 6, 8, 0, 0, 7); x.ellipse(43, 32, 6, 8, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(32, 60, 9, 12, 0, 0, 7); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), new THREE.MeshBasicMaterial({ map: t })); f.position.set(0, 2.3, 0.14); g.add(f);
  }
  g.userData.limbs = limbs;
  g.userData.walk = (t, amt) => { for (const [a, l, s] of limbs) { a.rotation.x = Math.sin(t * 6) * 0.5 * s * amt; l.rotation.x = -Math.sin(t * 6) * 0.6 * s * amt; } };
  return g;
}

export function createStalker(scene, world, assets, park) {
  const car = new THREE.Group(); scene.add(car);
  const model = assets.M.covered_car.clone(); car.add(model);
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; { const x = gc.getContext('2d'), gr = x.createRadialGradient(32, 32, 1, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.2, 'rgba(255,235,190,.55)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const glowM = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0 });
  const glows = [-0.58, 0.58].map(x => { const s = new THREE.Sprite(glowM); s.position.set(x, 0.66, 2.15); s.scale.setScalar(1.6); car.add(s); return s; });
  const man = makeFigure(true); man.scale.setScalar(1.06); man.visible = false; scene.add(man);
  const box = { x: 1e6, z: 0, hw: 1.0, hd: 2.25, c: 1, s: 0 }; world.boxes.push(box);
  const st = { mode: 'parked', x: park.x, z: park.z, h: park.h, v: 0, mx: 0, mz: 0, path: [], tPath: 0, lost: 0, cool: 0, away: 0, gone: false, dist: 1e9, active: false, t: 0, lightPos: new THREE.Vector3(), car, man };
  const place = () => { const y = world.ground(st.x, st.z); car.position.set(st.x, y + 0.02, st.z); car.rotation.y = st.h; box.x = st.x; box.z = st.z; box.c = Math.cos(st.h); box.s = Math.sin(st.h); };
  st.reset = () => { st.mode = 'parked'; st.x = park.x; st.z = park.z; st.h = park.h; st.v = 0; st.gone = false; st.lost = 0; st.path = []; man.visible = false; place(); };
  st.reset();
  const ang = a => Math.atan2(Math.sin(a), Math.cos(a));
  // c: { px, pz, inBus, busV, hunt, day }  ->  null | 'caught' | 'ram'
  st.update = (dt, c) => {
    st.t += dt; let ev = null;
    if (!c.hunt) { if (st.mode !== 'parked') st.reset(); glowM.opacity = 0; st.dist = 1e9; st.active = false; return null; }
    if (st.mode === 'parked') { st.mode = st.gone ? 'fled' : 'drive'; st.tPath = 0; }
    st.cool -= dt;
    const dCar = Math.hypot(c.px - st.x, c.pz - st.z);
    if (st.mode === 'drive') {
      st.tPath -= dt;
      if (st.tPath <= 0) { st.tPath = 0.7; st.path = world.pathTo(world.nearestNode(st.x, st.z), world.nearestNode(c.px, c.pz)); }
      while (st.path.length && Math.hypot(world.nodes[st.path[0]].x - st.x, world.nodes[st.path[0]].z - st.z) < 3.2) st.path.shift();
      const stop = !c.inBus && (dCar < 24 || st.path.length < 2);
      let tx = c.px, tz = c.pz, dirt = false;
      if (st.path.length) { const n = world.nodes[st.path[Math.min(1, st.path.length - 1)]]; tx = n.x; tz = n.z; dirt = n.dirt; }
      const vmax = stop ? 0 : (dirt ? 9.4 : 13.6) + (c.day >= 5 ? 0.8 : 0);
      st.v += Math.max(-14 * dt, Math.min(5 * dt, vmax - st.v));
      if (st.path.length || c.inBus) st.h += ang(Math.atan2(tx - st.x, tz - st.z) - st.h) * Math.min(1, dt * 3.5);
      st.x += Math.sin(st.h) * st.v * dt; st.z += Math.cos(st.h) * st.v * dt;
      if (c.inBus && dCar < 5.6 && st.cool <= 0) { if (Math.abs(c.busV) < 3.5) ev = 'caught'; else { ev = 'ram'; st.cool = 2.6; st.v *= 0.3; } }
      if (stop && st.v < 0.4) { st.mode = 'walk'; st.mx = st.x + Math.cos(st.h) * 1.6; st.mz = st.z - Math.sin(st.h) * 1.6; man.visible = true; }
      if (dCar > 240) { st.lost += dt; if (st.lost > 20) { st.mode = 'away'; st.away = 35 + Math.random() * 40; } } else st.lost = 0;
      st.dist = dCar;
    } else if (st.mode === 'walk') {
      const dx = c.px - st.mx, dz = c.pz - st.mz, d = Math.hypot(dx, dz) || 1, sp = 3.45 + (c.day >= 5 ? 0.45 : 0);
      const p = { x: st.mx + dx / d * sp * dt, z: st.mz + dz / d * sp * dt }; world.collide(p, 0.3); st.mx = p.x; st.mz = p.z;
      man.position.set(st.mx, world.ground(st.mx, st.mz) - 0.03, st.mz); man.rotation.y = Math.atan2(dx, dz); man.userData.walk(st.t, 1);
      if (!c.inBus && d < 1.15) ev = 'caught';
      if (c.inBus && d < 2.6 && Math.abs(c.busV) < 2) ev = 'caught';
      if ((c.inBus && d > 38) || (!c.inBus && d > 75)) { st.mode = 'drive'; man.visible = false; st.tPath = 0; }
      st.dist = Math.min(d, dCar);
    } else if (st.mode === 'away') {
      st.away -= dt; st.dist = 1e9; st.x = park.x; st.z = park.z; st.h = park.h; st.v = 0;
      if (st.away <= 0) { st.mode = 'drive'; st.lost = 0; st.tPath = 0; }
    } else { st.dist = 1e9; man.visible = false; } // fled
    place();
    st.active = st.mode === 'drive' || st.mode === 'walk';
    const on = st.mode === 'drive' || st.mode === 'walk' ? 1 : 0;
    glowM.opacity += (on * 0.95 - glowM.opacity) * Math.min(1, dt * 3);
    st.lightPos.set(st.x + Math.sin(st.h) * 4.5, car.position.y + 1.2, st.z + Math.cos(st.h) * 4.5);
    return ev;
  };
  // Schuss: Strahl (o, d) trifft den Mann?
  st.shot = (o, d) => {
    if (st.mode !== 'walk') return false;
    const cx = st.mx - o.x, cy = man.position.y + 1.3 - o.y, cz = st.mz - o.z, t = cx * d.x + cy * d.y + cz * d.z;
    if (t < 0 || t > 60) return false;
    const ex = cx - d.x * t, ey = cy - d.y * t, ez = cz - d.z * t;
    if (Math.hypot(ex, ez) > 0.42 || Math.abs(ey) > 1.25) return false;
    st.mode = 'fled'; st.gone = true; man.visible = false; return true;
  };
  st.showAt = (x, z, faceX, faceZ) => { man.visible = true; man.position.set(x, world.ground(x, z) - 0.03, z); man.rotation.y = Math.atan2(faceX - x, faceZ - z); man.userData.walk(0, 0); };
  return st;
}
