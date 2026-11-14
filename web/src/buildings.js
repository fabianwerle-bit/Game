import * as THREE from 'three';

// Box mit sauber gekachelten UVs (tile = Meter pro Texturwiederholung)
export function texBox(w, h, d, mat, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return new THREE.Mesh(g, mat);
}
const std = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t.d, normalMap: t.n, roughness: 0.85, ...o });
function signTex(text, fg = '#f2efe4', bg = '#7a1c16') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 96); x.fillStyle = fg; x.font = 'bold 62px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createBuildings(assets, world, scene) {
  const { T, M } = assets, items = [], fx = { flicker: [], beam: null, windows: [], embers: null, emitters: [] };
  // Lichtquellen werden nur registriert – main.js legt EIN echtes Punktlicht auf die nächstgelegene (Performance)
  const emit = (g, x, y, z, color, intensity, dist, tag) => { g.updateMatrixWorld(true); const e = { pos: g.localToWorld(new THREE.Vector3(x, y, z)), color: new THREE.Color(color), base: intensity, k: 1, dist, tag }; fx.emitters.push(e); return e; };
  const mats = {
    plaster: std(T.white_plaster_rough_01, { color: new THREE.Color(1.3, 1.42, 1.8) }), concrete: std(T.concrete_floor_worn_001), iron: std(T.corrugated_iron_02, { metalness: 0.5, roughness: 0.6 }),
    planks: std(T.weathered_planks), deck: std(T.wood_planks_grey), shutter: std(T.rusty_metal_shutter, { metalness: 0.4 }), roof: std(T.grey_roof_tiles),
    paint: std(T.rusty_painted_metal, { metalness: 0.4, roughness: 0.6 }), brick: std(T.red_brick), tiles: new THREE.MeshStandardMaterial({ map: T.tiles.d, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1a2224, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.7 }), steel: new THREE.MeshStandardMaterial({ color: 0x8b9094, roughness: 0.45, metalness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: 0xcfd2cf, roughness: 0.7 }), red: new THREE.MeshStandardMaterial({ color: 0x7a1c16, roughness: 0.6 }),
    tent: new THREE.MeshStandardMaterial({ color: 0x5c6b4a, roughness: 0.95, side: THREE.DoubleSide }), tent2: new THREE.MeshStandardMaterial({ color: 0x9a5a2a, roughness: 0.95, side: THREE.DoubleSide }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 1 }),
  };
  const site = p => { const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.face; scene.add(g); g.userData.p = p; return g; };
  const toWorld = (g, lx, lz) => { const r = g.rotation.y, c = Math.cos(r), s = Math.sin(r); return { x: g.position.x + lx * c + lz * s, z: g.position.z - lx * s + lz * c }; };
  const add = (g, mesh, x, y, z, solid) => { mesh.position.set(x, y, z); g.add(mesh); if (solid) { const p = mesh.geometry.parameters, w = toWorld(g, x, z); world.addBox(w.x, w.z, p.width / 2, p.depth / 2, g.rotation.y + mesh.rotation.y); } return mesh; };
  const prop = (g, name, x, z, ry = 0, s = 1, y = 0, solidR = 0) => { const o = M[name].clone(); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); if (solidR) { const w = toWorld(g, x, z); world.addCircle(w.x, w.z, solidR); } return o; };
  const ITEM = { can: ['russian_food_cans_01', 2.2, 'Konserven'], longlife: ['long_life_food', 1.2, 'Notration'], apple: ['food_apple_01', 2.0, 'Apfel'], fuel: ['metal_jerrycan_green', 1.0, 'Benzinkanister'] };
  const item = (g, type, x, y, z, ry = 0) => {
    const o = M[ITEM[type][0]].clone(); o.scale.setScalar(ITEM[type][1]); o.rotation.y = ry;
    if (g) { o.position.set(x, y, z); g.add(o); g.updateMatrixWorld(true); } else { o.position.set(x, world.getHeight(x, z) + y, z); scene.add(o); }
    const wp = o.getWorldPosition(new THREE.Vector3());
    items.push({ id: items.length, type, name: ITEM[type][2], obj: o, pos: wp }); return o;
  };

  // ================= TANKSTELLE =================
  {
    const g = site(world.pois.station), W = 12, D = 7, Hh = 3.3, zc = -8;
    const slab = texBox(34, 0.3, 26, mats.concrete, 3); slab.material = mats.concrete.clone(); slab.material.polygonOffset = true; slab.material.polygonOffsetFactor = -1; slab.material.polygonOffsetUnits = -1;
    add(g, slab, 0, -0.09, 0);
    add(g, texBox(W, Hh, 0.25, mats.plaster), 0, Hh / 2, zc - D / 2, true);            // Rückwand
    add(g, texBox(0.25, Hh, D, mats.plaster), -W / 2, Hh / 2, zc, true);                // Seiten
    add(g, texBox(0.25, Hh, D, mats.plaster), W / 2, Hh / 2, zc, true);
    const zf = zc + D / 2;
    add(g, texBox(1.6, Hh, 0.25, mats.plaster), -5.2, Hh / 2, zf, true);                // links der Tür
    add(g, texBox(1.5, Hh - 2.2, 0.25, mats.plaster), -3.65, 2.2 + (Hh - 2.2) / 2, zf); // Türsturz
    add(g, texBox(8.9, 0.9, 0.25, mats.brick), 1.55, 0.45, zf, true);                   // Brüstung
    add(g, texBox(8.9, Hh - 2.5, 0.25, mats.plaster), 1.55, 2.5 + (Hh - 2.5) / 2, zf);
    add(g, new THREE.Mesh(new THREE.PlaneGeometry(8.9, 1.6), mats.glass), 1.55, 1.7, zf);
    for (const x of [-2.9, 1.55, 6.0]) add(g, texBox(0.08, 1.6, 0.12, mats.dark), x, 1.7, zf);
    add(g, texBox(W + 1.2, 0.3, D + 1.6, mats.concrete, 3), 0, Hh + 0.15, zc + 0.3);     // Dach
    add(g, texBox(W + 1.3, 0.55, 0.1, mats.red), 0, Hh + 0.05, zc + D / 2 + 1.12);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.95), new THREE.MeshStandardMaterial({ map: signTex('TANKSTELLE'), emissiveMap: signTex('TANKSTELLE', '#fff', '#300'), emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.5 }));
    add(g, sign, 1.5, Hh + 0.75, zc + D / 2 + 1.0); fx.flicker.push({ mat: sign.material, base: 1.2 });
    add(g, texBox(5.4, 1.15, 0.15, mats.dark), 1.5, Hh + 0.75, zc + D / 2 + 0.9);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, D - 0.3), mats.tiles); floor.rotation.x = -Math.PI / 2; T.tiles.d.repeat.set(6, 4); add(g, floor, 0, 0.08, zc);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mats.white); ceil.rotation.x = Math.PI / 2; add(g, ceil, 0, Hh - 0.01, zc);
    // Innen: Tresen, Regale, Neonröhre
    add(g, texBox(2.6, 1.0, 0.7, mats.planks), 3.9, 0.5, zc - 1.6, true);
    add(g, texBox(0.5, 0.35, 0.4, mats.dark), 4.4, 1.18, zc - 1.6);
    const shelfS = 0.09;
    for (const [x, z, r] of [[-1.6, zc - 0.4, 0], [0.9, zc - 0.4, 0], [-4.2, zc - 3.0, 0], [-1.2, zc - 3.05, 0], [1.6, zc - 3.05, 0]]) {
      prop(g, 'steel_frame_shelves_01', x, z, r, shelfS, 0.08); const w = toWorld(g, x, z); world.addBox(w.x, w.z, 0.5, 0.24, g.rotation.y + r);
    }
    const tube = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.14), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeaff, emissiveIntensity: 2.5 }));
    add(g, tube, 0, Hh - 0.08, zc - 0.5); fx.flicker.push({ mat: tube.material, base: 2.5 });
    emit(g, 0, Hh - 0.5, zc - 0.5, 0xdfe8ff, 16, 16, 'station');
    item(g, 'can', -1.6, 1.07, zc - 0.4); item(g, 'can', 0.9, 0.59, zc - 0.4, 1.2); item(g, 'longlife', -1.2, 1.07, zc - 3.05); item(g, 'can', 1.6, 1.55, zc - 3.05, 2);
    item(g, 'longlife', 3.6, 1.02, zc - 1.6, 0.5); item(g, 'can', -4.2, 0.59, zc - 3.0, 0.4); item(g, 'apple', 4.5, 1.03, zc - 1.5);
    prop(g, 'cardboard_box_01', -4.6, zc + 1.2, 0.4, 1, 0.08); prop(g, 'plastic_crate_03', 5.0, zc + 2.2, 0.2, 1, 0.08);
    // Vordach + Zapfsäulen
    const cz = 4.5, ch = 4.7;
    for (const [x, z] of [[-5, cz - 3], [5, cz - 3], [-5, cz + 3], [5, cz + 3]]) { const c = add(g, texBox(0.3, ch, 0.3, mats.white), x, ch / 2, z); const w = toWorld(g, x, z); world.addCircle(w.x, w.z, 0.25); }
    add(g, texBox(13, 0.5, 9, mats.iron, 2.5), 0, ch + 0.25, cz);
    add(g, texBox(13.1, 0.6, 0.08, mats.red), 0, ch + 0.25, cz + 4.52); add(g, texBox(13.1, 0.6, 0.08, mats.red), 0, ch + 0.25, cz - 4.52);
    add(g, texBox(0.08, 0.6, 9.1, mats.red), 6.52, ch + 0.25, cz); add(g, texBox(0.08, 0.6, 9.1, mats.red), -6.52, ch + 0.25, cz);
    for (const x of [-2.6, 2.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe6eeff, emissiveIntensity: 2.2 })); add(g, l, x, ch - 0.02, cz); fx.flicker.push({ mat: l.material, base: 2.2, slow: x > 0 }); }
    emit(g, 0, ch - 0.6, cz, 0xe0e8ff, 30, 28, 'station');
    add(g, texBox(7, 0.2, 1.3, mats.concrete), 0, 0.14, cz);
    for (const x of [-2, 2]) {
      add(g, texBox(0.95, 1.55, 0.5, mats.paint, 1.2), x, 0.98, cz, true);
      add(g, texBox(0.99, 0.3, 0.54, mats.dark), x, 1.9, cz);
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshStandardMaterial({ color: 0x0a0f0a, emissive: 0x3cff6a, emissiveIntensity: 0.35 })); add(g, disp, x, 1.4, cz + 0.26); fx.flicker.push({ mat: disp.material, base: 0.35 });
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.022, 6, 14, Math.PI), mats.dark); hose.rotation.z = Math.PI; hose.rotation.y = Math.PI / 2; add(g, hose, x + 0.5, 1.0, cz);
    }
    // Garage + Kram
    add(g, texBox(4.2, 2.9, 0.2, mats.shutter, 3), -8.4, 1.45, zc + 2.8, true); add(g, texBox(0.25, 3.1, 6, mats.plaster), -10.5, 1.55, zc, true); add(g, texBox(4.5, 0.25, 6.3, mats.iron), -8.3, 3.1, zc);
    add(g, texBox(4.2, 3.1, 0.25, mats.plaster), -8.4, 1.55, zc - 3, true);
    prop(g, 'covered_car', 10.5, -5.5, 0.3, 1, 0.06, 0); { const w = toWorld(g, 10.5, -5.5); world.addBox(w.x, w.z, 1.0, 2.3, g.rotation.y + 0.3); }
    prop(g, 'old_tyre', -6.6, -3.9, 0, 1, 0.06); prop(g, 'old_tyre', -6.9, -3.6, 1, 1, 0.3); prop(g, 'Barrel_01', -11.6, -5.2, 0, 1, 0.06, 0.35); prop(g, 'Barrel_01', -12.3, -4.4, 2, 1, 0.06, 0.35);
    prop(g, 'metal_trash_can', 6.6, -4.2, 0, 1, 0.06, 0.3); prop(g, 'propane_tank', 7.4, -4.25, 0, 1, 0.06, 0.2); prop(g, 'utility_box_01', -6.3, -4.38, 0, 1, 1.0);
    prop(g, 'street_lamp_02', 13, 9.5, 2.2, 1, 0, 0.2);
    item(g, 'fuel', -6.2, 0.06, -3.1, 0.6); item(g, 'fuel', 2.9, 0.24, cz + 0.2, 2.0); item(g, 'fuel', -12.0, 0.06, -3.4, 1.1);
    world.pois.station.g = g;
  }

  // ================= HÜTTE =================
  {
    const g = site(world.pois.cabin), W = 6, D = 5, Hh = 2.5;
    add(g, texBox(W + 0.2, 0.25, D + 0.2, mats.deck), 0, 0.02, -1.5);
    add(g, texBox(W, Hh, 0.2, mats.planks), 0, Hh / 2, -4, true); add(g, texBox(0.2, Hh, D, mats.planks), -3, Hh / 2, -1.5, true); add(g, texBox(0.2, Hh, D, mats.planks), 3, Hh / 2, -1.5, true);
    add(g, texBox(1.9, Hh, 0.2, mats.planks), -2.05, Hh / 2, 1, true); add(g, texBox(2.9, Hh, 0.2, mats.planks), 1.55, Hh / 2, 1, true); add(g, texBox(1.2, Hh - 2.05, 0.2, mats.planks), -0.5, 2.05 + (Hh - 2.05) / 2, 1);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8), new THREE.MeshStandardMaterial({ color: 0x221a10, emissive: 0xffb45a, emissiveIntensity: 1.6, roughness: 0.3 })); add(g, win, 1.7, 1.5, 1.11); fx.windows.push(win.material);
    add(g, texBox(1.16, 0.96, 0.06, mats.dark), 1.7, 1.5, 1.08);
    for (const s of [-1, 1]) { const r = texBox(W + 0.9, 0.14, 3.6, mats.roof, 1.6); r.rotation.x = s * 0.6; add(g, r, 0, Hh + 0.85, -1.5 + s * 1.42); }
    for (const z of [-4, 1]) { const tri = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-3, 0, 0, 3, 0, 0, 0, 1.95, 0], 3)), new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1, side: THREE.DoubleSide })); tri.geometry.computeVertexNormals(); add(g, tri, 0, Hh, z); }
    add(g, texBox(0.6, 1.6, 0.6, mats.brick, 1), 1.8, Hh + 1.3, -2.6);
    add(g, texBox(W + 0.2, 0.2, 1.8, mats.deck), 0, 0.05, 2.0);                          // Veranda
    for (const x of [-2.9, 2.9]) add(g, texBox(0.14, 2.3, 0.14, mats.planks), x, 1.15, 2.8);
    add(g, texBox(2.0, 0.5, 0.95, mats.fabric), -1.9, 0.4, -3.3, true); add(g, texBox(1.1, 0.75, 0.7, mats.planks), 2.3, 0.5, -3.4, true);
    prop(g, 'vintage_oil_lamp', 2.3, -3.4, 0, 1.3, 0.88); fx.windows.push(emit(g, 2.0, 1.4, -3.0, 0xffa850, 6, 9, 'cabin'));
    item(g, 'can', 2.5, 0.88, -3.3, 1); item(g, 'longlife', -2.5, 0.16, -1.2, 0.3); item(g, 'apple', 2.0, 0.88, -3.6); item(g, 'can', -2.6, 0.16, 0.2, 2);
    prop(g, 'Barrel_01', 4.3, 0.5, 0.4, 1, 0, 0.35); prop(g, 'tree_stump_01', -4.6, 2.4, 0, 1, 0, 0.4); item(g, 'fuel', 3.6, 0.0, 2.4, 0.5);
  }

  // ================= LEUCHTTURM =================
  {
    const g = site(world.pois.light), th = 17;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.9, th, 24, 1), mats.plaster.clone()); tower.material.color.setRGB(1.45, 1.58, 2.0); T.white_plaster_rough_01.d.repeat.set(1, 1);
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
    add(g, texBox(5, 2.8, 4, mats.plaster), 4.6, 1.4, -3, true); const r = texBox(5.6, 0.16, 4.8, mats.roof, 1.6); r.rotation.z = -0.18; add(g, r, 4.6, 3.1, -3);
    add(g, texBox(1.0, 2.0, 0.08, mats.shutter, 2), 4.6, 1.0, -0.97);
    prop(g, 'lifebuoy', 3.0, -0.93, 0, 1.2, 1.3); prop(g, 'Barrel_01', 7.6, -1.5, 0, 1, 0, 0.35);
    item(g, 'can', 6.2, 0.0, -0.5, 0.7); item(g, 'longlife', -3.4, 0.0, -1.2, 0.2); item(g, 'fuel', 7.9, 0.0, -0.4, 1.4);
  }

  // ================= STEG + BOOTSSCHUPPEN =================
  {
    const g = site(world.pois.pier), L = 34, y = 0.25;
    add(g, texBox(3, 0.16, L, mats.deck, 1.5), 0, y, -L / 2 + 1);
    for (let z = 0; z > -L; z -= 4) for (const x of [-1.35, 1.35]) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 6, 6), mats.planks), x, -2.4, z);
    for (let z = -2; z > -L; z -= 6) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), mats.planks), 1.4, y + 0.6, z);
    { const c = toWorld(g, 0, -L / 2 + 1); world.platforms.push({ x: c.x, z: c.z, hw: 1.5, hd: L / 2, c: Math.cos(g.rotation.y), s: Math.sin(g.rotation.y), y: world.pois.pier.y + y + 0.08 }); }
    add(g, texBox(4, 2.6, 0.12, mats.iron), -6, 1.3, 0.5, true); add(g, texBox(0.12, 2.6, 5, mats.iron), -8, 1.3, 3, true); add(g, texBox(0.12, 2.6, 5, mats.iron), -4, 1.3, 3, true);
    const rf = texBox(4.6, 0.1, 5.6, mats.iron); rf.rotation.z = 0.14; add(g, rf, -6, 2.8, 3);
    prop(g, 'Barrel_01', -6.9, 2.2, 1, 1, 0, 0.35); prop(g, 'Barrel_01', -7.0, 3.1, 2, 1, 0, 0.35); prop(g, 'lifebuoy', -3.92, 3, Math.PI / 2, 1.2, 1.4); prop(g, 'plastic_crate_03', -5.2, 3.6, 0.4);
    item(g, 'can', -5.2, 0.32, 3.6); item(g, 'longlife', 0.5, y + 0.09, -L + 2.5, 1); item(g, 'apple', -6.2, 0.0, 4.2); item(g, 'fuel', -5.0, 0.0, 1.4, 0.3);
  }

  // ================= CAMP (Start) =================
  {
    const g = site(world.pois.camp);
    const tent = (x, z, ry, mat, s = 1) => {
      const w = 1.3 * s, h = 1.45 * s, l = 2.6 * s;
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, -l / 2, 0, h, -l / 2, 0, h, l / 2, -w, 0, -l / 2, 0, h, l / 2, -w, 0, l / 2, w, 0, -l / 2, 0, h, l / 2, 0, h, -l / 2, w, 0, -l / 2, w, 0, l / 2, 0, h, l / 2, -w, 0, -l / 2, w, 0, -l / 2, 0, h, -l / 2], 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, z); m.rotation.y = ry; g.add(m); const wp = toWorld(g, x, z); world.addBox(wp.x, wp.z, w * 0.9, l / 2, g.rotation.y + ry);
    };
    tent(-5, -3, 0.5, mats.tent); tent(4.5, -5, -0.7, mats.tent2, 1.15);
    prop(g, 'stone_fire_pit', 0, -2, 0, 1, 0, 0.6);
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), new THREE.MeshBasicMaterial({ color: 0xff6a1a })); em.rotation.x = -Math.PI / 2; add(g, em, 0, 0.18, -2);
    fx.embers = { light: emit(g, 0, 0.7, -2, 0xff7a30, 8, 12, 'camp'), mesh: em };
    prop(g, 'plastic_crate_03', 1.6, -3.2, 0.5); prop(g, 'tree_stump_01', -1.8, -1.2, 0, 0.8, 0, 0.3); prop(g, 'covered_car', 9.5, -2.5, 1.2, 1, 0); { const w = toWorld(g, 9.5, -2.5); world.addBox(w.x, w.z, 1.0, 2.3, g.rotation.y + 1.2); }
    item(g, 'apple', 1.6, 0.36, -3.2); item(g, 'can', -4.2, 0.0, -1.4, 0.4); item(g, 'apple', -1.8, 0.0, -2.4); item(g, 'can', 5.0, 0.0, -2.9, 2);
  }

  // ================= Verstreutes entlang der Insel =================
  {
    const R = [[20, 0.5, 'can'], [85, 0.63, 'apple'], [150, 0.5, 'can'], [178, 0.66, 'fuel'], [232, 0.47, 'apple'], [272, 0.66, 'can'], [330, 0.5, 'longlife'], [5, 0.7, 'fuel'], [100, 0.4, 'longlife'], [200, 0.36, 'can'], [315, 0.3, 'apple'], [140, 0.75, 'apple']];
    const loop = world.roads[0].pts;
    R.forEach(([deg, off, type], i) => {
      const p = loop[Math.floor(deg / 360 * loop.length)], l = Math.hypot(p.x, p.z), side = i % 2 ? 1 : -1, dd = 6 + (i % 3) * 4;
      const x = p.x + p.x / l * side * dd, z = p.z + p.z / l * side * dd;
      if (world.getHeight(x, z) < 2) return;
      const c = M.plastic_crate_03.clone(); c.position.set(x, world.getHeight(x, z), z); c.rotation.y = i; scene.add(c); world.addCircle(x, z, 0.3);
      item(null, type, x, type === 'fuel' ? 0 : 0.34, z + (type === 'fuel' ? 0.6 : 0), i);
    });
  }
  return { items, fx, mats };
}
