import { TUNING } from './music.js';

function evaluate(frets, rootPc, required) {
  const idx = [];
  frets.forEach((f, i) => { if (f >= 0) idx.push(i); });
  if (idx.length < 4) return null;
  const first = idx[0], last = idx[idx.length - 1];
  if (last - first + 1 !== idx.length) return null; // sem corda muda no meio
  const here = new Set(idx.map(i => (TUNING[i] + frets[i]) % 12));
  for (const r of required) if (!here.has(r)) return null;

  const fretted = idx.filter(i => frets[i] > 0);
  let minF = 0, maxF = 0, barre = false, fingers = 0, barreFrom = -1, barreTo = -1;
  if (fretted.length) {
    minF = Math.min(...fretted.map(i => frets[i]));
    maxF = Math.max(...fretted.map(i => frets[i]));
    if (maxF - minF > 3) return null;
    fingers = fretted.length;
    if (fingers > 4) { // só com pestana
      const low = fretted.filter(i => frets[i] === minF);
      if (low.length < 2) return null;
      const a = low[0], b = low[low.length - 1];
      if (idx.some(i => i > a && i < b && frets[i] === 0)) return null;
      barre = true; barreFrom = a; barreTo = b;
      fingers = fretted.filter(i => frets[i] > minF).length + 1;
      if (fingers > 4) return null;
    }
  }
  const bassIsRoot = (TUNING[first] + frets[first]) % 12 === rootPc;
  const muted = 6 - idx.length;
  const score = fingers * 2 + (maxF - minF) + muted * 0.6 + (barre ? 2.5 : 0)
    + minF * 0.15 + (bassIsRoot ? 0 : 3) - idx.length * 0.4;
  return { frets: frets.slice(), minF, maxF, fingers, barre, barreFrom, barreTo,
    hasOpen: idx.some(i => frets[i] === 0), sounded: idx.length, bassIsRoot, score };
}

export function generateVoicings(rootPc, iv) {
  const pcs = new Set(iv.map(i => (rootPc + i) % 12));
  const required = new Set(pcs);
  if (pcs.size >= 4 && iv.includes(7)) required.delete((rootPc + 7) % 12); // quinta opcional
  const seen = new Set(), out = [];
  for (let base = 1; base <= 12; base++) {
    const opts = [];
    for (let s = 0; s < 6; s++) {
      const o = [-1];
      if (base <= 3 && pcs.has(TUNING[s] % 12)) o.push(0);
      for (let f = base; f <= base + 3; f++) if (pcs.has((TUNING[s] + f) % 12)) o.push(f);
      opts.push(o);
    }
    const cur = new Array(6);
    const rec = s => {
      if (s === 6) {
        const v = evaluate(cur, rootPc, required);
        if (v) { const k = v.frets.join(','); if (!seen.has(k)) { seen.add(k); out.push(v); } }
        return;
      }
      for (const f of opts[s]) { cur[s] = f; rec(s + 1); }
    };
    rec(0);
  }
  return out.sort((a, b) => a.score - b.score);
}

const REGIONS = { '1': [0, 4], '2': [5, 8], '3': [9, 12], '4': [13, 15] };

export function filterVoicings(list, f) {
  return list.filter(v => {
    if (f.region !== 'all') {
      const [lo, hi] = REGIONS[f.region];
      if (v.minF < lo || v.minF > hi) return false;
    }
    if (f.open === 'with' && !v.hasOpen) return false;
    if (f.open === 'without' && v.hasOpen) return false;
    if (f.barre === 'with' && !v.barre) return false;
    if (f.barre === 'without' && v.barre) return false;
    if (f.bass === 'root' && !v.bassIsRoot) return false;
    if (v.sounded < f.min) return false;
    return true;
  });
}

// Sistema CAGED: 5 formas de acorde aberto que viram móveis (pestana)
const CAGED = {
  maior: { C: [[-1,3,2,0,1,0], 0], A: [[-1,0,2,2,2,0], 9], G: [[3,2,0,0,0,3], 7], E: [[0,2,2,1,0,0], 4], D: [[-1,-1,0,2,3,2], 2] },
  menor: { C: [[-1,3,1,0,1,-1], 0], A: [[-1,0,2,2,1,0], 9], G: [[3,1,0,0,3,3], 7], E: [[0,2,2,0,0,0], 4], D: [[-1,-1,0,2,3,1], 2] },
};
export const hasCaged = type => !!CAGED[type];
export function cagedShapes(rootPc, type) {
  return Object.entries(CAGED[type]).map(([shape, [tpl, r]]) => {
    const shift = (rootPc - r + 12) % 12;
    const frets = tpl.map(f => f < 0 ? -1 : f + shift);
    const used = frets.filter(f => f > 0);
    const minF = used.length ? Math.min(...used) : 0, maxF = used.length ? Math.max(...used) : 0;
    const low = frets.map((f, i) => f === shift && shift > 0 ? i : -1).filter(i => i >= 0);
    const barre = low.length >= 2;
    return { shape, frets, minF, maxF, barre, barreFrom: low[0], barreTo: low[low.length - 1],
      fingers: barre ? 1 + used.filter(f => f > shift).length : used.length, hasOpen: frets.includes(0) };
  }).sort((a, b) => a.minF - b.minF);
}
