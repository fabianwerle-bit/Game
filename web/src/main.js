import * as THREE from 'three';
import { loadAssets } from './assets.js';
import { createWorld, ISLET } from './world.js';
import { createScenery } from './scenery.js';
import { createBuildings, texBox } from './buildings.js';
import { createBus } from './bus.js';
import { createWeather } from './weather.js';
import { createAudio } from './audio.js';
import { createPost, createGrass } from './fx.js';
import { createStalker, makeFigure } from './stalker.js';
import { createDetails } from './details.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createAdmin } from './admin.js';
import { NOTES, WIND, WAKE, ENDING, ENDING_B, TAPES, PHONE, PHOTO, OMEN, objective } from './story.js';

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

const SAVE = 'la_save3';
const FOOD = { apple: 12, can: 26, longlife: 40 };
// einfarbige Strich-Symbole (24x24)
const ICON = {
  lamp: '<path d="M3 9h9l4-3h5v12h-5l-4-3H3z"/><path d="M8 9v6"/>',
  can: '<ellipse cx="12" cy="6" rx="6" ry="2.2"/><path d="M6 6v12c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V6"/><path d="M6 11c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2"/>',
  longlife: '<rect x="4" y="7" width="16" height="11"/><path d="M4 11h16M10 7v4M14 14h3"/>',
  apple: '<path d="M12 8c-3.5-2-7 .5-7 5s3 8 7 6.5c4 1.500 7-2 7-6.500s-3.500-7-7-5z"/><path d="M12 8c0-2 1-3.500 3-4"/>',
  gun: '<path d="M3 8h17v4h-7l-1 3H8.500L7 20H3z"/><path d="M12 12v2"/>',
  key: '<circle cx="7.500" cy="12" r="3.500"/><path d="M11 12h10M17 12v3M20.500 12v2.500"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.500h7M9 18h4"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  fuse: '<rect x="5" y="9" width="14" height="6" rx="1"/><path d="M2 12h3M19 12h3M9 9v6M15 9v6"/>',
  tape: '<rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="8.500" cy="12" r="2"/><circle cx="15.500" cy="12" r="2"/><path d="M7 18l1.500-2.500h7L17 18"/>',
  radio: '<rect x="3" y="9" width="18" height="10" rx="1"/><circle cx="8" cy="14" r="2.500"/><path d="M14 12.500h4M14 15.500h4M7 9l9-5"/>',
  planks: '<path d="M3 8h18v3H3zM3 13h18v3H3z"/><path d="M6 8v8M18 8v8"/>',
  tyre: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="3.500"/>',
  carbatt: '<rect x="3" y="8" width="18" height="11"/><path d="M6 8V5.500h3V8M15 8V5.500h3V8M6 13h3M15 13h3M16.500 11.500v3"/>',
};
const NAME = { lamp: 'Licht', can: 'Konserve', longlife: 'Ration', apple: 'Apfel', gun: 'Pistole', notes: 'Notizen', key: 'Schlüssel', map: 'Karte', fuse: 'Sicherung', tape: 'Kassette', radio: 'Radio', planks: 'Bretter', tyre: 'Reifen', carbatt: 'Batterie' };
const HOUR = 30, SLEEP_FROM = 22, HUNT_FROM = 20.5, DAWN = 30;

