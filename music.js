export const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
// Cordas da mais grave (6ª) para a mais aguda (1ª): E A D G B E
export const TUNING = [4, 9, 2, 7, 11, 4];

export const SCALES = {
  'Maior':           [2,2,1,2,2,2,1],
  'Menor':           [2,1,2,2,1,2,2],
  'Menor Harmônica': [2,1,2,2,1,3,1],
  'Maior Harmônica': [2,2,1,2,1,3,1],
  'Menor Melódica':  [2,1,2,2,2,2,1],
  'Pentatônica Maior': [2,2,3,2,3],
  'Pentatônica Menor': [3,2,2,3,2],
  'Blues':           [3,2,1,1,3,2],
};

export const noteName = (n, useSharps) => (useSharps ? SHARP : FLAT)[((n % 12) + 12) % 12];
export const noteAt = (string, fret) => (TUNING[string] + fret) % 12;

export function scaleNotes(root, name) {
  const notes = [root];
  SCALES[name].slice(0, -1).forEach(i => notes.push((notes[notes.length - 1] + i) % 12));
  return notes;
}

const LABELS = {
  'Pentatônica Maior': ['I','II','III','V','VI'],
  'Pentatônica Menor': ['I','bIII','IV','V','bVII'],
  'Blues': ['I','bIII','IV','bV','V','bVII'],
};
export const degreeLabels = name => LABELS[name] || ['I','II','III','IV','V','VI','VII'];

const ROMAN = ['I','II','III','IV','V','VI','VII'];

/* ---------- grafia correta (cada escala usa cada letra uma vez) ---------- */
const LETTERS = ['C','D','E','F','G','A','B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
// em que letra (contando a partir da tônica) cai cada nota da escala
const SCALE_LETTERS = {
  'Pentatônica Maior': [0, 1, 2, 4, 5],
  'Pentatônica Menor': [0, 2, 3, 4, 6],
  'Blues': [0, 2, 3, 4, 4, 6],
};
const scaleLetters = name => SCALE_LETTERS[name] || [0, 1, 2, 3, 4, 5, 6];
// intervalo do acorde (semitons) -> distância em letras: 3ª, 5ª, 7ª etc.
const INTERVAL_LETTER = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 4, 9: 5, 10: 6, 11: 6 };

// escreve a nota `pc` usando a letra `letterIdx` (0 = C ... 6 = B)
export function spellNote(pc, letterIdx) {
  const li = ((letterIdx % 7) + 7) % 7;
  const diff = ((pc - LETTER_PC[li] + 18) % 12) - 6;
  return LETTERS[li] + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
}
const accidentals = names => names.reduce((n, x) => n + x.length - 1, 0);

// testa a tônica escrita com # e com b e fica com a que dá menos acidentes; empate = preferência do usuário
function bestSpelling(rootPc, pcs, letterSteps, useSharps) {
  const build = rootName => {
    const li = LETTERS.indexOf(rootName[0]);
    return pcs.map((pc, i) => spellNote(pc, li + letterSteps[i]));
  };
  const a = build(SHARP[rootPc]), b = build(FLAT[rootPc]);
  if (SHARP[rootPc] === FLAT[rootPc]) return a;
  const da = accidentals(a), db = accidentals(b);
  return da < db ? a : db < da ? b : (useSharps ? a : b);
}

export function spelledScale(root, name, useSharps) {
  return bestSpelling(root, scaleNotes(root, name), scaleLetters(name), useSharps);
}

const chordLetters = (iv, letters) => letters || iv.map(i => INTERVAL_LETTER[i % 12]);
export function spelledChord(rootPc, iv, useSharps, letters) {
  return bestSpelling(rootPc, iv.map(i => (rootPc + i) % 12), chordLetters(iv, letters), useSharps);
}
// nome escrito -> nota (0-11)
export function pcOfName(name) {
  const acc = name.slice(1);
  return (LETTER_PC[LETTERS.indexOf(name[0])] + acc.split('#').length - acc.split('b').length + 12) % 12;
}
// notas de um acorde a partir de uma tônica já escrita (ex.: o IV de Gb maior é Cb)
export function spellChordFromRoot(rootName, iv, letters) {
  const li = LETTERS.indexOf(rootName[0]), rootPc = pcOfName(rootName), ls = chordLetters(iv, letters);
  return iv.map((i, k) => spellNote((rootPc + i) % 12, li + ls[k]));
}
// nome do grau `deg` da escala, com alteração `alt` em semitons (ex.: bVII)
export function spellDegree(key, scaleName, deg, alt, useSharps) {
  const sp = spelledScale(key, scaleName, useSharps);
  return spellNote((scaleNotes(key, scaleName)[deg] + alt + 12) % 12, LETTERS.indexOf(sp[deg][0]));
}

