import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleNotes, harmonicField, noteName, noteAt } from '../music.js';

const names = (pcs, sharps = false) => pcs.map(n => noteName(n, sharps)).join(' ');

test('notas no braço (afinação padrão)', () => {
  assert.equal(noteAt(0, 1), 5);  // 6ª corda casa 1 = F
  assert.equal(noteAt(5, 0), 4);  // 1ª corda solta = E
  assert.equal(noteAt(1, 12), 9); // casa 12 repete a solta
});

test('escalas em C', () => {
  assert.equal(names(scaleNotes(0, 'Maior')), 'C D E F G A B');
  assert.equal(names(scaleNotes(0, 'Menor')), 'C D Eb F G Ab Bb');
  assert.equal(names(scaleNotes(0, 'Pentatônica Menor')), 'C Eb F G Bb');
  assert.equal(names(scaleNotes(0, 'Blues')), 'C Eb F Gb G Bb');
});

test('campos harmônicos batem com o app de referência', () => {
  const f = s => harmonicField(0, s, false).map(c => c.chord).join(' ');
  assert.equal(f('Maior'), 'C Dm Em F G Am B°');
  assert.equal(f('Menor'), 'Cm D° Eb Fm Gm Ab Bb');
  assert.equal(f('Menor Harmônica'), 'Cm D° Eb+ Fm G Ab B°');
  assert.equal(f('Maior Harmônica'), 'C D° Em Fm G Ab+ B°');
  assert.equal(f('Menor Melódica'), 'Cm Dm Eb+ F G A° B°');
  assert.equal(harmonicField(0, 'Pentatônica Maior', false), null);
});

import { spelledScale, spelledChord, scaleDegreeLabels } from '../music.js';

test('grafia correta: cada escala usa cada letra uma vez', () => {
  assert.equal(spelledScale(5, 'Maior', true).join(' '), 'F G A Bb C D E');
  assert.equal(spelledScale(2, 'Maior', false).join(' '), 'D E F# G A B C#');
  assert.equal(spelledScale(10, 'Maior', true).join(' '), 'Bb C D Eb F G A');      // A# maior vira Bb
  assert.equal(spelledScale(1, 'Menor', false).join(' '), 'C# D# E F# G# A B');    // Db menor vira C#
  assert.equal(spelledScale(6, 'Maior', true).join(' '), 'F# G# A# B C# D# E#');   // empate: segue o botão
  assert.equal(spelledScale(6, 'Maior', false).join(' '), 'Gb Ab Bb Cb Db Eb F');
  assert.equal(spelledScale(9, 'Menor Harmônica', true).join(' '), 'A B C D E F G#');
  assert.equal(spelledScale(8, 'Menor Harmônica', true).at(-1), 'F##');
  assert.equal(spelledScale(9, 'Pentatônica Menor', true).join(' '), 'A C D E G');
  assert.equal(spelledScale(9, 'Blues', true).join(' '), 'A C D Eb E G');
  assert.equal(spelledScale(10, 'Blues', false).join(' '), 'Bb Db Eb E F Ab'); // blue note E, não Fb
  assert.equal(spelledScale(5, 'Blues', false).join(' '), 'F Ab Bb B C Eb');
});

test('campo harmônico de F maior com Bb', () => {
  assert.equal(harmonicField(5, 'Maior', true).map(c => c.chord).join(' '), 'F Gm Am Bb C Dm E°');
});

test('notas dos acordes escritas certo', () => {
  assert.equal(spelledChord(10, [0, 4, 7], true).join(' '), 'Bb D F');
  assert.equal(spelledChord(11, [0, 3, 6], true).join(' '), 'B D F');
  assert.equal(spelledChord(0, [0, 4, 8], true).join(' '), 'C E G#');
  assert.equal(spelledChord(7, [0, 4, 7, 10], true).join(' '), 'G B D F');
  assert.equal(spelledChord(3, [0, 3, 7, 10], false).join(' '), 'Eb Gb Bb Db'); // empate: segue o botão
});

test('grau da blue note acompanha a grafia', () => {
  assert.equal(scaleDegreeLabels(10, 'Blues', false)[3], '#IV'); // Bb blues: E
  assert.equal(scaleDegreeLabels(0, 'Blues', false)[3], 'bV');   // C blues: Gb
});