(async function boot() {
  const audio = createAudio();
  let assets;
  try { assets = await loadAssets(renderer, p => { $('load').firstElementChild.style.width = (p * 100).toFixed(0) + '%'; }); }
  catch (e) { $('sub0').textContent = 'Fehler beim Laden: ' + (e?.message || e); throw e; }
  scene.environment = assets.env;
  const world = createWorld(assets, scene);
  const scenery = createScenery(assets, world, scene);
  const built = createBuildings(assets, world, scene);
  const bus = createBus(scene, world, assets);
  const weather = createWeather(scene, renderer, world, scenery);
  const items = built.items, fx = built.fx;
  const details = createDetails(world, scene, fx);
  const stalker = createStalker(scene, world, assets, fx.park);
  grass = createGrass(assets, world, scene); post = createPost(renderer); applyQual();
  let runs = +(localStorage.getItem('la_runs') || 0); fx.tally(runs);

  const torch = new THREE.SpotLight(0xfff1d6, 0, 42, 0.42, 0.5, 1.4); torch.position.set(0.25, -0.2, 0.1); camera.add(torch); torch.target.position.set(0, -0.05, -6); camera.add(torch.target);
  const local = new THREE.PointLight(0xffffff, 0, 20, 1.6); scene.add(local);
  const gunVM = new THREE.Group(); { const m = assets.M.service_pistol.clone(); m.rotation.y = Math.PI / 2 + 0.22; m.rotation.z = 0.06; gunVM.add(m); } gunVM.position.set(0.2, -0.19, -0.5); gunVM.visible = false; camera.add(gunVM);
  const fig = makeFigure(false); scene.add(fig); fig.visible = false;
  const figure = { t: 30, life: 0, d0: 0 };
  // Vorzeichen am Morgen: Reifenspuren, Rollstuhl; abgestelltes Kofferradio
  const tracks = new THREE.Group(); for (const s of [-0.7, 0.7]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 11), new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); m.rotation.x = -Math.PI / 2; m.position.set(s, 0.06, -8.5); tracks.add(m); } tracks.visible = false; scene.add(tracks);
  const chair = assets.M.wheelchair_01.clone(); chair.visible = false; scene.add(chair);
  const boom = assets.M.boombox.clone(); boom.scale.setScalar(0.7); boom.visible = false; scene.add(boom);
  const barMat = built.mats.planks;
  // echte Spiegel: Hausspiegel (nur der nächste rendert) und Rückspiegel im Bus
  const mirrors = (fx.mirrorObjs || []).map(o => { const r = new Reflector(new THREE.PlaneGeometry(0.3, 0.5), { textureWidth: 256, textureHeight: 448, clipBias: 0.003, color: 0x8a8f8c }); r.position.set(0, -0.045, 0.035); r.visible = false; o.add(r); return r; });
  const rearMirror = new Reflector(new THREE.PlaneGeometry(0.175, 0.042), { textureWidth: 384, textureHeight: 96, clipBias: 0.003, color: 0x9a9f9c }); rearMirror.position.set(0, 1.76, 0.9605); rearMirror.rotation.y = Math.PI; rearMirror.visible = false; bus.group.add(rearMirror); bus.mirrorFig.visible = false;

  // --- Spielzustand ---
  const fresh = () => ({ day: 1, hour: 8.5, hunger: 78, fuel: 46, inv: { apple: 0, can: 0, longlife: 0 }, ammo: 0, gun: false, armed: false, key: false, fuse: false, map: false, batt: 100, spare: 0, tapes: [], heard: [], tyres: 0, flat: false, flatDay: 0, dead: false, carbatt: 0, radioOff: false, planks: 0, boombox: 0, sketches: [], ngp: false, polaroids: 0, stats: { km: 0, shots: 0, close: 0 }, up: {}, locked: false, seen: {}, phone: {}, sleepAt: null, waiting: false,
    notes: [], picked: [], doors: {}, wnote: 0, scares: {}, inMine: false, onIslet: false, bus: { ...fx.start.bus }, pl: { ...fx.start.pl }, mode: 'walk', lights: false, torch: false });
  let S = fresh();
  const pl = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0, bob: 0, look: 0 };
  let mode = 'menu', busy = false, paused = false, tSave = 0, tHud = 0, target = null, dread = 0, shake = 0, fireCd = 0, flashT = 0, lastZone = null, endCam = null;
  let admin = null, C = {}, flyH = 0, photoPrev = null, lastDist = 0;
  let hideSpot = null, distract = null, blackout = 0, falseT = 80, mirT = 40, ringT = 0, hornT = 0, driveT = 0, cineS = null, subQ = [], subT = 0, lastHunt = false;
  const cap = () => S.up.tank ? 130 : 100;
  const visible = it => !S.picked.includes(it.id) && (!it.req || it.req(S));
  const hbW = (lx, lz) => { const o = world.pois.harbor, f = o.face; return { x: o.x + lx * Math.cos(f) + lz * Math.sin(f), z: o.z - lx * Math.sin(f) + lz * Math.cos(f) }; };
  const setBar = (d, on) => {
    if (on && !d.bar) { const g = new THREE.Group(); g.position.set(d.x, d.y, d.z); g.rotation.y = d.ry; for (const [y, r] of [[0.6, 0.12], [1.15, -0.1], [1.7, 0.07]]) { const p = texBox(d.w + 0.7, 0.16, 0.05, barMat, 1.5); p.position.set(0, y, 0.16); p.rotation.z = r; g.add(p); } scene.add(g); const box = { x: d.x, z: d.z, hw: d.w / 2 + 0.1, hd: 0.2, c: Math.cos(d.ry), s: Math.sin(d.ry) }; world.boxes.push(box); d.bar = { g, box }; }
    else if (!on && d.bar) { scene.remove(d.bar.g); d.bar.box.x = 1e6; d.bar = null; }
  };
  const refreshItems = () => {
    for (const it of items) it.obj.visible = visible(it); for (const id in fx.doors) S.doors[id] ? fx.doors[id].open() : fx.doors[id].close();
    bus.wsNote.visible = !!S.wnote; fx.ferry.mat.map = S.day >= 3 ? fx.ferry.b : fx.ferry.a; fx.setPhotos(S.day); bus.lightbar.visible = !!S.up.light; bus.flat = S.flat; bus.dead = S.dead; world.mine.on = !!S.inMine;
  };
  const applyState = () => {
    bus.place(S.bus.x, S.bus.z, S.bus.h); bus.fuel = S.fuel; bus.lights = S.lights;
    pl.x = S.pl.x; pl.z = S.pl.z; pl.yaw = S.pl.yaw; pl.pitch = 0; pl.look = 0; refreshItems(); pl.y = world.ground(pl.x, pl.z);
    for (const d of fx.doorways) setBar(d, false); stalker.reset(); fig.visible = false; tracks.visible = chair.visible = boom.visible = false; distract = null; hideSpot = null; mode = S.mode || 'walk';
  };
  const save = () => { if (S.ngp) return; S.bus = { x: bus.x, z: bus.z, h: bus.heading }; S.fuel = bus.fuel; S.lights = bus.lights; S.pl = { x: pl.x, z: pl.z, yaw: pl.yaw }; S.mode = mode === 'walk' || mode === 'hide' ? 'walk' : 'rear'; try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch { } };

  // --- Anzeige ---
  let msgT = 0;
  const say = (t, sec = 6) => { const m = $('msg'); m.textContent = t; m.style.opacity = 1; msgT = sec; };
  const subs = (lines, gap = 3.6) => { subQ = lines.slice(); subT = 0; subQ.gap = gap; };
  const show = (id, on) => { const e = $(id), v = on ? 'flex' : 'none'; if (e.style.display !== v) e.style.display = v; };
  const setTxt = (id, t) => { const e = $(id); if (e.textContent !== t) e.textContent = t; };
  let invKey = '';
  const hud = () => {
    const hh = S.hour % 24, h = Math.floor(hh), m = Math.floor((hh - h) * 60);
    setTxt('day', `Tag ${S.day} · ${String(h).padStart(2, '0')}:${String(m - m % 10).padStart(2, '0')}`);
    $('hHunger').style.width = S.hunger + '%'; $('hHunger').style.background = S.hunger < 22 ? '#a8463a' : '';
    $('hFuel').style.width = Math.min(100, bus.fuel / cap() * 100) + '%'; $('hFuel').style.background = bus.fuel < 12 ? '#a8463a' : '';
    if (!S.ngp) setTxt('obj', '→ ' + objective(S));
    const drive = mode === 'drive', inBus = drive || mode === 'rear';
    document.body.classList.toggle('drive', drive);
    show('bSet', mode !== 'menu' && mode !== 'end' && mode !== 'photo'); show('bGas', drive); show('bBrk', drive); show('bBack', drive && !S.ngp && Math.abs(bus.v) < 0.5); show('bRadio', drive); $('bRadio').classList.toggle('on', !S.radioOff); show('bFire', mode !== 'hide' && S.gun && S.armed);
    gunVM.visible = (mode === 'walk' || inBus) && S.gun && S.armed;
    const slots = [['lamp', S.spare || '', drive ? bus.lights : S.torch, drive ? -1 : S.batt]];
    for (const k of ['can', 'longlife', 'apple']) if (S.inv[k]) slots.push([k, S.inv[k], false]);
    if (S.gun) slots.push(['gun', S.ammo, S.armed]);
    if (S.map) slots.push(['map', '', false]);
    if (S.key) slots.push(['key', '', false]);
    if (S.fuse) slots.push(['fuse', '', false]);
    if (S.planks) slots.push(['planks', S.planks, false]);
    if (S.boombox) slots.push(['radio', S.boombox, false]);
    if (S.tyres) slots.push(['tyre', S.tyres, false]);
    if (S.carbatt) slots.push(['carbatt', S.carbatt, false]);
    if (S.tapes.length) slots.push(['tape', S.tapes.length - S.heard.length || '', false]);
    slots.push(['notes', S.notes.length || '', false]);
    const key = JSON.stringify(slots);
    if (key !== invKey) { invKey = key; $('inv').innerHTML = slots.map(([k, n, on, bar]) => `<div class="slot${on ? ' on' : ''}" data-k="${k}">${bar >= 0 ? `<u><i style="width:${Math.round(bar)}%"></i></u>` : ''}<svg viewBox="0 0 24 24">${ICON[k]}</svg>${n !== '' ? `<b>${n}</b>` : ''}<small>${NAME[k]}</small></div>`).join(''); }
  };
  const toggleLamp = () => { if (mode === 'drive') bus.lights = !bus.lights; else { if (!S.torch && S.batt <= 0) { if (S.spare > 0) { S.spare--; S.batt = 100; } else return say('Die Batterien sind leer.', 3); } S.torch = !S.torch; } audio.blip(240); };
  $('inv').addEventListener('pointerdown', e => {
    const k = e.target.closest('.slot')?.dataset.k; if (!k || busy || mode === 'cine') return; e.preventDefault(); audio.init();
    if (k === 'lamp') toggleLamp();
    else if (FOOD[k]) eat(k);
    else if (k === 'gun') { S.armed = !S.armed; audio.click(); }
    else if (k === 'notes') journal();
    else if (k === 'map') openMap();
    else if (k === 'key') say('Ein alter Schlüssel. Er passt zum Leuchtturm.', 3);
    else if (k === 'fuse') say('Die Hauptsicherung. Schwer für so ein kleines Ding.', 3);
    else if (k === 'planks') say('Bretter. An einer Haustür kannst du sie von innen vornageln.', 4);
    else if (k === 'tyre') say('Ein Ersatzreifen. Am Bus kannst du ihn wechseln.', 3);
    else if (k === 'carbatt') say('Eine Autobatterie. Schwer. Am Bus kannst du sie einbauen.', 3);
    else if (k === 'tape') say('Kassetten. Der Rekorder steht hinten im Bus auf der Küchenzeile.', 4);
    else if (k === 'radio') placeRadio();
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
    if (S.sketches.length) { const hd = document.createElement('div'); hd.className = 'n'; const b = document.createElement('b'); b.textContent = 'Skizzen'; hd.append(b); const wrap = document.createElement('div'); wrap.className = 'sk'; for (const k of S.sketches) { const f = document.createElement('figure'), c = document.createElement('canvas'); c.width = 150; c.height = 110; sketchInto(c, k); const cap = document.createElement('figcaption'); cap.textContent = SKETCH[k][0]; f.append(c, cap); wrap.append(f); } hd.append(wrap); j.append(hd); }
    show('journal', true);
  };
  $('journal').addEventListener('pointerup', e => { if (e.target.id === 'journal') { show('journal', false); paused = false; } });
  // --- Karte (handgezeichnet) ---
  const PLACES = { harbor: 'Hafen', village: 'Grauwik', station: 'Tankstelle', cabin: 'Jagdhütte', light: 'Leuchtturm', camp: 'Camp', mine: 'Bergwerk', mast: 'Sendemast', wreck: 'Wrack', islet: 'Nebeninsel' };
  const placePos = k => world.pois[k] || world.spots[k];
  function openMap() {
    paused = true; const c = $('mapC'), x = c.getContext('2d'), W = c.width, Hh = c.height, sc = 1.16, T = (wx, wz) => [W / 2 + wx * sc, Hh / 2 + wz * sc * 0.98 - 10];
    x.fillStyle = '#cfc6ac'; x.fillRect(0, 0, W, Hh); for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(60,50,30,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * Hh, 2 + Math.random() * 3, 1 + Math.random() * 2); }
    x.strokeStyle = 'rgba(40,36,48,.14)'; x.lineWidth = 1; for (let g = 0; g < W; g += 250) { x.beginPath(); x.moveTo(g, 0); x.lineTo(g, Hh); x.stroke(); } x.beginPath(); x.moveTo(0, Hh / 2); x.lineTo(W, Hh / 2); x.stroke();
    const jit = () => (Math.random() - 0.5) * 1.6;
    x.strokeStyle = '#2a2632'; x.lineWidth = 2.4; x.lineJoin = 'round'; x.fillStyle = 'rgba(120,125,95,.22)'; x.beginPath();
    for (let a = 0; a <= 180; a++) { const th = a / 180 * Math.PI * 2, r = world.coastR(th), [px, py] = T(Math.cos(th) * r, Math.sin(th) * r); a ? x.lineTo(px + jit(), py + jit()) : x.moveTo(px, py); } x.closePath(); x.fill(); x.stroke();
    { const [ix, iy] = T(ISLET.x, ISLET.z); x.beginPath(); x.ellipse(ix, iy, 21, 18, 0.4, 0, 7); x.fill(); x.stroke(); }
    world.roads.forEach((r, i) => { x.beginPath(); x.lineWidth = i === 0 ? 3.4 : r.dirt ? 1.4 : 2.4; x.setLineDash(r.dirt ? [7, 5] : []); x.strokeStyle = '#3a2f2a'; r.pts.forEach((p, k) => { if (k % 3 && k !== r.pts.length - 1) return; const [px, py] = T(p.x, p.z); k ? x.lineTo(px + jit() * 0.5, py + jit() * 0.5) : x.moveTo(px, py); }); if (r.closed) x.closePath(); x.stroke(); }); x.setLineDash([]);
    x.font = 'italic 21px "Segoe Script","Bradley Hand",cursive'; x.textAlign = 'center';
    for (const k in PLACES) { const p = placePos(k), [px, py] = T(p.x, p.z), seen = S.seen[k] || k === 'harbor'; x.strokeStyle = '#2a2632'; x.lineWidth = 2; x.beginPath(); if (seen) { x.rect(px - 5, py - 5, 10, 10); x.fillStyle = '#2a2632'; x.fill(); x.fillText(PLACES[k], px, py - 12); } else { x.fillStyle = '#2a2632'; x.fillText('?', px, py + 7); } x.stroke(); }
    x.font = '15px "Segoe Script","Bradley Hand",cursive'; x.fillStyle = '#2a2632'; x.fillText('N', W - 60, 58); x.beginPath(); x.moveTo(W - 60, 100); x.lineTo(W - 60, 66); x.lineTo(W - 66, 78); x.moveTo(W - 60, 66); x.lineTo(W - 54, 78); x.stroke();
    x.textAlign = 'left'; x.font = 'italic 26px "Segoe Script","Bradley Hand",cursive'; x.fillText('Insel Grauwik', 34, 52); x.font = '13px sans-serif'; x.globalAlpha = 0.6; x.fillText('▢ Bus    ▲ du    – – – Waldweg', 36, Hh - 26); x.globalAlpha = 1;
    if (!S.inMine) { const [bx, by] = T(bus.x, bus.z); x.strokeStyle = '#7a1c16'; x.lineWidth = 2.5; x.strokeRect(bx - 6, by - 6, 12, 12);
      if (C.showStalker && stalker.active) { const [sx2, sy2] = T(stalker.out ? stalker.mx : stalker.x, stalker.out ? stalker.mz : stalker.z); x.fillStyle = '#000'; x.beginPath(); x.arc(sx2, sy2, 7, 0, 7); x.fill(); x.fillText('Er', sx2 + 10, sy2 + 5); }
      const [qx, qy] = T(pl.x, pl.z), a = mode === 'walk' || mode === 'hide' ? pl.yaw : bus.heading + Math.PI; x.fillStyle = '#7a1c16'; x.save(); x.translate(qx, qy); x.rotate(-a); x.beginPath(); x.moveTo(0, -11); x.lineTo(7, 8); x.lineTo(-7, 8); x.closePath(); x.fill(); x.restore(); }
    show('map', true);
  }
  $('map').addEventListener('pointerup', () => { show('map', false); paused = false; });
  const choose = (text, opts) => { paused = true; $('chT').textContent = text; const b = $('chB'); b.innerHTML = ''; opts.forEach(([label, fn]) => { const e = document.createElement('button'); e.className = 'b'; e.textContent = label; e.onclick = () => { show('choice', false); paused = false; fn && fn(); }; b.append(e); }); show('choice', true); };

  // --- Skizzen im Notizbuch: einfache Bleistiftzeichnungen (Linienzüge in 0..100) ---
  const SKETCH = {
    harbor: ['Der Hafen', [[5,70,95,70],[20,70,20,50,45,50,45,70],[60,70,60,30],[60,30,80,45,60,45],[5,80,30,76,55,82,80,77,95,80]]],
    village: ['Grauwik', [[8,75,8,50,22,36,36,50,36,75,8,75],[44,75,44,45,58,32,72,45,72,75,44,75],[50,75,50,60,58,60,58,75],[80,75,80,30],[76,36,84,36],[0,75,100,75]]],
    station: ['Die Tankstelle', [[10,35,90,35,90,42,10,42,10,35],[20,42,20,78],[80,42,80,78],[40,78,40,55,50,55,50,78],[58,78,58,55,68,55,68,78],[0,78,100,78]]],
    cabin: ['Die Jagdhütte', [[20,78,20,50,50,28,80,50,80,78,20,78],[42,78,42,58,54,58,54,78],[60,56,72,56,72,66,60,66,60,56],[64,34,64,20,70,20,70,38]]],
    light: ['Der Leuchtturm', [[40,85,44,30,56,30,60,85,40,85],[41,62,59,62],[42,46,58,46],[42,30,42,20,58,20,58,30],[46,20,50,10,54,20],[60,24,95,14],[60,26,95,34]]],
    camp: ['Das Camp', [[10,78,32,40,54,78,10,78],[32,40,32,78],[58,78,74,52,90,78,58,78],[40,84,46,76,52,84]]],
    mine: ['Das Bergwerk', [[5,80,25,30,50,18,75,30,95,80],[38,80,38,52,62,52,62,80],[38,52,50,44,62,52],[44,80,50,60],[56,80,50,60],[30,90,70,90]]],
    mast: ['Der Sendemast', [[35,90,50,8,65,90],[40,62,60,62],[43,44,57,44],[46,26,54,26],[40,62,57,44],[60,62,43,44],[50,8,50,2]]],
    wreck: ['Das Wrack', [[10,70,30,84,74,80,92,58],[10,70,92,58],[40,68,56,14],[62,64,74,22],[56,14,72,30,46,50],[0,88,100,86]]],
    islet: ['Die Nebeninsel', [[15,70,35,58,65,56,85,70],[40,58,40,42,60,42,60,57],[0,74,20,72,40,76,60,72,80,76,100,73],[0,84,100,82]]],
    man: ['Er', [[50,14,44,22,50,30,56,22,50,14],[50,30,50,66],[50,36,36,62],[50,36,64,62],[50,66,42,94],[50,66,58,94]]],
    car: ['Das Auto unter der Plane', [[8,74,14,52,34,40,66,40,84,52,92,74,8,74],[14,52,84,52],[24,74,24,82],[76,74,76,82],[30,60,40,48],[58,48,70,62]]],
  };
  const sketchInto = (cv, key) => { const x = cv.getContext('2d'), W = cv.width, H = cv.height; x.fillStyle = '#d9d2bd'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(30,26,38,.8)'; x.lineJoin = x.lineCap = 'round';
    for (const L of SKETCH[key][1]) for (let pass = 0; pass < 2; pass++) { x.lineWidth = pass ? 0.7 : 1.3; x.beginPath(); for (let i = 0; i < L.length; i += 2) { const px = L[i] / 100 * W + (Math.random() - 0.5) * 2.2, py = L[i + 1] / 100 * H + (Math.random() - 0.5) * 2.2; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); } };
  const addSketch = (key) => { if (!SKETCH[key] || S.sketches.includes(key)) return; S.sketches.push(key); say(`Du skizzierst es ins Notizbuch: ${SKETCH[key][0]}.`, 3); };
  // --- Sequenzen ---
  const cine = (dur, camFn, text, done) => { cineS = { t: 0, dur, camFn, done, prev: mode }; mode = 'cine'; document.body.classList.add('cine'); if (text) say(text, dur - 0.8); };
  const through = (fn, text, sec = 1.8) => { busy = true; $('fade').style.opacity = 1; setTimeout(() => { fn(); if (text) say(text, 6); $('fade').style.opacity = 0; busy = false; hud(); }, sec * 1000); };

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
  const scare = (face, vol = 1) => { admin?.vib(face ? 250 : 120); audio.sting(vol); post.u.uPulse.value = 1; shake = 0.9; if (face) { drawFace(); fc.style.display = 'block'; setTimeout(() => { fc.style.display = 'none'; }, 480); } };
  const figAt = (dist, behind, life, vol) => { camera.getWorldDirection(v3); const s = behind ? -1 : 1, x = pl.x + v3.x * dist * s, z = pl.z + v3.z * dist * s; fig.position.set(x, pl.y - 0.03, z); fig.rotation.y = Math.atan2(pl.x - x, pl.z - z); fig.visible = true; figure.life = life; figure.d0 = 0; if (vol) scare(false, vol); };
  const roomScare = () => figAt(2.6, false, 0.42, 1);

  // --- Eingabe ---
  const inp = { mx: 0, mz: 0, gas: 0, brake: 0, keys: {} };
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
  const stick = $('stick'), knob = stick.firstElementChild;
  canvas.addEventListener('pointerdown', e => {
    if (mode === 'menu' || mode === 'cine') return; audio.init();
    if (mode === 'photo' && e.clientX > innerWidth - 90 && e.clientY < 80) { mode = photoPrev; document.body.classList.remove('photo'); paused = false; hud(); return; }
    if (e.pointerType === 'mouse') { canvas.requestPointerLock?.(); return; }
    if (e.clientX < innerWidth * 0.42 && stickId === null && mode !== 'rear' && mode !== 'hide') { stickId = e.pointerId; sx = e.clientX; sy = e.clientY; stick.style.display = 'block'; stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; knob.style.transform = ''; }
    else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
    canvas.setPointerCapture(e.pointerId);
  });
  const look = (dx, dy) => { const k = 0.0042 * (admin?.set.sens || 1); if (mode === 'drive') pl.look = Math.max(-2.3, Math.min(2.3, pl.look - dx * k)); else if (mode === 'rear') pl.look -= dx * k; else pl.yaw -= dx * k; pl.pitch = Math.max(-1.35, Math.min(1.35, pl.pitch - dy * k)); };
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) { let dx = e.clientX - sx, dy = e.clientY - sy; const l = Math.hypot(dx, dy), R = 55; if (l > R) { dx *= R / l; dy *= R / l; } inp.mx = dx / R; inp.mz = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === lookId) { look(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; }
  });
  const up = e => { if (e.pointerId === stickId) { stickId = null; inp.mx = inp.mz = 0; stick.style.display = 'none'; } if (e.pointerId === lookId) lookId = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) look(e.movementX * 0.6, e.movementY * 0.6); });
  addEventListener('keydown', e => { inp.keys[e.code] = 1; if (mode === 'menu' || mode === 'cine' || e.repeat) return; if (e.code === 'KeyE') act(); if (e.code === 'KeyF') { toggleLamp(); hud(); } if (e.code === 'KeyQ') eat(); if (e.code === 'KeyG') { S.armed = !S.armed; hud(); } if (e.code === 'Space') fire(); if (e.code === 'KeyB') back(); if (e.code === 'KeyJ') journal(); if (e.code === 'KeyM' && S.map) openMap(); });
  addEventListener('keyup', e => { inp.keys[e.code] = 0; });
  const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); audio.init(); fn(); });
  const hold = (id, key) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); inp[key] = 1; el.classList.add('on'); }); const off = () => { inp[key] = 0; el.classList.remove('on'); }; el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); };
  hold('bGas', 'gas'); hold('bBrk', 'brake');

  // --- Aktionen ---
  const exitBus = () => {
    const c = Math.cos(bus.heading), s = Math.sin(bus.heading); let sides = [-1.8, 1.8];
    if (stalker.out) sides.sort((a, b) => Math.hypot(bus.x + c * b - stalker.mx, bus.z - s * b - stalker.mz) - Math.hypot(bus.x + c * a - stalker.mx, bus.z - s * a - stalker.mz)); // weg von ihm
    for (const side of sides) { const p = { x: bus.x + c * side, z: bus.z - s * side }; if (world.ground(p.x, p.z) > 0.5 && !world.collide({ ...p }, 0.3)) { pl.x = p.x; pl.z = p.z; pl.y = world.ground(p.x, p.z); pl.yaw = bus.heading + (side < 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI; pl.look = 0; pl.pitch = 0; mode = 'walk'; S.locked = false; audio.door(); hud(); return true; } }
    say('Hier ist kein Platz zum Aussteigen.', 2); return false;
  };
  const readWind = () => { const d = S.wnote; S.wnote = 0; bus.wsNote.visible = false; readNote('w' + d, 'Zettel an der Windschutzscheibe', WIND[Math.min(6, d)]); if (d >= 5) { weather.flash = 1; audio.thunder(0.3); } };
  const placeRadio = () => { if (mode !== 'walk' || !S.boombox) return say('Stell es draußen ab.', 2); S.boombox--; camera.getWorldDirection(v3); const x = pl.x + v3.x * 0.9, z = pl.z + v3.z * 0.9; boom.position.set(x, world.ground(x, z), z); boom.rotation.y = pl.yaw; boom.visible = true; distract = { x, z, t: 50, radio: true }; say('Das Radio plärrt los. Das hört man weit.', 4); };
  const enterMine = () => through(() => { admin.award('mine'); S.inMine = true; world.mine.on = true; pl.x = fx.mineSpawn.x; pl.z = fx.mineSpawn.z; pl.y = world.mine.y; pl.yaw = -Math.PI / 2; pl.pitch = 0; if (!S.seen.mineIn) { S.seen.mineIn = 1; } }, 'Kalte Luft. Es riecht nach nassem Stein und Öl.');
  const leaveMine = () => through(() => { S.inMine = false; world.mine.on = false; const p = world.pois.mine, f = p.face; pl.x = fx.mineIn.x + Math.sin(f) * 2.2; pl.z = fx.mineIn.z + Math.cos(f) * 2.2; pl.y = world.ground(pl.x, pl.z); pl.yaw = f + Math.PI; });
  const boatMenu = () => choose('Ein Ruderboot mit Außenborder. Der Tank ist leer.', [
    ['Zur Nebeninsel', () => boatGo('islet')], ['Aufs offene Meer', () => boatGo('sea')], ['Bleiben', null]]);
  const boatGo = (where) => {
    if (Math.hypot(bus.x - pl.x, bus.z - pl.z) > 90) return say('Du brauchst Benzin aus dem Bus. Er steht zu weit weg – fahr ihn an den Kai.', 5);
    if (bus.fuel < 15) return say('Im Bus ist zu wenig Sprit, um etwas abzuzapfen.', 4);
    bus.fuel -= 15; audio.door();
    if (where === 'sea') through(() => { S.hour = Math.min(DAWN - 0.2, S.hour + 1.5); S.hunger = Math.max(5, S.hunger - 6); }, 'Du fährst eine Stunde geradeaus. Dann taucht ein Steg aus dem Nebel auf. Derselbe Steg.', 3);
    else through(() => { admin.award('islet'); S.onIslet = true; pl.x = fx.isletSpawn.x; pl.z = fx.isletSpawn.z; pl.y = world.ground(pl.x, pl.z); pl.yaw = fx.isletSpawn.yaw; S.hour = Math.min(DAWN - 0.2, S.hour + 0.4); S.seen.islet = 1; }, 'Eine winzige Insel. Eine Ruine. Hier draußen ist es still.', 2.6);
  };
  const boatBack = () => through(() => { S.onIslet = false; const p = hbW(0, -55); pl.x = p.x; pl.z = p.z; pl.y = world.ground(p.x, p.z); pl.yaw = world.pois.harbor.face + Math.PI; S.hour = Math.min(DAWN - 0.2, S.hour + 0.4); }, 'Der Steg. Der Bus steht noch da.', 2.6);
  const playTape = () => { const id = S.tapes.find(t => !S.heard.includes(t)) || S.tapes[S.tapes.length - 1]; if (!id) return say('Du hast keine Kassette.', 3); if (!S.heard.includes(id)) S.heard.push(id); if (S.heard.length >= 5) admin.award('tapes'); audio.click(); audio.hiss(TAPES[id].length * 3.6 + 1); subs(TAPES[id]); hud(); };
  function act() {
    if (busy || paused || mode === 'cine') return;
    if (mode === 'hide') { mode = 'walk'; hideSpot = null; hud(); return; }
    if (mode === 'drive') {
      if (S.ngp) return say('Du bleibst im Wagen. Du hast keine Zeit.', 3);
      if (S.wnote) return readWind();
      if (Math.abs(bus.v) > 1) return say('Erst anhalten.', 2);
      exitBus(); return;
    }
    if (mode === 'rear') {
      const id = target?.spot; if (!id) return;
      if (id === 'bed') sleep();
      else if (id === 'cook') { if (!S.inv.can) return say('Du hast keine Konserve zum Aufwärmen.', 3); if (S.hunger > 92) return say('Du hast keinen Hunger.', 2); S.inv.can--; S.hunger = Math.min(100, S.hunger + 40); audio.blip(520); say('Warmes Essen. Für einen Moment ist alles gut.', 4); hud(); }
      else if (id === 'todo') readNote('todo', NOTES.todo.t, NOTES.todo.x + (runs > 0 ? `\n\nPS: Du warst schon ${runs}-mal hier. Sieh im Bergwerk nach.` : ''));
      else if (id === 'seat') { mode = 'drive'; pl.look = 0; pl.pitch = 0; hud(); if (S.dead) say('Der Schlüssel dreht sich. Nichts. Die Batterie ist leer – in der Werkstatt an der Tankstelle oder in der Lagerhalle liegt eine.', 8); else if (bus.fuel <= 0) say('Der Tank ist leer.', 3); else if (S.flat) say('Ein Reifen ist platt. So kommst du kaum voran.', 4); else if (S.wnote) say('An der Scheibe klemmt ein Zettel.', 4); }
      else if (id === 'exit') exitBus();
      else if (id === 'lock') { S.locked = !S.locked; audio.click(); say(S.locked ? (S.up.lock ? 'Verriegelt. Der neue Riegel hält einiges aus.' : 'Verriegelt. Lange hält das Schloss nicht.') : 'Entriegelt.', 3); }
      else if (id === 'tape') playTape();
      return;
    }
    if (!target) return;
    if (target.item) {
      const it = target.item, ty = it.type;
      if (ty === 'note') { if (!it.keep) { S.picked.push(it.id); it.obj.visible = false; } readNote(it.note, NOTES[it.note].t, NOTES[it.note].x); return; }
      it.obj.visible = false; S.picked.push(it.id); audio.blip(ty === 'fuel' ? 440 : 700);
      if (ty === 'fuel') { bus.fuel = Math.min(cap(), bus.fuel + 28); say('Benzinkanister – in den Bus gekippt.', 3); }
      else if (ty === 'ammo') { S.ammo += 4; say(S.gun ? 'Munition. Vier Schuss.' : 'Munition. Vier Schuss – aber wofür?', 3); }
      else if (ty === 'pistol') { S.gun = true; S.armed = true; S.ammo += 6; say('Eine Dienstpistole. Sechs Schuss. Tippe sie im Inventar an, um sie wegzustecken.', 6); }
      else if (ty === 'key') { S.key = true; say('Der Schlüssel zum Leuchtturm.', 4); setTimeout(roomScare, 900); save(); }
      else if (ty === 'battery') { if (S.batt < 45) S.batt = 100; else S.spare++; say('Batterien für die Taschenlampe.', 3); }
      else if (ty === 'tape') { S.tapes.push(it.tape); say('Eine Kassette. Auf dem Etikett: deine Handschrift. Der Rekorder steht im Bus.', 5); }
      else if (ty === 'map') { S.map = true; say('Eine Inselkarte. Tippe sie im Inventar an.', 5); admin.award('map'); save(); }
      else if (ty === 'polaroid') { S.polaroids++; say(`Ein Polaroid. Ein Stück Strand, ein Stück Bus. ${S.polaroids} von 6.` + (S.polaroids === 6 ? ' Zusammen zeigen sie den Hafen – und dich, wie du ankommst. Von oben fotografiert.' : ''), 6); if (S.polaroids >= 6) admin.award('polaroids'); }
      else if (ty === 'tyre') { S.tyres++; say('Ein Ersatzreifen.', 3); }
      else if (ty === 'carbatt') { S.carbatt++; say('Eine Autobatterie. Falls der Bus einmal nicht anspringt.', 4); }
      else if (ty === 'lightbar') { S.up.light = 1; bus.lightbar.visible = true; say('Zusatzscheinwerfer – aufs Busdach geschraubt. Das Licht reicht jetzt weiter.', 5); }
      else if (ty === 'lockkit') { S.up.lock = 1; say('Ein schwerer Türriegel. Im Bus eingebaut hält er ihn länger auf.', 5); }
      else if (ty === 'canister') { S.up.tank = 1; bus.fuel = Math.min(130, bus.fuel + 20); say('Ein Reservekanister. Der Bus fasst jetzt mehr Sprit.', 5); }
      else if (ty === 'planks') { S.planks++; say('Bretter. Damit lässt sich eine Haustür verrammeln.', 4); }
      else if (ty === 'boombox') { S.boombox++; say('Ein Kofferradio. Laut genug, um jemanden wegzulocken.', 5); }
      else { S.inv[ty]++; say(it.name + ' eingesteckt.', 2); }
      hud();
    } else if (target.door) {
      const d = target.door, ok = d.id === 'office' ? S.day >= 3 : S.key;
      if (ok) { S.doors[d.id] = true; d.open(); audio.door(); say(d.id === 'office' ? 'Die Tür ist offen. Niemand da.' : 'Der Schlüssel dreht sich schwer.', 3); save(); }
      else { audio.knock(); const k = d.id === 'office' ? 'officedoor' : 'lightdoor'; readNote(k, NOTES[k].t, NOTES[k].x); }
    } else if (target.wind) readWind();
    else if (target.radio) { if (S.fuse) ending(ENDING, 'a'); else readNote('nofuse', NOTES.nofuse.t, NOTES.nofuse.x); }
    else if (target.fusebox) { S.fuse = true; audio.click(); say('Die Hauptsicherung. Das rote Licht erlischt.', 4); setTimeout(() => { audio.knock(); audio.knock(0.5); say('Schritte im Stollen. Hinter dir.', 4); }, 2500); setTimeout(() => figAt(3.5, true, 2.5, 0.8), 5200); save(); hud(); }
    else if (target.mineIn) enterMine();
    else if (target.mineOut) leaveMine();
    else if (target.boat) boatMenu();
    else if (target.boat2) boatBack();
    else if (target.hide) { hideSpot = target.hide; mode = 'hide'; S.torch = false; pl.pitch = 0; say('Du hältst den Atem an.', 3); hud(); }
    else if (target.bar) { const d = target.bar; if (d.bar) { setBar(d, false); S.planks++; audio.door(); } else { setBar(d, true); S.planks--; audio.thud(); say('Verrammelt. Das hält ihn eine Weile auf.', 3); } hud(); }
    else if (target.phone) { S.phone[S.day] = 1; audio.click(); subs(PHONE[Math.min(5, Math.max(2, S.day))], 3); }
    else if (target.photo) say(PHOTO[Math.min(5, S.day)], 5);
    else if (target.drawing) say('Kinderzeichnungen. Auf jeder: ein Auto unter einem Tuch. Und ein langer Mann.', 5);
    else if (target.graves) readNote('graves', NOTES.graves.t, NOTES.graves.x);
    else if (target.grave) readNote('grave', NOTES.grave.t, NOTES.grave.x);
    else if (target.horn) { distract = { x: fx.horn.x, z: fx.horn.z, t: 30, horn: true }; hornT = 0; say('Die Hupe klemmt. Das hört die ganze Insel.', 4); stalker.heard(fx.horn.x, fx.horn.z); }
    else if (target.carbatt) through(() => { S.dead = false; bus.dead = false; S.carbatt--; S.hour = Math.min(DAWN - 0.2, S.hour + 0.4); }, 'Die neue Batterie sitzt. Der Anlasser dreht wieder.', 2.4);
    else if (target.tyre) through(() => { S.flat = false; bus.flat = false; S.tyres--; S.hour = Math.min(DAWN - 0.2, S.hour + 0.5); }, 'Reifen gewechselt. Deine Hände sind schwarz.', 2.4);
    else if (target.bus) { mode = 'rear'; pl.look = Math.PI; pl.pitch = -0.1; audio.door(); hud(); if (!S.notes.includes('todo')) say('Dein Zuhause für die nächsten Tage. Am Schrank hängt ein Zettel.', 5); }
  }
  function back() { if (S.ngp) return; if (mode === 'drive' && Math.abs(bus.v) < 0.5 && !busy) { mode = 'rear'; pl.look = Math.PI; pl.pitch = -0.1; hud(); } }
  function eat(kind) {
    const need = 100 - S.hunger, order = ['apple', 'can', 'longlife'];
    const pick = kind || order.find(k => S.inv[k] && FOOD[k] >= need) || order.slice().reverse().find(k => S.inv[k]);
    if (!pick || !S.inv[pick]) return;
    if (need < 6) return say('Du hast keinen Hunger.', 2);
    S.inv[pick]--; S.hunger = Math.min(100, S.hunger + FOOD[pick]); audio.blip(520); hud();
  }
  function fire() {
    if (!(mode === 'walk' || mode === 'drive' || mode === 'rear') || !S.gun || !S.armed || fireCd > 0 || busy || paused) return;
    fireCd = 0.45;
    if (S.ammo <= 0) { audio.click(); return say('Leer.', 1.5); }
    if (!C.infAmmo) S.ammo--; S.stats.shots++; admin.vib(40); audio.shot(); flashT = 0.07; pl.pitch = Math.min(1.3, pl.pitch + 0.05); shake = Math.max(shake, 0.25); $('flash').style.opacity = 0.25; setTimeout(() => { $('flash').style.opacity = 0; }, 50);
    camera.getWorldDirection(v3); stalker.heard(pl.x, pl.z);
    if (stalker.shot(camera.position, v3)) { admin.award('shot'); audio.scream(); say('Er taumelt zurück in den Nebel. Für heute Nacht.', 5); }
    else if (S.inMine && !S.fuse) { v4.copy(fx.fusebox).sub(camera.position); const d = v4.length(); if (d < 14 && v4.normalize().dot(v3) > 0.985) { hud(); return ending(ENDING_B, 'b'); } }
    else if (fig.visible) { const dx = fig.position.x - camera.position.x, dz = fig.position.z - camera.position.z, d = Math.hypot(dx, dz); if ((dx * v3.x + dz * v3.z) / d > 0.995) fig.visible = false; }
    hud();
  }
  function wake(slept) {
    if (S.day >= 2) admin.award('night');
    S.day++; S.hour = slept ? 7.5 : 6.2; S.hunger = Math.max(8, S.hunger - (slept ? 18 : 26)); S.wnote = S.day; figure.t = 25; fig.visible = false; stalker.reset(); stalker.man.visible = false; S.locked = false; details.resetDay();
    if (slept) { mode = 'rear'; pl.look = 0; pl.pitch = 0; }
    items.forEach(it => { if (it.type === 'apple' && S.picked.includes(it.id) && Math.random() < Math.max(0, 0.6 - S.day * 0.12)) S.picked.splice(S.picked.indexOf(it.id), 1); });
    // Er war da: Spuren hinterlassen
    const sn = Math.sin(bus.heading), cs = Math.cos(bus.heading);
    tracks.visible = S.day >= 3; tracks.position.set(bus.x, world.ground(bus.x, bus.z), bus.z); tracks.rotation.y = bus.heading;
    if (S.day === 4 && !S.scares.dead) { S.scares.dead = 1; S.dead = true; } // jemand hat nachts das Licht angelassen
    chair.visible = S.day === 4; if (chair.visible) { const x = bus.x + sn * 5.2, z = bus.z + cs * 5.2; chair.position.set(x, world.ground(x, z), z); chair.rotation.y = bus.heading + Math.PI; }
    for (const d of fx.doorways) setBar(d, false); distract = null; boom.visible = false;
    refreshItems(); save(); hud(); $('fade').style.opacity = 0; busy = false;
    say(slept ? WAKE[Math.min(6, S.day)] : 'Der Himmel wird grau. Du hast die Nacht durchgemacht. Am Bus klemmt ein Zettel.', 8);
    if (OMEN[Math.min(6, S.day)] && S.day >= 3) setTimeout(() => say(OMEN[Math.min(6, S.day)], 7), 9500);
  }
  function sleep() {
    if (busy) return;
    if (S.hour < SLEEP_FROM) return say(`Du bist noch nicht müde. (Schlafen ab ${SLEEP_FROM} Uhr)`, 3);
    if (hunting() && stalker.hunting && stalker.dist < 90) return say('Du kannst jetzt nicht schlafen. Er ist ganz nah. Häng ihn ab, versteck dich oder vertreib ihn.', 5);
    busy = true; $('fade').style.opacity = 1; bus.lights = false;
    // Er lernt: zweimal am selben Platz schlafen merkt er sich
    S.waiting = !!(S.sleepAt && Math.hypot(S.sleepAt.x - bus.x, S.sleepAt.z - bus.z) < 45); S.sleepAt = { x: bus.x, z: bus.z };
    const threat = hunting() && !stalker.gone, ambush = threat && !S.locked;
    if (ambush) { // unverriegelt eingeschlafen, während er noch sucht: er steht nachts an der Tür
      setTimeout(() => { S.hour = 27.1; mode = 'rear'; pl.look = Math.PI * 0.5; pl.pitch = -0.05; busy = false; $('fade').style.opacity = 0; stalker.ambush({ x: bus.x, z: bus.z, h: bus.heading }); say('03:06. Du schreckst hoch. Jemand ist an der Schiebetür.', 4); audio.knock(); audio.knock(0.4); }, 2600);
    } else if (S.day >= 3 && !S.scares.window) {
      setTimeout(() => {
        S.scares.window = 1; S.hour = 27.2; mode = 'drive'; pl.look = 0.5; pl.pitch = -0.1; S.torch = false;
        stalker.showAt(bus.x + Math.sin(bus.heading) * 3.0, bus.z + Math.cos(bus.heading) * 3.0, bus.x, bus.z);
        audio.knock(0.2); audio.knock(0.55); audio.knock(0.9); $('fade').style.opacity = 0.35; say('03:12. Etwas hat geklopft.', 3);
        setTimeout(() => { pl.look = 0; scare(true); weather.flash = 1; }, 3300);
        setTimeout(() => { $('fade').style.opacity = 1; }, 3900);
        setTimeout(() => { stalker.man.visible = false; wake(true); }, 6200);
      }, 2400);
    } else { if (threat) { audio.knock(1.2); audio.knock(1.6); audio.knock(2.0); } setTimeout(() => wake(true), 2800); }
  }
  function die() { if (busy) return; if (C.god) { stalker.mode = 'fled'; stalker.gone = true; stalker.man.visible = false; say('(Admin: unverwundbar)', 2); return; } busy = true; admin.vib([200, 80, 300]); scare(true, 1.3); audio.scream(); setTimeout(() => { show('dead', true); }, 900); }
  $('bRetry').onclick = () => { try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE))); } catch { S = fresh(); } if (S.hour >= HUNT_FROM) S.hour = HUNT_FROM - 1.5; applyState(); show('dead', false); busy = false; hud(); say('Du schreckst hoch. Derselbe Tag. Wieder.', 5); };
  function ending(lines, kind) {
    if (busy) return; busy = true; S.statDay = S.day; audio.sting(0.5); $('fade').style.opacity = 1;
    setTimeout(() => {
      mode = 'end'; show('end', true); $('hud').style.display = 'none'; $('inv').style.display = 'none'; show('bAct', false); show('bFire', false); S.inMine = false; world.mine.on = false;
      let i = 0; const p = $('endT');
      const next = () => {
        if (i < lines.length) { p.style.opacity = 0; setTimeout(() => { p.textContent = lines[i++]; p.style.opacity = 1; }, 700); setTimeout(next, 5200); return; }
        runs++; localStorage.setItem('la_runs', runs); fx.tally(runs); admin.award(kind === 'a' ? 'endA' : 'endB');
        const n = world.roads[0].pts, k = 250, a = n[k], b = n[(k + 9) % n.length], c = n[(k + 10) % n.length];
        bus.place(b.x, b.z, Math.atan2(c.x - b.x, c.z - b.z)); bus.lights = true; S.day = kind === 'a' ? 5 : 1; S.hour = kind === 'a' ? 22.6 : 9; stalker.reset(); stalker.car.visible = false; fig.visible = false;
        endCam = { x: a.x, z: a.z, tx: b.x, tz: b.z, t: 0 };
        $('end').style.background = 'transparent'; $('fade').style.opacity = 0; p.style.opacity = 0;
        setTimeout(() => { p.textContent = kind === 'a' ? 'Tag 1.\nDiesmal hältst du ihn auf,\nbevor er den Leuchtturm erreicht.' : 'Tag 1.\nJemand anderes.\nNicht mehr du.'; p.style.opacity = 1; }, 2500);
        setTimeout(() => { $('fade').style.opacity = 1; }, 10000);
        setTimeout(() => { $('end').style.background = '#000'; p.textContent = `LETZTE AUSFAHRT\n\n${kind === 'a' ? 'Ende A · Der Kreis' : 'Ende B · Die Fähre'}\nDurchlauf ${runs} · Tag ${S.statDay || '?'}\n${S.stats.km.toFixed(1)} km · ${S.stats.shots} Schüsse · ${S.stats.close}× an der Tür`; $('bEnd').style.display = ''; }, 12000);
      };
      next();
    }, 2200);
  }
  $('bEnd').onclick = () => { if (!S.ngp) localStorage.removeItem(SAVE); location.reload(); };
  tap('bAct', act); tap('bFire', fire); tap('bBack', back); tap('bRadio', () => { S.radioOff = !S.radioOff; audio.click(); hud(); });

  // --- Neues Spiel Plus: du bist der Mann unter der Plane ---
  let camper = null, ngp = null;
  const startNgp = () => {
    audio.init(); S = fresh(); S.ngp = true; S.day = 4; S.hour = 21.6; S.hunger = 100; S.lights = true; S.bus = { x: fx.park.x, z: fx.park.z, h: fx.park.h }; applyState(); mode = 'drive'; bus.lights = true; bus.fuel = 100;
    if (!camper) { camper = createBus(scene, world, assets); const car = assets.M.covered_car.clone(); bus.group.traverse(o => { if (o.isMesh) o.visible = false; }); bus.group.add(car); }
    stalker.banish(); const from = world.nearestNode(world.pois.village.x, world.pois.village.z), to = world.nearestNode(world.pois.light.x, world.pois.light.z);
    ngp = { path: [from, ...world.pathTo(from, to)], i: 0, x: world.nodes[from].x, z: world.nodes[from].z, h: 0, wait: 14, done: false }; camper.lights = true; camper.place(ngp.x, ngp.z, 0);
    $('menu').style.display = 'none'; $('hud').style.display = 'block'; $('cross').style.display = 'block'; $('inv').style.display = 'flex'; hud();
    say('Du erinnerst dich an alles. Er nicht. Halte den Camper auf, bevor er den Leuchtturm erreicht.', 9);
  };
  const ngpUpdate = (dt) => {
    if (!ngp || ngp.done) return; const n = world.nodes;
    if (ngp.wait > 0) ngp.wait -= dt; else if (ngp.i < ngp.path.length) { const q = n[ngp.path[ngp.i]], dx = q.x - ngp.x, dz = q.z - ngp.z, d = Math.hypot(dx, dz), sp = (q.dirt ? 6.2 : 8.4) * admin.diff().sp; if (d < 2.5) ngp.i++; else { ngp.h += Math.atan2(Math.sin(Math.atan2(dx, dz) - ngp.h), Math.cos(Math.atan2(dx, dz) - ngp.h)) * Math.min(1, dt * 3); ngp.x += Math.sin(ngp.h) * sp * dt; ngp.z += Math.cos(ngp.h) * sp * dt; } }
    camper.x = ngp.x; camper.z = ngp.z; camper.heading = ngp.h; camper.update(dt, 0, 0, 0, false, weather.rain);
    const dist = Math.hypot(bus.x - ngp.x, bus.z - ngp.z), left = ngp.path.length - ngp.i;
    setTxt('obj', `→ Halte den Camper auf. Abstand ${Math.round(dist)} m · bis zum Leuchtturm noch ${left * 2} m`);
    const finish = (lines, win) => { ngp.done = true; busy = true; audio.sting(0.6); $('fade').style.opacity = 1; setTimeout(() => { mode = 'end'; show('end', true); $('hud').style.display = 'none'; $('inv').style.display = 'none'; const p = $('endT'); let i = 0; const next = () => { if (i < lines.length) { p.style.opacity = 0; setTimeout(() => { p.textContent = lines[i++]; p.style.opacity = 1; }, 700); setTimeout(next, 5000); } else { if (win) admin.award('endC'); p.textContent = win ? 'LETZTE AUSFAHRT\n\nEnde C · Der Aufpasser' : 'LETZTE AUSFAHRT\n\nZu spät. Wieder.'; $('bEnd').style.display = ''; } }; next(); }, 2200); };
    if (dist < 5.6) finish(['Du stellst dich quer. Der Camper bremst.', 'Du reißt die Tür auf.\nEr starrt dich an. Dein Gesicht. Jünger. Ahnungslos.', '»Fahr nicht zum Leuchtturm«, sagst du.', 'Diesmal sagst du es nicht mit Zetteln.\nDiesmal hört er zu.', 'Am Freitag legt die Fähre an.\nSie nimmt nur einen mit. Du bleibst am Kai stehen und siehst ihr nach.'], true);
    else if (left <= 1) finish(['Die Rücklichter verschwinden hinter dem Leuchtturm.', 'Ein Licht geht an. Ein Funkgerät rauscht.', '»Tag 1. Ein paar ruhige Tage auf der Insel.«', 'Du sitzt wieder unter der Plane. Am Hafen. Und wartest.'], false);
  };
  // --- Einstellungen, Erfolge, Admin-Menü ---
  const gotoPlace = (k) => { const p = placePos(k); S.inMine = false; world.mine.on = false; S.onIslet = k === 'islet'; const f = p.face || 0; let x = p.x + Math.sin(f) * 6, z = p.z + Math.cos(f) * 6; if (k === 'islet') { x = fx.isletSpawn.x; z = fx.isletSpawn.z; } pl.x = x; pl.z = z; pl.y = world.ground(x, z); pl.yaw = f; pl.pitch = 0; flyH = 0; mode = 'walk'; hud(); };
  admin = createAdmin({ SAVE, S: () => S, setS: o => { Object.assign(S, o); refreshItems(); hud(); }, bus, pl, world, stalker, places: PLACES, toast: t => say(t, 5), hud, pause: v => { paused = v; },
    goto: gotoPlace, scare: f => scare(f), roomScare: () => roomScare(), ending: k => ending(k === 'a' ? ENDING : ENDING_B, k), qualName: () => QUAL[qual][0], nextQual: () => { dynScale = 1; qual = (qual + 1) % 3; localStorage.setItem('la_q', qual); applyQual(); },
    summon: () => { const n = world.nodes, i = world.nearestNode(pl.x, pl.z); let b = i, bd = 1e9; n.forEach((q, k) => { const d = Math.abs(Math.hypot(q.x - pl.x, q.z - pl.z) - 70); if (d < bd) { bd = d; b = k; } }); stalker.spawnNext = { x: n[b].x, z: n[b].z, h: 0 }; stalker.reset(); lastHunt = false; },
    allNotes: () => { for (const k in NOTES) if (!S.notes.includes(k)) S.notes.push(k); hud(); }, resetRuns: () => { runs = 0; localStorage.setItem('la_runs', 0); fx.tally(0); },
    photo: () => { photoPrev = mode; mode = 'photo'; paused = false; document.body.classList.add('photo'); } });
  C = admin.C;
  // --- Menü / Start ---
  const hasSave = !!localStorage.getItem(SAVE);
  $('load').style.display = 'none'; $('btns').style.display = 'block';
  $('bStart').textContent = hasSave ? 'Weiter' : 'Start'; $('bNew').style.display = hasSave ? '' : 'none';
  if (runs > 0) $('sub0').textContent = `Eine kleine Insel. Ein alter Bus. Du kennst das alles schon. (Durchlauf ${runs + 1})`;
  const begin = (cont) => {
    audio.init();
    if (cont) { try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE))); } catch { S = fresh(); } } else S = fresh();
    applyState(); $('menu').style.display = 'none'; $('hud').style.display = 'block'; $('cross').style.display = 'block'; $('inv').style.display = 'flex'; hud();
    document.documentElement.requestFullscreen?.().catch(() => { });
    if (!cont) { // Anfangssequenz: die Fähre legt ab
      const f = fx.ferry3d, a = hbW(9, -30), e = { x: pl.x, z: pl.z }; f.obj.visible = true; f.obj.position.copy(f.home); setTimeout(() => audio.foghorn(), 900);
      cine(9.5, (t, u) => { f.obj.position.z = f.home.z - t * 2.4; const k = u * u * (3 - 2 * u); camera.position.set(a.x + (e.x - a.x) * k, world.pois.harbor.y + 7 - 5.3 * k, a.z + (e.z - a.z) * k); f.obj.getWorldPosition(v4); const hx = bus.x, hz = bus.z; camera.lookAt(v4.x + (hx - v4.x) * k, v4.y + 2 + (bus.y + 1 - v4.y - 2) * k, v4.z + (hz - v4.z) * k); },
        runs > 0 ? 'Die Fähre legt ab. Du hast das schon einmal gesehen.' : 'Die Fähre legt ab. Nächste Abfahrt: Freitag, 9 Uhr.',
        () => { f.obj.visible = false; pl.yaw = Math.atan2(-(bus.x - pl.x), -(bus.z - pl.z)); say('Ein paar ruhige Tage auf der Insel. Dein Bus steht am Kai.', 7); });
    }
  };
  $('bStart').onclick = () => begin(hasSave); $('bNew').onclick = () => begin(false);
  $('bNgp').style.display = runs > 0 || localStorage.getItem('la_admin') === '1' ? '' : 'none'; $('bNgp').onclick = startNgp;
  $('q').onclick = () => { dynScale = 1; qual = (qual + 1) % 3; localStorage.setItem('la_q', qual); applyQual(); };

  // --- Schleife ---
  const clock = new THREE.Clock(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), q1 = new THREE.Quaternion(), e1 = new THREE.Euler(0, 0, 0, 'YXZ');
  let t = 0, stepAcc = 0, fpsN = 0, fpsT = 0;
  applyState(); mode = 'menu';
  const hb = world.pois.harbor;
  const menuCam = () => { const a = t * 0.03 + 1; camera.position.set(hb.x + Math.cos(a) * 30, hb.y + 8, hb.z + Math.sin(a) * 30); camera.lookAt(hb.x, hb.y + 1.5, hb.z); };
  const hunting = () => !S.ngp && (S.day >= 2 || runs > 0) && S.hour >= HUNT_FROM && S.hour < DAWN - 0.5 && !S.inMine && !S.onIslet;
  const near3 = (p, r, cone = 0.6) => { const dx = p.x - camera.position.x, dy = p.y - camera.position.y, dz = p.z - camera.position.z, d = Math.hypot(dx, dy, dz); return d < r && (dx * v3.x + dy * v3.y + dz * v3.z) / d > cone; };

  function frame() {
    requestAnimationFrame(frame);
    const rdt = Math.min(0.05, clock.getDelta()), dt = paused || mode === 'cine' || mode === 'photo' ? 0 : rdt; t += rdt;
    const k = inp.keys;
    let mx = inp.mx + (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = inp.mz + (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    let indoor = false, moving = 0, zone = null, hear = 0;
    const playing = mode === 'walk' || mode === 'drive' || mode === 'rear' || mode === 'hide';
    if (mode === 'menu') { menuCam(); bus.update(dt, 0, 0, 0, false, 0); }
    else if (mode === 'photo') { // freie Kamera, Welt steht
      const l = Math.hypot(mx, mz) || 1, f = 9 * rdt / Math.max(1, l); camera.rotation.set(pl.pitch, pl.yaw, 0); camera.getWorldDirection(v3);
      camera.position.addScaledVector(v3, -mz * f); camera.position.x += Math.cos(pl.yaw) * mx * f; camera.position.z -= Math.sin(pl.yaw) * mx * f; bus.update(0, 0, 0, 0, false, weather.rain);
    }
    else if (mode === 'cine') {
      const c = cineS; c.t += rdt; c.camFn(c.t, Math.min(1, c.t / c.dur)); bus.update(0, 0, 0, 0, false, weather.rain);
      if (c.t >= c.dur) { mode = c.prev; cineS = null; document.body.classList.remove('cine'); c.done && c.done(); hud(); }
    } else if (mode === 'end') {
      bus.update(dt, 0, 0, 0, false, 1);
      if (endCam) { endCam.t += rdt; const f = Math.min(0.55, endCam.t * 0.03); camera.position.set(endCam.x + (endCam.tx - endCam.x) * f, world.ground(endCam.x, endCam.z) + 1.15, endCam.z + (endCam.tz - endCam.z) * f); camera.lookAt(bus.x, bus.y + 1.2, bus.z); }
    } else {
      if (!C.freeze) S.hour += dt / HOUR * C.ts;
      if (S.ngp) { S.hunger = 100; S.hour = 21.6; ngpUpdate(dt); }
      if (!C.noHunger) S.hunger = Math.max(0, S.hunger - dt * (100 / (HOUR * 17)) * admin.diff().hun * C.ts);
      if (C.infBatt) S.batt = 100;
      S.stats.km += Math.max(0, bus.dist - lastDist) / 1000; lastDist = bus.dist;
      fireCd -= dt;
      if (S.hour >= DAWN && !busy) { busy = true; $('fade').style.opacity = 1; setTimeout(() => wake(false), 1800); }
      if (mode === 'walk') {
        const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
        const sneak = l < 0.62 && !k.ShiftLeft, sp = (k.ShiftLeft ? 6 : sneak ? 3.0 : 4.1) * (S.hunger < 15 ? 0.6 : 1) * (C.fast ? 2.6 : 1) * (C.fly ? 2 : 1), sn = Math.sin(pl.yaw), cs = Math.cos(pl.yaw), mm = sneak && l > 0 ? 1 / Math.max(l, 0.3) : 1;
        const p = { x: pl.x + (mx * cs + mz * sn) * mm * sp * dt, z: pl.z + (-mx * sn + mz * cs) * mm * sp * dt };
        if (!C.noclip && !C.fly) world.collide(p, 0.32);
        const gh = world.ground(p.x, p.z), cur = world.ground(pl.x, pl.z);
        if (C.fly) flyH = Math.max(0, flyH + (-mz) * Math.sin(pl.pitch) * sp * dt); else flyH = 0;
        if (C.noclip || C.fly || ((S.inMine || gh > 0.22) && gh - cur < 0.9)) { moving = Math.hypot(p.x - pl.x, p.z - pl.z) / Math.max(dt, 1e-4); pl.x = p.x; pl.z = p.z; }
        pl.y += (world.ground(pl.x, pl.z) - pl.y) * Math.min(1, dt * 14);
        if (moving > 0.5) { pl.bob += dt * moving * 1.9; stepAcc += dt * moving; if (stepAcc > 1.9) { stepAcc = 0; if (!sneak) audio.step(world.wet.value > 0.3); } }
        hear = moving > 3.4 ? 26 : moving > 0.5 ? 8 : 0;
        camera.position.set(pl.x, pl.y + 1.68 + flyH + Math.sin(pl.bob * 2) * 0.035 * Math.min(1, moving / 3), pl.z);
        camera.rotation.set(pl.pitch, pl.yaw, Math.sin(pl.bob) * 0.004);
        bus.update(dt, 0, 0, 0, false, weather.rain);
        zone = S.inMine ? { name: 'mine' } : world.indoor(pl.x, pl.z); indoor = !!zone;
        if (S.torch) { S.batt = Math.max(0, S.batt - dt * (100 / 300)); if (S.batt <= 0) { if (S.spare > 0) { S.spare--; S.batt = 100; say('Neue Batterien eingelegt.', 3); } else { S.torch = false; say('Die Taschenlampe flackert und geht aus. Die Batterien sind leer.', 5); } hud(); } }
      } else if (mode === 'hide') {
        camera.position.set(hideSpot.x, hideSpot.y + 0.55, hideSpot.z); camera.rotation.set(pl.pitch * 0.4, pl.yaw, 0.12); bus.update(dt, 0, 0, 0, false, weather.rain); pl.x = hideSpot.x; pl.z = hideSpot.z; indoor = true; zone = world.indoor(pl.x, pl.z);
      } else {
        const driving = mode === 'drive';
        const gas = driving ? Math.max(inp.gas, k.KeyW ? 1 : 0) : 0, brake = driving ? Math.max(inp.brake, k.KeyS ? 1 : 0) : 0;
        bus.update(dt, gas, brake, driving ? -Math.max(-1, Math.min(1, inp.mx + (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0))) : 0, driving, weather.rain);
        if (bus.bump > 2) { audio.thud(); shake = Math.max(shake, 0.3); bus.bump = 0; }
        bus.group.updateMatrixWorld(true);
        if (driving) camera.position.copy(bus.group.localToWorld(S.ngp ? v3.set(0.3, 1.42, 0.95) : v3.set(0.42, 1.52, 0.47))); else camera.position.copy(bus.group.localToWorld(v3.set(-0.12, 1.4, -0.42)));
        e1.set(pl.pitch, Math.PI + pl.look, 0); camera.quaternion.copy(bus.group.quaternion).multiply(q1.setFromEuler(e1));
        pl.x = bus.x; pl.z = bus.z; pl.y = bus.y; indoor = true;
        hear = driving && Math.abs(bus.v) > 1 ? 150 : driving && bus.fuel > 0 && !S.dead ? (S.radioOff ? 30 : 55) : 0;
        // Reifenpanne
        if (driving && Math.abs(bus.v) > 8) { driveT += dt; if (S.day >= 3 && !S.flat && S.flatDay !== S.day && driveT > 25 && Math.random() < dt * 0.012) { S.flat = true; bus.flat = true; S.flatDay = S.day; audio.pop(); shake = 0.8; say('Ein Knall. Ein Reifen ist geplatzt. In der Werkstatt an der Tankstelle liegen Ersatzreifen.', 8); hud(); } }
        // Gestalt im Rückspiegel
        mirT -= dt; if (driving && S.day >= 3 && weather.lum < 0.5 && mirT < 0) { mirT = 45 + Math.random() * 50; const x = bus.x - Math.sin(bus.heading) * 11, z = bus.z - Math.cos(bus.heading) * 11; fig.position.set(x, world.ground(x, z) - 0.03, z); fig.rotation.y = bus.heading; fig.visible = true; figure.life = 2.8; figure.d0 = 0; }
      }
      if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake * 0.12; camera.position.y += (Math.random() - 0.5) * shake * 0.12; camera.rotation.z += (Math.random() - 0.5) * shake * 0.05; shake *= Math.pow(0.02, rdt); }
      if (S.hunger <= 0 && !busy) {
        busy = true; $('fade').style.opacity = 1;
        setTimeout(() => { S.hunger = 30; S.hour = Math.min(DAWN - 0.3, S.hour + 3); S.inMine = false; world.mine.on = false; S.onIslet = false; mode = 'rear'; pl.look = 0; $('fade').style.opacity = 0; busy = false; hud(); say('Du bist vor Hunger zusammengebrochen. Irgendwie hast du es zurück in den Bus geschafft.', 8); }, 2600);
      }
      // entdeckte Orte (für die Karte)
      for (const key in PLACES) { if (S.seen[key]) continue; const p = placePos(key); if (Math.hypot(pl.x - p.x, pl.z - p.z) < (p.r || 14) + 18) { S.seen[key] = 1; addSketch(key); if (S.map && key !== 'harbor') say(`In die Karte eingetragen: ${PLACES[key]}.`, 3); } }

      // --- Ziel für Aktion ---
      target = null; let hint = '', label = '';
      camera.getWorldDirection(v3);
      if (mode === 'walk') {
        let best = 2.6;
        for (const it of items) { if (!it.obj.visible) continue; const dx = it.pos.x - camera.position.x, dy = it.pos.y - camera.position.y, dz = it.pos.z - camera.position.z, d = Math.hypot(dx, dy, dz); if (d < best && (dx * v3.x + dy * v3.y + dz * v3.z) / d > 0.72) { best = d; target = { item: it }; } }
        if (!target) for (const id in fx.doors) { const d = fx.doors[id]; if (S.doors[id]) continue; const dx = d.pos.x - camera.position.x, dz = d.pos.z - camera.position.z, dd = Math.hypot(dx, dz); if (dd < 2.4 && (dx * v3.x + dz * v3.z) / dd > 0.6) target = { door: d }; }
        if (!target && S.inMine) { if (!S.fuse && near3(fx.fusebox, 2.4, 0.7)) target = { fusebox: true }; else if (near3(fx.mineOut, 2.6, 0.5)) target = { mineOut: true }; }
        if (!target && !S.inMine) {
          if (S.doors.light && near3(fx.radio, 2.3, 0.7)) target = { radio: true };
          else if (near3(fx.mineIn, 3.2, 0.5)) target = { mineIn: true };
          else if (!S.onIslet && near3(fx.boat, 4.2, 0.3)) target = { boat: true };
          else if (S.onIslet && near3(fx.boat2, 5, 0.2)) target = { boat2: true };
          else if (fx.phone && near3(fx.phone, 2.2, 0.5) && S.day >= 2 && !S.phone[S.day]) target = { phone: true };
          else if (fx.graves && near3(fx.grave, 2.6, 0.5)) target = { grave: true };
          else if (fx.graves && near3(fx.graves, 3.4, 0.5)) target = { graves: true };
          else if (near3(fx.horn, 3.2, 0.4)) target = { horn: true };
          else { for (const p of fx.photos) if (near3(p, 2.2, 0.8)) target = { photo: true }; for (const p of fx.drawings) if (near3(p, 3, 0.8)) target = { drawing: true };
            if (!target) for (const h of fx.hides) if (Math.hypot(h.x - pl.x, h.z - pl.z) < 1.5) target = { hide: h };
            if (!target) for (const d of fx.doorways) { const dd = Math.hypot(d.x - pl.x, d.z - pl.z); if (dd < 1.9 && (d.bar || S.planks > 0) && world.indoor(pl.x, pl.z)) { v4.set(d.x - pl.x, 0, d.z - pl.z).normalize(); if (v4.x * v3.x + v4.z * v3.z > 0.5) target = { bar: d }; } } }
        }
        if (!target && !S.inMine && Math.hypot(pl.x - bus.x, pl.z - bus.z) < 3.6) {
          const fxp = bus.x + Math.sin(bus.heading) * 2.4, fzp = bus.z + Math.cos(bus.heading) * 2.4;
          target = S.wnote && Math.hypot(pl.x - fxp, pl.z - fzp) < 2.3 ? { wind: true } : S.dead && S.carbatt > 0 ? { carbatt: true } : S.flat && S.tyres > 0 ? { tyre: true } : { bus: true };
        }
        const T = target || {};
        label = T.item ? (T.item.type === 'note' ? 'Lesen' : 'Nehmen') : T.door ? 'Tür' : T.radio ? 'Funken' : T.wind ? 'Zettel lesen' : T.fusebox ? 'Sicherung nehmen' : T.mineIn ? 'Betreten' : T.mineOut ? 'Hinaus' : T.boat || T.boat2 ? 'Boot' : T.phone ? 'Abheben' : T.grave || T.graves ? 'Lesen' : T.horn ? 'Hupe' : T.photo || T.drawing ? 'Ansehen' : T.hide ? 'Verstecken' : T.bar ? (T.bar.bar ? 'Bretter ab' : 'Verrammeln') : T.tyre ? 'Reifen wechseln' : T.carbatt ? 'Batterie tauschen' : 'Einsteigen';
        hint = T.item ? T.item.name : T.radio ? 'Funkgerät' : T.fusebox ? 'Sicherungskasten' : T.mineIn ? 'Stollen' : T.horn ? 'Abgedecktes Auto' : T.phone ? 'Das Telefon klingelt' : '';
        show('bAct', !!target);
      } else if (mode === 'hide') { label = 'Raus'; show('bAct', true); hint = 'versteckt'; }
      else if (mode === 'drive') { label = S.wnote ? 'Zettel lesen' : 'Aussteigen'; show('bAct', !S.ngp && (S.wnote || Math.abs(bus.v) < 1)); }
      else {
        let best = 0.8;
        for (const s of bus.spots) { v4.copy(s.p); bus.group.localToWorld(v4).sub(camera.position).normalize(); const d = v4.dot(v3); if (d > best) { best = d; target = { spot: s.id }; label = s.id === 'lock' ? (S.locked ? 'Entriegeln' : 'Verriegeln') : s.label; } }
        hint = target ? '' : 'Sieh dich um: Bett · Küche · Zettel · Kassette · Riegel · Fahrersitz · Tür';
        show('bAct', !!target);
      }
      setTxt('bAct', label); setTxt('hint', hint);

      // --- Verfolger ---
      const hunt = hunting() && !busy && !C.stalkerOff;
      if (hunt && !lastHunt) { // Beginn der Jagd
        let spawn = null;
        if (S.waiting) { let bn = -1, bd = 1e9; world.nodes.forEach((n, i) => { const d = Math.abs(Math.hypot(n.x - bus.x, n.z - bus.z) - 48); if (d < bd) { bd = d; bn = i; } }); const n = world.nodes[bn]; spawn = { x: n.x, z: n.z, h: Math.atan2(bus.x - n.x, bus.z - n.z) }; say('Scheinwerfer. Ganz nah. Er wusste, wo du schläfst.', 6); S.waiting = false; }
        else if (!S.scares['hunt' + S.day]) say(S.day <= 2 ? 'Scheinwerfer. Jemand kommt die Straße herunter.' : 'Er kommt wieder.', 5);
        S.scares['hunt' + S.day] = 1; stalker.spawnNext = spawn;
        if (S.day <= 2 && mode === 'walk' && !S.scares.sight) { S.scares.sight = 1; const e = camera.position.clone(); cine(3.8, (tt, u) => { camera.position.set(e.x, e.y + 0.4 * u, e.z); camera.lookAt(stalker.x, stalker.car.position.y + 1, stalker.z); }, 'Scheinwerfer. Jemand kommt die Straße herunter.', null); }
      }
      lastHunt = hunt;
      if (distract) { distract.t -= dt; if (distract.t <= 0) { distract = null; } else if (distract.horn) { hornT -= dt; if (hornT <= 0) { hornT = 1.4; if (Math.hypot(pl.x - fx.horn.x, pl.z - fx.horn.z) < 160) audio.horn(); } } }
      const ev = stalker.update(C.stalkerFreeze ? 0 : dt, { sp: admin.diff().sp, gr: admin.diff().gr, px: pl.x, pz: pl.z, inBus: mode === 'drive' || mode === 'rear', busV: bus.v, bus: { x: bus.x, z: bus.z, h: bus.heading }, rear: mode === 'rear', hunt, day: S.day, hear, lit: mode === 'walk' && S.torch, hidden: mode === 'hide', locked: S.locked, lockHold: S.up.lock ? 22 : 8, spawn: stalker.spawnNext, distract, bars: fx.doorways.filter(d => d.bar) });
      if (hunt) stalker.spawnNext = null;
      if (stalker.active && stalker.dist < 45) { addSketch('car'); if (stalker.out) addSketch('man'); }
      if (ev === 'caught') die();
      else if (ev === 'ram') { admin.vib(180); audio.thud(); shake = 1; bus.v = Math.min(17, bus.v + 2.5); post.u.uPulse.value = 0.6; }
      else if (ev === 'out') { audio.sting(0.5); say('Er hält. Die Fahrertür geht auf. Er rennt.', 3); }
      else if (ev === 'pound') { audio.knock(); audio.knock(0.25); shake = Math.max(shake, 0.35); if (S.locked && (mode === 'rear' || mode === 'drive')) say('Er rüttelt an der Tür. Der Riegel hält – noch.', 2); }
      else if (ev === 'rip') { S.stats.close++; admin.vib([120, 60, 260]); audio.rip(); shake = 1.2; post.u.uPulse.value = 1; S.locked = false; say('ER REISST DIE TÜR AUF!', 2.5); }
      else if (ev === 'break') { const b = stalker.breakAt, d = fx.doorways.find(d => d.bar && Math.hypot(d.x - b.x, d.z - b.z) < 0.5); if (d) setBar(d, false); audio.crash(); shake = 0.8; say('Die Bretter splittern.', 3); }
      else if (ev === 'lost' && playing) { if (mode === 'hide') admin.award('hide'); say('Es wird still. Er hat dich verloren – für den Moment.', 5); }

      // --- Schreckmomente ---
      const zn = zone?.name || null;
      if (zn !== lastZone) {
        if (zn === 'cabin' && S.day >= 3 && !S.scares.cabin) { S.scares.cabin = 1; setTimeout(roomScare, 1500); }
        if (zn === 'shop' && S.day >= 4 && !S.scares.shop) { S.scares.shop = 1; setTimeout(roomScare, 2200); }
        if (zn === 'school' && S.day >= 2 && !S.scares.school) { S.scares.school = 1; setTimeout(() => { audio.knock(); say('Ein Stuhl kippt um. Niemand da.', 4); }, 2500); }
        if (zn === 'chapel' && S.hour > 19 && !S.scares.chapel) { S.scares.chapel = 1; audio.knock(); audio.knock(0.4); say('Die Bänke knarren. Du bist nicht allein.', 4); }
        lastZone = zn;
      }
      if (indoor && mode === 'walk' && S.day >= 2 && !S.inMine) { falseT -= dt; if (falseT <= 0) { falseT = 70 + Math.random() * 90; audio.door(); blackout = 2.4; } } // falscher Alarm: Tür knallt, Licht aus, nichts passiert
      if (mode === 'walk' && S.day >= 3) fx.mirrors.forEach((p, i) => { if (!S.scares['m' + i] && near3(p, 2.3, 0.75)) { S.scares['m' + i] = 1; figAt(2.2, true, 1.8, 0.6); say('Im Spiegel steht jemand hinter dir.', 3); } });
      if (fx.phone && S.day >= 2 && !S.phone[S.day] && !S.inMine) { const d = Math.hypot(pl.x - fx.phone.x, pl.z - fx.phone.z); if (d < 30) { ringT -= dt; if (ringT <= 0) { ringT = 3.2; audio.ring(); } } }
      if (details.cawed) { details.cawed = false; audio.caw(); }
      tHud += rdt; if (tHud > 0.4) { tHud = 0; hud(); }
      tSave += dt; if (tSave > 15 && !busy && !stalker.active && S.hour < HUNT_FROM) { tSave = 0; save(); }
    }

    const day = mode === 'menu' ? 2 : S.day, hour = mode === 'menu' ? 18.5 : S.hour, cave = S.inMine && mode !== 'menu' && mode !== 'end';
    weather.update(dt, t, day, hour, camera, indoor && (mode === 'walk' || mode === 'hide'), cave);
    if (weather.thunder !== null) {
      audio.thunder(weather.thunder); weather.thunder = null;
      if (mode === 'walk' && !busy && Math.hypot(pl.x - fx.mast.x, pl.z - fx.mast.z) < 17 && Math.random() < 0.5) { // Blitzeinschlag am Mast
        busy = true; $('flash').style.opacity = 1; audio.crash(); setTimeout(() => { $('flash').style.opacity = 0; $('fade').style.opacity = 1; }, 250);
        setTimeout(() => { S.hour = Math.min(DAWN - 0.3, S.hour + 2.5); S.hunger = Math.max(5, S.hunger - 12); $('fade').style.opacity = 0; busy = false; say('Der Blitz schlägt in den Mast. Als du wieder zu dir kommst, sind Stunden vergangen.', 7); }, 2600);
      }
    }
    const far = Math.max(110, Math.min(1000, weather.vis * 1.08)); if (Math.abs(far - camera.far) > 2) { camera.far = far; camera.updateProjectionMatrix(); scenery.sky.scale.setScalar(far * 0.9 / 1000); }
    scenery.update(t, camera); grass.update(t, camera, 0.25 + weather.storm * 0.6 + weather.rain * 0.2);
    details.update({ t, dt: rdt, day, px: pl.x, pz: pl.z, bus, playing });
    { let bi = -1, bdm = 49; fx.mirrors.forEach((p, i) => { const d = p.distanceToSquared(camera.position); if (d < bdm) { bdm = d; bi = i; } }); mirrors.forEach((r, i) => { r.visible = i === bi && mode === 'walk'; }); rearMirror.visible = mode === 'drive' && qual >= 1; }
    if (C.fps || C.showStalker) { const e = $('fps'); e.style.display = 'block'; if (fpsT > 0.4 || !e.textContent) e.textContent = (C.fps ? `${Math.round(fpsN / Math.max(0.01, fpsT))} B/s · x ${pl.x.toFixed(0)} z ${pl.z.toFixed(0)} · ${mode}` : '') + (C.showStalker ? ` · Er: ${stalker.mode}${stalker.dist < 1e8 ? ' ' + Math.round(stalker.dist) + ' m' : ''}` : ''); } else if ($('fps').style.display !== 'none') $('fps').style.display = 'none';
    fpsN++; fpsT += rdt; if (fpsT > 3) { const fps = fpsN / fpsT; fpsN = 0; fpsT = 0; if (fps < 27 && dynScale > 0.55) { dynScale -= 0.12; applyQual(); } else if (fps > 52 && dynScale < 1) { dynScale = Math.min(1, dynScale + 0.06); applyQual(); } }

    // --- Lichter ---
    const dk = 1 - weather.lum, night = dk > 0.45 ? 1 : 0; if (blackout > 0) blackout -= rdt; const bo = blackout > 0 ? 0 : 1;
    let fl = 1;
    if (day === 3) fl = Math.sin(t * 0.7) > 0.96 ? (Math.random() > 0.5 ? 1 : 0.2) : 1;
    else if (day === 4) fl = (Math.sin(t * 1.3) + Math.sin(t * 3.1)) > 0.9 ? (Math.random() > 0.4 ? 1 : 0.1) : 1;
    else if (day >= 5) fl = (Math.sin(t * 0.9) + Math.sin(t * 2.3)) > 1.5 ? Math.random() : 0.04;
    const K = { station: fl * bo, shop: (day <= 2 ? 1 : day === 3 ? fl : 0) * bo, lamp: night * (day <= 3 ? 1 : fl) * bo, warm: (day <= 2 ? 1 : 0) * bo, fire: day <= 2 ? 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3) : 0, radio: S.fuse && cave ? 0 : 1, mast: Math.sin(t * 2.2) > 0 ? 1 : 0.05 };
    for (const f of fx.flicker) f.mat.emissiveIntensity = f.base * (K[f.group] ?? 1);
    built.mats.winLit.emissiveIntensity = 1.4 * K.warm; fx.embers.mesh.visible = K.fire > 0;
    let bestE = null, bd = 1e9; for (const e of fx.emitters) { e.k = K[e.tag] ?? 1; if (e.k <= 0.01) continue; const d = e.pos.distanceToSquared(camera.position) / (e.dist * e.dist); if (d < bd) { bd = d; bestE = e; } }
    if (flashT > 0) { flashT -= rdt; local.position.copy(camera.position); local.color.setRGB(1, 0.85, 0.6); local.intensity = 70; local.distance = 30; }
    else if (mode === 'rear') { local.position.copy(bus.group.localToWorld(v4.set(-0.1, 1.55, -0.55))); local.color.setRGB(1, 0.72, 0.42); local.intensity = 2.2; local.distance = 5; }
    else if (stalker.active && stalker.mode !== 'away' && stalker.lightPos.distanceTo(camera.position) < 60 && !(bestE && bd < 0.3)) { local.position.copy(stalker.lightPos); local.color.setRGB(1, 0.93, 0.78); local.intensity = 60; local.distance = 26; }
    else if (bestE && bd < 30) { local.position.copy(bestE.pos); local.color.copy(bestE.color); local.intensity = bestE.base * bestE.k * (0.35 + 0.65 * dk); local.distance = bestE.dist; } else local.intensity = 0;
    fx.beam.group.rotation.y = t * 0.45; fx.beam.mat.opacity = 0.13 * dk * dk + Math.min(0.03, weather.fog * 0.8) * dk;
    const weak = S.batt < 15 ? (Math.sin(t * 23) > -0.2 ? 0.5 : 0.1) : 1;
    torch.intensity = (mode === 'walk' && S.torch) ? 95 * weak * (blackout > 0 ? 0.05 : 1) : 0;

    // --- Erscheinung im Nebel ---
    if (playing && S.day >= 3 && !S.inMine) {
      if (!fig.visible) {
        figure.t -= dt;
        if (figure.t <= 0) {
          figure.t = 35 + Math.random() * (S.day >= 5 ? 40 : 80);
          camera.getWorldDirection(v3); const a = Math.atan2(v3.x, v3.z) + (Math.random() - 0.5) * (mode === 'drive' ? 0.3 : 0.9), d = Math.max(16, Math.min(55, weather.vis * 0.55));
          const x = camera.position.x + Math.sin(a) * d, z = camera.position.z + Math.cos(a) * d, h = world.getHeight(x, z);
          if (h > 1.2 && !world.collide({ x, z }, 0.5) && (mode === 'walk' || mode === 'drive')) { fig.position.set(x, h - 0.05, z); fig.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z); fig.visible = true; figure.life = 9 + Math.random() * 8; figure.d0 = d; }
        }
      } else {
        figure.life -= rdt; const d = Math.hypot(fig.position.x - camera.position.x, fig.position.z - camera.position.z);
        if (figure.d0 > 0 && d < 9) { fig.visible = false; if (mode === 'drive' && Math.abs(bus.v) > 4) scare(false, 0.8); }
        else if (figure.life <= 0 || (figure.d0 > 0 && d < figure.d0 * 0.5)) fig.visible = false;
      }
    } else if (fig.visible) { figure.life -= rdt; if (figure.life <= 0) fig.visible = false; }
    const near = stalker.active ? Math.max(0, 1 - stalker.dist / 120) : 0;
    dread += ((fig.visible ? 1 : Math.max(near, cave ? 0.5 : 0, playing && S.day >= 5 ? 0.25 : 0)) - dread) * Math.min(1, rdt * 0.8);

    const pu = post.u; pu.uTime.value = t; pu.uPulse.value *= Math.pow(0.05, rdt);
    pu.uHorror.value += ((mode === 'menu' ? 0.5 : Math.min(1, 0.06 + (day - 1) * 0.17 + dk * 0.22 + near * 0.4 + (cave ? 0.3 : 0))) - pu.uHorror.value) * Math.min(1, rdt * 1.5);

    if (msgT > 0) { msgT -= rdt; if (msgT <= 0) $('msg').style.opacity = 0; }
    if (subQ.length || subT > 0) { subT -= rdt; if (subT <= 0) { const e = $('sub'); if (subQ.length) { e.textContent = subQ.shift(); e.style.opacity = 1; subT = subQ.gap || 3.6; } else { e.style.opacity = 0; subT = 0; } } }
    const hC = cave ? 50 : world.getHeight(camera.position.x, camera.position.z), inB = mode === 'drive' || mode === 'rear';
    audio.update({ rain: cave ? 0 : weather.rain, storm: cave ? 0 : weather.storm, birds: mode === 'menu' || cave ? 0 : weather.birds, inBus: inB, indoor, speed: bus.v, gas: mode === 'drive' ? Math.max(inp.gas, k.KeyW ? 1 : 0) : 0, engine: mode === 'drive' && bus.fuel > 0 && !S.dead, coast: Math.max(0, 1 - Math.max(0, hC) / 7), dread, dt: rdt, t, stalker: stalker.active ? stalker.dist : 1e9, stalkerCar: stalker.mode === 'drive', stalkerV: stalker.v });
    audio.radio(mode === 'drive' && bus.fuel > 0 && !S.dead && !S.radioOff ? (S.day <= 2 ? 1 : 2) : (distract?.radio && Math.hypot(pl.x - distract.x, pl.z - distract.z) < 40 ? 1 : 0), near, rdt);
    post.render(scene, camera);
  }
  window.__game = {
    tp: (x, z, yaw, pitch = 0) => { pl.x = x; pl.z = z; pl.yaw = yaw; pl.pitch = pitch; pl.y = world.ground(x, z); mode = 'walk'; },
    view: (key, dist, side = 0, pitch = 0, dyaw = 0) => { const o = world.pois[key] || world.spots[key], f = o.face; window.__game.tp(o.x + Math.sin(f) * dist + Math.cos(f) * side, o.z + Math.cos(f) * dist - Math.sin(f) * side, f + dyaw, pitch); },
    S: () => S, bus, pl, world, weather, items, camera, stalker, fx, post, details, set: o => { Object.assign(S, o); refreshItems(); }, mode: m => { if (m) mode = m; return mode; }, hud, fig, figure, act, fire, sleep, scare, ending, openMap, enterMine, target: () => target, skip: () => { if (cineS) cineS.t = cineS.dur; },
  };
  frame();
})();
