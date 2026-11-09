import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harmonicField, harmonicField7, degreeLabels, tensionChords, progressionChords, customChords, spelledChord, CHORD_TYPES, PROGRESSIONS } from '../music.js';
import { generateVoicings } from '../chords.js';

test('campo: diminuto com °, aumentado com +, graus com b/# como nas progressões', () => {
  assert.deepEqual(harmonicField(0, 'Maior', true).map(c => c.roman), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  assert.deepEqual(harmonicField(9, 'Menor', true).map(c => c.roman), ['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII']);
  assert.deepEqual(harmonicField(9, 'Menor Harmônica', true).map(c => c.roman), ['i', 'ii°', 'bIII+', 'iv', 'V', 'bVI', 'vii°']);
  assert.equal(harmonicField(0, 'Frígia', true)[1].roman, 'bII');
  assert.equal(harmonicField(0, 'Lídia', true)[3].roman, '#iv°');
  assert.equal(harmonicField(0, 'Mixolídia', true)[6].roman, 'bVII');
});

test('graus das escalas menores com b, como a Dórica', () => {
  assert.deepEqual(degreeLabels('Menor'), ['I', 'II', 'bIII', 'IV', 'V', 'bVI', 'bVII']);
  assert.deepEqual(degreeLabels('Menor Harmônica'), ['I', 'II', 'bIII', 'IV', 'V', 'bVI', 'VII']);
});

test('tétrades: o III aumentado ganha a sétima maior', () => {
  const f = harmonicField7(9, 'Menor Harmônica', true);
  assert.equal(f[2].chord, 'Cmaj7(#5)');
  assert.equal(f[2].roman, 'bIIImaj7(#5)');
  assert.equal(f[6].roman, 'vii°7');
});

test('6/9 tem quinta e gera a forma x-3-2-2-3-3', () => {
  assert.deepEqual(spelledChord(0, CHORD_TYPES['6/9'].iv, true), ['C', 'E', 'G', 'A', 'D']);
  assert.ok(generateVoicings(0, CHORD_TYPES['6/9'].iv).some(v => v.frets.join() === '-1,3,2,2,3,3'));
});

test('com tensão no tom menor não sai do tom: V vira 7(b9), VII vira 7', () => {
  const pr = PROGRESSIONS.menor.find(p => p.name.startsWith('i – VII – VI – V'));
  const ten = tensionChords(9, 'menor', progressionChords(9, 'menor', pr, true), true);
  assert.deepEqual(ten.map(c => c.name), ['Am7', 'G7', 'Fmaj7', 'E7(b9)']);
  assert.ok(ten.every(c => c.inField));
});

test('progressões prontas marcam acorde de fora do campo', () => {
  const pr = PROGRESSIONS.maior.find(p => p.name.startsWith('I – bVI'));
  assert.deepEqual(progressionChords(0, 'maior', pr, true).map(c => c.inField), [true, false, false, true]);
});

test('diminuto montado à mão sobe para o grau seguinte: C#°7 em C', () => {
  const [c] = customChords(0, 'maior', [{ o: 1, t: 'dim7' }], true);
  assert.equal(c.name, 'C#°7');
  assert.equal(c.roman, '#i°7');
});
