// Afinador: ouve o microfone, descobre a altura do som (algoritmo YIN) e compara com as cordas soltas.
// As funções de cálculo não usam o navegador, então têm teste em test/tuner.test.js.

// afinação padrão, da 6ª (mais grossa) para a 1ª (mais fina)
export const STRINGS = [
  { n: 6, midi: 40, name: 'Mi', letter: 'E' },
  { n: 5, midi: 45, name: 'Lá', letter: 'A' },
  { n: 4, midi: 50, name: 'Ré', letter: 'D' },
  { n: 3, midi: 55, name: 'Sol', letter: 'G' },
  { n: 2, midi: 59, name: 'Si', letter: 'B' },
  { n: 1, midi: 64, name: 'Mi', letter: 'E' },
];
export const freqOf = midi => 440 * 2 ** ((midi - 69) / 12);
export const cents = (f, ref) => 1200 * Math.log2(f / ref);

// altura do som num trecho de áudio; null se for silêncio ou barulho sem nota definida
export function detectPitch(buf, sr, minF = 60, maxF = 1100) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / n) < 0.008) return null;
  const maxLag = Math.min(Math.floor(sr / minF), Math.floor(n / 2));
  const minLag = Math.max(2, Math.floor(sr / maxF));
  const W = n - maxLag - 1;
  // diferença média normalizada (YIN): fica perto de 0 quando o som se repete após "tau" amostras
  const c = new Float32Array(maxLag + 2);
  c[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= maxLag + 1; tau++) {
    let d = 0;
    for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; d += x * x; }
    run += d;
    c[tau] = run ? d * tau / run : 1;
  }
  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (c[t] < 0.15) { while (t < maxLag && c[t + 1] < c[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  // interpolação para achar o ponto exato entre duas amostras
  const a = c[tau - 1], b = c[tau], g = c[tau + 1];
  const den = a - 2 * b + g;
  const shift = den > 0 ? Math.max(-1, Math.min(1, 0.5 * (a - g) / den)) : 0;
  return { freq: sr / (tau + shift), clarity: 1 - b };
}

// corda mais próxima do som ouvido
export function nearestString(freq) {
  let best = 0, bc = Infinity;
  STRINGS.forEach((s, i) => { const c = cents(freq, freqOf(s.midi)); if (Math.abs(c) < Math.abs(bc)) { bc = c; best = i; } });
  return { i: best, cents: bc };
}

// quanto o som está longe da corda escolhida; se o microfone pegou a oitava (harmônico), corrige
export function centsToString(freq, i) {
  let c = cents(freq, freqOf(STRINGS[i].midi));
  if (c > 900 && c < 1500) c -= 1200;
  else if (c < -900 && c > -1500) c += 1200;
  return c;
}

// texto para o usuário conforme a diferença (em cents: 100 = uma casa)
export function tuneStatus(c) {
  const a = Math.abs(c);
  if (a <= 5) return { key: 'ok', text: 'Afinada! Pode passar para a próxima corda.' };
  if (a > 350) return { key: 'far', text: 'Esse som está longe desta corda. Confira se tocou a corda certa, solta, sem apertar casa.' };
  if (c < 0) return a > 50
    ? { key: 'low', text: 'Bem baixa: aperte a tarraxa (estica a corda e o som sobe).' }
    : { key: 'low', text: 'Um pouco baixa: aperte a tarraxa devagar, só um pouquinho.' };
  return a > 50
    ? { key: 'high', text: 'Bem alta: afrouxe a tarraxa (solta a corda e o som desce).' }
    : { key: 'high', text: 'Um pouco alta: afrouxe a tarraxa devagar, só um pouquinho.' };
}

// ---------- microfone (só no navegador) ----------
let mic = null;
export const micOn = () => !!mic;

export async function startMic(onFrame) {
  const md = typeof navigator !== 'undefined' && navigator.mediaDevices;
  if (!md || !md.getUserMedia) { const e = new Error('sem suporte'); e.name = 'NotSupportedError'; throw e; }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC(); // criado ainda dentro do toque do usuário (exigência do Safari)
  let stream;
  try {
    // sem filtros do navegador: eles "limpam" o som e atrapalham a medida
    stream = await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) { ctx.close().catch(() => {}); throw e; }
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const an = ctx.createAnalyser();
  an.fftSize = 4096;
  ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  const timer = setInterval(() => { an.getFloatTimeDomainData(buf); onFrame(detectPitch(buf, ctx.sampleRate)); }, 80);
  mic = { ctx, stream, timer };
}

export function stopMic() {
  if (!mic) return;
  clearInterval(mic.timer);
  mic.stream.getTracks().forEach(t => t.stop());
  mic.ctx.close().catch(() => {});
  mic = null;
}
