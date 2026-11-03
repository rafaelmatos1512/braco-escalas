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
