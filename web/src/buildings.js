import * as THREE from 'three';

// Box mit sauber gekachelten UVs (tile = Meter pro Texturwiederholung)
export function texBox(w, h, d, mat, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return new THREE.Mesh(g, mat);
}
const std = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t.d, normalMap: t.n, roughness: 0.85, ...o });
function signTex(text, fg = '#f2efe4', bg = '#7a1c16', size = 62) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 96); x.fillStyle = fg; x.font = `bold ${size}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function paperTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 180; const x = c.getContext('2d');
  x.fillStyle = '#d9d2bd'; x.fillRect(0, 0, 128, 180); x.strokeStyle = 'rgba(30,25,40,.75)'; x.lineWidth = 1.6;
  for (let l = 0; l < 9; l++) { x.beginPath(); let px = 14; const y = 22 + l * 16; x.moveTo(px, y); const end = 60 + Math.random() * 50; while (px < end) { px += 3 + Math.random() * 4; x.lineTo(px, y + (Math.random() - 0.5) * 6); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createBuildings(assets, world, scene) {
  const { T, M } = assets, items = [], fx = { flicker: [], beam: null, embers: null, emitters: [], doors: {}, ferry: null, park: null, start: null, radio: null };
  const emit = (g, x, y, z, color, intensity, dist, tag) => { g.updateWorldMatrix(true, false); const e = { pos: g.localToWorld(new THREE.Vector3(x, y, z)), color: new THREE.Color(color), base: intensity, k: 1, dist, tag }; fx.emitters.push(e); return e; };
  const mats = {
    plaster: std(T.white_plaster_rough_01, { color: new THREE.Color(1.3, 1.42, 1.8) }), plasterY: std(T.white_plaster_rough_01, { color: new THREE.Color(1.25, 1.2, 1.25) }),
    concrete: std(T.concrete_floor_worn_001), iron: std(T.corrugated_iron_02, { metalness: 0.5, roughness: 0.6 }),
    planks: std(T.weathered_planks), deck: std(T.wood_planks_grey), shutter: std(T.rusty_metal_shutter, { metalness: 0.4 }), roof: std(T.grey_roof_tiles),
    paint: std(T.rusty_painted_metal, { metalness: 0.4, roughness: 0.6 }), brick: std(T.red_brick), tiles: new THREE.MeshStandardMaterial({ map: T.tiles.d, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1a2224, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
    winLit: new THREE.MeshStandardMaterial({ color: 0x2a2014, emissive: 0xffb45a, emissiveIntensity: 1.4, roughness: 0.3, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.7 }), steel: new THREE.MeshStandardMaterial({ color: 0x8b9094, roughness: 0.45, metalness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: 0xcfd2cf, roughness: 0.7 }), red: new THREE.MeshStandardMaterial({ color: 0x7a1c16, roughness: 0.6 }),
    tent: new THREE.MeshStandardMaterial({ color: 0x5c6b4a, roughness: 0.95, side: THREE.DoubleSide }), tent2: new THREE.MeshStandardMaterial({ color: 0x9a5a2a, roughness: 0.95, side: THREE.DoubleSide }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 1 }), brass: new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.9 }),
    paper: new THREE.MeshStandardMaterial({ map: paperTex(), roughness: 0.9, side: THREE.DoubleSide }),
  };
  T.tiles.d.repeat.set(1, 1);
  const tileMat = new THREE.MeshStandardMaterial({ map: T.tiles.d, roughness: 0.5 });
  const v3 = new THREE.Vector3();
  const site = p => { const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.face; g.userData.ry = p.face; scene.add(g); return g; };
  const sub = (parent, x, z, ry = 0, y = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.userData.ry = parent.userData.ry + ry; parent.add(g); return g; };
  const toWorld = (g, lx, lz) => { g.updateWorldMatrix(true, false); v3.set(lx, 0, lz); g.localToWorld(v3); return { x: v3.x, z: v3.z }; };
  const add = (g, mesh, x, y, z, solid) => { mesh.position.set(x, y, z); g.add(mesh); if (solid) { const p = mesh.geometry.parameters, w = toWorld(g, x, z); world.addBox(w.x, w.z, p.width / 2, p.depth / 2, g.userData.ry + mesh.rotation.y); } return mesh; };
  // solid: Zahl = Kreisradius, [hw, hd] = Box
  const prop = (g, name, x, z, ry = 0, s = 1, y = 0, solid = 0) => { const o = M[name].clone(); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); if (solid) { const w = toWorld(g, x, z); if (solid.length) world.addBox(w.x, w.z, solid[0], solid[1], g.userData.ry + ry); else world.addCircle(w.x, w.z, solid); } return o; };
  const zone = (g, lx, lz, hw, hd, name) => { const w = toWorld(g, lx, lz), r = g.userData.ry; world.zones.push({ x: w.x, z: w.z, hw, hd, c: Math.cos(r), s: Math.sin(r), name }); };
  const keyMesh = () => { const k = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 14), mats.brass); r.rotation.x = Math.PI / 2; k.add(r); const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.12), mats.brass); b.position.z = 0.09; k.add(b); const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.02), mats.brass); t.position.set(0.02, 0, 0.14); k.add(t); return k; };
  const ITEM = { can: ['russian_food_cans_01', 2.2, 'Konserven'], longlife: ['long_life_food', 1.2, 'Notration'], apple: ['food_apple_01', 2.0, 'Apfel'], fuel: ['metal_jerrycan_green', 1.0, 'Benzinkanister'], ammo: ['ammo_box', 1.3, 'Munition'], pistol: ['service_pistol', 1.3, 'Pistole'], key: [null, 1.6, 'Schlüssel'], note: [null, 1, 'Zettel'] };
  const item = (g, type, x, y, z, ry = 0, extra = {}) => {
    let o;
    if (type === 'note') { o = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.3), mats.paper); if (!extra.wall) o.rotation.x = -Math.PI / 2; const h = new THREE.Group(); h.add(o); o = h; }
    else if (type === 'key') o = keyMesh(); else o = M[ITEM[type][0]].clone();
    o.scale.setScalar(ITEM[type][1]); o.rotation.y = ry; if (type === 'pistol') o.rotation.x = Math.PI / 2;
    if (g) { o.position.set(x, y, z); g.add(o); g.updateWorldMatrix(true, true); } else { o.position.set(x, world.getHeight(x, z) + y, z); scene.add(o); }
    const it = { id: items.length, type, name: ITEM[type][2], obj: o, pos: o.getWorldPosition(new THREE.Vector3()), ...extra }; items.push(it); return it;
  };
  const door = (g, id, x, z, w = 1.1, h = 2.1) => {
    const m = texBox(w, h, 0.07, mats.planks, 1.5); m.position.set(x, h / 2, z); g.add(m);
    const wp = toWorld(g, x, z), r = g.userData.ry, box = { x: wp.x, z: wp.z, hw: w / 2, hd: 0.18, c: Math.cos(r), s: Math.sin(r) }; world.boxes.push(box);
    fx.doors[id] = { id, mesh: m, box, pos: new THREE.Vector3(wp.x, g.getWorldPosition(v3).y + 1.2, wp.z), open() { m.visible = false; box.x = 1e6; }, close() { m.visible = true; box.x = wp.x; } };
  };
  // Wand entlang lokaler X-Achse (zentriert), mit Tür-/Fensteröffnungen
  const wallRun = (g, len, hgt, mat, ops = [], tile = 2) => {
    let x = -len / 2; const TH = 0.22;
    const seg = (x0, x1, y0, y1, solid) => { if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return; add(g, texBox(x1 - x0, y1 - y0, TH, mat, tile), (x0 + x1) / 2, (y0 + y1) / 2, 0, solid); };
    for (const o of ops.slice().sort((a, b) => a.x - b.x)) {
      const a = o.x - o.w / 2, b = o.x + o.w / 2; seg(x, a, 0, hgt, true);
      if (o.door) seg(a, b, o.h || 2.1, hgt, false);
      else { const y0 = o.y0 ?? 0.95, y1 = o.y1 ?? 2.05; seg(a, b, 0, y0, true); seg(a, b, y1, hgt, false); add(g, new THREE.Mesh(new THREE.PlaneGeometry(b - a, y1 - y0), o.lit ? mats.winLit : mats.glass), (a + b) / 2, (y0 + y1) / 2, 0); add(g, texBox(0.05, y1 - y0, TH + 0.04, mats.dark), (a + b) / 2, (y0 + y1) / 2, 0); add(g, texBox(b - a + 0.1, 0.06, TH + 0.08, mats.dark), (a + b) / 2, y0, 0); }
      x = b;
    }
    seg(x, len / 2, 0, hgt, true);
  };
  // Haus: Tür vorn (lokal +Z), Satteldach, Kollision, Innenraum-Zone
  const house = (parent, x, z, ry, o) => {
    const g = sub(parent, x, z, ry), { w, d } = o, hgt = o.h || 2.7, wall = o.wall || mats.plaster, tile = o.tile || 2, p = o.pitch || 0.62;
    add(g, texBox(w + 0.4, 0.24, d + 0.4, mats.concrete, 3), 0, -0.02, 0);
    const fl = texBox(w - 0.2, 0.04, d - 0.2, o.floor || mats.deck, 1.6); add(g, fl, 0, 0.11, 0);
    wallRun(sub(g, 0, d / 2, 0), w, hgt, wall, o.front, tile); wallRun(sub(g, 0, -d / 2, Math.PI), w, hgt, wall, o.back || [], tile);
    wallRun(sub(g, -w / 2, 0, -Math.PI / 2), d - 0.22, hgt, wall, o.left || [], tile); wallRun(sub(g, w / 2, 0, Math.PI / 2), d - 0.22, hgt, wall, o.right || [], tile);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.white); ceil.rotation.x = Math.PI / 2; add(g, ceil, 0, hgt - 0.01, 0);
    const half = d / 2 + 0.45, sl = half / Math.cos(p), rise = Math.tan(p) * d / 2, rm = o.roof || mats.roof;
    for (const s of [-1, 1]) { const r = texBox(w + 0.8, 0.14, sl, rm, 1.6); r.rotation.x = s * p; add(g, r, 0, hgt + Math.tan(p) * half / 2 - 0.02, s * half / 2); }
    for (const sx of [-1, 1]) {
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -d / 2, 0, 0, d / 2, 0, rise, 0], 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, d / tile, 0, d / 2 / tile, rise / tile], 2)); tg.computeVertexNormals();
      const m = wall.clone(); m.side = THREE.DoubleSide; add(g, new THREE.Mesh(tg, m), sx * w / 2, hgt, 0);
    }
    if (o.chimney) add(g, texBox(0.6, 1.5, 0.6, mats.brick, 1), w / 4, hgt + rise * 0.55 + 0.5, -d / 5);
    if (o.sign) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(o.signW || 2.4, 0.46), new THREE.MeshStandardMaterial({ map: signTex(o.sign, '#e8e2d0', o.signBg || '#2c3a2e'), roughness: 0.7 })); add(g, sg, o.signX || 0, hgt - 0.3, d / 2 + 0.13); }
    zone(g, 0, 0, w / 2, d / 2, o.name || 'house');
    return g;
  };
  const tube = (g, x, y, z, len, group, base = 2.5) => { const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.14), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeaff, emissiveIntensity: base })); add(g, m, x, y, z); fx.flicker.push({ mat: m.material, base, group }); return m; };
  const shelfS = 0.09;
  const shelf = (g, x, z, r = 0) => prop(g, 'steel_frame_shelves_01', x, z, r, shelfS, 0.1, [0.5, 0.24]);

  // ================= TANKSTELLE =================
  {
    const g = site(world.pois.station), W = 12, D = 7, Hh = 3.3, zc = -8;
    const slab = texBox(34, 0.3, 26, mats.concrete.clone(), 3); slab.material.polygonOffset = true; slab.material.polygonOffsetFactor = -1; slab.material.polygonOffsetUnits = -1;
    add(g, slab, 0, -0.09, 0);
    add(g, texBox(W, Hh, 0.25, mats.plaster), 0, Hh / 2, zc - D / 2, true);
    add(g, texBox(0.25, Hh, D, mats.plaster), -W / 2, Hh / 2, zc, true); add(g, texBox(0.25, Hh, D, mats.plaster), W / 2, Hh / 2, zc, true);
    const zf = zc + D / 2;
    add(g, texBox(1.6, Hh, 0.25, mats.plaster), -5.2, Hh / 2, zf, true); add(g, texBox(1.5, Hh - 2.2, 0.25, mats.plaster), -3.65, 2.2 + (Hh - 2.2) / 2, zf);
    add(g, texBox(8.9, 0.9, 0.25, mats.brick), 1.55, 0.45, zf, true); add(g, texBox(8.9, Hh - 2.5, 0.25, mats.plaster), 1.55, 2.5 + (Hh - 2.5) / 2, zf);
    add(g, new THREE.Mesh(new THREE.PlaneGeometry(8.9, 1.6), mats.glass), 1.55, 1.7, zf);
    for (const x of [-2.9, 1.55, 6.0]) add(g, texBox(0.08, 1.6, 0.12, mats.dark), x, 1.7, zf);
    add(g, texBox(W + 1.2, 0.3, D + 1.6, mats.concrete, 3), 0, Hh + 0.15, zc + 0.3);
    add(g, texBox(W + 1.3, 0.55, 0.1, mats.red), 0, Hh + 0.05, zc + D / 2 + 1.12);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.95), new THREE.MeshStandardMaterial({ map: signTex('TANKSTELLE'), emissiveMap: signTex('TANKSTELLE', '#fff', '#300'), emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.5 }));
    add(g, sign, 1.5, Hh + 0.75, zc + D / 2 + 1.0); fx.flicker.push({ mat: sign.material, base: 1.2, group: 'station' });
    add(g, texBox(5.4, 1.15, 0.15, mats.dark), 1.5, Hh + 0.75, zc + D / 2 + 0.9);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, D - 0.3), tileMat.clone()); floor.rotation.x = -Math.PI / 2; { const uv = floor.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 4); } add(g, floor, 0, 0.08, zc);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mats.white); ceil.rotation.x = Math.PI / 2; add(g, ceil, 0, Hh - 0.01, zc);
    add(g, texBox(2.6, 1.0, 0.7, mats.planks), 3.9, 0.5, zc - 1.6, true); add(g, texBox(0.5, 0.35, 0.4, mats.dark), 4.4, 1.18, zc - 1.6);
    for (const [x, z] of [[-1.6, zc - 0.4], [0.9, zc - 0.4], [-4.2, zc - 3.0], [-1.2, zc - 3.05], [1.6, zc - 3.05]]) shelf(g, x, z);
    tube(g, 0, Hh - 0.08, zc - 0.5, 2.4, 'station'); emit(g, 0, Hh - 0.5, zc - 0.5, 0xdfe8ff, 16, 16, 'station');
    item(g, 'can', -1.6, 1.07, zc - 0.4); item(g, 'can', 0.9, 0.59, zc - 0.4, 1.2); item(g, 'longlife', -1.2, 1.07, zc - 3.05); item(g, 'can', 1.6, 1.55, zc - 3.05, 2);
    item(g, 'longlife', 3.6, 1.02, zc - 1.6, 0.5); item(g, 'can', -4.2, 0.59, zc - 3.0, 0.4); item(g, 'apple', 4.5, 1.03, zc - 1.5);
    prop(g, 'cardboard_box_01', -4.6, zc + 1.2, 0.4, 1, 0.08); prop(g, 'plastic_crate_03', 5.0, zc + 2.2, 0.2, 1, 0.08);
    zone(g, 0, zc, W / 2, D / 2, 'station');
    const cz = 4.5, ch = 4.7;
    for (const [x, z] of [[-5, cz - 3], [5, cz - 3], [-5, cz + 3], [5, cz + 3]]) { add(g, texBox(0.3, ch, 0.3, mats.white), x, ch / 2, z); const w = toWorld(g, x, z); world.addCircle(w.x, w.z, 0.25); }
    add(g, texBox(13, 0.5, 9, mats.iron, 2.5), 0, ch + 0.25, cz);
    add(g, texBox(13.1, 0.6, 0.08, mats.red), 0, ch + 0.25, cz + 4.52); add(g, texBox(13.1, 0.6, 0.08, mats.red), 0, ch + 0.25, cz - 4.52);
    add(g, texBox(0.08, 0.6, 9.1, mats.red), 6.52, ch + 0.25, cz); add(g, texBox(0.08, 0.6, 9.1, mats.red), -6.52, ch + 0.25, cz);
    for (const x of [-2.6, 2.6]) { const l = tube(g, x, ch - 0.02, cz, 0.3, 'station', 2.2); l.scale.set(1, 1, 21); l.userData.slow = x > 0; }
    emit(g, 0, ch - 0.6, cz, 0xe0e8ff, 30, 28, 'station');
    add(g, texBox(7, 0.2, 1.3, mats.concrete), 0, 0.14, cz);
    for (const x of [-2, 2]) {
      add(g, texBox(0.95, 1.55, 0.5, mats.paint, 1.2), x, 0.98, cz, true); add(g, texBox(0.99, 0.3, 0.54, mats.dark), x, 1.9, cz);
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshStandardMaterial({ color: 0x0a0f0a, emissive: 0x3cff6a, emissiveIntensity: 0.35 })); add(g, disp, x, 1.4, cz + 0.26); fx.flicker.push({ mat: disp.material, base: 0.35, group: 'station' });
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.022, 6, 14, Math.PI), mats.dark); hose.rotation.z = Math.PI; hose.rotation.y = Math.PI / 2; add(g, hose, x + 0.5, 1.0, cz);
    }
    // offene Werkstatt
    add(g, texBox(0.25, 3.1, 6, mats.plaster), -10.5, 1.55, zc, true); add(g, texBox(4.5, 0.25, 6.3, mats.iron), -8.3, 3.1, zc); add(g, texBox(4.2, 3.1, 0.25, mats.plaster), -8.4, 1.55, zc - 3, true);
    const sh = texBox(4.2, 0.9, 0.12, mats.shutter, 3); add(g, sh, -8.4, 2.6, zc + 2.9);
    zone(g, -8.4, zc, 2.1, 3, 'garage');
    prop(g, 'old_tyre', -9.8, zc - 2.2, 0, 1, 0.3); prop(g, 'old_tyre', -9.7, zc - 1.4, 1, 1, 0.3); prop(g, 'Barrel_01', -7.0, zc - 2.3, 0, 1, 0.06, 0.35); prop(g, 'wooden_crate_01', -9.6, zc + 0.6, 0.2, 1, 0.06, [0.42, 0.22]);
    item(g, 'ammo', -9.6, 0.42, zc + 0.6, 0.5); item(g, 'fuel', -7.6, 0.06, zc - 1.2, 0.6);
    prop(g, 'covered_car', 10.5, -5.5, 0.3, 1, 0.06, [1.0, 2.3]);
    prop(g, 'Barrel_01', -11.6, -5.2, 0, 1, 0.06, 0.35); prop(g, 'metal_trash_can', 6.6, -4.2, 0, 1, 0.06, 0.3); prop(g, 'propane_tank', 7.4, -4.25, 0, 1, 0.06, 0.2); prop(g, 'utility_box_01', -6.3, -4.38, 0, 1, 1.0);
    prop(g, 'street_lamp_02', 13, 9.5, 2.2, 1, 0, 0.2);
    item(g, 'fuel', 2.9, 0.24, cz + 0.2, 2.0); item(g, 'fuel', -12.0, 0.06, -3.4, 1.1);
    world.pois.station.g = g;
  }

  // ================= JAGDHÜTTE =================
  {
    const g = site(world.pois.cabin);
    const h = house(g, 0, -4, 0, { w: 6, d: 5, h: 2.5, wall: mats.planks, front: [{ x: -1.2, w: 1.1, door: true }, { x: 1.5, w: 1.0, lit: true }], left: [{ x: 0, w: 1.0 }], chimney: true, name: 'cabin' });
    add(h, texBox(6.2, 0.2, 1.8, mats.deck), 0, 0.05, 3.4); for (const x of [-2.9, 2.9]) add(h, texBox(0.14, 2.3, 0.14, mats.planks), x, 1.15, 4.2);
    prop(h, 'vintage_day_bed', -1.7, -1.9, 0, 1, 0.13, [1.0, 0.45]); prop(h, 'WoodenTable_01', 1.6, -1.9, 0, 1, 0.13, [0.9, 0.33]); prop(h, 'painted_wooden_chair_01', 1.4, -1.1, Math.PI, 1, 0.13);
    prop(h, 'barrel_stove', 2.4, 0.6, 0, 1, 0.13, 0.35); prop(h, 'vintage_oil_lamp', 2.2, -1.9, 0, 1.2, 0.68); prop(h, 'wooden_axe', -2.86, 0.8, Math.PI / 2, 1.3, 1.3);
    emit(h, 2.0, 1.5, -1.5, 0xffa850, 6, 9, 'warm');
    item(h, 'pistol', 1.5, 0.71, -1.9, 0.6); item(h, 'note', 1.0, 0.69, -1.85, 0.3, { note: 'cabin' }); item(h, 'ammo', 1.9, 0.68, -2.05, 1);
    item(h, 'can', -2.5, 0.15, 1.6, 2); item(h, 'longlife', 2.5, 0.15, -0.6, 0.3);
    prop(g, 'Barrel_01', 4.3, -0.6, 0.4, 1, 0, 0.35); prop(g, 'tree_stump_01', -4.6, 1.4, 0, 1, 0, 0.4); item(g, 'fuel', 3.8, 0.0, 0.6, 0.5);
  }

  // ================= LEUCHTTURM =================
  {
    const g = site(world.pois.light), th = 17;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.9, th, 24, 1), mats.plaster.clone()); tower.material.color.setRGB(1.45, 1.58, 2.0);
    { const uv = tower.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 7, uv.getY(i) * 8); }
    add(g, tower, 0, th / 2, -3); for (const y of [5, 11]) add(g, new THREE.Mesh(new THREE.CylinderGeometry(2.36 + (11 - y) * 0.029 + 0.1, 2.36 + (11 - y) * 0.029 + 0.2, 2.6, 24, 1, true), mats.red), 0, y, -3);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.5, 0.3, 24), mats.dark), 0, th + 0.15, -3);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.04, 6, 24), mats.dark); rail.rotation.x = Math.PI / 2; add(g, rail, 0, th + 1.3, -3);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 2.2, 12, 1, true), mats.glass), 0, th + 1.4, -3);
    add(g, new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.3, 12), mats.red), 0, th + 3.15, -3);
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }); add(g, new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampM), 0, th + 1.4, -3);
    const beam = new THREE.Group(); beam.position.set(0, th + 1.4, -3); g.add(beam);
    const bm = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(9, 150, 14, 1, true), bm); c.rotation.z = s * Math.PI / 2; c.position.x = s * -75; beam.add(c); }
    fx.beam = { group: beam, mat: bm, lamp: lampM };
    { const w = toWorld(g, 0, -3); world.addCircle(w.x, w.z, 3.0); }
    // Wärterhaus mit Funkraum (abgeschlossen)
    const h = house(g, 6.2, -2.6, 0, { w: 5.4, d: 4.4, front: [{ x: 0.8, w: 1.1, door: true }, { x: -1.3, w: 0.9 }], name: 'light' });
    door(h, 'light', 0.8, 2.2);
    prop(h, 'WoodenTable_01', -0.6, -1.6, 0, 1, 0.13, [0.9, 0.33]); prop(h, 'painted_wooden_chair_01', -0.6, -0.8, Math.PI, 1, 0.13);
    const radio = prop(h, 'vintage_radio_transceiver', -0.6, -1.6, 0, 1, 0.68); fx.radio = radio.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0));
    for (let i = 0; i < 46; i++) { // Wände voller Zettel
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.3), mats.paper), side = i % 3; n.rotation.z = (Math.random() - 0.5) * 0.5;
      if (side === 0) add(h, n, -2.4 + Math.random() * 4.8, 0.7 + Math.random() * 1.7, -2.07); else { n.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2; add(h, n, side === 1 ? -2.57 : 2.57, 0.7 + Math.random() * 1.7, -1.9 + Math.random() * 3.6); }
    }
    emit(h, 0, 2.1, 0, 0xffe0b0, 5, 8, 'radio');
    prop(g, 'lifebuoy', 3.6, -0.3, 0, 1.2, 1.3); prop(g, 'Barrel_01', 9.6, -1.5, 0, 1, 0, 0.35);
    item(g, 'can', 9.2, 0.0, 0.5, 0.7); item(g, 'longlife', -3.4, 0.0, -1.2, 0.2); item(g, 'fuel', 9.9, 0.0, -0.4, 1.4);
  }

  // ================= HAFEN (Start) =================
  {
    const g = site(world.pois.harbor), L = 46, y = 0.3, pz = -13;
    const slab = texBox(46, 0.3, 21, mats.concrete.clone(), 3); slab.material.polygonOffset = true; slab.material.polygonOffsetFactor = -1; slab.material.polygonOffsetUnits = -1; add(g, slab, 0, -0.08, -4);
    add(g, texBox(3, 0.16, L, mats.deck, 1.5), 0, y, pz - L / 2);
    for (let z = pz; z > pz - L; z -= 4) for (const x of [-1.35, 1.35]) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 7, 6), mats.planks), x, -3, z);
    for (let z = pz - 2; z > pz - L; z -= 6) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), mats.planks), 1.4, y + 0.6, z);
    { const c = toWorld(g, 0, pz - L / 2), r = g.userData.ry; world.platforms.push({ x: c.x, z: c.z, hw: 1.5, hd: L / 2 + 0.6, c: Math.cos(r), s: Math.sin(r), y: world.pois.harbor.y + y + 0.08 }); }
    // Lagerhalle
    const wh = house(g, -16, -3, Math.PI / 2, { w: 10, d: 8, h: 4, wall: mats.iron, roof: mats.iron, pitch: 0.3, tile: 2.5, floor: mats.concrete, front: [{ x: 0, w: 4.2, h: 3.3, door: true }], name: 'warehouse' });
    prop(wh, 'old_military_crate', -3.2, -2.6, 0.2, 1, 0.13, [0.9, 0.3]); prop(wh, 'old_military_crate', -3.1, -2.5, -0.1, 1, 0.43); prop(wh, 'wooden_crate_01', 3.3, -3.0, 0.4, 1.3, 0.13, [0.55, 0.3]); prop(wh, 'wooden_crate_01', 3.6, -1.7, 1.5, 1.3, 0.13, [0.3, 0.55]);
    prop(wh, 'Barrel_01', -3.9, 2.6, 0, 1, 0.13, 0.35); prop(wh, 'Barrel_01', -3.1, 3.0, 1, 1, 0.13, 0.35); shelf(wh, 0, -3.5); shelf(wh, 1.3, -3.5);
    item(wh, 'ammo', -3.1, 0.74, -2.5, 0.4); item(wh, 'fuel', 3.9, 0.13, 0.5, 0.8); item(wh, 'can', 0, 1.09, -3.5, 0.3); item(wh, 'longlife', 1.3, 0.61, -3.5, 0.2); item(wh, 'fuel', -4.2, 0.13, 0.6, 2);
    tube(wh, 0, 3.9, 0, 2.4, 'lamp');
    // Büro des Hafenmeisters
    const of = house(g, 16, -2, -Math.PI / 2, { w: 5.2, d: 4.2, front: [{ x: -1.2, w: 1.1, door: true }, { x: 1.1, w: 1.2 }], right: [{ x: 0, w: 1.0 }], sign: 'HAFENMEISTER', signW: 2.6, signX: 1.0, signBg: '#1c2c3c', name: 'office' });
    door(of, 'office', -1.2, 2.1);
    prop(of, 'WoodenTable_01', 0.9, -1.3, 0, 1, 0.13, [0.9, 0.33]); prop(of, 'painted_wooden_chair_01', 0.9, -0.5, Math.PI, 1, 0.13); prop(of, 'painted_wooden_cabinet', -1.7, -1.6, 0, 1, 0.13, [0.6, 0.3]); prop(of, 'hanging_picture_frame_01', 1.2, -1.98, 0, 1, 1.7);
    item(of, 'note', 0.6, 0.69, -1.3, -0.3, { note: 'office' }); item(of, 'longlife', 1.4, 0.69, -1.35, 0.4); item(of, 'ammo', -1.7, 1.32, -1.6, 0.2);
    // Fährschild
    add(g, texBox(0.1, 2.4, 0.1, mats.dark), 3.2, 1.2, -11.5); const fa = signTex('FÄHRE  FR 9:00', '#f2efe4', '#1c2c3c', 50), fb = signTex('FÄHRBETRIEB EINGESTELLT', '#f2efe4', '#5a1612', 34);
    const fm = new THREE.MeshStandardMaterial({ map: fa, roughness: 0.6, side: THREE.DoubleSide }); const fs = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.42), fm); add(g, fs, 3.2, 2.3, -11.44); fx.ferry = { mat: fm, a: fa, b: fb };
    prop(g, 'ocean_buoy', -6, -11, 0.3, 1, 0.86, 0.5); prop(g, 'ocean_buoy', -8.2, -10.4, 1.8, 1, 0.86, 0.5); prop(g, 'lifebuoy', 2.7, -12.2, 0, 1.2, 1.1);
    prop(g, 'wooden_crate_01', 6.5, -11, 0.2, 1.3, 0.07, [0.55, 0.3]); prop(g, 'wooden_crate_01', 6.6, -11, 0.5, 1.2, 0.52); prop(g, 'Barrel_01', 8.0, -11.3, 0, 1, 0.07, 0.35); prop(g, 'painted_wooden_bench', -3.4, -12.6, 0, 1.2, 0.07, [0.7, 0.3]);
    for (const [x, z, r] of [[9.5, 5.5, 2.4], [-9.5, -12.5, -0.6]]) { prop(g, 'street_lamp_01', x, z, r, 1.25, 0.05, 0.2); emit(g, x, 4.4, z, 0xffd9a0, 22, 22, 'lamp'); }
    item(g, 'apple', 6.6, 1.0, -11, 0); item(g, 'can', -3.4, 0.66, -12.6, 0.4);
    const pk = toWorld(g, 10, -9); fx.park = { x: pk.x, z: pk.z, h: g.userData.ry + 0.5 };
    const bs = toWorld(g, -3.5, 0.5), ps = toWorld(g, 1.2, -8.5); fx.start = { bus: { x: bs.x, z: bs.z, h: g.userData.ry }, pl: { x: ps.x, z: ps.z, yaw: g.userData.ry + Math.PI } };
  }

  // ================= DORF =================
  {
    const g = site(world.pois.village), slots = [];
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * Math.PI * 2 + 0.2, R = 23.5, lx = Math.sin(a) * R, lz = Math.cos(a) * R, w = toWorld(g, lx, lz), rn = world.roadNear(w.x, w.z);
      const w2 = toWorld(g, Math.sin(a) * (R - 6), Math.cos(a) * (R - 6)), rn2 = world.roadNear(w2.x, w2.z);
      if ((!rn || rn.d > rn.s.w + 7.5) && (!rn2 || rn2.d > rn2.s.w + 3)) slots.push({ lx, lz, ry: a + Math.PI, a });
    }
    const W1 = [{ x: -1.5, w: 1.1, door: true }, { x: 1.4, w: 1.2, lit: true }];
    const builders = [
      s => { // Dorfladen
        const h = house(g, s.lx, s.lz, s.ry, { w: 8, d: 6, wall: mats.brick, floor: tileMat, front: [{ x: -2.4, w: 1.2, door: true }, { x: 1.3, w: 3.2, y0: 0.8, y1: 2.15 }], sign: 'LADEN', signX: -2.4, signW: 1.8, name: 'shop' });
        for (const x of [-2.9, -1.5, 0.4, 1.8]) shelf(h, x, -2.5); shelf(h, 3.3, 0.2, Math.PI / 2);
        add(h, texBox(2.2, 1.0, 0.7, mats.planks), 0.2, 0.6, 0.6, true); tube(h, 0, 2.62, -0.6, 2.4, 'shop'); emit(h, 0, 2.3, -0.6, 0xdfe8ff, 12, 12, 'shop');
        item(h, 'note', 0.5, 1.12, 0.6, 0.2, { note: 'shop' }); item(h, 'can', -2.9, 1.09, -2.5); item(h, 'can', -1.5, 0.61, -2.5, 1); item(h, 'longlife', 0.4, 1.09, -2.5, 0.2); item(h, 'can', 1.8, 1.57, -2.5, 2);
        item(h, 'apple', -0.3, 1.12, 0.6); item(h, 'apple', -0.5, 1.12, 0.75); item(h, 'longlife', 3.3, 1.09, 0.2, 1.5); item(h, 'can', -1.5, 1.09, -2.5, 0.6); item(h, 'longlife', 1.8, 0.61, -2.5, 0.1);
        prop(h, 'cardboard_box_01', 3.2, 2.1, 0.3, 1, 0.13);
      },
      s => { // Kapelle
        const lz2 = Math.cos(s.a) * 26.5, lx2 = Math.sin(s.a) * 26.5;
        const h = house(g, lx2, lz2, s.ry, { w: 6, d: 10, h: 3.8, pitch: 0.85, wall: mats.plaster, front: [{ x: 0, w: 1.4, h: 2.4, door: true }], left: [{ x: -2, w: 0.8, y0: 1.2, y1: 3.0 }, { x: 2, w: 0.8, y0: 1.2, y1: 3.0 }], right: [{ x: -2, w: 0.8, y0: 1.2, y1: 3.0 }, { x: 2, w: 0.8, y0: 1.2, y1: 3.0 }], name: 'chapel' });
        add(h, texBox(2.4, 9.5, 2.4, mats.plaster), 0, 4.75, -6.2, true); const sp = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3, 4), mats.roof); sp.rotation.y = Math.PI / 4; add(h, sp, 0, 11, -6.2);
        add(h, texBox(0.1, 1.3, 0.1, mats.dark), 0, 13.1, -6.2); add(h, texBox(0.7, 0.1, 0.1, mats.dark), 0, 13.3, -6.2);
        for (let r = 0; r < 4; r++) for (const x of [-1.5, 1.5]) prop(h, 'painted_wooden_bench', x, 2.6 - r * 1.5, Math.PI, 1.3, 0.13, [0.75, 0.3]);
        add(h, texBox(1.7, 1.0, 0.7, mats.planks), 0, 0.63, -4.1, true); add(h, texBox(0.12, 1.6, 0.06, mats.dark), 0, 2.4, -4.86); add(h, texBox(0.8, 0.12, 0.06, mats.dark), 0, 2.75, -4.86);
        prop(h, 'wheelchair_01', 0.1, -1.9, Math.PI, 1, 0.13, 0.4);
        item(h, 'key', 0.3, 1.15, -4.1, 0.5, { req: S => S.notes.includes('office') }); item(h, 'note', -0.3, 1.14, -4.1, 0.2, { note: 'chapel', req: S => S.notes.includes('office') }); item(h, 'ammo', -2.4, 0.13, -4.3, 0.7);
        emit(h, 0, 2.2, -3.4, 0xffb060, 4, 9, 'warm');
      },
      s => { // Gasthaus
        const h = house(g, s.lx, s.lz, s.ry, { w: 9, d: 7, wall: mats.plasterY, front: [{ x: 0, w: 1.2, door: true }, { x: -2.9, w: 1.4, lit: true }, { x: 2.9, w: 1.4, lit: true }], back: [{ x: 2, w: 1.2 }], sign: 'GASTHAUS', signW: 2.6, signBg: '#3a2416', chimney: true, name: 'pub' });
        prop(h, 'dining_table', -2.2, -0.8, 0, 0.8, 0.13, [0.9, 0.56]); for (const [x, z, r] of [[-2.9, 0.1, Math.PI], [-1.5, 0.1, Math.PI], [-2.9, -1.7, 0], [-1.5, -1.7, 0]]) prop(h, 'painted_wooden_chair_01', x, z, r, 1, 0.13);
        prop(h, 'Sofa_01', 3.0, -2.9, 0, 1.1, 0.13, [0.85, 0.36]); prop(h, 'wooden_bookshelf_worn', -3.5, -3.1, 0, 1, 0.13, [0.7, 0.3]); add(h, texBox(3.2, 1.05, 0.6, mats.planks), 2.6, 0.65, 1.2, true);
        prop(h, 'barrel_stove', 4.0, -0.4, 0, 1, 0.13, 0.35); prop(h, 'hanging_picture_frame_01', 0, -3.38, 0, 1.2, 1.7);
        item(h, 'note', -2.2, 0.85, -0.8, 0.4, { note: 'pub' }); item(h, 'can', 2.2, 1.18, 1.2, 0.3); item(h, 'apple', 3.1, 1.18, 1.2); item(h, 'longlife', -1.6, 0.85, -0.6, 1);
        emit(h, 0, 2.2, 0, 0xffb060, 9, 11, 'warm');
      },
      s => { // Wohnhaus A
        const h = house(g, s.lx, s.lz, s.ry, { w: 7, d: 6, wall: mats.brick, front: W1, right: [{ x: 0, w: 1.0 }], chimney: true, name: 'house' });
        prop(h, 'vintage_day_bed', -2.2, -2.4, 0, 1, 0.13, [1.0, 0.45]); prop(h, 'painted_wooden_cabinet', 2.5, -2.5, 0, 1, 0.13, [0.6, 0.3]); prop(h, 'WoodenTable_01', 1.6, 0.6, Math.PI / 2, 1, 0.13, [0.33, 0.9]); prop(h, 'painted_wooden_chair_01', 0.8, 0.6, -Math.PI / 2, 1, 0.13);
        prop(h, 'ornate_mirror_01', -0.4, -2.88, 0, 1.3, 1.6); prop(h, 'hanging_picture_frame_01', -3.38, 0, Math.PI / 2, 1, 1.7);
        item(h, 'note', 1.6, 0.69, 0.5, 1, { note: 'house' }); item(h, 'can', 2.5, 1.32, -2.5, 0.5); item(h, 'longlife', 1.6, 0.69, 1.0, 0.3);
        emit(h, 0, 2.2, 0, 0xffb060, 7, 10, 'warm');
      },
      s => { // Wohnhaus B
        const h = house(g, s.lx, s.lz, s.ry, { w: 8, d: 6, wall: mats.plaster, front: [{ x: 1.8, w: 1.1, door: true }, { x: -1.6, w: 1.4, lit: true }], back: [{ x: 0, w: 1.2 }], name: 'house' });
        prop(h, 'Sofa_01', -2.4, -2.4, 0, 1.1, 0.13, [0.85, 0.36]); prop(h, 'ArmChair_01', -3.2, -0.6, Math.PI / 2, 1, 0.13, 0.4); prop(h, 'wooden_bookshelf_worn', 0.6, -2.6, 0, 1, 0.13, [0.7, 0.3]); prop(h, 'electric_stove', 3.5, -2.4, 0, 1, 0.13, [0.26, 0.32]);
        prop(h, 'dining_table', 2.3, 0.2, Math.PI / 2, 0.7, 0.13, [0.5, 0.8]); prop(h, 'vintage_electric_kettle', 3.5, -2.4, 0, 0.8, 0.99); prop(h, 'hanging_picture_frame_01', -2.4, -2.88, 0, 1, 1.75);
        item(h, 'can', 2.3, 0.75, 0.2, 0.5); item(h, 'apple', 2.4, 0.75, 0.6); item(h, 'can', 0.6, 1.2, -2.6, 0.2);
        emit(h, 0, 2.2, 0, 0xffb060, 7, 10, 'warm');
      },
      s => { // Wohnhaus C
        const h = house(g, s.lx, s.lz, s.ry, { w: 6.4, d: 6, wall: mats.planks, front: [{ x: -1.4, w: 1.1, door: true }, { x: 1.4, w: 1.1 }], left: [{ x: 0, w: 1.0 }], name: 'house' });
        prop(h, 'GothicBed_01', 1.8, -1.7, 0, 1, 0.13, [0.75, 1.05]); prop(h, 'painted_wooden_cabinet', -2.2, -2.5, 0, 1, 0.13, [0.6, 0.3]); prop(h, 'ornate_mirror_01', -3.08, 0.6, Math.PI / 2, 1.3, 1.6); prop(h, 'painted_wooden_chair_01', -2.4, 1.6, 2.2, 1, 0.13);
        item(h, 'apple', -2.2, 1.32, -2.5); item(h, 'ammo', -2.5, 1.32, -2.45, 1.2); item(h, 'longlife', 0.2, 0.15, -2.4, 0.4);
      },
      s => { // Wohnhaus D
        const h = house(g, s.lx, s.lz, s.ry, { w: 7, d: 5.6, wall: mats.plasterY, front: W1, back: [{ x: -1, w: 1.0 }], chimney: true, name: 'house' });
        prop(h, 'vintage_day_bed', 2.2, -2.2, 0, 1, 0.13, [1.0, 0.45]); prop(h, 'WoodenTable_01', -1.8, -2.2, 0, 1, 0.13, [0.9, 0.33]); prop(h, 'ArmChair_01', -2.6, 0.8, 1.2, 1, 0.13, 0.4); prop(h, 'hanging_picture_frame_01', 0.4, -2.68, 0, 1, 1.7);
        item(h, 'can', -1.8, 0.69, -2.2, 0.5); item(h, 'fuel', -3.0, 0.13, 2.0, 0.6);
      },
    ];
    slots.slice(0, builders.length).forEach((s, i) => builders[i](s));
    // Dorfplatz
    const free = [];
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, lx = Math.sin(a) * 9.5, lz = Math.cos(a) * 9.5, w = toWorld(g, lx, lz), rn = world.roadNear(w.x, w.z); if (!rn || rn.d > rn.s.w + 2.5) free.push({ lx, lz, a }); }
    if (free[0]) { const f = free[0]; const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.9, 16, 1, true), mats.brick); well.material = mats.brick.clone(); well.material.side = THREE.DoubleSide; add(g, well, f.lx, 0.45, f.lz); const wt = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16), mats.dark); wt.rotation.x = -Math.PI / 2; add(g, wt, f.lx, 0.3, f.lz); const w = toWorld(g, f.lx, f.lz); world.addCircle(w.x, w.z, 1.15); }
    if (free[2]) { const f = free[2]; prop(g, 'street_lamp_01', f.lx, f.lz, f.a, 1.25, 0, 0.2); emit(g, f.lx, 4.4, f.lz, 0xffd9a0, 22, 22, 'lamp'); }
    if (free[4]) { const f = free[4]; prop(g, 'wooden_picnic_table', f.lx, f.lz, f.a, 0.8, 0, [0.9, 1.2]); item(g, 'apple', f.lx, 0.61, f.lz); }
    if (free[6]) { const f = free[6]; prop(g, 'painted_wooden_bench', f.lx, f.lz, f.a + Math.PI, 1.2, 0, [0.7, 0.3]); }
  }

  // ================= VERLASSENES CAMP =================
  {
    const g = site(world.pois.camp);
    const tent = (x, z, ry, mat, s = 1) => {
      const w = 1.3 * s, h = 1.45 * s, l = 2.6 * s;
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, -l / 2, 0, h, -l / 2, 0, h, l / 2, -w, 0, -l / 2, 0, h, l / 2, -w, 0, l / 2, w, 0, -l / 2, 0, h, l / 2, 0, h, -l / 2, w, 0, -l / 2, w, 0, l / 2, 0, h, l / 2, -w, 0, -l / 2, w, 0, -l / 2, 0, h, -l / 2], 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, z); m.rotation.y = ry; g.add(m); const wp = toWorld(g, x, z); world.addBox(wp.x, wp.z, w * 0.9, l / 2, g.userData.ry + ry);
    };
    tent(-5, -3, 0.5, mats.tent); tent(4.5, -5, -0.7, mats.tent2, 1.15);
    prop(g, 'stone_fire_pit', 0, -2, 0, 1, 0, 0.6);
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), new THREE.MeshBasicMaterial({ color: 0xff6a1a })); em.rotation.x = -Math.PI / 2; add(g, em, 0, 0.18, -2);
    fx.embers = { light: emit(g, 0, 0.7, -2, 0xff7a30, 8, 12, 'fire'), mesh: em };
    prop(g, 'plastic_crate_03', 1.6, -3.2, 0.5); prop(g, 'tree_stump_01', -1.8, -1.2, 0, 0.8, 0, 0.3);
    item(g, 'apple', 1.6, 0.36, -3.2); item(g, 'can', -4.2, 0.0, -1.4, 0.4); item(g, 'note', -3.2, 0.03, -1.6, 0.4, { note: 'camp' }); item(g, 'can', 5.0, 0.0, -2.9, 2); item(g, 'ammo', 3.4, 0.0, -3.4, 1);
  }

  // ================= Verstreutes entlang der Ringstraße =================
  {
    const R = [[20, 'can'], [85, 'apple'], [150, 'can'], [178, 'fuel'], [232, 'apple'], [272, 'ammo'], [330, 'longlife'], [5, 'fuel'], [100, 'longlife'], [200, 'can'], [315, 'apple'], [140, 'apple']];
    const loop = world.roads[0].pts;
    R.forEach(([deg, type], i) => {
      const p = loop[Math.floor(deg / 360 * loop.length)], l = Math.hypot(p.x, p.z), side = i % 2 ? 1 : -1, dd = 6 + (i % 3) * 4;
      const x = p.x + p.x / l * side * dd, z = p.z + p.z / l * side * dd;
      if (world.getHeight(x, z) < 2 || !world.clearOfPois(x, z, 3)) return; const rn = world.roadNear(x, z); if (rn && rn.d < rn.s.w + 1) return;
      const c = M.plastic_crate_03.clone(); c.position.set(x, world.getHeight(x, z), z); c.rotation.y = i; scene.add(c); world.addCircle(x, z, 0.3);
      item(null, type, x, type === 'fuel' ? 0 : 0.34, z + (type === 'fuel' ? 0.6 : 0), i);
    });
  }
  return { items, fx, mats };
}
