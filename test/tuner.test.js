import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, freqOf, cents, detectPitch, nearestString, centsToString, tuneStatus } from '../tuner.js';
import { pluckData } from '../audio.js';

const N = 4096;
// som parecido com corda: fundamental + harmônicos (o 2º bem forte, como na corda grave)
function stringLike(freq, sr, amps = [1, 0.9, 0.5, 0.35, 0.2, 0.12]) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) amps.forEach((a, k) => { b[i] += 0.3 * a * Math.sin(2 * Math.PI * freq * (k + 1) * i / sr + k); });
  return b;
}
// som de corda dedilhada (Karplus-Strong, igual ao do aplicativo), com ruído previsível
function plucked(freq, sr) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = sr / freq, L = Math.floor(P), ring = new Float32Array(L);
  for (let i = 0; i < L; i++) ring[i] = rnd() * 2 - 1;
  const out = new Float32Array(N + 2000);
  for (let i = 0, k = 0; i < out.length; i++) { const c = ring[k], nx = ring[(k + 1) % L]; out[i] = c * 0.5; ring[k] = (c + nx) * 0.5 * 0.996; k = (k + 1) % L; }
  return { buf: out.slice(2000), freq: sr / (L - 0.5) }; // a média com a amostra seguinte dá volta de L - 0,5
}

test('acha a altura de cada corda, afinada e desafinada, com erro menor que 2 cents', () => {
  for (const sr of [44100, 48000]) for (const s of STRINGS) for (const off of [-40, -8, 0, 3, 25]) {
    const f = freqOf(s.midi) * 2 ** (off / 1200);
    const r = detectPitch(stringLike(f, sr), sr);
    assert.ok(r, `sem leitura: corda ${s.n} ${off}c ${sr}`);
    assert.ok(Math.abs(cents(r.freq, f)) < 2, `corda ${s.n} ${off}c ${sr}: ${cents(r.freq, f).toFixed(2)}c`);
    assert.equal(nearestString(r.freq).i, STRINGS.indexOf(s));
    assert.ok(Math.abs(centsToString(r.freq, STRINGS.indexOf(s)) - off) < 2);
  }
});

test('funciona com som de corda dedilhada', () => {
  for (const s of STRINGS) {
    const { buf, freq } = plucked(freqOf(s.midi), 48000);
    const r = detectPitch(buf, 48000);
    assert.ok(r && Math.abs(cents(r.freq, freq)) < 2, `corda ${s.n}: ${r && cents(r.freq, freq).toFixed(2)}`);
    assert.equal(nearestString(r.freq).i, STRINGS.indexOf(s));
  }
});

test('o som do aplicativo sai afinado em todas as casas (até a 24ª)', () => {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const sr of [44100, 48000]) for (let midi = 40; midi <= 64 + 24; midi++) {
    const { out, rate } = pluckData(midi, sr, rnd);
    const r = detectPitch(out.subarray(4000, 4000 + N), sr, 60, 2000);
    const heard = r.freq * rate; // tocado mais rápido ou mais devagar
    assert.ok(Math.abs(cents(heard, freqOf(midi))) < 3, `midi ${midi} ${sr}: ${cents(heard, freqOf(midi)).toFixed(1)}c`);
  }
});

test('silêncio e chiado não viram nota', () => {
  assert.equal(detectPitch(new Float32Array(N), 48000), null);
  let seed = 3; const noise = new Float32Array(N).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.4);
  assert.equal(detectPitch(noise, 48000), null);
});

test('oitava errada do microfone é corrigida e as mensagens fazem sentido', () => {
  assert.ok(Math.abs(centsToString(freqOf(52), 0) - 0) < 0.01); // E3 lido na corda E2
  assert.equal(tuneStatus(0).key, 'ok');
  assert.equal(tuneStatus(-4).key, 'ok');
  assert.equal(tuneStatus(-30).key, 'low');
  assert.match(tuneStatus(-30).text, /aperte/);
  assert.equal(tuneStatus(80).key, 'high');
  assert.match(tuneStatus(80).text, /afrouxe/);
  assert.equal(tuneStatus(500).key, 'far');
});
