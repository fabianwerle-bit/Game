import * as THREE from 'three';
import { loadAssets } from './assets.js';
import { createWorld } from './world.js';
import { createScenery } from './scenery.js';
import { createBuildings } from './buildings.js';
import { createBus } from './bus.js';
import { createWeather } from './weather.js';
import { createAudio } from './audio.js';

const $ = id => document.getElementById(id);
const canvas = $('c');
const QUAL = [['Niedrig', 1], ['Mittel', 1.5], ['Hoch', 2]];
let qual = +(localStorage.getItem('la_q') ?? 1), dynScale = 1;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const applyQual = () => { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUAL[qual][1]) * dynScale); renderer.setSize(innerWidth, innerHeight, false); $('qv').textContent = QUAL[qual][0]; };
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 1200);
camera.rotation.order = 'YXZ'; scene.add(camera);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyQual(); });
applyQual();

const SAVE = 'la_save1';
const WAKE = {
  2: 'Der Morgen ist grau. Die Vögel sind leiser als gestern.',
  3: 'Es regnet. Das Lagerfeuer ist aus. Du hast niemanden wegfahren hören.',
  4: 'In der Nacht hat etwas am Bus gekratzt. Der Nebel steht zwischen den Bäumen.',
  5: 'Du hast kaum geschlafen. Draußen hat jemand deinen Namen gesagt.',
  6: 'Es wird nicht mehr richtig hell.',
};
const FOOD = { apple: 12, can: 26, longlife: 40 };