// mapa nota (0-11) -> nome escrito, para desenhar no braço
export const nameMap = (pcs, names) => new Map(pcs.map((pc, i) => [pc, names[i]]));

export function harmonicField(root, name, useSharps) {
  const n = scaleNotes(root, name);
  if (n.length !== 7) return null;
  const sp = spelledScale(root, name, useSharps);
  return n.map((r, i) => {
    const third = (n[(i + 2) % 7] - r + 12) % 12;
    const fifth = (n[(i + 4) % 7] - r + 12) % 12;
    let suffix = '', roman = ROMAN[i];
    if (third === 3 && fifth === 7) { suffix = 'm'; roman = roman.toLowerCase(); }
    else if (third === 3 && fifth === 6) { suffix = '°'; roman = roman.toLowerCase(); }
    else if (third === 4 && fifth === 8) { suffix = '+'; }
    const type = suffix === 'm' ? 'menor' : suffix === '°' ? 'dim' : suffix === '+' ? 'aug' : 'maior';
    return { chord: sp[i] + suffix, type, roman, notes: [r, n[(i + 2) % 7], n[(i + 4) % 7]] };
  });
}

const PT = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };
const ACC_PT = { '#': ' sustenido', '##': ' dobrado sustenido', 'b': ' bemol', 'bb': ' dobrado bemol' };
export const ptOf = name => PT[name[0]] + (ACC_PT[name.slice(1)] || '');
export const ptName = (pc, useSharps) => ptOf(noteName(pc, useSharps));

export const CHORD_TYPES = {
  maior: { label: 'Maior', suffix: '', iv: [0,4,7],
    desc: 'Acorde de 3 notas. Soa alegre e firme. É o acorde "sem sobrenome": escreve-se só a letra, como C ou G.' },
  menor: { label: 'Menor', suffix: 'm', iv: [0,3,7],
    desc: 'Acorde de 3 notas. Soa mais triste ou sério. Escreve-se com um "m" depois da letra, como Am.' },
  '7': { label: 'Com sétima (7)', suffix: '7', iv: [0,4,7,10],
    desc: 'Acorde maior com uma nota a mais. Soa "pedindo continuação": cria uma tensão que quer voltar ao acorde de repouso. Muito usado no blues e no samba.' },
  m7: { label: 'Menor com sétima (m7)', suffix: 'm7', iv: [0,3,7,10],
    desc: 'Acorde menor com uma nota a mais. Soa suave e melancólico, menos pesado que o menor simples.' },
  maj7: { label: 'Sétima maior (maj7)', suffix: 'maj7', iv: [0,4,7,11],
    desc: 'Acorde maior com uma nota a mais que dá um som elegante e sonhador. Muito usado na bossa nova e no jazz.' },
  dim: { label: 'Diminuto (°)', suffix: '°', iv: [0,3,6],
    desc: 'Acorde tenso e instável, que não quer ficar parado. Serve de passagem para outro acorde. É marcado com o sinal °.' },
  aug: { label: 'Aumentado (+)', suffix: '+', iv: [0,4,8],
    desc: 'Acorde estranho, "flutuante", que parece suspenso no ar. É marcado com o sinal +.' },
  sus2: { label: 'Suspenso 2 (sus2)', suffix: 'sus2', iv: [0,2,7], ivNames: ['1','2','5'],
    desc: 'Não é nem alegre nem triste, soa aberto e indefinido, porque falta a nota que decide se é maior ou menor.' },
  sus4: { label: 'Suspenso 4 (sus4)', suffix: 'sus4', iv: [0,5,7], ivNames: ['1','4','5'],
    desc: 'Parecido com o sus2, também aberto e indefinido. Muitas vezes volta para o acorde maior logo depois.' },
  '6': { label: 'Com sexta (6)', suffix: '6', iv: [0,4,7,9],
    desc: 'Acorde maior com uma nota a mais. Soa doce e estável. Comum no samba e na bossa nova.' },
  '9': { label: 'Com nona (9)', suffix: '9', iv: [0,4,7,10,2],
    desc: 'Acorde com 7 e uma nota extra. Soa rico e cheio de personalidade, comum no blues e no funk.' },
  m7b5: { label: 'Meio-diminuto (m7b5)', suffix: 'm7(b5)', iv: [0,3,6,10],
    desc: 'Também chamado de meio-diminuto (ø). Soa tenso e melancólico. Aparece no ii–V–i do tom menor, no jazz e na bossa nova.' },
  '5': { label: 'Power chord (5)', suffix: '5', iv: [0,7],
    desc: 'Só a nota base e a quinta. Não é maior nem menor, por isso soa forte e "neutro". É o acorde do rock e do metal, quase sempre com distorção.' },
  add9: { label: 'Com nona adicionada (add9)', suffix: 'add9', iv: [0,4,7,2],
    desc: 'Acorde maior com a nona, sem a sétima. Soa brilhante e aberto, muito usado no pop, no rock e no gospel.' },
  '7#9': { label: 'Sétima com nona aumentada (7#9)', suffix: '7(#9)', iv: [0,4,7,10,3], letters: [0,2,4,6,1], ivNames: ['1','3','5','b7','#9'],
    desc: 'O "acorde do Hendrix". Mistura o maior e o menor ao mesmo tempo, som sujo e marcante do blues-rock e do funk.' },
  '6/9': { label: 'Sexta com nona (6/9)', suffix: '6/9', iv: [0,4,9,2],
    desc: 'Acorde maior com a sexta e a nona. Soa suave e "final", muito usado para terminar músicas na bossa nova e no jazz.' },
};
const INTERVAL_NAME = { 0: '1', 1: 'b9', 2: '9', 3: 'b3', 4: '3', 5: '4', 6: 'b5', 7: '5', 8: '#5', 9: '6', 10: 'b7', 11: '7' };
export const intervalNames = t => t.ivNames || t.iv.map(i => INTERVAL_NAME[i % 12]);

