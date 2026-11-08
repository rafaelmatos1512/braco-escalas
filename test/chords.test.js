import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateVoicings, cagedShapes } from '../chords.js';
import { CHORD_TYPES } from '../music.js';

const shape = v => v.frets.map(f => (f < 0 ? 'x' : f)).join('');
const first = (root, type) => shape(generateVoicings(root, CHORD_TYPES[type].iv).filter(v => v.bassIsRoot)[0]);

test('acordes abertos clássicos vêm primeiro', () => {
  assert.equal(first(0, 'maior'), 'x32010'); // C
  assert.equal(first(9, 'menor'), 'x02210'); // Am
  assert.ok(first(7, 'maior').startsWith('320')); // G
});

test('F tem forma com pestana', () => {
  const all = generateVoicings(5, CHORD_TYPES.maior.iv).map(shape);
  assert.ok(all.includes('133211'));
});

test('CAGED de C maior: 5 formas em ordem no braço', () => {
  const c = cagedShapes(0, 'maior');
  assert.deepEqual(c.map(v => v.shape), ['C', 'A', 'G', 'E', 'D']);
  assert.equal(shape(c[0]), 'x32010');
});

test('findVoicing acha a forma pelas casas e recusa o que não existe', async () => {
  const { findVoicing, neckPositions } = await import('../chords.js');
  const { CHORD_TYPES } = await import('../music.js');
  const list = neckPositions(0, 'maior', CHORD_TYPES.maior.iv);
  assert.equal(findVoicing(list, [...list[2].frets]), list[2]);
  assert.equal(findVoicing(list, [9, 9, 9, 9, 9, 9]), null);
  assert.equal(findVoicing(list, null), null);
});

test('Mais agudo (13+) tem formas em todos os acordes e tons, sem passar da casa 24', async () => {
  const { filterVoicings } = await import('../chords.js');
  const f = { region: '4', open: 'any', barre: 'any', bass: 'root', min: 4 };
  for (const [type, t] of Object.entries(CHORD_TYPES)) {
    if (type === '5') continue; // power chord não está na tela Acordes
    for (let r = 0; r < 12; r++) {
      const all = generateVoicings(r, t.iv);
      assert.ok(filterVoicings(all, f).length > 0, `${type} em ${r}`);
      assert.ok(all.every(v => v.maxF <= 24));
    }
  }
});

test('allPositions traz mais formas que as espalhadas, sem repetir e com a nota principal no grave', async () => {
  const { allPositions, neckPositions } = await import('../chords.js');
  for (const [type, t] of Object.entries(CHORD_TYPES)) {
    if (type === '5') continue;
    for (let r = 0; r < 12; r++) {
      const all = allPositions(r, type, t.iv), keys = all.map(v => v.frets.join(','));
      assert.equal(new Set(keys).size, keys.length);
      assert.ok(all.length >= neckPositions(r, type, t.iv).length);
    }
  }
  assert.ok(allPositions(0, 'maior', CHORD_TYPES.maior.iv).length > 12);
});

test('tipos novos escritos certo (m(maj7), 7(b13), 7(#11), maj7(#11), 7(#5), 9sus4, m11, m(add9), 7(b5))', async () => {
  const { CHORD_TYPES, spelledChord } = await import('../music.js');
  const sp = (r, t) => spelledChord(r, CHORD_TYPES[t].iv, true, CHORD_TYPES[t].letters).join(' ');
  assert.equal(sp(0, 'mmaj7'), 'C Eb G B');
  assert.equal(sp(0, '7b13'), 'C E G Bb Ab');
  assert.equal(sp(0, '7#11'), 'C E G Bb F#');
  assert.equal(sp(0, 'maj7#11'), 'C E G B F#');
  assert.equal(sp(0, '7#5'), 'C E G# Bb');
  assert.equal(sp(0, '9sus4'), 'C F G Bb D');
  assert.equal(sp(0, 'm11'), 'C Eb G Bb F');
  assert.equal(sp(9, 'madd9'), 'A C E B');
  assert.equal(sp(7, '7b5'), 'G B Db F');
  assert.equal(sp(10, '7b13'), 'Bb D F Ab Gb');
});
