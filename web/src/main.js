import * as THREE from 'three';
import { loadAssets } from './assets.js';
import { createWorld } from './world.js';
import { createScenery } from './scenery.js';
import { createBuildings } from './buildings.js';
import { createBus } from './bus.js';
import { createWeather } from './weather.js';
import { createAudio } from './audio.js';
import { createPost, createGrass } from './fx.js';
import { createStalker, makeFigure } from './stalker.js';
import { NOTES, WIND, WAKE, ENDING, objective } from './story.js';

const $ = id => document.getElementById(id);
const canvas = $('c');
const QUAL = [['Niedrig', 1, 3000], ['Mittel', 1.5, 6500], ['Hoch', 2, 9000]];
let qual = +(localStorage.getItem('la_q') ?? 1), dynScale = 1, post = null, grass = null;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const applyQual = () => {
  const pr = Math.min(window.devicePixelRatio || 1, QUAL[qual][1]) * dynScale;
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false); post?.setSize(innerWidth, innerHeight, pr);
  grass?.mesh.geometry.setDrawRange(0, QUAL[qual][2] * 12); $('qv').textContent = QUAL[qual][0];
};
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 1200);
camera.rotation.order = 'YXZ'; scene.add(camera);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyQual(); });
applyQual();

const SAVE = 'la_save2';
const FOOD = { apple: 12, can: 26, longlife: 40 };
const ICON = { lamp: '🔦', can: '🥫', longlife: '🍱', apple: '🍎', gun: '🔫', notes: '📄', key: '🗝️' };
const NAME = { lamp: 'Licht', can: 'Konserve', longlife: 'Ration', apple: 'Apfel', gun: 'Pistole', notes: 'Zettel', key: 'Schlüssel' };
const HOUR = 30;      // Sekunden pro Spielstunde
const SLEEP_FROM = 22, HUNT_FROM = 20.5;

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
  const stalker = createStalker(scene, world, assets, fx.park);
  grass = createGrass(assets, world, scene); post = createPost(renderer); applyQual();

  // --- Lichter: Taschenlampe + EIN wanderndes Punktlicht ---
  const torch = new THREE.SpotLight(0xfff1d6, 0, 42, 0.42, 0.5, 1.4); torch.position.set(0.25, -0.2, 0.1); camera.add(torch); torch.target.position.set(0, -0.05, -6); camera.add(torch.target);
  const local = new THREE.PointLight(0xffffff, 0, 20, 1.6); scene.add(local);
  // --- Pistole in der Hand ---
  const gunVM = new THREE.Group(); { const m = assets.M.service_pistol.clone(); m.rotation.y = Math.PI / 2 + 0.22; m.rotation.z = 0.06; gunVM.add(m); } gunVM.position.set(0.2, -0.19, -0.5); gunVM.visible = false; camera.add(gunVM);
  // --- Erscheinung im Nebel ---
  const fig = makeFigure(false); scene.add(fig); fig.visible = false;
  const figure = { t: 30, life: 0, d0: 0 };

  // --- Spielzustand ---
  const fresh = () => ({ day: 1, hour: 8.5, hunger: 78, fuel: 46, inv: { apple: 0, can: 0, longlife: 0 }, ammo: 0, gun: false, armed: false, key: false, notes: [], picked: [], doors: {}, wnote: 0, scares: {}, bus: { ...fx.start.bus }, pl: { ...fx.start.pl }, mode: 'walk', lights: false, torch: false });
  let S = fresh();
  const pl = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0, bob: 0, look: 0 };
  let mode = 'menu', busy = false, paused = false, tSave = 0, tHud = 0, target = null, dread = 0, shake = 0, fireCd = 0, flashT = 0, lastZone = null, endCam = null;
  const visible = it => !S.picked.includes(it.id) && (!it.req || it.req(S));
  const refreshItems = () => { for (const it of items) it.obj.visible = visible(it); for (const id in fx.doors) S.doors[id] ? fx.doors[id].open() : fx.doors[id].close(); bus.wsNote.visible = !!S.wnote; fx.ferry.mat.map = S.day >= 3 ? fx.ferry.b : fx.ferry.a; };
  const applyState = () => {
    bus.place(S.bus.x, S.bus.z, S.bus.h); bus.fuel = S.fuel; bus.lights = S.lights;
    pl.x = S.pl.x; pl.z = S.pl.z; pl.yaw = S.pl.yaw; pl.pitch = 0; pl.look = 0; pl.y = world.ground(pl.x, pl.z);
    refreshItems(); stalker.reset(); fig.visible = false; mode = S.mode || 'walk';
  };
  const save = () => { S.bus = { x: bus.x, z: bus.z, h: bus.heading }; S.fuel = bus.fuel; S.lights = bus.lights; S.pl = { x: pl.x, z: pl.z, yaw: pl.yaw }; S.mode = mode === 'walk' ? 'walk' : 'rear'; try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch { } };

  // --- Anzeige ---
  let msgT = 0;
  const say = (t, sec = 6) => { const m = $('msg'); m.textContent = t; m.style.opacity = 1; msgT = sec; };
  const show = (id, on) => { const e = $(id), v = on ? 'flex' : 'none'; if (e.style.display !== v) e.style.display = v; };
  const setTxt = (id, t) => { const e = $(id); if (e.textContent !== t) e.textContent = t; };
  let invKey = '';
  const hud = () => {
    const h = Math.floor(S.hour), m = Math.floor((S.hour - h) * 60);
    setTxt('day', `Tag ${S.day} · ${String(h % 24).padStart(2, '0')}:${String(m - m % 10).padStart(2, '0')}`);
    $('hHunger').style.width = S.hunger + '%'; $('hHunger').style.background = S.hunger < 22 ? '#c2543e' : '#d8d2c0';
    $('hFuel').style.width = bus.fuel + '%'; $('hFuel').style.background = bus.fuel < 12 ? '#c2543e' : '#d8d2c0';
    setTxt('obj', '→ ' + objective(S));
    const drive = mode === 'drive';
    document.body.classList.toggle('drive', drive);
    show('bGas', drive); show('bBrk', drive); show('bBack', drive && Math.abs(bus.v) < 0.5); show('bFire', mode === 'walk' && S.gun && S.armed);
    gunVM.visible = mode === 'walk' && S.gun && S.armed;
    // Inventarleiste
    const slots = [['lamp', '', drive ? bus.lights : S.torch]];
    for (const k of ['can', 'longlife', 'apple']) if (S.inv[k]) slots.push([k, S.inv[k], false]);
    if (S.gun) slots.push(['gun', S.ammo, S.armed]);
    if (S.key) slots.push(['key', '', false]);
    slots.push(['notes', S.notes.length || '', false]);
    const key = JSON.stringify(slots);
    if (key !== invKey) { invKey = key; $('inv').innerHTML = slots.map(([k, n, on]) => `<div class="slot${on ? ' on' : ''}" data-k="${k}"><small>${NAME[k]}</small>${ICON[k]}${n !== '' ? `<b>${n}</b>` : ''}</div>`).join(''); }
  };
  $('inv').addEventListener('pointerdown', e => {
    const k = e.target.closest('.slot')?.dataset.k; if (!k || busy) return; e.preventDefault(); audio.init();
    if (k === 'lamp') { if (mode === 'drive') bus.lights = !bus.lights; else S.torch = !S.torch; audio.blip(240); }
    else if (FOOD[k]) eat(k);
    else if (k === 'gun') { S.armed = !S.armed; audio.click(); }
    else if (k === 'notes') journal();
    else if (k === 'key') say('Ein alter Schlüssel. Er passt zum Leuchtturm.', 3);
    hud();
  });
  const readNote = (id, title, text) => {
    paused = true; audio.paper();
    $('paper').innerHTML = `<h3></h3><div></div><div class="x">tippen zum Schließen</div>`; $('paper').children[0].textContent = title; $('paper').children[1].textContent = text; show('note', true);
    if (id && !S.notes.includes(id)) { S.notes.push(id); refreshItems(); hud(); save(); }
  };
  $('note').addEventListener('pointerup', () => { show('note', false); paused = false; });
  const journal = () => {
    paused = true; const j = $('jr'); j.innerHTML = '<h2>NOTIZEN</h2><p class="o"></p>'; j.children[1].textContent = '→ ' + objective(S);
    for (const id of S.notes) { const n = NOTES[id] || (id[0] === 'w' ? { t: `Zettel an der Scheibe · Tag ${id.slice(1)}`, x: WIND[Math.min(6, +id.slice(1))] } : null); if (!n) continue; const d = document.createElement('div'); d.className = 'n'; const b = document.createElement('b'); b.textContent = n.t; d.append(b, n.x); j.append(d); }
    show('journal', true);
  };
  $('journal').addEventListener('pointerup', e => { if (e.target.id === 'journal') { show('journal', false); paused = false; } });

  // --- Jumpscares ---
  const fc = $('face'), fcx = fc.getContext('2d');
  const drawFace = () => {
    const w = fc.width = innerWidth, h = fc.height = innerHeight, cx = w / 2 + (Math.random() - 0.5) * 60, cy = h * 0.5, s = h * 0.95;
    fcx.fillStyle = '#000'; fcx.fillRect(0, 0, w, h); fcx.filter = `blur(${Math.round(h * 0.02)}px)`;
    const g = fcx.createRadialGradient(cx, cy - s * 0.1, s * 0.05, cx, cy, s * 0.8); g.addColorStop(0, '#b8b1a2'); g.addColorStop(0.5, '#6b665d'); g.addColorStop(0.85, '#121110'); g.addColorStop(1, '#000'); fcx.fillStyle = g; fcx.beginPath(); fcx.ellipse(cx, cy, s * 0.5, s * 0.82, 0, 0, 7); fcx.fill();
    fcx.fillStyle = '#000'; for (const sx of [-1, 1]) { fcx.beginPath(); fcx.ellipse(cx + sx * s * 0.2, cy - s * 0.17, s * 0.1, s * 0.075, sx * 0.35, 0, 7); fcx.fill(); }
    fcx.beginPath(); fcx.ellipse(cx, cy + s * 0.36, s * 0.13, s * 0.3, 0, 0, 7); fcx.fill();
    fcx.filter = 'blur(1px)'; fcx.fillStyle = '#e8e2d2'; for (const sx of [-1, 1]) { fcx.beginPath(); fcx.arc(cx + sx * s * 0.2 + s * 0.01, cy - s * 0.17, s * 0.008, 0, 7); fcx.fill(); }
    fcx.filter = 'none';
    for (let i = 0; i < 14; i++) { const y = Math.random() * h, hh = 4 + Math.random() * h * 0.06; fcx.drawImage(fc, 0, y, w, hh, (Math.random() - 0.5) * w * 0.08, y, w, hh); }
    for (let i = 0; i < 1200; i++) { fcx.fillStyle = `rgba(0,0,0,${Math.random() * 0.6})`; fcx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2); }
  };
  const scare = (face, vol = 1) => { audio.sting(vol); post.u.uPulse.value = 1; shake = 0.9; if (face) { drawFace(); fc.style.display = 'block'; setTimeout(() => { fc.style.display = 'none'; }, 480); } };
  const roomScare = () => { camera.getWorldDirection(v3); const x = pl.x + v3.x * 2.6, z = pl.z + v3.z * 2.6; fig.position.set(x, pl.y - 0.03, z); fig.rotation.y = Math.atan2(pl.x - x, pl.z - z); fig.visible = true; figure.life = 0.42; figure.d0 = 0; scare(false); };

  // --- Eingabe ---
  const inp = { mx: 0, mz: 0, gas: 0, brake: 0, keys: {} };
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
  const stick = $('stick'), knob = stick.firstElementChild;
  canvas.addEventListener('pointerdown', e => {
    if (mode === 'menu') return; audio.init();
    if (e.pointerType === 'mouse') { canvas.requestPointerLock?.(); return; }
    if (e.clientX < innerWidth * 0.42 && stickId === null && mode !== 'rear') { stickId = e.pointerId; sx = e.clientX; sy = e.clientY; stick.style.display = 'block'; stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; knob.style.transform = ''; }
    else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
    canvas.setPointerCapture(e.pointerId);
  });
  const look = (dx, dy) => { const k = 0.0042; if (mode === 'drive') pl.look = Math.max(-2.3, Math.min(2.3, pl.look - dx * k)); else if (mode === 'rear') pl.look -= dx * k; else pl.yaw -= dx * k; pl.pitch = Math.max(-1.35, Math.min(1.35, pl.pitch - dy * k)); };
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) { let dx = e.clientX - sx, dy = e.clientY - sy; const l = Math.hypot(dx, dy), R = 55; if (l > R) { dx *= R / l; dy *= R / l; } inp.mx = dx / R; inp.mz = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === lookId) { look(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; }
  });
  const up = e => { if (e.pointerId === stickId) { stickId = null; inp.mx = inp.mz = 0; stick.style.display = 'none'; } if (e.pointerId === lookId) lookId = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) look(e.movementX * 0.6, e.movementY * 0.6); });
  addEventListener('keydown', e => { inp.keys[e.code] = 1; if (mode === 'menu' || e.repeat) return; if (e.code === 'KeyE') act(); if (e.code === 'KeyF') { if (mode === 'drive') bus.lights = !bus.lights; else S.torch = !S.torch; hud(); } if (e.code === 'KeyQ') eat(); if (e.code === 'KeyG') { S.armed = !S.armed; hud(); } if (e.code === 'Space') fire(); if (e.code === 'KeyB') back(); if (e.code === 'KeyJ') journal(); });
  addEventListener('keyup', e => { inp.keys[e.code] = 0; });
  const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); audio.init(); fn(); });
  const hold = (id, key) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); inp[key] = 1; el.classList.add('on'); }); const off = () => { inp[key] = 0; el.classList.remove('on'); }; el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); };
  hold('bGas', 'gas'); hold('bBrk', 'brake');

  // --- Aktionen ---
  const exitBus = () => {
    const c = Math.cos(bus.heading), s = Math.sin(bus.heading);
    for (const side of [-1.8, 1.8]) { const p = { x: bus.x + c * side, z: bus.z - s * side }; if (world.ground(p.x, p.z) > 0.5 && !world.collide({ ...p }, 0.3)) { pl.x = p.x; pl.z = p.z; pl.y = world.ground(p.x, p.z); pl.yaw = bus.heading + (side < 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI; pl.look = 0; pl.pitch = 0; mode = 'walk'; audio.door(); hud(); return true; } }
    say('Hier ist kein Platz zum Aussteigen.', 2); return false;
  };
  const readWind = () => { const d = S.wnote; S.wnote = 0; bus.wsNote.visible = false; readNote('w' + d, 'Zettel an der Windschutzscheibe', WIND[Math.min(6, d)]); if (d >= 5) { weather.flash = 1; audio.thunder(0.3); } };
  function act() {
    if (busy || paused) return;
    if (mode === 'drive') {
      if (S.wnote) return readWind();
      if (Math.abs(bus.v) > 1) return say('Erst anhalten.', 2);
      exitBus(); return;
    }
    if (mode === 'rear') {
      const id = target?.spot; if (!id) return;
      if (id === 'bed') sleep();
      else if (id === 'cook') { if (!S.inv.can) return say('Du hast keine Konserve zum Aufwärmen.', 3); if (S.hunger > 92) return say('Du hast keinen Hunger.', 2); S.inv.can--; S.hunger = Math.min(100, S.hunger + 40); audio.blip(520); say('Warmes Essen. Für einen Moment ist alles gut.', 4); hud(); }
      else if (id === 'todo') readNote('todo', NOTES.todo.t, NOTES.todo.x);
      else if (id === 'seat') { mode = 'drive'; pl.look = 0; pl.pitch = 0; hud(); if (bus.fuel <= 0) say('Der Tank ist leer.', 3); else if (S.wnote) say('An der Scheibe klemmt ein Zettel.', 4); }
      else if (id === 'exit') exitBus();
      return;
    }
    if (!target) return;
    if (target.item) {
      const it = target.item;
      if (it.type === 'note') { S.picked.push(it.id); it.obj.visible = false; readNote(it.note, NOTES[it.note].t, NOTES[it.note].x); return; }
      it.obj.visible = false; S.picked.push(it.id); audio.blip(it.type === 'fuel' ? 440 : 700);
      if (it.type === 'fuel') { bus.fuel = Math.min(100, bus.fuel + 28); say('Benzinkanister – in den Bus gekippt.', 3); }
      else if (it.type === 'ammo') { S.ammo += 4; say(S.gun ? 'Munition. Vier Schuss.' : 'Munition. Vier Schuss – aber wofür?', 3); }
      else if (it.type === 'pistol') { S.gun = true; S.armed = true; S.ammo += 6; say('Eine Dienstpistole. Sechs Schuss. Tippe sie im Inventar an, um sie wegzustecken.', 6); }
      else if (it.type === 'key') { S.key = true; say('Der Schlüssel zum Leuchtturm.', 4); setTimeout(roomScare, 900); save(); }
      else { S.inv[it.type]++; say(it.name + ' eingesteckt.', 2); }
      hud();
    } else if (target.door) {
      const d = target.door, ok = d.id === 'office' ? S.day >= 3 : S.key;
      if (ok) { S.doors[d.id] = true; d.open(); audio.door(); say(d.id === 'office' ? 'Die Tür ist offen. Niemand da.' : 'Der Schlüssel dreht sich schwer.', 3); save(); }
      else { audio.knock(); readNote(d.id === 'office' ? 'officedoor' : 'lightdoor', NOTES[d.id === 'office' ? 'officedoor' : 'lightdoor'].t, NOTES[d.id === 'office' ? 'officedoor' : 'lightdoor'].x); }
    } else if (target.wind) readWind();
    else if (target.radio) ending();
    else if (target.bus) { mode = 'rear'; pl.look = Math.PI; pl.pitch = -0.1; audio.door(); hud(); if (!S.notes.includes('todo')) say('Dein Zuhause für die nächsten Tage. Am Schrank hängt ein Zettel.', 5); }
  }
  function back() { if (mode === 'drive' && Math.abs(bus.v) < 0.5 && !busy) { mode = 'rear'; pl.look = Math.PI; pl.pitch = -0.1; hud(); } }
  function eat(kind) {
    const need = 100 - S.hunger, order = ['apple', 'can', 'longlife'];
    const pick = kind || order.find(k => S.inv[k] && FOOD[k] >= need) || order.slice().reverse().find(k => S.inv[k]);
    if (!pick || !S.inv[pick]) return;
    if (need < 6) return say('Du hast keinen Hunger.', 2);
    S.inv[pick]--; S.hunger = Math.min(100, S.hunger + FOOD[pick]); audio.blip(520); hud();
  }
  function fire() {
    if (mode !== 'walk' || !S.gun || !S.armed || fireCd > 0 || busy || paused) return;
    fireCd = 0.45;
    if (S.ammo <= 0) { audio.click(); return say('Leer.', 1.5); }
    S.ammo--; audio.shot(); flashT = 0.07; pl.pitch = Math.min(1.3, pl.pitch + 0.05); shake = Math.max(shake, 0.25); $('flash').style.opacity = 0.25; setTimeout(() => { $('flash').style.opacity = 0; }, 50);
    camera.getWorldDirection(v3);
    if (stalker.shot(camera.position, v3)) { audio.scream(); say('Er taumelt zurück in den Nebel. Für heute Nacht.', 5); }
    else if (fig.visible) { const dx = fig.position.x - camera.position.x, dz = fig.position.z - camera.position.z, d = Math.hypot(dx, dz); if ((dx * v3.x + dz * v3.z) / d > 0.995) fig.visible = false; }
    hud();
  }
  function wake() {
    S.day++; S.hour = 7.5; S.hunger = Math.max(8, S.hunger - 18); S.wnote = S.day; figure.t = 25; fig.visible = false; stalker.reset(); mode = 'rear'; pl.look = 0; pl.pitch = 0;
    items.forEach(it => { if (it.type === 'apple' && S.picked.includes(it.id) && Math.random() < Math.max(0, 0.6 - S.day * 0.12)) S.picked.splice(S.picked.indexOf(it.id), 1); });
    refreshItems(); save(); hud(); $('fade').style.opacity = 0; busy = false; say(WAKE[Math.min(6, S.day)], 9);
  }
  function sleep() {
    if (busy) return;
    if (S.hour < SLEEP_FROM) return say(`Du bist noch nicht müde. (Schlafen ab ${SLEEP_FROM} Uhr)`, 3);
    if (stalker.active && stalker.dist < 140) return say('Du kannst jetzt nicht schlafen. Er ist in der Nähe.', 4);
    busy = true; $('fade').style.opacity = 1; bus.lights = false;
    if (S.day >= 3 && !S.scares.window) { // nachts: er steht an der Scheibe
      setTimeout(() => {
        S.scares.window = 1; S.hour = 3.2; mode = 'drive'; pl.look = 0.5; pl.pitch = -0.1; S.torch = false;
        const fxp = bus.x + Math.sin(bus.heading) * 3.0, fzp = bus.z + Math.cos(bus.heading) * 3.0; stalker.showAt(fxp, fzp, bus.x, bus.z);
        audio.knock(0.2); audio.knock(0.55); audio.knock(0.9); $('fade').style.opacity = 0.35; say('03:12. Etwas hat geklopft.', 3);
        setTimeout(() => { pl.look = 0; scare(true); weather.flash = 1; }, 3300);
        setTimeout(() => { $('fade').style.opacity = 1; }, 3900);
        setTimeout(() => { stalker.man.visible = false; wake(); }, 6200);
      }, 2400);
    } else setTimeout(wake, 2600);
  }
  function die() {
    if (busy) return; busy = true; scare(true, 1.3); audio.scream();
    setTimeout(() => { show('dead', true); }, 900);
  }
  $('bRetry').onclick = () => { try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE))); } catch { S = fresh(); } if (S.hour >= HUNT_FROM) S.hour = HUNT_FROM - 1.5; applyState(); show('dead', false); busy = false; hud(); say('Du schreckst hoch. Derselbe Tag. Wieder.', 5); };
  function ending() {
    if (busy) return; busy = true; audio.sting(0.5); $('fade').style.opacity = 1;
    setTimeout(() => {
      mode = 'end'; show('end', true); $('hud').style.display = 'none'; $('inv').style.display = 'none'; show('bAct', false); show('bFire', false);
      let i = 0; const p = $('endT');
      const next = () => {
        if (i < ENDING.length) { p.style.opacity = 0; setTimeout(() => { p.textContent = ENDING[i++]; p.style.opacity = 1; }, 700); setTimeout(next, 5200); return; }
        // Schlussbild: du sitzt im Auto hinter dem Bus
        const n = world.roads[0].pts, k = 250, a = n[k], b = n[(k + 9) % n.length], c = n[(k + 10) % n.length];
        bus.place(b.x, b.z, Math.atan2(c.x - b.x, c.z - b.z)); bus.lights = true; S.day = 5; S.hour = 22.6; stalker.reset(); stalker.car.visible = false; fig.visible = false;
        endCam = { x: a.x, z: a.z, tx: b.x, tz: b.z, t: 0 };
        $('end').style.background = 'transparent'; $('fade').style.opacity = 0; p.style.opacity = 0;
        setTimeout(() => { p.textContent = 'Tag 1.\nDiesmal hältst du ihn auf,\nbevor er den Leuchtturm erreicht.'; p.style.opacity = 1; }, 2500);
        setTimeout(() => { $('fade').style.opacity = 1; }, 10000);
        setTimeout(() => { $('end').style.background = '#000'; p.textContent = 'LETZTE AUSFAHRT\n\nEnde'; $('bEnd').style.display = ''; }, 12000);
      };
      next();
    }, 2200);
  }
  $('bEnd').onclick = () => { localStorage.removeItem(SAVE); location.reload(); };
  tap('bAct', act); tap('bFire', fire); tap('bBack', back);

  // --- Menü ---
  const hasSave = !!localStorage.getItem(SAVE);
  $('load').style.display = 'none'; $('btns').style.display = 'block';
  $('bStart').textContent = hasSave ? 'WEITER' : 'START'; $('bNew').style.display = hasSave ? '' : 'none';
  const begin = (cont) => {
    audio.init();
    if (cont) { try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE))); } catch { S = fresh(); } } else S = fresh();
    applyState(); $('menu').style.display = 'none'; $('hud').style.display = 'block'; $('cross').style.display = 'block'; $('inv').style.display = 'flex'; hud();
    if (!cont) say('Die Fähre hat dich am Hafen abgesetzt. Ein paar ruhige Tage auf der Insel – dein Bus steht am Kai.', 10);
    document.documentElement.requestFullscreen?.().catch(() => { });
  };
  $('bStart').onclick = () => begin(hasSave); $('bNew').onclick = () => begin(false);
  $('q').onclick = () => { dynScale = 1; qual = (qual + 1) % 3; localStorage.setItem('la_q', qual); applyQual(); };

  // --- Schleife ---
  const clock = new THREE.Clock(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), q1 = new THREE.Quaternion(), e1 = new THREE.Euler(0, 0, 0, 'YXZ');
  let t = 0, stepAcc = 0, fpsN = 0, fpsT = 0;
  applyState(); mode = 'menu';
  const hb = world.pois.harbor;
  const menuCam = () => { const a = t * 0.03 + 1; camera.position.set(hb.x + Math.cos(a) * 30, hb.y + 8, hb.z + Math.sin(a) * 30); camera.lookAt(hb.x, hb.y + 1.5, hb.z); };

  function frame() {
    requestAnimationFrame(frame);
    const rdt = Math.min(0.05, clock.getDelta()), dt = paused ? 0 : rdt; t += rdt;
    const k = inp.keys;
    let mx = inp.mx + (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = inp.mz + (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    let indoor = false, moving = 0, zone = null;
    const playing = mode === 'walk' || mode === 'drive' || mode === 'rear';
    if (mode === 'menu') { menuCam(); bus.update(dt, 0, 0, 0, false, 0); }
    else if (mode === 'end') {
      bus.update(dt, 0, 0, 0, false, 1);
      if (endCam) { endCam.t += rdt; const f = Math.min(0.55, endCam.t * 0.03); camera.position.set(endCam.x + (endCam.tx - endCam.x) * f, world.ground(endCam.x, endCam.z) + 1.15, endCam.z + (endCam.tz - endCam.z) * f); camera.lookAt(bus.x, bus.y + 1.2, bus.z); }
    } else {
      S.hour = Math.min(23.99, S.hour + dt / HOUR);
      S.hunger = Math.max(0, S.hunger - dt * (100 / (HOUR * 16)));
      fireCd -= dt;
      if (mode === 'walk') {
        const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
        const sp = (k.ShiftLeft ? 6 : 4.1) * (S.hunger < 15 ? 0.6 : 1), sn = Math.sin(pl.yaw), cs = Math.cos(pl.yaw);
        const p = { x: pl.x + (mx * cs + mz * sn) * sp * dt, z: pl.z + (-mx * sn + mz * cs) * sp * dt };
        world.collide(p, 0.32);
        const gh = world.ground(p.x, p.z), cur = world.ground(pl.x, pl.z);
        if (gh > 0.22 && gh - cur < 0.9) { moving = Math.hypot(p.x - pl.x, p.z - pl.z) / Math.max(dt, 1e-4); pl.x = p.x; pl.z = p.z; }
        pl.y += (world.ground(pl.x, pl.z) - pl.y) * Math.min(1, dt * 14);
        if (moving > 0.5) { pl.bob += dt * moving * 1.9; stepAcc += dt * moving; if (stepAcc > 1.9) { stepAcc = 0; audio.step(world.wet.value > 0.3); } }
        camera.position.set(pl.x, pl.y + 1.68 + Math.sin(pl.bob * 2) * 0.035 * Math.min(1, moving / 3), pl.z);
        camera.rotation.set(pl.pitch, pl.yaw, Math.sin(pl.bob) * 0.004);
        bus.update(dt, 0, 0, 0, false, weather.rain);
        zone = world.indoor(pl.x, pl.z); indoor = !!zone;
      } else {
        const driving = mode === 'drive';
        const gas = driving ? Math.max(inp.gas, k.KeyW ? 1 : 0) : 0, brake = driving ? Math.max(inp.brake, k.KeyS ? 1 : 0) : 0;
        bus.update(dt, gas, brake, driving ? -Math.max(-1, Math.min(1, inp.mx + (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0))) : 0, driving, weather.rain);
        if (bus.bump > 2) { audio.thud(); shake = Math.max(shake, 0.3); bus.bump = 0; }
        bus.group.updateMatrixWorld(true);
        if (driving) camera.position.copy(bus.group.localToWorld(v3.set(0.42, 1.52, 0.47))); else camera.position.copy(bus.group.localToWorld(v3.set(-0.12, 1.4, -0.42)));
        e1.set(pl.pitch, Math.PI + pl.look, 0); camera.quaternion.copy(bus.group.quaternion).multiply(q1.setFromEuler(e1));
        pl.x = bus.x; pl.z = bus.z; pl.y = bus.y; indoor = true;
      }
      // Kamerawackeln
      if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake * 0.12; camera.position.y += (Math.random() - 0.5) * shake * 0.12; camera.rotation.z += (Math.random() - 0.5) * shake * 0.05; shake *= Math.pow(0.02, rdt); }
      // Hunger-Kollaps
      if (S.hunger <= 0 && !busy) {
        busy = true; $('fade').style.opacity = 1;
        setTimeout(() => { S.hunger = 30; S.hour = Math.min(23.5, S.hour + 3); mode = 'rear'; pl.look = 0; $('fade').style.opacity = 0; busy = false; hud(); say('Du bist vor Hunger zusammengebrochen. Irgendwie hast du es zurück in den Bus geschafft.', 8); }, 2600);
      }
      // --- Ziel für Aktion ---
      target = null; let hint = '', label = '';
      camera.getWorldDirection(v3);
      if (mode === 'walk') {
        let best = 2.6;
        for (const it of items) { if (!it.obj.visible) continue; const dx = it.pos.x - camera.position.x, dy = it.pos.y - camera.position.y, dz = it.pos.z - camera.position.z, d = Math.hypot(dx, dy, dz); if (d < best && (dx * v3.x + dy * v3.y + dz * v3.z) / d > 0.72) { best = d; target = { item: it }; } }
        if (!target) for (const id in fx.doors) { const d = fx.doors[id]; if (S.doors[id]) continue; const dx = d.pos.x - camera.position.x, dz = d.pos.z - camera.position.z, dd = Math.hypot(dx, dz); if (dd < 2.4 && (dx * v3.x + dz * v3.z) / dd > 0.6) target = { door: d }; }
        if (!target && S.doors.light) { const dx = fx.radio.x - camera.position.x, dy = fx.radio.y - camera.position.y, dz = fx.radio.z - camera.position.z, d = Math.hypot(dx, dy, dz); if (d < 2.3 && (dx * v3.x + dy * v3.y + dz * v3.z) / d > 0.7) target = { radio: true }; }
        if (!target && Math.hypot(pl.x - bus.x, pl.z - bus.z) < 3.6) {
          const fxp = bus.x + Math.sin(bus.heading) * 2.4, fzp = bus.z + Math.cos(bus.heading) * 2.4;
          target = S.wnote && Math.hypot(pl.x - fxp, pl.z - fzp) < 2.3 ? { wind: true } : { bus: true };
        }
        label = target?.item ? (target.item.type === 'note' ? 'Lesen' : 'Nehmen') : target?.door ? 'Tür' : target?.radio ? 'Funken' : target?.wind ? 'Zettel lesen' : 'Einsteigen';
        hint = target?.item ? target.item.name : target?.radio ? 'Funkgerät' : '';
        show('bAct', !!target);
      } else if (mode === 'drive') { label = S.wnote ? 'Zettel lesen' : 'Aussteigen'; show('bAct', S.wnote || Math.abs(bus.v) < 1); }
      else { // Wohnbereich: Blickziel wählen
        let best = 0.8;
        for (const s of bus.spots) { v4.copy(s.p); bus.group.localToWorld(v4).sub(camera.position).normalize(); const d = v4.dot(v3); if (d > best) { best = d; target = { spot: s.id }; label = s.label; } }
        hint = target ? '' : 'Sieh dich um: Bett · Küche · Zettel · Fahrersitz · Tür';
        show('bAct', !!target);
      }
      setTxt('bAct', label); setTxt('hint', hint);

      // --- Verfolger ---
      const hunt = S.day >= 2 && S.hour >= HUNT_FROM && !busy;
      const ev = stalker.update(dt, { px: pl.x, pz: pl.z, inBus: mode !== 'walk', busV: bus.v, hunt, day: S.day });
      if (ev === 'caught') die();
      else if (ev === 'ram') { audio.thud(); shake = 1; bus.v = Math.min(17, bus.v + 2.5); post.u.uPulse.value = 0.6; }
      if (hunt && stalker.active && !S.scares['hunt' + S.day]) { S.scares['hunt' + S.day] = 1; say(S.day === 2 ? 'Scheinwerfer. Jemand kommt die Straße herunter.' : 'Er kommt wieder.', 5); }

      // --- Raum-Schreck ---
      const zn = zone?.name || null;
      if (zn !== lastZone) {
        if (zn === 'cabin' && S.day >= 3 && !S.scares.cabin) { S.scares.cabin = 1; setTimeout(roomScare, 1500); }
        if (zn === 'shop' && S.day >= 4 && !S.scares.shop) { S.scares.shop = 1; setTimeout(roomScare, 2200); }
        if (zn === 'chapel' && S.hour > 19 && !S.scares.chapel) { S.scares.chapel = 1; audio.knock(); audio.knock(0.4); say('Die Bänke knarren. Du bist nicht allein.', 4); }
        lastZone = zn;
      }
      tHud += rdt; if (tHud > 0.4) { tHud = 0; hud(); }
      tSave += dt; if (tSave > 15 && !busy && !stalker.active && S.hour < HUNT_FROM) { tSave = 0; save(); }
    }

    const day = mode === 'menu' ? 2 : S.day, hour = mode === 'menu' ? 18.5 : S.hour;
    weather.update(dt, t, day, hour, camera, indoor && mode === 'walk');
    if (weather.thunder !== null) { audio.thunder(weather.thunder); weather.thunder = null; }
    const far = Math.max(110, Math.min(1000, weather.vis * 1.08)); if (Math.abs(far - camera.far) > 2) { camera.far = far; camera.updateProjectionMatrix(); scenery.sky.scale.setScalar(far * 0.9 / 1000); }
    scenery.update(t, camera); grass.update(t, camera, 0.25 + weather.storm * 0.6 + weather.rain * 0.2);
    fpsN++; fpsT += rdt; if (fpsT > 3) { const fps = fpsN / fpsT; fpsN = 0; fpsT = 0; if (fps < 27 && dynScale > 0.55) { dynScale -= 0.12; applyQual(); } else if (fps > 52 && dynScale < 1) { dynScale = Math.min(1, dynScale + 0.06); applyQual(); } }

    // --- Orts-Effekte / Lichter ---
    const dk = 1 - weather.lum, night = dk > 0.45 ? 1 : 0;
    let fl = 1;
    if (day === 3) fl = Math.sin(t * 0.7) > 0.96 ? (Math.random() > 0.5 ? 1 : 0.2) : 1;
    else if (day === 4) fl = (Math.sin(t * 1.3) + Math.sin(t * 3.1)) > 0.9 ? (Math.random() > 0.4 ? 1 : 0.1) : 1;
    else if (day >= 5) fl = (Math.sin(t * 0.9) + Math.sin(t * 2.3)) > 1.5 ? Math.random() : 0.04;
    const K = { station: fl, shop: day <= 2 ? 1 : day === 3 ? fl : 0, lamp: night * (day <= 3 ? 1 : fl), warm: day <= 2 ? 1 : 0, fire: day <= 2 ? 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3) : 0, radio: 1 };
    for (const f of fx.flicker) f.mat.emissiveIntensity = f.base * (K[f.group] ?? 1);
    built.mats.winLit.emissiveIntensity = 1.4 * K.warm; fx.embers.mesh.visible = K.fire > 0;
    let bestE = null, bd = 1e9; for (const e of fx.emitters) { e.k = K[e.tag] ?? 1; if (e.k <= 0.01) continue; const d = e.pos.distanceToSquared(camera.position) / (e.dist * e.dist); if (d < bd) { bd = d; bestE = e; } }
    if (flashT > 0) { flashT -= rdt; local.position.copy(camera.position); local.color.setRGB(1, 0.85, 0.6); local.intensity = 70; local.distance = 30; }
    else if (mode === 'rear') { local.position.copy(bus.group.localToWorld(v4.set(-0.1, 1.55, -0.55))); local.color.setRGB(1, 0.72, 0.42); local.intensity = 2.2; local.distance = 5; }
    else if (stalker.active && stalker.lightPos.distanceTo(camera.position) < 60 && !(bestE && bd < 0.3)) { local.position.copy(stalker.lightPos); local.color.setRGB(1, 0.93, 0.78); local.intensity = 60; local.distance = 26; }
    else if (bestE && bd < 30) { local.position.copy(bestE.pos); local.color.copy(bestE.color); local.intensity = bestE.base * bestE.k * (0.35 + 0.65 * dk); local.distance = bestE.dist; } else local.intensity = 0;
    fx.beam.group.rotation.y = t * 0.45; fx.beam.mat.opacity = 0.13 * dk * dk + Math.min(0.03, weather.fog * 0.8) * dk;
    torch.intensity = (mode === 'walk' && S.torch) ? 95 : 0;

    // --- Erscheinung im Nebel (ab Tag 3; nachts auf der Straße) ---
    if (playing && S.day >= 3) {
      if (!fig.visible) {
        figure.t -= dt;
        if (figure.t <= 0) {
          figure.t = 35 + Math.random() * (S.day >= 5 ? 40 : 80);
          camera.getWorldDirection(v3); const a = Math.atan2(v3.x, v3.z) + (Math.random() - 0.5) * (mode === 'drive' ? 0.3 : 0.9), d = Math.max(16, Math.min(55, weather.vis * 0.55));
          const x = camera.position.x + Math.sin(a) * d, z = camera.position.z + Math.cos(a) * d, h = world.getHeight(x, z);
          if (h > 1.2 && !world.collide({ x, z }, 0.5) && mode !== 'rear') { fig.position.set(x, h - 0.05, z); fig.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z); fig.visible = true; figure.life = 9 + Math.random() * 8; figure.d0 = d; }
        }
      } else {
        figure.life -= rdt; const d = Math.hypot(fig.position.x - camera.position.x, fig.position.z - camera.position.z);
        if (figure.d0 > 0 && d < 9) { fig.visible = false; if (mode === 'drive' && Math.abs(bus.v) > 4) scare(false, 0.8); }
        else if (figure.life <= 0 || (figure.d0 > 0 && d < figure.d0 * 0.5)) fig.visible = false;
      }
    } else if (fig.visible && figure.d0 === 0) { figure.life -= rdt; if (figure.life <= 0) fig.visible = false; }
    const near = stalker.active ? Math.max(0, 1 - stalker.dist / 120) : 0;
    dread += ((fig.visible ? 1 : Math.max(near, playing && S.day >= 5 ? 0.25 : 0)) - dread) * Math.min(1, rdt * 0.8);

    // --- Filter ---
    const pu = post.u; pu.uTime.value = t; pu.uPulse.value *= Math.pow(0.05, rdt);
    pu.uHorror.value += ((mode === 'menu' ? 0.5 : Math.min(1, 0.06 + (day - 1) * 0.17 + dk * 0.22 + near * 0.4)) - pu.uHorror.value) * Math.min(1, rdt * 1.5);

    if (msgT > 0) { msgT -= rdt; if (msgT <= 0) $('msg').style.opacity = 0; }
    const hC = world.getHeight(camera.position.x, camera.position.z);
    audio.update({ rain: weather.rain, storm: weather.storm, birds: mode === 'menu' ? 0 : weather.birds, inBus: mode === 'drive' || mode === 'rear', indoor, speed: bus.v, gas: mode === 'drive' ? Math.max(inp.gas, k.KeyW ? 1 : 0) : 0, engine: mode === 'drive' && bus.fuel > 0, coast: Math.max(0, 1 - Math.max(0, hC) / 7), dread, dt: rdt, t, stalker: stalker.active ? stalker.dist : 1e9, stalkerCar: stalker.mode === 'drive', stalkerV: stalker.v });
    post.render(scene, camera);
  }
  window.__game = {
    tp: (x, z, yaw, pitch = 0) => { pl.x = x; pl.z = z; pl.yaw = yaw; pl.pitch = pitch; pl.y = world.ground(x, z); mode = 'walk'; },
    view: (key, dist, side = 0, pitch = 0, dyaw = 0) => { const o = world.pois[key], f = o.face; window.__game.tp(o.x + Math.sin(f) * dist + Math.cos(f) * side, o.z + Math.cos(f) * dist - Math.sin(f) * side, f + dyaw, pitch); },
    S: () => S, bus, pl, world, weather, items, camera, stalker, fx, post, set: o => { Object.assign(S, o); refreshItems(); }, mode: m => { if (m) mode = m; return mode; }, hud, fig, figure, act, fire, sleep, scare, ending, target: () => target,
  };
  frame();
})();
