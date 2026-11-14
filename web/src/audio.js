// Komplett synthetisierter Ton (WebAudio) – keine Audiodateien nötig
export function createAudio() {
  let ctx = null, n = {}, lastStep = 0, birdT = 1;
  const A = { ready: false };
  A.init = () => {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buf = buf;
    const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); n.master = master;
    const loop = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return { f, g }; };
    n.rain = loop('highpass', 1400); n.rainLow = loop('lowpass', 700); n.wind = loop('bandpass', 320, 0.5); n.sea = loop('lowpass', 420);
    const eg = ctx.createGain(); eg.gain.value = 0; const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 260; ef.connect(eg); eg.connect(master);
    n.eng = [1, 0.5, 1.51].map((m, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'square' : 'sawtooth'; o.frequency.value = 40 * m; const g = ctx.createGain(); g.gain.value = i === 2 ? 0.25 : 0.6; o.connect(g); g.connect(ef); o.start(); return { o, m }; });
    n.engG = eg; n.engF = ef;
    const dr = ctx.createGain(); dr.gain.value = 0; dr.connect(master); [49, 52.3, 98.7].forEach(f => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(dr); o.start(); }); n.drone = dr;
    A.ready = true;
  };
  const set = (p, v, tc = 0.3) => p.setTargetAtTime(v, ctx.currentTime, tc);
  const burst = (type, freq, dur, vol, q = 1, delay = 0) => {
    const s = ctx.createBufferSource(); s.buffer = n.buf; s.playbackRate.value = 0.7 + Math.random() * 0.6; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(), t = ctx.currentTime + delay; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(n.master); s.start(t, Math.random() * 2); s.stop(t + dur + 0.1);
  };
  A.step = (wet) => { if (!A.ready) return; burst('bandpass', wet ? 500 : 900, 0.13, 0.16, 1.2); if (wet) burst('highpass', 2500, 0.09, 0.05); };
  A.thunder = (delay) => { if (!A.ready) return; burst('lowpass', 150, 4.5, 1.2, 0.7, delay); burst('lowpass', 420, 1.2, 0.5, 0.7, delay); };
  A.blip = (f = 660) => { if (!A.ready) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25); o.connect(g); g.connect(n.master); o.start(); o.stop(ctx.currentTime + 0.3); };
  A.thud = () => { if (!A.ready) return; burst('lowpass', 180, 0.4, 0.9); };
  A.door = () => { if (!A.ready) return; burst('lowpass', 300, 0.25, 0.6); burst('bandpass', 1800, 0.06, 0.15, 2, 0.02); };
  const chirp = () => {
    const t = ctx.currentTime, base = 2200 + Math.random() * 2600, reps = 1 + (Math.random() * 5 | 0), vol = 0.015 + Math.random() * 0.03;
    for (let i = 0; i < reps; i++) { const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.13; o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (0.75 + Math.random() * 0.7), s + 0.09); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol, s + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, s + 0.1); o.connect(g); g.connect(n.master); o.start(s); o.stop(s + 0.12); }
  };
  // s: { rain, storm, birds, inBus, indoor, speed, gas, engine, coast, dread, dt, t }
  A.update = (s) => {
    if (!A.ready) return;
    const muff = s.inBus ? 1 : s.indoor ? 0.7 : 0;
    set(n.rain.g.gain, s.rain * 0.34 * (1 - muff * 0.85)); set(n.rainLow.g.gain, s.rain * (0.12 + muff * 0.5));
    set(n.rainLow.f.frequency, 500 + muff * 500);
    set(n.wind.g.gain, (0.05 + s.storm * 0.22 + s.rain * 0.06) * (1 - muff * 0.6) * (0.7 + 0.3 * Math.sin(s.t * 0.21) * Math.sin(s.t * 0.13)), 0.8);
    set(n.wind.f.frequency, 260 + 160 * Math.sin(s.t * 0.17) + s.storm * 200, 1);
    set(n.sea.g.gain, s.coast * 0.3 * (0.55 + 0.45 * Math.sin(s.t * 0.55)) * (1 - muff * 0.7), 0.5);
    set(n.engG.gain, s.engine ? 0.16 + s.gas * 0.1 : 0, 0.15);
    const f = 34 + Math.abs(s.speed) * 4.6 + s.gas * 9; n.eng.forEach(e => set(e.o.frequency, f * e.m, 0.1)); set(n.engF.frequency, 200 + Math.abs(s.speed) * 26 + s.gas * 120, 0.2);
    set(n.drone.gain, s.dread * 0.06, 1.5);
    birdT -= s.dt; if (birdT <= 0) { birdT = 0.3 + Math.random() * 2.2 / Math.max(0.05, s.birds); if (s.birds > 0.05 && Math.random() < s.birds && !s.inBus) chirp(); }
  };
  return A;
}
