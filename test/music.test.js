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