export const SCALE_INFO = {
  'Maior': 'A escala mais conhecida, o "dó ré mi fá sol lá si". Soa alegre e clara. É a base de quase toda a música.',
  'Menor': 'Também chamada de menor natural. Soa mais triste ou séria. Usa as mesmas notas de uma escala maior, mas começando de outro ponto.',
  'Menor Harmônica': 'Igual à menor, mas com a sétima nota meio tom mais alta. Soa tensa e misteriosa, muito usada na música clássica e no flamenco. Sua marca é o salto de tom e meio perto do fim.',
  'Maior Harmônica': 'Igual à maior, mas com a sexta nota meio tom mais baixa. Mistura alegria com um toque dramático.',
  'Menor Melódica': 'Igual à menor, mas com a sexta e a sétima notas meio tom mais altas. Soa suave quando sobe. (Aqui é mostrada a forma subindo.)',
  'Pentatônica Maior': 'Só 5 notas ("penta" quer dizer cinco). Sem as notas que causam atrito, por isso é difícil errar. Muito usada em solos alegres, no country e no rock.',
  'Pentatônica Menor': 'Só 5 notas, a mais usada em solos de rock e blues. Fácil de tocar e soa bem sobre muitos acordes.',
  'Blues': 'É a pentatônica menor com uma nota extra (a "blue note"), que dá o tempero característico do blues.',
};
export const STEP_NAME = { 1: 'semitom', 2: 'tom', 3: 'tom e meio' };

