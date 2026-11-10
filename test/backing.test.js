import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
const { barEvents, bassMidi, beatSec, GROOVES, GROOVE_ORDER, GROOVE_OF, BEATS } = await import('../backing.js');
const { PROG_STYLES } = await import('../music.js');

const C = { frets: [-1, 3, 2, 0, 1, 0], rootPc: 0, iv: [0, 4, 7] }; // C aberto
const ALL = { drums: true, bass: true, comp: true };

test('rock: bumbo nos tempos 1 e 3, caixa nos 2 e 4, baixo na fundamental', () => {
  const ev = barEvents('rock', C);
  assert.deepEqual(ev.filter(e => e.drum === 'kick').map(e => e.t), [0, 2, 2.5]);
  assert.deepEqual(ev.filter(e => e.drum === 'snare').map(e => e.t), [1, 3]);
  assert.ok(ev.filter(e => e.kind === 'bass').every(e => e.midi === 48)); // C2
});

test('baixo: região grave, fundamental certa e intervalos do acorde', () => {
  assert.equal(bassMidi(9, [0, 4, 7], 'r'), 45); // A2
  assert.equal(bassMidi(4, [0, 3, 7], 'r'), 40); // E2
  assert.equal(bassMidi(0, [0, 4, 7], '5'), 48 + 7);
  assert.equal(bassMidi(0, [0, 3, 7], '3'), 48 + 3); // menor: terça menor
  assert.equal(bassMidi(0, [0, 3, 6], '5'), 48 + 6); // diminuto: quinta diminuta
  for (let pc = 0; pc < 12; pc++) { const m = bassMidi(pc, [0, 4, 7], 'r'); assert.ok(m >= 40 && m <= 51); }
});

test('blues em tercinas: 12 passos por compasso, caixa no 2º e 4º tempos', () => {
  const ev = barEvents('blues', { ...C, iv: [0, 4, 7, 10] });
  assert.deepEqual(ev.filter(e => e.drum === 'snare').map(e => e.t), [1, 3]);
  assert.deepEqual(ev.filter(e => e.kind === 'bass').map(e => e.midi - 48), [0, 4, 7, 9]); // 1 3 5 6
});

test('desligar bateria, baixo ou violão tira só aquele grupo', () => {
  const kinds = mix => new Set(barEvents('samba', C, mix).map(e => e.kind));
  assert.ok(!kinds({ drums: false, bass: true, comp: true }).has('drum'));
  assert.ok(!kinds({ drums: true, bass: false, comp: true }).has('bass'));
  const noComp = kinds({ drums: true, bass: true, comp: false });
  assert.ok(!noComp.has('strum') && !noComp.has('up') && !noComp.has('note'));
});

test('todos os ritmos: tempos dentro do compasso, passos dentro da grade, sons conhecidos', () => {
  const drums = new Set(['kick', 'snare', 'hat', 'ohat', 'rim', 'ride']);
  for (const id of GROOVE_ORDER) {
    const g = GROOVES[id];
    assert.ok(g.bpm >= 50 && g.bpm <= 160, id);
    for (const e of barEvents(id, { ...C, iv: [0, 4, 7, 10] })) {
      assert.ok(e.t >= 0 && e.t < BEATS, id + ' t=' + e.t);
      if (e.kind === 'drum') assert.ok(drums.has(e.drum) && e.vol > 0 && e.vol <= 1, id);
    }
    const steps = [...Object.values(g.drums).flat().map(s => [].concat(s)[0]), ...g.bass.map(b => b[0]), ...g.comp.map(c => c[0])];
    assert.ok(steps.every(s => Number.isInteger(s) && s >= 0 && s < g.grid), id);
  }
});

test('todo gênero da lista de progressões tem um ritmo', () => {
  for (const [k] of PROG_STYLES.filter(([k]) => k)) assert.ok(GROOVES[GROOVE_OF[k]], k);
});

test('acorde sem cordas ou andamento: sem erro e segundos por tempo', () => {
  assert.equal(barEvents('rock', { frets: [-1, -1, -1, -1, -1, -1], rootPc: 0, iv: [0, 4, 7] }).some(e => e.kind === 'strum'), false);
  assert.equal(beatSec(60), 1); assert.equal(beatSec(120), 0.5);
});
