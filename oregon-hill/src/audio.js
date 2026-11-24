// Procedural WebAudio: ambient drone, pocket-radio static, sirens, blips.
export function createAudio() {
  let ctx = null;
  let master, staticGain, staticFilter, droneGain, droneFilter, oscs = [];
  let muted = false;
  let noiseBuf = null;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // radio static
    const ns = ctx.createBufferSource();
    ns.buffer = noiseBuf;
    ns.loop = true;
    staticFilter = ctx.createBiquadFilter();
    staticFilter.type = 'bandpass';
    staticFilter.frequency.value = 2400;
    staticFilter.Q.value = 0.6;
    staticGain = ctx.createGain();
    staticGain.gain.value = 0;
    ns.connect(staticFilter).connect(staticGain).connect(master);
    ns.start();

    // drone
    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 420;
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.0;
    droneFilter.connect(droneGain).connect(master);
    for (const [f, type, g] of [
      [55, 'sawtooth', 0.12],
      [55.4, 'sawtooth', 0.12],
      [82.4, 'triangle', 0.18],
      [110.3, 'sine', 0.1],
    ]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(droneFilter);
      o.start();
      oscs.push({ o, base: f });
    }
    // slow LFO on the filter
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 160;
    lfo.connect(lg).connect(droneFilter.frequency);
    lfo.start();
    droneGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 4);
  }

  function env(node, t0, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }

  function tone(freq, dur = 0.12, type = 'square', vol = 0.12, slide = 0, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = ctx.createGain();
    env(g, t, 0.005, vol, dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noiseBurst(dur = 0.1, freq = 1000, vol = 0.2, q = 1, when = 0, type = 'bandpass') {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, 0.003, vol, dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  const sfx = {
    blip: () => tone(880, 0.05, 'square', 0.06),
    select: () => {
      tone(660, 0.05, 'square', 0.07);
      tone(990, 0.07, 'square', 0.07, 0, 0.05);
    },
    cash: () => {
      tone(1320, 0.08, 'square', 0.08);
      tone(1760, 0.18, 'square', 0.08, 0, 0.08);
    },
    bad: () => tone(220, 0.3, 'sawtooth', 0.1, -120),
    ticket: () => {
      tone(1800, 0.08, 'square', 0.07);
      tone(1800, 0.08, 'square', 0.07, 0, 0.14);
      tone(1800, 0.2, 'square', 0.07, 0, 0.28);
    },
    door: () => {
      noiseBurst(0.25, 300, 0.25, 1.5);
      tone(90, 0.25, 'sine', 0.2, -30, 0.05);
    },
    swing: () => noiseBurst(0.12, 1800, 0.12, 0.8, 0, 'highpass'),
    hit: () => {
      noiseBurst(0.08, 500, 0.4, 2);
      tone(140, 0.12, 'square', 0.12, -60);
    },
    hurt: () => {
      tone(160, 0.25, 'sawtooth', 0.14, -80);
      noiseBurst(0.2, 800, 0.2, 1);
    },
    step: () => noiseBurst(0.04, 600 + Math.random() * 300, 0.035, 3),
    paper: () => noiseBurst(0.18, 3000, 0.12, 0.5),
    gulp: () => {
      tone(300, 0.08, 'sine', 0.12, -100);
      tone(260, 0.08, 'sine', 0.12, -100, 0.12);
    },
    horn: () => {
      if (!ctx || muted) return;
      for (const f of [311, 370, 466]) tone(f, 2.2, 'sawtooth', 0.035, -6);
    },
    siren: () => {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 1.5);
      g.gain.setValueAtTime(0.09, t + 6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1400;
      o.frequency.setValueAtTime(180, t);
      for (let i = 0; i < 3; i++) {
        o.frequency.linearRampToValueAtTime(640, t + 1.5 + i * 2.5);
        o.frequency.linearRampToValueAtTime(260, t + 2.8 + i * 2.5);
      }
      o.connect(f).connect(g).connect(master);
      o.start(t);
      o.stop(t + 9.2);
    },
    clank: () => {
      noiseBurst(0.4, 180 + Math.random() * 200, 0.25, 6);
      tone(70 + Math.random() * 40, 0.5, 'square', 0.05, -20);
    },
  };

  let lastStatic = 0;
  function setStatic(v) {
    if (!ctx) return;
    v = muted ? 0 : Math.max(0, Math.min(1, v));
    const crackle = v > 0 ? v * (0.6 + Math.random() * 0.5) : 0;
    if (Math.abs(crackle - lastStatic) > 0.01) {
      staticGain.gain.setTargetAtTime(crackle * 0.32, ctx.currentTime, 0.05);
      staticFilter.frequency.setTargetAtTime(1500 + Math.random() * 2500, ctx.currentTime, 0.05);
      lastStatic = crackle;
    }
  }

  function setMood(other, interior) {
    if (!ctx) return;
    const pitch = 1 - other * 0.25;
    for (const { o, base } of oscs) o.frequency.setTargetAtTime(base * pitch, ctx.currentTime, 1.5);
    droneGain.gain.setTargetAtTime(muted ? 0 : interior ? 0.12 : 0.28 + other * 0.25, ctx.currentTime, 1.0);
    droneFilter.Q.value = 1 + other * 8;
  }

  function toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.1);
    return muted;
  }

  return { init, sfx, setStatic, setMood, toggleMute, get muted() { return muted; } };
}