(async function boot() {
  const audio = createAudio();
  let assets;
  try { assets = await loadAssets(renderer, p => { $('load').firstElementChild.style.width = (p * 100).toFixed(0) + '%'; }); }
  catch (e) { $('sub').textContent = 'Fehler beim Laden: ' + (e?.message || e); throw e; }
  scene.environment = assets.env;
  const world = createWorld(assets, scene);
  const scenery = createScenery(assets, world, scene);
  const built = createBuildings(assets, world, scene);
  const bus = createBus(scene, world, assets);
  const weather = createWeather(scene, renderer, world, scenery);
  const items = built.items, fx = built.fx;

  // --- Lichter: Taschenlampe + EIN wanderndes Punktlicht ---
  const torch = new THREE.SpotLight(0xfff1d6, 0, 42, 0.42, 0.5, 1.4); torch.position.set(0.25, -0.2, 0.1); camera.add(torch); torch.target.position.set(0, -0.05, -6); camera.add(torch.target);
  const local = new THREE.PointLight(0xffffff, 0, 20, 1.6); scene.add(local);

  // --- Die Gestalt ---
  const figM = new THREE.MeshBasicMaterial({ color: 0x020203 });
  const fig = new THREE.Group(); scene.add(fig); fig.visible = false;
  { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.25, 4, 8), figM); b.position.y = 1.35; fig.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), figM); h.position.y = 2.3; fig.add(h);
    for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 1.15, 3, 6), figM); a.position.set(s * 0.33, 1.3, 0); a.rotation.z = s * 0.06; fig.add(a); const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.8, 3, 6), figM); l.position.set(s * 0.13, 0.45, 0); fig.add(l); } }
  const figure = { t: 30, life: 0, d0: 0 };

  // --- Spielzustand ---
  const camp = world.pois.camp, loopPts = world.roads[0].pts;
  const startBus = () => { let b = 0, bd = 1e9; loopPts.forEach((p, i) => { const d = (p.x - camp.x) ** 2 + (p.z - camp.z) ** 2; if (d < bd) { bd = d; b = i; } }); const p = loopPts[b], q = loopPts[(b + 1) % loopPts.length]; const l = Math.hypot(p.x, p.z); return { x: p.x - p.x / l * 5.6, z: p.z - p.z / l * 5.6, h: Math.atan2(q.x - p.x, q.z - p.z) }; };
  const fresh = () => { const b = startBus(); return { day: 1, hour: 8.5, hunger: 78, fuel: 46, inv: { apple: 0, can: 0, longlife: 0 }, picked: [], bus: b, pl: { x: camp.x + Math.sin(camp.face) * 3, z: camp.z + Math.cos(camp.face) * 3, yaw: camp.face + Math.PI }, inBus: false, lights: false, torch: false }; };
  let S = fresh();
  const pl = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0, bob: 0, look: 0 };
  let mode = 'menu', busy = false, tSave = 0, tHud = 0, target = null, dread = 0;
  const applyState = () => {
    bus.place(S.bus.x, S.bus.z, S.bus.h); bus.fuel = S.fuel; bus.lights = S.lights;
    pl.x = S.pl.x; pl.z = S.pl.z; pl.yaw = S.pl.yaw; pl.pitch = 0; pl.look = 0;
    for (const it of items) it.obj.visible = !S.picked.includes(it.id);
    mode = S.inBus ? 'drive' : 'walk';
  };
  const save = () => { S.bus = { x: bus.x, z: bus.z, h: bus.heading }; S.fuel = bus.fuel; S.lights = bus.lights; S.pl = { x: pl.x, z: pl.z, yaw: pl.yaw }; S.inBus = mode === 'drive'; try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch { } };

  // --- Anzeige ---
  let msgT = 0;
  const say = (t, sec = 6) => { const m = $('msg'); m.textContent = t; m.style.opacity = 1; msgT = sec; };
  const show = (id, on) => { $(id).style.display = on ? 'flex' : 'none'; };
  const hud = () => {
    const h = Math.floor(S.hour), m = Math.floor((S.hour - h) * 60);
    $('day').textContent = `Tag ${S.day} · ${String(h % 24).padStart(2, '0')}:${String(m - m % 10).padStart(2, '0')}`;
    $('hHunger').style.width = S.hunger + '%'; $('hHunger').style.background = S.hunger < 22 ? '#c2543e' : '#d8d2c0';
    $('hFuel').style.width = bus.fuel + '%'; $('hFuel').style.background = bus.fuel < 12 ? '#c2543e' : '#d8d2c0';
    const n = S.inv.apple + S.inv.can + S.inv.longlife;
    $('inv').textContent = n ? `Vorrat: ${[S.inv.can && S.inv.can + '× Konserven', S.inv.longlife && S.inv.longlife + '× Notration', S.inv.apple && S.inv.apple + '× Apfel'].filter(Boolean).join(' · ')}` : 'Vorrat: leer';
    const drive = mode === 'drive';
    show('bGas', drive); show('bBrk', drive); show('bLamp', mode !== 'menu'); show('bEat', mode !== 'menu' && n > 0);
    show('bSleep', drive && Math.abs(bus.v) < 0.5);
    $('bLamp').classList.toggle('on', drive ? bus.lights : S.torch);
    document.body.classList.toggle('drive', drive);
  };

  // --- Eingabe ---
  const inp = { mx: 0, mz: 0, gas: 0, brake: 0, keys: {} };
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
  const stick = $('stick'), knob = stick.firstElementChild;
  canvas.addEventListener('pointerdown', e => {
    if (mode === 'menu') return; audio.init();
    if (e.pointerType === 'mouse') { canvas.requestPointerLock?.(); return; }
    if (e.clientX < innerWidth * 0.42 && stickId === null) { stickId = e.pointerId; sx = e.clientX; sy = e.clientY; stick.style.display = 'block'; stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; knob.style.transform = ''; }
    else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
    canvas.setPointerCapture(e.pointerId);
  });
  const look = (dx, dy) => { const k = 0.0042; if (mode === 'drive') { pl.look = Math.max(-2.3, Math.min(2.3, pl.look - dx * k)); } else pl.yaw -= dx * k; pl.pitch = Math.max(-1.35, Math.min(1.35, pl.pitch - dy * k)); };
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) { let dx = e.clientX - sx, dy = e.clientY - sy; const l = Math.hypot(dx, dy), R = 55; if (l > R) { dx *= R / l; dy *= R / l; } inp.mx = dx / R; inp.mz = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === lookId) { look(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; }
  });
  const up = e => { if (e.pointerId === stickId) { stickId = null; inp.mx = inp.mz = 0; stick.style.display = 'none'; } if (e.pointerId === lookId) lookId = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) look(e.movementX * 0.6, e.movementY * 0.6); });
  addEventListener('keydown', e => { inp.keys[e.code] = 1; if (mode === 'menu' || e.repeat) return; if (e.code === 'KeyE') act(); if (e.code === 'KeyF') lamp(); if (e.code === 'KeyQ') eat(); if (e.code === 'KeyR') sleep(); });
  addEventListener('keyup', e => { inp.keys[e.code] = 0; });
  const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); audio.init(); fn(); });
  const hold = (id, key) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); inp[key] = 1; el.classList.add('on'); }); const off = () => { inp[key] = 0; el.classList.remove('on'); }; el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); };
  hold('bGas', 'gas'); hold('bBrk', 'brake');

  // --- Aktionen ---
  function act() {
    if (busy) return;
    if (mode === 'drive') {
      if (Math.abs(bus.v) > 1) return say('Erst anhalten.', 2);
      const c = Math.cos(bus.heading), s = Math.sin(bus.heading);
      for (const side of [1.75, -1.75]) { const p = { x: bus.x + c * side, z: bus.z - s * side }; if (world.ground(p.x, p.z) > 0.5 && !world.collide({ ...p }, 0.3)) { pl.x = p.x; pl.z = p.z; pl.yaw = bus.heading + Math.PI + pl.look; pl.look = 0; mode = 'walk'; audio.door(); hud(); return; } }
      return say('Hier ist kein Platz zum Aussteigen.', 2);
    }
    if (target?.item) {
      const it = target.item; it.obj.visible = false; S.picked.push(it.id); audio.blip(it.type === 'fuel' ? 440 : 700);
      if (it.type === 'fuel') { bus.fuel = Math.min(100, bus.fuel + 28); say('Benzinkanister – in den Bus gekippt.', 3); }
      else { S.inv[it.type]++; say(it.name + ' eingesteckt.', 2); }
      hud();
    } else if (target?.bus) { mode = 'drive'; pl.look = 0; pl.pitch = 0; audio.door(); hud(); if (bus.fuel <= 0) say('Der Tank ist leer.', 3); }
  }
  function lamp() { if (mode === 'drive') bus.lights = !bus.lights; else S.torch = !S.torch; audio.blip(240); hud(); }
  function eat() {
    const need = 100 - S.hunger, order = ['apple', 'can', 'longlife'];
    let pick = order.find(k => S.inv[k] && FOOD[k] >= need) || order.slice().reverse().find(k => S.inv[k]);
    if (!pick) return;
    if (need < 6) return say('Du hast keinen Hunger.', 2);
    S.inv[pick]--; S.hunger = Math.min(100, S.hunger + FOOD[pick]); audio.blip(520); hud();
  }
  function sleep() {
    if (busy || mode !== 'drive') return;
    if (S.hour < 17 && S.day < 6) return say('Du bist noch nicht müde. (Schlafen ab 17 Uhr)', 3);
    busy = true; $('fade').style.opacity = 1; bus.lights = false;
    setTimeout(() => {
      S.day++; S.hour = 7.5; S.hunger = Math.max(8, S.hunger - 18); figure.t = 25; fig.visible = false;
      // ein paar Äpfel wachsen nach – aber jeden Tag weniger
      items.forEach(it => { if (it.type === 'apple' && S.picked.includes(it.id) && Math.random() < Math.max(0, 0.6 - S.day * 0.12)) { S.picked.splice(S.picked.indexOf(it.id), 1); it.obj.visible = true; } });
      if (S.day >= 4) audio.thud();
      save(); hud(); $('fade').style.opacity = 0; busy = false;
      say(WAKE[Math.min(6, S.day)], 9);
    }, 2600);
  }
  tap('bAct', act); tap('bLamp', lamp); tap('bEat', eat); tap('bSleep', sleep);

  // --- Menü ---
  const hasSave = !!localStorage.getItem(SAVE);
  $('load').style.display = 'none'; $('btns').style.display = 'block';
  $('bStart').textContent = hasSave ? 'WEITER' : 'START'; $('bNew').style.display = hasSave ? '' : 'none';
  const begin = (cont) => {
    audio.init();
    if (cont) { try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE))); } catch { S = fresh(); } } else S = fresh();
    applyState(); $('menu').style.display = 'none'; $('hud').style.display = 'block'; $('cross').style.display = 'block'; hud();
    if (!cont) say('Tag 1. Ein paar ruhige Tage auf der Insel. Die Tankstelle hat einen kleinen Laden – dein Bus steht an der Straße.', 10);
    document.documentElement.requestFullscreen?.().catch(() => { });
  };
  $('bStart').onclick = () => begin(hasSave); $('bNew').onclick = () => begin(false);
  $('q').onclick = () => { dynScale = 1; qual = (qual + 1) % 3; localStorage.setItem('la_q', qual); applyQual(); };

  // --- Schleife ---
  const clock = new THREE.Clock(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), e1 = new THREE.Euler(0, 0, 0, 'YXZ');
  let t = 0, stepAcc = 0, fpsN = 0, fpsT = 0;
  const HOUR = 36; // Sekunden pro Spielstunde
  applyState(); mode = 'menu';
  // Menü-Kamera: Blick übers Camp
  const menuCam = () => { const a = t * 0.03; camera.position.set(camp.x + Math.cos(a) * 26, camp.y + 7, camp.z + Math.sin(a) * 26); camera.lookAt(camp.x, camp.y + 1.5, camp.z); };

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta()); t += dt;
    const k = inp.keys;
    let mx = inp.mx + (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = inp.mz + (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    let indoor = false, moving = 0;
    if (mode === 'menu') { menuCam(); bus.update(dt, 0, 0, 0, false, 0); }
    else {
      S.hour = Math.min(23.99, S.hour + dt / HOUR);
      S.hunger = Math.max(0, S.hunger - dt * (100 / (HOUR * 15.5)));
      if (mode === 'walk') {
        const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
        const sp = (k.ShiftLeft ? 6 : 4.1) * (S.hunger < 15 ? 0.6 : 1), sn = Math.sin(pl.yaw), cs = Math.cos(pl.yaw);
        const dx = (mx * cs + mz * sn) * sp * dt, dz = (-mx * sn + mz * cs) * sp * dt;
        const nx = pl.x + dx, nz = pl.z + dz, p = { x: nx, z: nz };
        world.collide(p, 0.32);
        const gh = world.ground(p.x, p.z), cur = world.ground(pl.x, pl.z);
        if (gh > 0.22 && gh - cur < 0.9) { moving = Math.hypot(p.x - pl.x, p.z - pl.z) / Math.max(dt, 1e-4); pl.x = p.x; pl.z = p.z; }
        pl.y += (world.ground(pl.x, pl.z) - pl.y) * Math.min(1, dt * 14);
        if (moving > 0.5) { pl.bob += dt * moving * 1.9; stepAcc += dt * moving; if (stepAcc > 1.9) { stepAcc = 0; audio.step(world.wet.value > 0.3); } }
        camera.position.set(pl.x, pl.y + 1.68 + Math.sin(pl.bob * 2) * 0.035 * Math.min(1, moving / 3), pl.z);
        camera.rotation.set(pl.pitch, pl.yaw, Math.sin(pl.bob) * 0.004);
        bus.update(dt, 0, 0, 0, false, weather.rain);
        // im Bus-Radius oder unter Dach? (grob: nah an Hütte/Laden)
        for (const key of ['station', 'cabin']) { const o = world.pois[key]; if (Math.hypot(pl.x - o.x, pl.z - o.z) < (key === 'station' ? 0 : 4.5)) indoor = true; }
        if (world.pois.station.g) { v3.set(pl.x, 0, pl.z); world.pois.station.g.worldToLocal(v3); if (Math.abs(v3.x) < 6 && v3.z < -4.5 && v3.z > -11.5) indoor = true; }
      } else {
        const gas = Math.max(inp.gas, k.KeyW ? 1 : 0), brake = Math.max(inp.brake, k.KeyS ? 1 : 0);
        bus.update(dt, gas, brake, -Math.max(-1, Math.min(1, inp.mx + (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0))), true, weather.rain);
        if (bus.bump > 2) { audio.thud(); bus.bump = 0; }
        bus.group.updateMatrixWorld(true);
        camera.position.copy(bus.group.localToWorld(v3.set(0.42, 1.52, 0.47)));
        e1.set(pl.pitch, Math.PI + pl.look, 0); camera.quaternion.copy(bus.group.quaternion).multiply(q1.setFromEuler(e1));
        pl.x = bus.x; pl.z = bus.z; pl.y = bus.y; indoor = true;
      }
      // Hunger-Kollaps
      if (S.hunger <= 0 && !busy) {
        busy = true; $('fade').style.opacity = 1;
        setTimeout(() => { S.hunger = 30; S.hour = Math.min(23.5, S.hour + 3); mode = 'drive'; pl.look = 0; $('fade').style.opacity = 0; busy = false; hud(); say('Du bist vor Hunger zusammengebrochen. Irgendwie hast du es zurück in den Bus geschafft.', 8); }, 2600);
      }
      // Ziel für Aktion
      target = null; let hint = '';
      if (mode === 'walk') {
        camera.getWorldDirection(v3); let best = 2.6;
        for (const it of items) { if (!it.obj.visible) continue; const dx = it.pos.x - camera.position.x, dy = it.pos.y - camera.position.y, dz = it.pos.z - camera.position.z, d = Math.hypot(dx, dy, dz); if (d < best && (dx * v3.x + dy * v3.y + dz * v3.z) / d > 0.72) { best = d; target = { item: it }; } }
        if (!target && Math.hypot(pl.x - bus.x, pl.z - bus.z) < 3.4) target = { bus: true };
        hint = target?.item ? target.item.name : '';
        $('bAct').textContent = target?.item ? 'Nehmen' : 'Einsteigen'; show('bAct', !!target);
      } else { $('bAct').textContent = 'Aussteigen'; show('bAct', Math.abs(bus.v) < 1); }
      if ($('hint').textContent !== hint) $('hint').textContent = hint;
      tHud += dt; if (tHud > 0.5) { tHud = 0; hud(); }
      tSave += dt; if (tSave > 12 && !busy) { tSave = 0; save(); }
    }

    const day = mode === 'menu' ? 3 : S.day, hour = mode === 'menu' ? 17.5 : S.hour;
    weather.update(dt, t, day, hour, camera, indoor && mode === 'drive' ? false : indoor);
    if (weather.thunder !== null) { audio.thunder(weather.thunder); weather.thunder = null; }
    const far = Math.max(110, Math.min(1000, weather.vis * 1.08)); if (Math.abs(far - camera.far) > 2) { camera.far = far; camera.updateProjectionMatrix(); scenery.sky.scale.setScalar(far * 0.9 / 1000); }
    scenery.update(t, camera);
    // adaptive Auflösung: bei dauerhaft < 27 fps schrittweise runter
    fpsN++; fpsT += dt; if (fpsT > 3) { const fps = fpsN / fpsT; fpsN = 0; fpsT = 0; if (fps < 27 && dynScale > 0.55) { dynScale -= 0.12; applyQual(); } else if (fps > 52 && dynScale < 1) { dynScale = Math.min(1, dynScale + 0.06); applyQual(); } }

    // --- Orts-Effekte ---
    const dk = 1 - weather.lum;
    let fl = 1; // Tankstellen-Flackern
    if (day === 3) fl = Math.sin(t * 0.7) > 0.96 ? (Math.random() > 0.5 ? 1 : 0.2) : 1;
    else if (day === 4) fl = (Math.sin(t * 1.3) + Math.sin(t * 3.1)) > 0.9 ? (Math.random() > 0.4 ? 1 : 0.1) : 1;
    else if (day >= 5) fl = (Math.sin(t * 0.9) + Math.sin(t * 2.3)) > 1.5 ? Math.random() : 0.04;
    for (const f of fx.flicker) f.mat.emissiveIntensity = f.base * fl * (f.slow && day >= 3 ? 0.3 : 1);
    const warm = day <= 3 ? 1 : 0, fire = day <= 2 ? 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3) : 0;
    fx.windows[0].emissiveIntensity = 1.6 * warm; fx.embers.mesh.visible = fire > 0;
    for (const e of fx.emitters) e.k = e.tag === 'station' ? fl : e.tag === 'cabin' ? warm : fire;
    let bestE = null, bd = 1e9; for (const e of fx.emitters) { if (e.k <= 0.01) continue; const d = e.pos.distanceToSquared(camera.position) / (e.dist * e.dist); if (d < bd) { bd = d; bestE = e; } }
    if (bestE && bd < 30) { local.position.copy(bestE.pos); local.color.copy(bestE.color); local.intensity = bestE.base * bestE.k * (0.35 + 0.65 * dk); local.distance = bestE.dist; } else local.intensity = 0;
    fx.beam.group.rotation.y = t * 0.45; fx.beam.mat.opacity = 0.13 * dk * dk + Math.min(0.03, weather.fog * 0.8) * dk;
    torch.intensity = (mode === 'walk' && S.torch) ? 95 : 0;

    // --- Die Gestalt (ab Tag 4) ---
    if (mode !== 'menu' && S.day >= 4) {
      if (!fig.visible) {
        figure.t -= dt;
        if (figure.t <= 0) {
          figure.t = 35 + Math.random() * (S.day >= 5 ? 40 : 80);
          camera.getWorldDirection(v3); const a = Math.atan2(v3.x, v3.z) + (Math.random() - 0.5) * 0.9, d = Math.max(16, Math.min(55, weather.vis * 0.55));
          const x = camera.position.x + Math.sin(a) * d, z = camera.position.z + Math.cos(a) * d, h = world.getHeight(x, z);
          if (h > 1.2 && !world.collide({ x, z }, 0.5)) { fig.position.set(x, h - 0.05, z); fig.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z); fig.visible = true; figure.life = 9 + Math.random() * 8; figure.d0 = d; }
        }
      } else {
        figure.life -= dt; const d = Math.hypot(fig.position.x - camera.position.x, fig.position.z - camera.position.z);
        if (figure.life <= 0 || d < figure.d0 * 0.5 || d < 9) fig.visible = false;
      }
    }
    dread += ((fig.visible ? 1 : (mode !== 'menu' && S.day >= 5 ? 0.25 : 0)) - dread) * Math.min(1, dt * 0.8);

    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.opacity = 0; }
    const hC = world.getHeight(camera.position.x, camera.position.z);
    audio.update({ rain: weather.rain, storm: weather.storm, birds: mode === 'menu' ? 0 : weather.birds, inBus: mode === 'drive', indoor, speed: bus.v, gas: mode === 'drive' ? Math.max(inp.gas, k.KeyW ? 1 : 0) : 0, engine: mode === 'drive' && bus.fuel > 0, coast: Math.max(0, 1 - Math.max(0, hC) / 7), dread, dt, t });
    renderer.render(scene, camera);
  }
  window.__game = { tp: (x, z, yaw, pitch = 0) => { pl.x = x; pl.z = z; pl.yaw = yaw; pl.pitch = pitch; pl.y = world.ground(x, z); mode = 'walk'; }, view: (key, dist, side = 0, pitch = 0, dyaw = 0) => { const o = world.pois[key], f = o.face; window.__game.tp(o.x + Math.sin(f) * dist + Math.cos(f) * side, o.z + Math.cos(f) * dist - Math.sin(f) * side, f + dyaw, pitch); }, S: () => S, bus, pl, world, weather, items, camera, set: o => Object.assign(S, o), mode: m => { if (m) mode = m; return mode; }, hud, fig, figure };
  frame();
})();
