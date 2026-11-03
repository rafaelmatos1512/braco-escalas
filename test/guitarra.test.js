import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESSIONS, progressionChords, spelledChord, CHORD_TYPES } from '../music.js';
import { powerChords, stringSetTriads, neckPositions } from '../chords.js';

const shape = v => v.frets.map(f => (f < 0 ? 'x' : f)).join('.');
const prog = (key, mode, i) => progressionChords(key, mode, PROGRESSIONS[mode][i], true).map(c => c.name).join(' ');

test('progressões nos tons certos', () => {
  assert.equal(prog(0, 'maior', 1), 'C G Am F');
  assert.equal(prog(5, 'maior', 0), 'F Bb C');
  assert.equal(prog(0, 'maior', 5), 'Dm7 G7 Cmaj7');
  assert.equal(prog(9, 'menor', 1), 'Am Dm E7');
  assert.equal(prog(2, 'menor', 5), 'Em7(b5) A7 Dm7');
  assert.equal(progressionChords(9, 'menor', PROGRESSIONS.menor[1], true)[2].names.join(' '), 'E G# B D');
});

test('7(#9) escrito com #9', () => {
  const t = CHORD_TYPES['7#9'];
  assert.equal(spelledChord(0, t.iv, true, t.letters).join(' '), 'C E G Bb D#');
});

test('power chords de E pelo braço', () => {
  const p = powerChords(4).map(shape);
  assert.ok(p.includes('0.2.2.x.x.x'));
  assert.ok(p.includes('12.14.14.x.x.x'));
  assert.ok(powerChords(4).every(v => v.maxF <= 24));
});

test('tríades de C nas cordas agudas', () => {
  const t = stringSetTriads(0, [0, 4, 7], [5, 4, 3]);
  const s = t.map(shape);
  assert.ok(s.includes('x.x.x.0.1.0') && s.includes('x.x.x.5.5.3') && s.includes('x.x.x.9.8.8'));
  assert.ok(t.every(v => !(v.hasOpen && v.maxF > 4)));
  assert.equal(t.find(v => shape(v) === 'x.x.x.5.5.3').label, 'fundamental');
});

test('acordes espalhados até a casa 24', () => {
  for (const type of ['maior', 'menor', '7', 'm7', 'maj7', 'm7b5']) {
    const pos = neckPositions(0, type, CHORD_TYPES[type].iv);
    assert.ok(pos.length >= 4, type);
    assert.ok(pos.every(v => v.maxF <= 24), type);
    assert.ok(pos.some(v => v.minF >= 12), type + ' sem forma acima da casa 12');
  }
});
