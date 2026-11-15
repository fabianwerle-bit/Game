// Einstellungen, Erfolge und verstecktes Admin-/Cheat-Menü
const $ = id => document.getElementById(id);
export const ACH = {
  night: 'Die erste Nacht mit ihm überstanden', shot: 'Ihn mit einem Schuss vertrieben', hide: 'Versteckt geblieben, während er suchte', map: 'Die Inselkarte gefunden',
  mine: 'In den Stollen gestiegen', islet: 'Die Nebeninsel erreicht', tapes: 'Alle fünf Kassetten gehört', polaroids: 'Alle sechs Polaroids gefunden', endA: 'Ende A · Der Kreis', endB: 'Ende B · Die Fähre',
};
const CODE = '1984';

export function createAdmin(api) {
  const load = (k, d) => { try { return Object.assign(d, JSON.parse(localStorage.getItem(k) || '{}')); } catch { return d; } };
  const set = load('la_set', { sens: 1, vib: true, btn: 1, diff: 1 });
  const ach = load('la_ach', {});
  const C = { god: false, noHunger: false, infAmmo: false, infBatt: false, fast: false, noclip: false, fly: false, freeze: false, ts: 1, stalkerOff: false, stalkerFreeze: false, showStalker: false, fps: false };
  const saveSet = () => { localStorage.setItem('la_set', JSON.stringify(set)); document.documentElement.style.setProperty('--bs', set.btn); };
  saveSet();
  const DIFF = [{ n: 'Spaziergang', sp: 0.84, hun: 0.7, gr: 1.6 }, { n: 'Normal', sp: 1, hun: 1, gr: 1 }, { n: 'Albtraum', sp: 1.12, hun: 1.3, gr: 0.75 }];
  const A = { C, set, ach, diff: () => DIFF[set.diff], unlocked: localStorage.getItem('la_admin') === '1' };
  A.vib = (ms) => { if (set.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch { } };
  A.award = (id) => { if (ach[id] || !ACH[id]) return; ach[id] = 1; localStorage.setItem('la_ach', JSON.stringify(ach)); api.toast('Erfolg: ' + ACH[id]); };

  const ov = $('admin'), box = $('adminBox');
  const close = () => { ov.style.display = 'none'; api.pause(false); api.hud(); };
  const h = (t) => { const e = document.createElement('h4'); e.textContent = t; box.append(e); };
  const row = () => { const e = document.createElement('div'); e.className = 'ar'; box.append(e); return e; };
  const btn = (r, label, fn, on) => { const e = document.createElement('button'); e.className = 'ab' + (on ? ' on' : ''); e.textContent = label; e.onclick = () => { fn(e); }; r.append(e); return e; };
  const tog = (r, label, key) => btn(r, label, (e) => { C[key] = !C[key]; e.classList.toggle('on', C[key]); }, C[key]);

  // ---------- Einstellungen (für alle) ----------
  A.openSettings = () => {
    api.pause(true); box.innerHTML = ''; ov.style.display = 'flex';
    h('Einstellungen');
    let r = row(); r.append('Umsehen: '); for (const v of [0.6, 0.8, 1, 1.3, 1.7]) btn(r, v === 1 ? 'normal' : v < 1 ? (v === 0.6 ? 'sehr langsam' : 'langsam') : (v === 1.3 ? 'schnell' : 'sehr schnell'), () => { set.sens = v; saveSet(); A.openSettings(); }, set.sens === v);
    r = row(); r.append('Knopfgröße: '); for (const v of [0.85, 1, 1.15, 1.3]) btn(r, Math.round(v * 100) + ' %', () => { set.btn = v; saveSet(); A.openSettings(); }, set.btn === v);
    r = row(); r.append('Schwierigkeit: '); DIFF.forEach((d, i) => btn(r, d.n, () => { set.diff = i; saveSet(); A.openSettings(); }, set.diff === i));
    r = row(); btn(r, 'Vibration: ' + (set.vib ? 'an' : 'aus'), () => { set.vib = !set.vib; saveSet(); A.vib(60); A.openSettings(); }, set.vib);
    btn(r, 'Grafik: ' + api.qualName(), () => { api.nextQual(); A.openSettings(); });
    btn(r, 'Fotomodus', () => { close(); api.photo(); });
    h('Erfolge ' + Object.keys(ach).length + ' / ' + Object.keys(ACH).length);
    const l = document.createElement('div'); l.className = 'al'; for (const k in ACH) { const d = document.createElement('div'); d.textContent = (ach[k] ? '■ ' : '□ ') + ACH[k]; d.style.opacity = ach[k] ? 1 : 0.45; l.append(d); } box.append(l);
    const st = api.S().stats || {}; h('Dieser Durchlauf'); const s2 = document.createElement('div'); s2.className = 'al'; s2.textContent = `${(st.km || 0).toFixed(1)} km gefahren · ${st.shots || 0} Schüsse · ${st.close || 0}× stand er an der Tür · ${api.S().polaroids || 0}/6 Polaroids`; box.append(s2);
    r = row(); btn(r, 'Schließen', close); if (A.unlocked) btn(r, 'Admin-Menü', A.openAdmin);
  };

  // ---------- Code-Eingabe ----------
  let taps = 0, tapT = 0;
  $('hud').style.pointerEvents = 'none'; $('day').style.pointerEvents = 'auto';
  $('day').addEventListener('pointerdown', () => { const now = performance.now(); taps = now - tapT < 700 ? taps + 1 : 1; tapT = now; if (taps >= 5) { taps = 0; A.unlocked ? A.openAdmin() : keypad(); } });
  const keypad = () => {
    api.pause(true); box.innerHTML = ''; ov.style.display = 'flex'; let code = '';
    h('Admin-Code'); const disp = document.createElement('div'); disp.className = 'ad'; disp.textContent = '· · · ·'; box.append(disp);
    const r = document.createElement('div'); r.className = 'ak'; box.append(r);
    for (const d of '123456789✕0←') btn(r, d, () => { if (d === '✕') return close(); if (d === '←') code = code.slice(0, -1); else if (code.length < 4) code += d; disp.textContent = code.padEnd(4, '·').split('').join(' ');
      if (code.length === 4) { if (code === CODE) { A.unlocked = true; localStorage.setItem('la_admin', '1'); A.openAdmin(); } else { disp.textContent = 'falsch'; code = ''; } } });
  };

  // ---------- Admin-Menü ----------
  A.openAdmin = () => {
    api.pause(true); box.innerHTML = ''; ov.style.display = 'flex'; const S = api.S();
    h('Admin · Spieler'); let r = row();
    tog(r, 'Unverwundbar', 'god'); tog(r, 'Kein Hunger', 'noHunger'); tog(r, 'Unendlich Munition', 'infAmmo'); tog(r, 'Unendlich Batterie', 'infBatt'); tog(r, 'Schnell laufen', 'fast'); tog(r, 'Durch Wände', 'noclip'); tog(r, 'Fliegen', 'fly');
    h('Bus'); r = row();
    btn(r, 'Tank voll', () => { api.bus.fuel = S.up.tank ? 130 : 100; }); btn(r, 'Pannen beheben', () => { api.setS({ flat: false, dead: false }); }); btn(r, 'Alle Ausbauteile', () => { api.setS({ up: { light: 1, lock: 1, tank: 1 } }); }); btn(r, 'Bus zu mir', () => { const p = api.pl; api.bus.place(p.x + 3, p.z + 3, p.yaw); });
    h('Zeit und Wetter'); r = row();
    for (let d = 1; d <= 6; d++) btn(r, 'Tag ' + d, () => { api.setS({ day: d }); A.openAdmin(); }, S.day === d);
    r = row(); for (const [l, v] of [['08', 8], ['12', 12], ['18', 18], ['20:30', 20.5], ['22', 22], ['00', 24], ['03', 27], ['05:30', 29.5]]) btn(r, l + ' Uhr', () => { api.setS({ hour: v }); });
    r = row(); tog(r, 'Zeit anhalten', 'freeze'); for (const v of [1, 4, 12]) btn(r, 'Zeit ×' + v, () => { C.ts = v; A.openAdmin(); }, C.ts === v);
    h('Teleport'); r = row();
    for (const k in api.places) btn(r, api.places[k], () => { close(); api.goto(k); });
    h('Verfolger'); r = row();
    tog(r, 'Verfolger aus', 'stalkerOff'); tog(r, 'Einfrieren', 'stalkerFreeze'); tog(r, 'Auf Karte + Abstand zeigen', 'showStalker');
    btn(r, 'Herholen (Nacht)', () => { C.stalkerOff = false; if (S.day < 2) api.setS({ day: 2 }); if (S.hour < 20.6 || S.hour > 29) api.setS({ hour: 21 }); close(); api.summon(); });
    btn(r, 'Vertreiben', () => { api.stalker.mode = 'fled'; api.stalker.gone = true; api.stalker.man.visible = false; });
    h('Gegenstände und Geschichte'); r = row();
    btn(r, 'Alles geben', () => { api.setS({ gun: true, armed: true, ammo: 30, key: true, fuse: true, map: true, spare: 5, batt: 100, planks: 5, boombox: 2, tyres: 2, carbatt: 1, tapes: ['school', 'mine', 'mast', 'wreck', 'islet'], inv: { apple: 5, can: 5, longlife: 5 } }); });
    btn(r, 'Essen', () => { api.setS({ hunger: 100, inv: { apple: 5, can: 5, longlife: 5 } }); }); btn(r, 'Pistole + 30 Schuss', () => { api.setS({ gun: true, armed: true, ammo: 30 }); });
    btn(r, 'Alle Türen auf', () => { api.setS({ doors: { office: true, light: true } }); }); btn(r, 'Alle Zettel', () => { api.allNotes(); }); btn(r, 'Karte aufdecken', () => { api.setS({ map: true, seen: Object.fromEntries(Object.keys(api.places).map(k => [k, 1])) }); });
    r = row(); btn(r, 'Ende A', () => { close(); api.ending('a'); }); btn(r, 'Ende B', () => { close(); api.ending('b'); }); btn(r, 'Durchläufe auf 0', () => { api.resetRuns(); }); btn(r, 'Speicherstand löschen', () => { localStorage.removeItem(api.SAVE); location.reload(); });
    h('Schreck und Fehlersuche'); r = row();
    btn(r, 'Gesicht', () => { close(); api.scare(true); }); btn(r, 'Gestalt im Raum', () => { close(); api.roomScare(); }); btn(r, 'Reifen platzt', () => { api.setS({ flat: true }); }); btn(r, 'Batterie leer', () => { api.setS({ dead: true }); });
    tog(r, 'Bilder/Sekunde + Position', 'fps'); btn(r, 'Admin sperren', () => { A.unlocked = false; localStorage.removeItem('la_admin'); close(); });
    r = row(); btn(r, 'Schließen', close); btn(r, 'Einstellungen', A.openSettings);
  };
  $('bSet').addEventListener('pointerdown', e => { e.preventDefault(); A.openSettings(); });
  return A;
}
