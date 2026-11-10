// Som de corda dedilhada gerado no navegador (síntese Karplus-Strong), sem arquivos de áudio.

// altura (MIDI) de cada corda solta: 6ª E2 ... 1ª E4
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
export const midiAt = (string, fret) => OPEN_MIDI[string] + fret;

let ctx = null, master = null, enabled = true;
const cache = new Map();
const playing = new Set();
const timers = new Set();

try { enabled = localStorage.getItem('sound') !== 'off'; } catch {}
export const soundOn = () => enabled;
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem('sound', on ? 'on' : 'off'); } catch {}
  if (!on) stopAll();
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// amostra de uma corda vibrando (sem navegador, para poder testar a afinação)
export function pluckData(midi, sr, rnd = Math.random) {
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const N = Math.max(2, Math.round(sr / freq));
  const len = Math.floor(sr * 2.4), out = new Float32Array(len), ring = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) { const r = rnd() * 2 - 1; prev = prev * 0.45 + r * 0.55; ring[i] = prev; } // ataque mais macio
  const decay = freq > 600 ? 0.9935 : freq > 300 ? 0.995 : 0.9965;
  for (let i = 0, k = 0; i < len; i++) {
    const cur = ring[k], nxt = ring[(k + 1) % N];
    out[i] = cur;
    ring[k] = (cur + nxt) * 0.5 * decay;
    k = (k + 1) % N;
  }
  const fade = Math.floor(sr * 0.3);
  for (let i = 0; i < fade; i++) out[len - fade + i] *= 1 - i / fade;
  // a média com a amostra seguinte faz a volta durar N - 0,5 amostras:
  // a velocidade de leitura corrige para a altura exata da nota
  return { out, rate: freq / (sr / (N - 0.5)) };
}

// gera (uma vez) o som de cada nota
function pluckBuffer(midi) {
  if (cache.has(midi)) return cache.get(midi);
  const sr = ctx.sampleRate, { out, rate } = pluckData(midi, sr);
  const buf = ctx.createBuffer(1, out.length, sr);
  buf.copyToChannel ? buf.copyToChannel(out, 0) : buf.getChannelData(0).set(out);
  const item = { buf, rate };
  cache.set(midi, item);
  return item;
}

// force: toca mesmo com o som desligado (referência do afinador, pedida de propósito)
export function playNote(midi, delay = 0, vol = 0.45, force = false) {
  if ((!enabled && !force) || !audio()) return;
  const { buf, rate } = pluckBuffer(midi);
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = rate; g.gain.value = vol;
  src.connect(g).connect(master);
  src.start(ctx.currentTime + delay);
  playing.add(src); src.onended = () => playing.delete(src);
}

// toca uma forma de acorde (casas por corda, -1 = não toca), da corda grave para a aguda
export function strum(frets, delay = 0, gap = 0.035) {
  let i = 0;
  frets.forEach((f, s) => { if (f >= 0) playNote(midiAt(s, f), delay + gap * i++, 0.32); });
}

// toca uma lista de notas (MIDI) uma depois da outra
export function sequence(midis, gap = 0.32) {
  midis.forEach((m, i) => playNote(m, i * gap));
}

// agenda passos no tempo (para tocar progressões); devolve uma função que cancela
export function schedule(steps, gapMs, onStep, onEnd) {
  stopAll();
  steps.forEach((s, i) => {
    const t = setTimeout(() => { timers.delete(t); onStep(s, i); }, i * gapMs);
    timers.add(t);
  });
  const end = setTimeout(() => { timers.delete(end); onEnd && onEnd(); }, steps.length * gapMs);
  timers.add(end);
}

export function stopAll() {
  timers.forEach(clearTimeout); timers.clear();
  playing.forEach(s => { try { s.stop(); } catch {} }); playing.clear();
}
export const isScheduled = () => timers.size > 0;

// relógio do áudio (segundos), para agendar com precisão; null se o navegador não tem Web Audio
export const clock = () => { const c = audio(); return c ? c.currentTime : null; };

/* ---------- bateria sintetizada (sem arquivos de áudio) ---------- */
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
// toca uma peça da bateria: 'kick' | 'snare' | 'hat' | 'ohat' | 'rim' | 'ride'
export function drum(kind, delay = 0, vol = 1) {
  if (!enabled || !audio()) return;
  const t = ctx.currentTime + delay;
  const track = n => { playing.add(n); n.onended = () => playing.delete(n); return n; };
  const env = (peak, dur) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(master); return g;
  };
  const tone = (type, f0, f1, peak, dur) => {
    const o = track(ctx.createOscillator()); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
    o.connect(env(peak, dur)); o.start(t); o.stop(t + dur + 0.02);
  };
  const hiss = (filter, freq, peak, dur) => {
    const s = track(ctx.createBufferSource()); s.buffer = noise();
    const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq;
    s.connect(f); f.connect(env(peak, dur)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  };
  if (kind === 'kick') tone('sine', 150, 45, 0.9, 0.32);
  else if (kind === 'snare') { hiss('highpass', 1200, 0.45, 0.18); tone('triangle', 200, 140, 0.35, 0.1); }
  else if (kind === 'rim') { hiss('bandpass', 2200, 0.5, 0.04); tone('square', 900, 0, 0.12, 0.03); }
  else if (kind === 'ohat') hiss('highpass', 7000, 0.22, 0.28);
  else if (kind === 'ride') hiss('highpass', 5500, 0.18, 0.2);
  else hiss('highpass', 8000, 0.2, 0.05); // hat fechado
}
