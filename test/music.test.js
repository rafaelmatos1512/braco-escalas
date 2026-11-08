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

test('modos: D dórica e G mixolídia usam as notas brancas; toda progressão tem estilo válido', async () => {
  const { spelledScale, PROGRESSIONS, PROG_STYLES, harmonicField, scaleDegreeLabels } = await import('../music.js');
  assert.deepEqual(spelledScale(2, 'Dórica', true), ['D', 'E', 'F', 'G', 'A', 'B', 'C']);
  assert.deepEqual(spelledScale(7, 'Mixolídia', true), ['G', 'A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(spelledScale(4, 'Frígia', true), ['E', 'F', 'G', 'A', 'B', 'C', 'D']);
  assert.equal(harmonicField(2, 'Dórica', true)[0].chord, 'Dm');
  assert.equal(scaleDegreeLabels(5, 'Lídia', true)[3], '#IV');
  const ok = new Set(PROG_STYLES.map(s => s[0]).filter(Boolean));
  for (const pr of [...PROGRESSIONS.maior, ...PROGRESSIONS.menor]) assert.ok(pr.tags?.length && pr.tags.every(t => ok.has(t)), pr.name);
});

test('botão Sustenidos: tônica em tecla preta segue o botão, sem ## nem bb', async () => {
  const { spelledScale, harmonicField } = await import('../music.js');
  assert.equal(spelledScale(1, 'Maior', true)[0], 'C#');
  assert.equal(spelledScale(1, 'Maior', false)[0], 'Db');
  assert.equal(spelledScale(10, 'Menor', true)[0], 'A#');
  assert.equal(spelledScale(10, 'Menor', false)[0], 'Bb');
  assert.equal(spelledScale(3, 'Maior', true)[0], 'Eb'); // D# maior precisaria de F## e C##
  assert.equal(harmonicField(1, 'Maior', true)[0].chord, 'C#');
  for (let r = 0; r < 12; r++) for (const s of [true, false]) assert.ok(!spelledScale(r, 'Maior', s).some(n => /##|bb/.test(n)), r + ' ' + s);
});

test('com tensão: I–V–vi–IV em C vira Cmaj7–G9–Am7–Fmaj7 e ii–V–I ganha nonas', async () => {
  const { PROGRESSIONS, progressionChords, tensionChords } = await import('../music.js');
  const pop = PROGRESSIONS.maior.find(x => x.name === 'I – V – vi – IV');
  assert.deepEqual(tensionChords(0, 'maior', progressionChords(0, 'maior', pop, true), true).map(c => c.name), ['Cmaj7', 'G9', 'Am7', 'Fmaj7']);
  const iiVI = PROGRESSIONS.maior.find(x => x.name === 'ii – V – I');
  assert.deepEqual(tensionChords(0, 'maior', progressionChords(0, 'maior', iiVI, true), true).map(c => c.name), ['Dm9', 'G9', 'Cmaj9']);
  const choro = PROGRESSIONS.maior.find(x => x.name.includes('#I°7'));
  assert.equal(tensionChords(0, 'maior', progressionChords(0, 'maior', choro, true), true)[1].name, 'C#°7');
});

test('títulos das progressões prontas em romano, com apelido só quando tem nome próprio', async () => {
  const { PROGRESSIONS, progRoman, progNick } = await import('../music.js');
  const f = n => PROGRESSIONS.maior.find(x => x.name === n) || PROGRESSIONS.menor.find(x => x.name === n);
  assert.equal(progRoman(f('ii – V – I')), 'ii7 – V7 – Imaj7');
  assert.equal(progNick(f('ii – V – I')), '');
  assert.equal(progNick(f('ii7 – V7(b9) – Imaj7')), '');
  assert.equal(progNick(f('I – V7 (baião)')), 'Baião');
  assert.equal(progNick(f('Cânone de Pachelbel')), 'Cânone de Pachelbel');
  for (const pr of [...PROGRESSIONS.maior, ...PROGRESSIONS.menor]) assert.ok(progRoman(pr).length, pr.name);
});

test('campo harmônico com sétima: C maior e A menor', async () => {
  const { harmonicField7 } = await import('../music.js');
  assert.deepEqual(harmonicField7(0, 'Maior', true).map(c => c.chord), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7(b5)']);
  assert.deepEqual(harmonicField7(0, 'Maior', true).map(c => c.roman), ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø']);
  assert.deepEqual(harmonicField7(9, 'Menor Harmônica', true).map(c => c.chord).slice(0, 2), ['Am(maj7)', 'Bm7(b5)']);
  assert.equal(harmonicField7(9, 'Menor Harmônica', true)[6].chord, 'G#°7');
});
