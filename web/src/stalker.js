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
  [-0.58, 0.58].forEach(x => { const s = new THREE.Sprite(glowM); s.position.set(x, 0.66, 2.15); s.scale.setScalar(1.6); car.add(s); });
  const man = makeFigure(true); man.scale.setScalar(1.06); man.visible = false; scene.add(man);
  const box = { x: 1e6, z: 0, hw: 1.0, hd: 2.25, c: 1, s: 0 }; world.boxes.push(box);
  // mode: parked | drive | walk | door | rip | search | away | fled
  const st = { mode: 'parked', x: park.x, z: park.z, h: park.h, v: 0, mx: 0, mz: 0, path: [], tPath: 0, cool: 0, away: 0, gone: false, dist: 1e9, active: false, t: 0, lightPos: new THREE.Vector3(), car, man,
    kx: 0, kz: 0, knowT: 99, timer: 0, pound: 0, stuck: 0, lx: 0, lz: 0, sawT: 99, home: { ...park }, run: false };
  const place = () => { const y = world.ground(st.x, st.z); car.position.set(st.x, y + 0.02, st.z); car.rotation.y = st.h; box.x = st.x; box.z = st.z; box.c = Math.cos(st.h); box.s = Math.sin(st.h); };
  st.reset = () => { st.mode = 'parked'; st.x = park.x; st.z = park.z; st.h = park.h; st.v = 0; st.gone = false; st.path = []; st.knowT = 99; st.home = { ...park }; man.visible = false; place(); };
  st.reset();
  const ang = a => Math.atan2(Math.sin(a), Math.cos(a));
  const manTo = (tx, tz, sp, dt) => { const dx = tx - st.mx, dz = tz - st.mz, d = Math.hypot(dx, dz) || 1; const p = { x: st.mx + dx / d * Math.min(d, sp * dt), z: st.mz + dz / d * Math.min(d, sp * dt) }; world.collide(p, 0.3); st.mx = p.x; st.mz = p.z; man.position.set(st.mx, world.ground(st.mx, st.mz) - 0.03, st.mz); man.rotation.y = Math.atan2(dx, dz); man.userData.walk(st.t * (sp > 5 ? 1.7 : 1), 1); return d; };
  const getOut = () => { st.mx = st.x + Math.cos(st.h) * 1.6; st.mz = st.z - Math.sin(st.h) * 1.6; man.visible = true; st.stuck = 0; st.lx = st.mx; st.lz = st.mz; };
  /* c: { px, pz, inBus, busV, bus:{x,z,h}, rear, hunt, day, hear (Hörradius in m), lit, hidden, locked, lockHold, spawn, distract:{x,z}|null, bars:[{x,z}] }
     Rückgabe: null | 'caught' | 'ram' | 'out' | 'pound' | 'rip' | 'break' | 'lost' */
  st.update = (dt, c) => {
    st.t += dt; let ev = null;
    if (!c.hunt) { if (st.mode !== 'parked') st.reset(); glowM.opacity = 0; st.dist = 1e9; st.active = false; st.hunting = false; st.out = false; return null; }
    if (st.mode === 'parked') {
      if (st.gone) st.mode = 'fled';
      else { st.mode = 'drive'; st.tPath = 0; st.kx = c.px; st.kz = c.pz; st.knowT = 0; if (c.spawn) { st.x = c.spawn.x; st.z = c.spawn.z; st.h = c.spawn.h; st.home = { ...c.spawn }; } }
    }
    st.cool -= dt;
    const dCar = Math.hypot(c.px - st.x, c.pz - st.z), out = st.mode === 'walk' || st.mode === 'door' || st.mode === 'rip' || st.mode === 'search';
    const dMan = out ? Math.hypot(c.px - st.mx, c.pz - st.mz) : 1e9, d = Math.min(dCar, dMan);
    // --- Wahrnehmung: sehen / hören / Ablenkung ---
    const sees = !c.hidden && d < (c.lit ? 70 : 36), hears = !c.hidden && d < c.hear;
    if (st.mode !== 'fled' && st.mode !== 'away') {
      if (sees || hears) { st.kx = c.px; st.kz = c.pz; if (st.knowT > 6 && st.mode === 'search') st.mode = 'walk'; st.knowT = 0; if (sees) st.sawT = 0; }
      else { st.knowT += dt; st.sawT += dt; if (c.distract) { st.kx = c.distract.x; st.kz = c.distract.z; } }
    }
    const knows = st.knowT < 4;
    if (st.mode === 'drive') {
      st.tPath -= dt;
      if (st.tPath <= 0) { st.tPath = 0.7; st.path = world.pathTo(world.nearestNode(st.x, st.z), world.nearestNode(st.kx, st.kz)); }
      while (st.path.length && Math.hypot(world.nodes[st.path[0]].x - st.x, world.nodes[st.path[0]].z - st.z) < 3.2) st.path.shift();
      const dK = Math.hypot(st.kx - st.x, st.kz - st.z), busStill = c.inBus && Math.abs(c.busV) < 3.5;
      const stop = (knows && !c.inBus && dCar < 24) || (knows && busStill && dCar < 9) || (!knows && (dK < 22 || st.path.length < 2)) || (knows && !c.inBus && st.path.length < 2);
      let tx = st.kx, tz = st.kz, dirt = false;
      if (st.path.length) { const n = world.nodes[st.path[Math.min(1, st.path.length - 1)]]; tx = n.x; tz = n.z; dirt = n.dirt; }
      const vmax = stop ? 0 : ((dirt ? 9.4 : 13.6) + (c.day >= 5 ? 0.8 : 0)) * (c.sp || 1);
      st.v += Math.max(-16 * dt, Math.min(5 * dt, vmax - st.v));
      if (st.path.length || c.inBus) st.h += ang(Math.atan2(tx - st.x, tz - st.z) - st.h) * Math.min(1, dt * 3.5);
      st.x += Math.sin(st.h) * st.v * dt; st.z += Math.cos(st.h) * st.v * dt;
      if (c.inBus && dCar < 5.6 && st.cool <= 0 && Math.abs(c.busV) >= 3.5) { ev = 'ram'; st.cool = 2.6; st.v *= 0.3; }
      if (stop && st.v < 0.5) { getOut(); if (knows && busStill) { st.mode = 'door'; ev = 'out'; } else if (knows) st.mode = 'walk'; else { st.mode = 'search'; st.timer = 22 + Math.random() * 10; st.sx = st.kx; st.sz = st.kz; } }
    } else if (st.mode === 'walk') {
      const dd = manTo(st.kx, st.kz, (3.45 + (c.day >= 5 ? 0.45 : 0)) * (c.sp || 1), dt);
      if (!c.inBus && !c.hidden && dMan < 1.15) ev = 'caught';
      if (c.hidden && dMan < 1.3 && st.sawT < 4) ev = 'caught';
      if (c.inBus && knows && dMan < 14 && Math.abs(c.busV) < 3.5) st.mode = 'door';
      if (!knows && dd < 2.5) { st.mode = 'search'; st.timer = 18 + Math.random() * 8; st.sx = st.kx; st.sz = st.kz; }
      if ((c.inBus && dMan > 40) || dMan > 80) { st.mode = 'drive'; man.visible = false; st.tPath = 0; }
      // Hängt er an verrammelter Tür?
      st.stuck += dt; if (st.stuck > 1.5) { const mv = Math.hypot(st.mx - st.lx, st.mz - st.lz); st.lx = st.mx; st.lz = st.mz; st.stuck = 0; if (mv < 0.35 && c.bars) { const b = c.bars.find(b => Math.hypot(b.x - st.mx, b.z - st.mz) < 2.6); if (b) { st.pound += 1.5; ev = 'pound'; if (st.pound > 9) { st.pound = 0; ev = 'break'; st.breakAt = b; } } } else st.pound = Math.max(0, st.pound - 0.5); }
    } else if (st.mode === 'door') {   // rennt zur Bustür
      const sn = Math.sin(c.bus.h), cs = Math.cos(c.bus.h), side = c.rear ? -1.15 : 1.15, fz = c.rear ? -0.4 : 0.7;
      const tx = c.bus.x + cs * side + sn * fz, tz = c.bus.z - sn * side + cs * fz;
      const dd = manTo(tx, tz, 6.4 * (c.sp || 1), dt);
      if (!c.inBus) st.mode = 'walk';
      else if (Math.abs(c.busV) > 4 && dMan > 5) st.mode = 'walk';
      else if (dd < 0.7) { st.mode = 'rip'; st.timer = c.locked ? c.lockHold : 0; st.pound = 0; st.ripped = false; }
    } else if (st.mode === 'rip') {     // hämmert, reißt die Tür auf
      man.userData.walk(st.t * 2, 0.5);
      if (!c.inBus || Math.abs(c.busV) > 3 || Math.hypot(c.bus.x - st.mx, c.bus.z - st.mz) > 2.8) { st.mode = 'walk'; }
      else if (st.timer > 0) { st.timer -= dt; st.pound -= dt; if (st.pound <= 0) { st.pound = 1.1; ev = 'pound'; } }
      else if (!st.ripped) { st.ripped = true; st.timer = -0.001; st.grace = (st.graceLen || 3.2) * (c.gr || 1); st.graceLen = 0; ev = 'rip'; }
      else { st.grace -= dt; if (st.grace <= 0) ev = 'caught'; }
    } else if (st.mode === 'search') {  // sucht die letzte bekannte Stelle ab
      st.timer -= dt; const a = st.t * 0.35; manTo(st.sx + Math.cos(a) * 7, st.sz + Math.sin(a * 1.3) * 7, 2.2, dt);
      if (!c.hidden && dMan < 1.15) ev = 'caught';
      if (c.hidden && dMan < 1.3 && st.sawT < 4) ev = 'caught';
      if (st.timer <= 0) { man.visible = false; st.mode = 'away'; st.away = 40 + Math.random() * 40; ev = 'lost'; }
    } else if (st.mode === 'away') {
      st.away -= dt; if (st.v > 0) st.v = 0;
      if (st.away <= 0) { st.mode = 'drive'; st.tPath = 0; const n = world.nodes[(world.nearestNode(c.px, c.pz) + 40 + Math.floor(Math.random() * 60)) % world.nodes.length]; st.kx = n.x; st.kz = n.z; st.knowT = 99; }
    } else { man.visible = false; } // fled
    place();
    st.active = st.mode !== 'fled' && st.mode !== 'parked';
    st.hunting = st.active && st.mode !== 'away' && (knows || st.mode === 'door' || st.mode === 'rip');
    st.dist = st.active && st.mode !== 'away' ? d : 1e9;
    st.out = st.mode === 'walk' || st.mode === 'door' || st.mode === 'rip' || st.mode === 'search';
    const on = st.active && st.mode !== 'away' ? 1 : 0;
    glowM.opacity += (on * 0.95 - glowM.opacity) * Math.min(1, dt * 3);
    st.lightPos.set(st.x + Math.sin(st.h) * 4.5, car.position.y + 1.2, st.z + Math.cos(st.h) * 4.5);
    return ev;
  };
  // Schuss: Strahl (o, d) trifft den Mann?
  st.shot = (o, d) => {
    if (!st.out) return false;
    const cx = st.mx - o.x, cy = man.position.y + 1.3 - o.y, cz = st.mz - o.z, t = cx * d.x + cy * d.y + cz * d.z;
    if (t < 0 || t > 60) return false;
    const ex = cx - d.x * t, ey = cy - d.y * t, ez = cz - d.z * t;
    if (Math.hypot(ex, ez) > 0.5 || Math.abs(ey) > 1.3) return false;
    st.mode = 'fled'; st.gone = true; man.visible = false; return true;
  };
  // nächtlicher Überfall: er steht schon an der Schiebetür
  st.ambush = (b) => { const sn = Math.sin(b.h), cs = Math.cos(b.h); st.x = b.x - sn * 9; st.z = b.z - cs * 9; st.h = b.h; st.v = 0; st.mx = b.x - cs * 1.15 - sn * 0.4; st.mz = b.z + sn * 1.15 - cs * 0.4; man.visible = true; man.position.set(st.mx, world.ground(st.mx, st.mz) - 0.03, st.mz); man.rotation.y = Math.atan2(b.x - st.mx, b.z - st.mz); st.mode = 'rip'; st.timer = 1.6; st.pound = 0; st.ripped = false; st.graceLen = 4.6; st.knowT = 0; st.gone = false; place(); };
  st.banish = () => { st.mode = 'parked'; st.x = 1e6; st.z = 1e6; car.visible = false; man.visible = false; box.x = 1e6; };
  st.heard = (x, z) => { if (st.active && st.mode !== 'away') { st.kx = x; st.kz = z; st.knowT = 0; if (st.mode === 'search') st.mode = 'walk'; } };
  st.showAt = (x, z, faceX, faceZ) => { man.visible = true; man.position.set(x, world.ground(x, z) - 0.03, z); man.rotation.y = Math.atan2(faceX - x, faceZ - z); man.userData.walk(0, 0); };
  return st;
}
