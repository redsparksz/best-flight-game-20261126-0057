// audio.js — Semua suara dibuat prosedural dengan WebAudio, tanpa file audio.
// Mesin: dua osilator sawtooth yang nadanya mengikuti throttle. Angin: noise
// putih yang difilter, volumenya mengikuti kecepatan. Ring: lonceng dua nada.
// Pendaratan/crash: dentum noise + nada rendah.

export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc1: null,
    engineOsc2: null,
    engineGain: null,
    windSrc: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };
}

export function ensureAudio(a) {
  if (a.started) {
    if (a.ctx && a.ctx.state === 'suspended') a.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  a.ctx = ctx;
  a.master = ctx.createGain();
  a.master.gain.value = 0.5;
  a.master.connect(ctx.destination);

  // Mesin.
  a.engineOsc1 = ctx.createOscillator();
  a.engineOsc1.type = 'sawtooth';
  a.engineOsc1.frequency.value = 55;
  a.engineOsc2 = ctx.createOscillator();
  a.engineOsc2.type = 'sawtooth';
  a.engineOsc2.frequency.value = 82;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  a.engineGain = ctx.createGain();
  a.engineGain.gain.value = 0;
  a.engineOsc1.connect(engineFilter);
  a.engineOsc2.connect(engineFilter);
  engineFilter.connect(a.engineGain);
  a.engineGain.connect(a.master);
  a.engineOsc1.start();
  a.engineOsc2.start();

  // Angin: buffer noise 2 detik yang diulang.
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  a.windSrc = ctx.createBufferSource();
  a.windSrc.buffer = buf;
  a.windSrc.loop = true;
  a.windFilter = ctx.createBiquadFilter();
  a.windFilter.type = 'bandpass';
  a.windFilter.frequency.value = 600;
  a.windFilter.Q.value = 0.6;
  a.windGain = ctx.createGain();
  a.windGain.gain.value = 0;
  a.windSrc.connect(a.windFilter);
  a.windFilter.connect(a.windGain);
  a.windGain.connect(a.master);
  a.windSrc.start();

  a.started = true;
}

// Dipanggil tiap frame: nada mesin + angin mengikuti throttle & kecepatan.
export function updateAudio(a, throttle, speed, onGround) {
  if (!a.started || !a.ctx) return;
  const t = a.ctx.currentTime;
  const rpm = 50 + throttle * 75 + (onGround ? 0 : speed * 0.35);
  a.engineOsc1.frequency.setTargetAtTime(rpm, t, 0.08);
  a.engineOsc2.frequency.setTargetAtTime(rpm * 1.494, t, 0.08);
  const engVol = a.muted ? 0 : 0.05 + throttle * 0.075 + (onGround ? 0 : 0.02);
  a.engineGain.gain.setTargetAtTime(engVol, t, 0.1);
  const windVol = a.muted ? 0 : Math.min(0.16, (speed / 62) * 0.16);
  a.windGain.gain.setTargetAtTime(windVol, t, 0.15);
  a.windFilter.frequency.setTargetAtTime(400 + speed * 14, t, 0.2);
}

function blip(a, freq, when, dur, vol, type = 'sine') {
  if (!a.started || a.muted) return;
  const osc = a.ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(g);
  g.connect(a.master);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

export function playRing(a) {
  if (!a.started) return;
  const t = a.ctx.currentTime;
  blip(a, 880, t, 0.5, 0.22);
  blip(a, 1318.5, t + 0.09, 0.6, 0.2);
}

export function playThud(a) {
  if (!a.started) return;
  const t = a.ctx.currentTime;
  // Dentum: noise rendah + sine 55 Hz yang meluruh.
  const len = a.ctx.sampleRate * 0.4;
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const f = a.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 300;
  const g = a.ctx.createGain();
  g.gain.value = a.muted ? 0 : 0.5;
  src.connect(f);
  f.connect(g);
  g.connect(a.master);
  src.start(t);
  blip(a, 55, t, 0.5, 0.4, 'sine');
}

export function playFanfare(a) {
  if (!a.started) return;
  const t = a.ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => blip(a, freq, t + i * 0.13, 0.55, 0.2));
}

export function setMuted(a, muted) {
  a.muted = muted;
  if (a.master) a.master.gain.value = muted ? 0 : 0.5;
}
