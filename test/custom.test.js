import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customChords, CHORD_TYPES, pcOfName } from '../music.js';

const it = (o, t) => ({ o, t });

test('progressão própria em Dó maior: nomes, graus e campo harmônico', () => {
  const ch = customChords(0, 'maior', [it(0, 'maior'), it(7, 'maior'), it(9, 'menor'), it(5, 'maior'), it(2, 'm7'), it(7, '7'), it(10, 'maior'), it(11, 'dim')], true);
  assert.deepEqual(ch.map(c => c.name), ['C', 'G', 'Am', 'F', 'Dm7', 'G7', 'Bb', 'B°']);
  assert.deepEqual(ch.map(c => c.roman), ['I', 'V', 'vi', 'IV', 'ii7', 'V7', 'bVII', 'vii°']);
  assert.deepEqual(ch.map(c => c.inField), [true, true, true, true, true, true, false, true]);
});

test('trocar o tom transpõe a progressão inteira', () => {
  const items = [it(0, 'maior'), it(7, 'maior'), it(9, 'menor'), it(5, 'maior')];
  assert.deepEqual(customChords(2, 'maior', items, true).map(c => c.name), ['D', 'A', 'Bm', 'G']);
  assert.deepEqual(customChords(5, 'maior', items, true).map(c => c.name), ['F', 'C', 'Dm', 'Bb']);
});

test('tom menor: graus da escala menor e acordes de fora', () => {
  const ch = customChords(9, 'menor', [it(0, 'menor'), it(5, 'menor'), it(7, '7'), it(8, 'maior'), it(3, 'maior'), it(10, 'maior')], true);
  assert.deepEqual(ch.map(c => c.name), ['Am', 'Dm', 'E7', 'F', 'C', 'G']);
  assert.deepEqual(ch.map(c => c.roman), ['i', 'iv', 'V7', 'VI', 'III', 'VII']);
  assert.equal(ch[2].inField, false); // E7 tem G#, que não está na escala menor natural
});

test('qualquer tipo em qualquer distância e tom: notas certas e grafia com letras seguidas', () => {
  for (const mode of ['maior', 'menor']) for (let key = 0; key < 12; key++) for (let o = 0; o < 12; o++)
    for (const [type, t] of Object.entries(CHORD_TYPES)) {
      const [c] = customChords(key, mode, [it(o, type)], key % 2 === 0);
      assert.equal(c.rootPc, (key + o) % 12);
      assert.equal(pcOfName(c.rootName), c.rootPc, `${key} ${mode} ${o} ${type}: ${c.rootName}`);
      c.names.forEach((n, i) => assert.equal(pcOfName(n), c.pcs[i], `${c.name}: ${c.names}`));
      assert.ok(!/[#b]{3}/.test(c.name), c.name);
    }
});
