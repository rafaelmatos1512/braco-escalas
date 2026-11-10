// Base (backing track): banda sintetizada (bateria, baixo e violão) tocando os acordes em ciclo.
// Cada ritmo é uma tabela de passos; barEvents transforma em eventos de UM compasso (testável sem navegador).
import { midiAt, playNote, strum, drum, stopAll, clock } from './audio.js';

export const BEATS = 4; // compasso 4/4

// Passos: números inteiros numa grade de 16 (semicolcheias) ou 12 (tercinas, para o balanço do blues e do jazz).
// Um item pode ser [passo, volume]. bass: [passo, intervalo]; comp (violão): [passo, 'D' desce | 'U' sobe | n = nota n do acorde].
// Intervalos do baixo: r = fundamental, 3 = terça do acorde, 5 = quinta, 6 = sexta, b7 = sétima menor, 8 = oitava.
export const GROOVES = {
  rock: { name: 'Rock', bpm: 120, grid: 16,
    drums: { kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    bass: [[0, 'r'], [2, 'r'], [4, 'r'], [6, 'r'], [8, 'r'], [10, 'r'], [12, 'r'], [14, 'r']],
    comp: [[0, 'D'], [4, 'D'], [8, 'D'], [12, 'D']] },
  pop: { name: 'Pop', bpm: 100, grid: 16,
    drums: { kick: [0, 6, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    bass: [[0, 'r'], [6, 'r'], [8, 'r'], [10, '5']],
    comp: [[0, 'D'], [4, 'D'], [6, 'U'], [10, 'U'], [12, 'D']] },
  balada: { name: 'Balada', bpm: 72, grid: 16,
    drums: { kick: [0, 10], snare: [4, 12], hat: [[0, .5], [2, .5], [4, .5], [6, .5], [8, .5], [10, .5], [12, .5], [14, .5]] },
    bass: [[0, 'r'], [8, 'r']],
    comp: [[0, 0], [2, 2], [4, 3], [6, 2], [8, 1], [10, 2], [12, 3], [14, 2]] },
  sertanejo: { name: 'Sertanejo', bpm: 92, grid: 16,
    drums: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    bass: [[0, 'r'], [4, '5'], [8, 'r'], [12, '5']], // baixo alternado: fundamental e quinta
    comp: [[0, 'D'], [4, 'D'], [6, 'U'], [8, 'D'], [12, 'D'], [14, 'U']] },
  samba: { name: 'Samba', bpm: 100, grid: 16,
    drums: { kick: [[0, .5], [4, 1], [8, .5], [12, 1]], rim: [0, 2, 6, 8, 10, 14], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(s => [s, .35]) },
    bass: [[0, 'r'], [6, '5'], [8, 'r'], [14, '5']],
    comp: [[0, 'D'], [3, 'U'], [6, 'D'], [8, 'D'], [11, 'U'], [14, 'D']] },
  bossa: { name: 'Bossa nova', bpm: 80, grid: 16,
    drums: { kick: [[0, .8], [6, .6], [8, .8], [14, .6]], rim: [0, 3, 6, 10, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14].map(s => [s, .35]) },
    bass: [[0, 'r'], [6, '5'], [8, 'r'], [14, '5']],
    comp: [[0, 'D'], [3, 'U'], [6, 'D'], [10, 'D'], [12, 'U']] },
  baiao: { name: 'Baião e forró', bpm: 110, grid: 16,
    drums: { kick: [0, 6, 8, 14], rim: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(s => [s, s % 4 === 2 ? .5 : .25]) },
    bass: [[0, 'r'], [6, '5'], [8, 'r'], [14, '5']],
    comp: [[0, 'D'], [3, 'U'], [6, 'D'], [8, 'D'], [11, 'U'], [14, 'D']] },
  blues: { name: 'Blues (shuffle)', bpm: 92, grid: 12,
    drums: { kick: [0, 6], snare: [3, 9], hat: [0, 2, 3, 5, 6, 8, 9, 11].map(s => [s, s % 3 === 0 ? .45 : .3]) },
    bass: [[0, 'r'], [3, '3'], [6, '5'], [9, '6']],
    comp: [[0, 'D'], [3, 'D'], [6, 'D'], [9, 'D']] },
  swing: { name: 'Jazz (swing)', bpm: 120, grid: 12,
    drums: { ride: [0, 3, 5, 6, 9, 11].map(s => [s, s % 3 === 0 ? .6 : .4]), kick: [[0, .2], [3, .2], [6, .2], [9, .2]], hat: [[3, .5], [9, .5]] },
    bass: [[0, 'r'], [3, '3'], [6, '5'], [9, '6']],
    comp: [[0, 'D'], [5, 'D'], [8, 'U']] },
};
export const GROOVE_ORDER = ['rock', 'pop', 'balada', 'sertanejo', 'samba', 'bossa', 'baiao', 'blues', 'swing'];
// ritmo sugerido para cada gênero da lista de progressões
export const GROOVE_OF = { pop: 'pop', rock: 'rock', louvor: 'balada', sert: 'sertanejo', forro: 'baiao', samba: 'samba', bossa: 'bossa', rom: 'balada', latina: 'balada', jazz: 'swing', blues: 'blues' };

const sounded = frets => frets.map((f, s) => (f >= 0 ? s : -1)).filter(s => s >= 0);
const step = s => (Array.isArray(s) ? s : [s, 1]);

// nota do baixo (MIDI), na região de 40 (Mi grave) a 51
export function bassMidi(rootPc, iv, name) {
  const root = 40 + ((rootPc - 4 + 12) % 12);
  const third = iv.find(i => i === 3 || i === 4) ?? (iv.includes(5) ? 5 : 2);
  const fifth = iv.includes(7) ? 7 : iv.includes(6) ? 6 : iv.includes(8) ? 8 : 7;
  return root + ({ r: 0, 3: third, 5: fifth, 6: 9, b7: 10, 8: 12 }[name] ?? 0);
}

// eventos de UM compasso. chord: { frets, rootPc, iv }; mix: { drums, bass, comp } (true/false). t em tempos (0 a 4).
export function barEvents(grooveId, chord, mix = { drums: true, bass: true, comp: true }) {
  const g = GROOVES[grooveId], k = BEATS / g.grid, ev = [];
  if (mix.drums) for (const [d, steps] of Object.entries(g.drums)) for (const s of steps) { const [p, v] = step(s); ev.push({ t: p * k, kind: 'drum', drum: d, vol: v }); }
  if (mix.bass) for (const [p, n] of g.bass) ev.push({ t: p * k, kind: 'bass', midi: bassMidi(chord.rootPc, chord.iv, n) });
  const ss = sounded(chord.frets);
  if (mix.comp && ss.length) for (const [p, how] of g.comp) {
    if (how === 'D') ev.push({ t: p * k, kind: 'strum', frets: chord.frets, gap: 0.03 });
    else if (how === 'U') ev.push({ t: p * k, kind: 'up', midis: ss.slice(-4).reverse().map(s => midiAt(s, chord.frets[s])) });
    else { const s = ss[Math.min(how, ss.length - 1)]; ev.push({ t: p * k, kind: 'note', midi: midiAt(s, chord.frets[s]) }); }
  }
  return ev.sort((a, b) => a.t - b.t);
}

export const beatSec = bpm => 60 / bpm;

// Toca em ciclo. chords: [{ frets, rootPc, iv }]; bars = compassos por acorde.
// onBeat({ chord, bar, beat }) é chamado no instante em que cada tempo soa (para destacar na tela).
export function createPlayer({ chords, bpm, bars = 1, groove = 'rock', mix, onBeat }) {
  const lookahead = 0.3, tick = 40;
  const events = chords.map(c => barEvents(groove, c, mix));
  let timer = null, uiTimers = new Set(), next = 0, chord = 0, bar = 0, beat = 0, started = false;

  const schedule = () => {
    const now = clock();
    if (now === null) return;
    if (!started) { next = now + 0.1; started = true; }
    while (next < now + lookahead) {
      const spb = beatSec(bpm), at = next - now;
      for (const e of events[chord]) {
        if (e.t < beat - 1e-9 || e.t >= beat + 1 - 1e-9) continue;
        const d = at + (e.t - beat) * spb;
        if (e.kind === 'drum') drum(e.drum, d, e.vol);
        else if (e.kind === 'strum') strum(e.frets, d, e.gap);
        else if (e.kind === 'up') e.midis.forEach((m, i) => playNote(m, d + i * 0.02, 0.26));
        else playNote(e.midi, d, e.kind === 'bass' ? 0.55 : 0.34);
      }
      const info = { chord, bar, beat };
      const u = setTimeout(() => { uiTimers.delete(u); onBeat && onBeat(info); }, Math.max(0, at * 1000));
      uiTimers.add(u);
      next += spb;
      if (++beat === BEATS) { beat = 0; if (++bar === bars) { bar = 0; chord = (chord + 1) % chords.length; } }
    }
  };
  return {
    start() { schedule(); timer = setInterval(schedule, tick); },
    stop() { clearInterval(timer); timer = null; uiTimers.forEach(clearTimeout); uiTimers.clear(); stopAll(); },
  };
}