/* ---------- progressões ---------- */
// cada acorde: [grau da escala (0 = I), alteração em semitons, tipo de acorde, nome do grau]
export const PROGRESSIONS = {
  maior: [
    { name: 'I – IV – V', desc: 'A mais básica de todas. Rock, sertanejo, forró, música de roda: com esses três acordes dá para tocar centenas de músicas.',
      chords: [[0, 0, 'maior', 'I'], [3, 0, 'maior', 'IV'], [4, 0, 'maior', 'V']] },
    { name: 'I – V – vi – IV', desc: 'A progressão do pop. Está em centenas de sucessos de pop, rock, gospel e sertanejo.',
      chords: [[0, 0, 'maior', 'I'], [4, 0, 'maior', 'V'], [5, 0, 'menor', 'vi'], [3, 0, 'maior', 'IV']] },
    { name: 'I – vi – IV – V', desc: 'Clássica dos anos 50 e da Jovem Guarda. Soa nostálgica e romântica.',
      chords: [[0, 0, 'maior', 'I'], [5, 0, 'menor', 'vi'], [3, 0, 'maior', 'IV'], [4, 0, 'maior', 'V']] },
    { name: 'vi – IV – I – V', desc: 'A mesma do pop, começando pelo acorde menor. Soa mais emotiva.',
      chords: [[5, 0, 'menor', 'vi'], [3, 0, 'maior', 'IV'], [0, 0, 'maior', 'I'], [4, 0, 'maior', 'V']] },
    { name: 'I – IV – I – V7', desc: 'Comum no forró, no sertanejo raiz e nas músicas de festa junina. O V7 prepara a volta para o I.',
      chords: [[0, 0, 'maior', 'I'], [3, 0, 'maior', 'IV'], [0, 0, 'maior', 'I'], [4, 0, '7', 'V7']] },
    { name: 'ii – V – I', desc: 'A base do jazz e da bossa nova. O V7 cria tensão e o I resolve. Usa acordes com sétima.',
      chords: [[1, 0, 'm7', 'ii7'], [4, 0, '7', 'V7'], [0, 0, 'maj7', 'Imaj7']] },
    { name: 'I – vi – ii – V', desc: 'A "volta" do samba, da bossa e do jazz, usada para retornar ao começo da música.',
      chords: [[0, 0, 'maj7', 'Imaj7'], [5, 0, 'm7', 'vi7'], [1, 0, 'm7', 'ii7'], [4, 0, '7', 'V7']] },
    { name: 'I – VI7 – ii – V7', desc: 'Clássica do samba e do choro. O VI7 (maior com sétima) "puxa" para o ii.',
      chords: [[0, 0, 'maior', 'I'], [5, 0, '7', 'VI7'], [1, 0, 'menor', 'ii'], [4, 0, '7', 'V7']] },
    { name: 'Blues de 12 compassos', desc: 'A base do blues e do rock antigo. São 12 compassos, um acorde por compasso, todos com sétima.',
      chords: [[0, 0, '7', 'I7'], [0, 0, '7', 'I7'], [0, 0, '7', 'I7'], [0, 0, '7', 'I7'], [3, 0, '7', 'IV7'], [3, 0, '7', 'IV7'],
        [0, 0, '7', 'I7'], [0, 0, '7', 'I7'], [4, 0, '7', 'V7'], [3, 0, '7', 'IV7'], [0, 0, '7', 'I7'], [4, 0, '7', 'V7']] },
  ],
  menor: [
    { name: 'i – iv – v', desc: 'A básica do tom menor. Soa triste e simples.',
      chords: [[0, 0, 'menor', 'i'], [3, 0, 'menor', 'iv'], [4, 0, 'menor', 'v']] },
    { name: 'i – iv – V7', desc: 'Com o V maior com sétima, a volta para o i fica mais forte. Comum no tango, no bolero, na MPB e no flamenco.',
      chords: [[0, 0, 'menor', 'i'], [3, 0, 'menor', 'iv'], [4, 0, '7', 'V7']] },
    { name: 'i – VI – III – VII', desc: 'Muito usada no rock e no pop em tom menor.',
      chords: [[0, 0, 'menor', 'i'], [5, 0, 'maior', 'VI'], [2, 0, 'maior', 'III'], [6, 0, 'maior', 'VII']] },
    { name: 'i – VII – VI – V', desc: 'Cadência andaluza: o som espanhol do flamenco.',
      chords: [[0, 0, 'menor', 'i'], [6, 0, 'maior', 'VII'], [5, 0, 'maior', 'VI'], [4, 0, 'maior', 'V']] },
    { name: 'i – VI – VII', desc: 'Soa épica. Comum no rock e em trilhas sonoras.',
      chords: [[0, 0, 'menor', 'i'], [5, 0, 'maior', 'VI'], [6, 0, 'maior', 'VII']] },
    { name: 'iiø – V7 – i', desc: 'O ii–V–i do tom menor, do jazz e da bossa. O primeiro acorde é o meio-diminuto.',
      chords: [[1, 0, 'm7b5', 'iiø'], [4, 0, '7', 'V7'], [0, 0, 'm7', 'i7']] },
  ],
};

// monta os acordes de uma progressão num tom
export function progressionChords(key, mode, prog, useSharps) {
  const scale = mode === 'maior' ? 'Maior' : 'Menor';
  const notes = scaleNotes(key, scale);
  return prog.chords.map(([deg, alt, type, roman]) => {
    const t = CHORD_TYPES[type], rootName = spellDegree(key, scale, deg, alt, useSharps);
    const rootPc = (notes[deg] + alt + 12) % 12;
    return { roman, type, rootPc, rootName, name: rootName + t.suffix,
      names: spellChordFromRoot(rootName, t.iv, t.letters), pcs: t.iv.map(i => (rootPc + i) % 12) };
  });
}
