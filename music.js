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
  'Dórica':          [2,1,2,2,2,1,2],
  'Frígia':          [1,2,2,2,1,2,2],
  'Lídia':           [2,2,2,1,2,2,1],
  'Mixolídia':       [2,2,1,2,2,1,2],
  'Lócria':          [1,2,2,1,2,2,2],
};

export const noteName = (n, useSharps) => (useSharps ? SHARP : FLAT)[((n % 12) + 12) % 12];
export const noteAt = (string, fret) => (TUNING[string] + fret) % 12;

export function scaleNotes(root, name) {
  const notes = [root];
  SCALES[name].slice(0, -1).forEach(i => notes.push((notes[notes.length - 1] + i) % 12));
  return notes;
}

const LABELS = {
  'Menor': ['I','II','bIII','IV','V','bVI','bVII'],
  'Menor Harmônica': ['I','II','bIII','IV','V','bVI','VII'],
  'Maior Harmônica': ['I','II','III','IV','V','bVI','VII'],
  'Menor Melódica': ['I','II','bIII','IV','V','VI','VII'],
  'Pentatônica Maior': ['I','II','III','V','VI'],
  'Pentatônica Menor': ['I','bIII','IV','V','bVII'],
  'Blues': ['I','bIII','IV','bV','V','bVII'],
  'Dórica': ['I','II','bIII','IV','V','VI','bVII'],
  'Frígia': ['I','bII','bIII','IV','V','bVI','bVII'],
  'Lídia': ['I','II','III','#IV','V','VI','VII'],
  'Mixolídia': ['I','II','III','IV','V','VI','bVII'],
  'Lócria': ['I','bII','bIII','IV','bV','bVI','bVII'],
};
export const degreeLabels = name => LABELS[name] || ['I','II','III','IV','V','VI','VII'];

const ROMAN = ['I','II','III','IV','V','VI','VII'];
const MAJOR_PC = [0, 2, 4, 5, 7, 9, 11];

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
  // tônica em tecla preta: vale o botão Sustenidos, desde que não precise de ## ou bb (aí fica a grafia com menos acidentes)
  const pref = useSharps ? a : b, dbl = x => x.some(n => /##|bb/.test(n));
  if (!dbl(pref)) return pref;
  const da = accidentals(a), db = accidentals(b);
  return da < db ? a : db < da ? b : pref;
}

export function spelledScale(root, name, useSharps) {
  const sp = bestSpelling(root, scaleNotes(root, name), scaleLetters(name), useSharps);
  if (name === 'Blues') {
    // a "blue note" pode ser escrita como b5 (Gb em C) ou #4 (F# em C): fica a que tiver menos acidentes (Bb blues usa E, não Fb)
    const alt = spellNote(scaleNotes(root, name)[3], LETTERS.indexOf(sp[0][0]) + 3);
    if (alt.length < sp[3].length) sp[3] = alt;
  }
  return sp;
}

const chordLetters = (iv, letters) => letters || iv.map(i => INTERVAL_LETTER[i % 12]);
// graus de uma escala já escrita (no blues, a blue note vira #IV quando é escrita como 4ª aumentada)
export function scaleDegreeLabels(root, name, useSharps) {
  const lb = degreeLabels(name).slice();
  if (name === 'Blues') {
    const sp = spelledScale(root, name, useSharps);
    if (sp[3][0] === sp[2][0]) lb[3] = '#IV';
  }
  return lb;
}

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
    // grau com b/# em relação à escala maior (bIII, #IV…), como nas progressões
    const acc = ((r - root - MAJOR_PC[i] + 18) % 12) - 6;
    let suffix = '', roman = (acc < 0 ? 'b' : acc > 0 ? '#' : '') + ROMAN[i];
    if (third === 3 && fifth === 7) { suffix = 'm'; roman = roman.toLowerCase(); }
    else if (third === 3 && fifth === 6) { suffix = '°'; roman = roman.toLowerCase() + '°'; }
    else if (third === 4 && fifth === 8) { suffix = '+'; roman += '+'; }
    const type = suffix === 'm' ? 'menor' : suffix === '°' ? 'dim' : suffix === '+' ? 'aug' : 'maior';
    return { chord: sp[i] + suffix, type, roman, notes: [r, n[(i + 2) % 7], n[(i + 4) % 7]] };
  });
}

// campo harmônico com sétima (tétrades): Imaj7, ii7, iii7, IVmaj7, V7, vi7, viiø na escala maior
const SEVENTH = { 'maior:11': ['maj7', 'maj7'], 'maior:10': ['7', '7'], 'menor:10': ['m7', '7'], 'menor:11': ['mmaj7', '(maj7)'],
  'dim:10': ['m7b5', 'ø'], 'dim:9': ['dim7', '°7'], 'aug:11': ['maj7#5', 'maj7(#5)'] };
export function harmonicField7(root, name, useSharps) {
  const f = harmonicField(root, name, useSharps);
  if (!f) return null;
  const n = scaleNotes(root, name);
  return f.map((c, i) => {
    const sev = (n[(i + 6) % 7] - n[i] + 12) % 12, hit = SEVENTH[c.type + ':' + sev];
    const rn = c.chord.replace(/[m°+]$/, '');
    if (!hit) return { ...c, rn };
    const [type, rs] = hit, t = CHORD_TYPES[type];
    return { chord: rn + t.suffix, rn, type, roman: c.roman.replace(/[°+]$/, '') + rs, notes: t.iv.map(x => (n[i] + x) % 12) };
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
  'maj7#5': { label: 'Sétima maior com quinta aumentada (maj7(#5))', suffix: 'maj7(#5)', iv: [0,4,8,11], ivNames: ['1','3','#5','7'],
    desc: 'Acorde aumentado com a sétima maior. Soa misterioso e brilhante. Nasce no 3º grau das escalas menor harmônica e menor melódica.' },
  m7b5: { label: 'Meio-diminuto (m7b5)', suffix: 'm7(b5)', iv: [0,3,6,10],
    desc: 'Também chamado de meio-diminuto (ø). Soa tenso e melancólico. Aparece no ii–V–i do tom menor, no jazz e na bossa nova.' },
  '5': { label: 'Power chord (5)', suffix: '5', iv: [0,7],
    desc: 'Só a nota base e a quinta. Não é maior nem menor, por isso soa forte e "neutro". É o acorde do rock e do metal, quase sempre com distorção.' },
  add9: { label: 'Com nona adicionada (add9)', suffix: 'add9', iv: [0,4,7,2],
    desc: 'Acorde maior com a nona, sem a sétima. Soa brilhante e aberto, muito usado no pop, no rock e no gospel.' },
  '7#9': { label: 'Sétima com nona aumentada (7#9)', suffix: '7(#9)', iv: [0,4,7,10,3], letters: [0,2,4,6,1], ivNames: ['1','3','5','b7','#9'],
    desc: 'O "acorde do Hendrix". Mistura o maior e o menor ao mesmo tempo, som sujo e marcante do blues-rock e do funk.' },
  m6: { label: 'Menor com sexta (m6)', suffix: 'm6', iv: [0,3,7,9],
    desc: 'Acorde menor com uma nota a mais. Soa misterioso e elegante, comum na bossa nova e no jazz.' },
  dim7: { label: 'Diminuto com sétima (°7)', suffix: '°7', iv: [0,3,6,9], letters: [0,2,4,6], ivNames: ['1','b3','b5','bb7'],
    desc: 'Diminuto com uma nota a mais. Muito tenso, ótimo para passar de um acorde a outro. Muito usado no choro e no samba.' },
  '7sus4': { label: 'Sétima com quarta (7sus4)', suffix: '7sus4', iv: [0,5,7,10], ivNames: ['1','4','5','b7'],
    desc: 'Parecido com o 7, mas troca a nota que define maior ou menor pela quarta. Soa em suspense e costuma voltar para o 7.' },
  m9: { label: 'Menor com nona (m9)', suffix: 'm9', iv: [0,3,7,10,2],
    desc: 'Menor com sétima e mais uma nota. Soa suave e sofisticado, comum no jazz, no soul e na bossa nova.' },
  maj9: { label: 'Sétima maior com nona (maj9)', suffix: 'maj9', iv: [0,4,7,11,2],
    desc: 'Sétima maior com mais uma nota. Soa aberto e sonhador, muito usado na bossa nova e no jazz.' },
  '13': { label: 'Com décima terceira (13)', suffix: '13', iv: [0,4,7,10,9], ivNames: ['1','3','5','b7','13'],
    desc: 'Acorde com 7 e uma nota bem aguda por cima. Soa rico e cheio de balanço, comum no blues, no samba e no jazz.' },
  '7b9': { label: 'Sétima com nona menor (7b9)', suffix: '7(b9)', iv: [0,4,7,10,1], letters: [0,2,4,6,1],
    desc: 'Acorde com 7 e uma nota bem tensa. Pede muito para resolver no acorde seguinte, comum no choro e no jazz.' },
  '6/9': { label: 'Sexta com nona (6/9)', suffix: '6/9', iv: [0,4,7,9,2],
    desc: 'Acorde maior com a sexta e a nona. Soa suave e "final", muito usado para terminar músicas na bossa nova e no jazz.' },
  mmaj7: { label: 'Menor com sétima maior (m(maj7))', suffix: 'm(maj7)', iv: [0,3,7,11],
    desc: 'Acorde menor com a sétima maior. Soa misterioso, de filme de suspense. Aparece na bossa nova e no tango, muitas vezes entre o menor e o m7.' },
  madd9: { label: 'Menor com nona adicionada (m(add9))', suffix: 'm(add9)', iv: [0,3,7,2],
    desc: 'Acorde menor com a nona, sem a sétima. Soa triste mas bonito e aberto, muito usado em baladas e no pop.' },
  m11: { label: 'Menor com décima primeira (m11)', suffix: 'm11', iv: [0,3,7,10,5], ivNames: ['1','b3','5','b7','11'],
    desc: 'Menor com sétima e uma quarta por cima. Soa aberto e moderno, comum no jazz, no soul e no funk.' },
  '9sus4': { label: 'Nona com quarta (9sus4)', suffix: '9sus4', iv: [0,5,7,10,2], ivNames: ['1','4','5','b7','9'],
    desc: 'Parecido com o 7sus4, com a nona por cima. Soa suspenso e macio, comum no gospel, no soul e no jazz.' },
  '7b5': { label: 'Sétima com quinta diminuta (7(b5))', suffix: '7(b5)', iv: [0,4,6,10],
    desc: 'Acorde com 7 e a quinta abaixada. Soa tenso e diferente, aparece no jazz e na bossa nova antes de voltar ao acorde de repouso.' },
  '7#5': { label: 'Sétima com quinta aumentada (7(#5))', suffix: '7(#5)', iv: [0,4,8,10], ivNames: ['1','3','#5','b7'],
    desc: 'Acorde com 7 e a quinta subida. Em cifras de outros países aparece como 7+, mas no Brasil "7+" quase sempre quer dizer sétima maior (7M). Soa tenso e "puxando" para o próximo acorde, comum no choro e no samba.' },
  '7b13': { label: 'Sétima com décima terceira menor (7(b13))', suffix: '7(b13)', iv: [0,4,7,10,8], letters: [0,2,4,6,5], ivNames: ['1','3','5','b7','b13'],
    desc: 'Acorde com 7 e uma nota tensa por cima. Muito usado antes de um acorde menor, no samba, no choro e na bossa nova.' },
  '7#11': { label: 'Sétima com décima primeira aumentada (7(#11))', suffix: '7(#11)', iv: [0,4,7,10,6], letters: [0,2,4,6,3], ivNames: ['1','3','5','b7','#11'],
    desc: 'Acorde com 7 e uma nota brilhante por cima. Soa moderno e colorido, comum na bossa nova e no jazz.' },
  'maj7#11': { label: 'Sétima maior com décima primeira aumentada (maj7(#11))', suffix: 'maj7(#11)', iv: [0,4,7,11,6], letters: [0,2,4,6,3], ivNames: ['1','3','5','7','#11'],
    desc: 'Sétima maior com uma nota brilhante por cima. Soa sonhador e moderno, muito usado na bossa nova e em trilhas.' },
};
// ordem de mostrar: dos mais comuns aos mais raros (o JavaScript põe chaves como '7' antes das outras no objeto)
export const CHORD_ORDER = ['maior', 'menor', '7', 'm7', 'maj7', '6', 'm6', '9', 'm9', 'maj9', '13', 'add9', 'madd9', '6/9', 'mmaj7', 'm11', 'sus2', 'sus4', '7sus4', '9sus4', 'dim', 'dim7', 'aug', 'maj7#5', 'm7b5', '7b5', '7#5', '7b9', '7#9', '7b13', '7#11', 'maj7#11', '5'];
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
  'Dórica': 'Menor, mas com a sexta nota mais alta. Soa menos triste. Muito usada no rock, no funk, no jazz e no baião.',
  'Frígia': 'Menor, com a segunda nota bem perto da primeira. Dá o som espanhol do flamenco.',
  'Lídia': 'Maior, com a quarta nota mais alta. Soa sonhadora, comum em trilhas de filme.',
  'Mixolídia': 'Maior, com a sétima nota mais baixa. É o som do baião, do forró e do rock clássico.',
  'Lócria': 'A mais tensa de todas, com a quinta nota mais baixa. Pouco usada sozinha; serve para entender o acorde meio-diminuto.',
};
export const STEP_NAME = { 1: 'semitom', 2: 'tom', 3: 'tom e meio' };

/* ---------- progressões ---------- */
// cada acorde: [grau da escala (0 = I), alteração em semitons, tipo de acorde, nome do grau]
export const PROGRESSIONS = {
  maior: [
    { name: 'I – IV – V', tags: ['pop', 'rock', 'sert', 'forro'], desc: 'A mais básica de todas. Rock, sertanejo, forró, música de roda: com esses três acordes dá para tocar centenas de músicas.',
      chords: [[0, 0, 'maior', 'I'], [3, 0, 'maior', 'IV'], [4, 0, 'maior', 'V']] },
    { name: 'I – V – vi – IV', tags: ['pop', 'rock', 'louvor', 'sert'], desc: 'A progressão do pop. Está em centenas de sucessos de pop, rock, gospel e sertanejo.',
      chords: [[0, 0, 'maior', 'I'], [4, 0, 'maior', 'V'], [5, 0, 'menor', 'vi'], [3, 0, 'maior', 'IV']] },
    { name: 'I – vi – IV – V', tags: ['pop', 'rom'], desc: 'Clássica dos anos 50 e da Jovem Guarda. Soa nostálgica e romântica.',
      chords: [[0, 0, 'maior', 'I'], [5, 0, 'menor', 'vi'], [3, 0, 'maior', 'IV'], [4, 0, 'maior', 'V']] },
    { name: 'vi – IV – I – V', tags: ['pop', 'louvor'], desc: 'A mesma do pop, começando pelo acorde menor. Soa mais emotiva.',
      chords: [[5, 0, 'menor', 'vi'], [3, 0, 'maior', 'IV'], [0, 0, 'maior', 'I'], [4, 0, 'maior', 'V']] },
    { name: 'I – IV – I – V7', tags: ['forro', 'sert'], desc: 'Comum no forró, no sertanejo raiz e nas músicas de festa junina. O V7 prepara a volta para o I.',
      chords: [[0, 0, 'maior', 'I'], [3, 0, 'maior', 'IV'], [0, 0, 'maior', 'I'], [4, 0, '7', 'V7']] },
    { name: 'ii – V – I', tags: ['jazz', 'bossa', 'samba'], desc: 'A base do jazz e da bossa nova. O V7 cria tensão e o I resolve. Usa acordes com sétima.',
      chords: [[1, 0, 'm7', 'ii7'], [4, 0, '7', 'V7'], [0, 0, 'maj7', 'Imaj7']] },
    { name: 'I – vi – ii – V', tags: ['samba', 'bossa', 'jazz'], desc: 'A "volta" do samba, da bossa e do jazz, usada para retornar ao começo da música.',
      chords: [[0, 0, 'maj7', 'Imaj7'], [5, 0, 'm7', 'vi7'], [1, 0, 'm7', 'ii7'], [4, 0, '7', 'V7']] },
    { name: 'I – VI7 – ii – V7', tags: ['samba'], desc: 'Clássica do samba e do choro. O VI7 (maior com sétima) "puxa" para o ii.',
      chords: [[0, 0, 'maior', 'I'], [5, 0, '7', 'VI7'], [1, 0, 'menor', 'ii'], [4, 0, '7', 'V7']] },
    { name: 'Blues de 12 compassos', tags: ['blues', 'rock'], desc: 'A base do blues e do rock antigo. São 12 compassos, um acorde por compasso, todos com sétima.',
      chords: [[0, 0, '7', 'I7'], [0, 0, '7', 'I7'], [0, 0, '7', 'I7'], [0, 0, '7', 'I7'], [3, 0, '7', 'IV7'], [3, 0, '7', 'IV7'],
        [0, 0, '7', 'I7'], [0, 0, '7', 'I7'], [4, 0, '7', 'V7'], [3, 0, '7', 'IV7'], [0, 0, '7', 'I7'], [4, 0, '7', 'V7']] },
    { name: 'I – IV – V7 – I', tags: ['sert', 'forro'], desc: 'A volta completa: sai do I, passa pelo IV e pelo V7 e volta para casa. Base de moda de viola, xote e música caipira.',
      chords: [[0, 0, 'maior', 'I'], [3, 0, 'maior', 'IV'], [4, 0, '7', 'V7'], [0, 0, 'maior', 'I']] },
    { name: 'I – bVI – bVII – I', tags: ['rock'], desc: 'Som épico do rock e do metal. Os dois acordes do meio vêm "emprestados" do tom menor.',
      chords: [[0, 0, 'maior', 'I'], [5, -1, 'maior', 'bVI'], [6, -1, 'maior', 'bVII'], [0, 0, 'maior', 'I']] },
    { name: 'ii7 – V7(b9) – Imaj7', tags: ['bossa', 'jazz', 'samba'], desc: 'O ii–V–I com tempero de bossa: o V7(b9) deixa a volta para o I mais tensa e bonita.',
      chords: [[1, 0, 'm7', 'ii7'], [4, 0, '7b9', 'V7(b9)'], [0, 0, 'maj7', 'Imaj7']] },
    { name: 'I – IV – vi – V', tags: ['louvor', 'pop'], desc: 'Variação do pop, muito usada em louvor e baladas.',
      chords: [[0, 0, 'maior', 'I'], [3, 0, 'maior', 'IV'], [5, 0, 'menor', 'vi'], [4, 0, 'maior', 'V']] },
    { name: 'IV – I – V – vi', tags: ['louvor', 'pop'], desc: 'Começa no IV e soa aberta, de "subida". Comum no louvor e no pop.',
      chords: [[3, 0, 'maior', 'IV'], [0, 0, 'maior', 'I'], [4, 0, 'maior', 'V'], [5, 0, 'menor', 'vi']] },
    { name: 'I – V – IV', tags: ['rock'], desc: 'Rock direto, de três acordes. Soa forte e animada.',
      chords: [[0, 0, 'maior', 'I'], [4, 0, 'maior', 'V'], [3, 0, 'maior', 'IV']] },
    { name: 'I – bVII – IV', tags: ['rock'], desc: 'Som do rock clássico. O bVII é um acorde maior um tom abaixo do I.',
      chords: [[0, 0, 'maior', 'I'], [6, -1, 'maior', 'bVII'], [3, 0, 'maior', 'IV']] },
    { name: 'I – iii – IV – V', tags: ['rom', 'pop'], desc: 'Romântica e suave, comum em baladas e na Jovem Guarda.',
      chords: [[0, 0, 'maior', 'I'], [2, 0, 'menor', 'iii'], [3, 0, 'maior', 'IV'], [4, 0, 'maior', 'V']] },
    { name: 'Cânone de Pachelbel', tags: ['pop', 'rom', 'louvor'], desc: 'Oito acordes de uma música clássica famosa, tocada em casamentos e copiada por muitas músicas pop.',
      chords: [[0, 0, 'maior', 'I'], [4, 0, 'maior', 'V'], [5, 0, 'menor', 'vi'], [2, 0, 'menor', 'iii'], [3, 0, 'maior', 'IV'], [0, 0, 'maior', 'I'], [3, 0, 'maior', 'IV'], [4, 0, 'maior', 'V']] },
    { name: 'I – IV – iv – I', tags: ['rom'], desc: 'O IV vira menor antes de voltar ao I. Dá um toque saudoso, muito usado em seresta e MPB.',
      chords: [[0, 0, 'maior', 'I'], [3, 0, 'maior', 'IV'], [3, 0, 'menor', 'iv'], [0, 0, 'maior', 'I']] },
    { name: 'I – I7 – IV – iv', tags: ['rom', 'samba'], desc: 'O I7 empurra para o IV, e o iv menor dá a saudade. Clássica de seresta e samba-canção.',
      chords: [[0, 0, 'maior', 'I'], [0, 0, '7', 'I7'], [3, 0, 'maior', 'IV'], [3, 0, 'menor', 'iv']] },
    { name: 'I – #I°7 – ii – V7', tags: ['samba'], desc: 'Do choro e do samba. O diminuto (#I°7) é uma ponte entre o I e o ii.',
      chords: [[0, 0, 'maior', 'I'], [0, 1, 'dim7', '#I°7'], [1, 0, 'menor', 'ii'], [4, 0, '7', 'V7']] },
    { name: 'Imaj7 – IVmaj7', tags: ['bossa'], desc: 'Dois acordes com sétima maior, indo e voltando. Som calmo de bossa nova.',
      chords: [[0, 0, 'maj7', 'Imaj7'], [3, 0, 'maj7', 'IVmaj7']] },
    { name: 'iii – vi – ii – V – I', tags: ['jazz', 'samba', 'bossa'], desc: 'Ciclo de quintas: cada acorde puxa o seguinte até chegar no I. Muito usado no jazz, no samba e no choro.',
      chords: [[2, 0, 'm7', 'iii7'], [5, 0, 'm7', 'vi7'], [1, 0, 'm7', 'ii7'], [4, 0, '7', 'V7'], [0, 0, 'maj7', 'Imaj7']] },
    { name: 'I – V7 (baião)', tags: ['forro', 'sert'], desc: 'Só dois acordes, para começar. Baião, forró, marchinha e cantiga de roda.',
      chords: [[0, 0, 'maior', 'I'], [4, 0, '7', 'V7']] },
    { name: 'Blues de 8 compassos', tags: ['blues'], desc: 'Blues mais curto, de 8 compassos. Bom para começar a tocar blues.',
      chords: [[0, 0, '7', 'I7'], [4, 0, '7', 'V7'], [3, 0, '7', 'IV7'], [3, 0, '7', 'IV7'], [0, 0, '7', 'I7'], [4, 0, '7', 'V7'], [0, 0, '7', 'I7'], [4, 0, '7', 'V7']] },
  ],
  menor: [
    { name: 'i – iv – v', tags: ['pop', 'rom'], desc: 'A básica do tom menor. Soa triste e simples.',
      chords: [[0, 0, 'menor', 'i'], [3, 0, 'menor', 'iv'], [4, 0, 'menor', 'v']] },
    { name: 'i – iv – V7', tags: ['latina', 'rom'], desc: 'Com o V maior com sétima, a volta para o i fica mais forte. Comum no tango, no bolero, na MPB e no flamenco.',
      chords: [[0, 0, 'menor', 'i'], [3, 0, 'menor', 'iv'], [4, 0, '7', 'V7']] },
    { name: 'i – VI – III – VII', tags: ['pop', 'rock'], desc: 'Muito usada no rock e no pop em tom menor.',
      chords: [[0, 0, 'menor', 'i'], [5, 0, 'maior', 'VI'], [2, 0, 'maior', 'III'], [6, 0, 'maior', 'VII']] },
    { name: 'i – VII – VI – V', tags: ['latina', 'rock'], desc: 'Cadência andaluza: o som espanhol do flamenco.',
      chords: [[0, 0, 'menor', 'i'], [6, 0, 'maior', 'VII'], [5, 0, 'maior', 'VI'], [4, 0, 'maior', 'V']] },
    { name: 'i – VI – VII', tags: ['rock', 'pop'], desc: 'Soa épica. Comum no rock e em trilhas sonoras.',
      chords: [[0, 0, 'menor', 'i'], [5, 0, 'maior', 'VI'], [6, 0, 'maior', 'VII']] },
    { name: 'iiø – V7 – i', tags: ['jazz', 'bossa'], desc: 'O ii–V–i do tom menor, do jazz e da bossa. O primeiro acorde é o meio-diminuto.',
      chords: [[1, 0, 'm7b5', 'iiø'], [4, 0, '7', 'V7'], [0, 0, 'm7', 'i7']] },
    { name: 'i – iv – VII – III', tags: ['rom', 'latina'], desc: 'Ciclo de quintas no tom menor. Soa triste e elegante, comum em boleros e baladas.',
      chords: [[0, 0, 'menor', 'i'], [3, 0, 'menor', 'iv'], [6, 0, 'maior', 'VII'], [2, 0, 'maior', 'III']] },
    { name: 'i – VII – VI – VII', tags: ['rock'], desc: 'Rock em tom menor, com cara de aventura.',
      chords: [[0, 0, 'menor', 'i'], [6, 0, 'maior', 'VII'], [5, 0, 'maior', 'VI'], [6, 0, 'maior', 'VII']] },
    { name: 'i – VI – iv – V7', tags: ['latina', 'rom'], desc: 'Dramática, de bolero e tango. O V7 traz de volta para o i.',
      chords: [[0, 0, 'menor', 'i'], [5, 0, 'maior', 'VI'], [3, 0, 'menor', 'iv'], [4, 0, '7', 'V7']] },
    { name: 'i – iv – i – V7', tags: ['forro', 'sert', 'rom'], desc: 'Simples e triste. Comum em valsa, toada e música nordestina.',
      chords: [[0, 0, 'menor', 'i'], [3, 0, 'menor', 'iv'], [0, 0, 'menor', 'i'], [4, 0, '7', 'V7']] },
    { name: 'i – v – VI – III', tags: ['pop'], desc: 'Suave e melancólica, usada no pop e em trilhas.',
      chords: [[0, 0, 'menor', 'i'], [4, 0, 'menor', 'v'], [5, 0, 'maior', 'VI'], [2, 0, 'maior', 'III']] },
    { name: 'Blues menor', tags: ['blues'], desc: 'O blues de 12 compassos em tom menor. Soa mais escuro e triste.',
      chords: [[0, 0, 'm7', 'i7'], [0, 0, 'm7', 'i7'], [0, 0, 'm7', 'i7'], [0, 0, 'm7', 'i7'], [3, 0, 'm7', 'iv7'], [3, 0, 'm7', 'iv7'],
        [0, 0, 'm7', 'i7'], [0, 0, 'm7', 'i7'], [5, 0, '7', 'VI7'], [4, 0, '7', 'V7'], [0, 0, 'm7', 'i7'], [4, 0, '7', 'V7']] },
    { name: 'i – bII – i (flamenco)', tags: ['latina'], desc: 'O acorde maior meio tom acima dá o som espanhol do flamenco e da música cigana.',
      chords: [[0, 0, 'menor', 'i'], [1, -1, 'maior', 'bII'], [0, 0, 'menor', 'i']] },
    { name: 'i – V7 (tango)', tags: ['latina', 'rom'], desc: 'Só dois acordes, indo e voltando. Base de tango, valsa e bolero em tom menor.',
      chords: [[0, 0, 'menor', 'i'], [4, 0, '7', 'V7'], [0, 0, 'menor', 'i'], [4, 0, '7', 'V7']] },
  ],
};

// título padrão de uma progressão pronta: os graus em romano, como estão nos acordes (ii7 – V7 – Imaj7)
export const progRoman = pr => pr.chords.map(c => c[3]).join(pr.chords.length > 6 ? ' · ' : ' – ');
// apelido, quando o nome não é só graus: "Blues de 12 compassos", "Cânone de Pachelbel", "baião"…
const ROMAN_TOKEN = /^[b#]?(i|ii|iii|iv|v|vi|vii)(°|ø|maj|m|\d|\(|\)|#|b)*\d*(\(.*\))?$/i;
export function progNick(pr) {
  const par = pr.name.match(/\(([^)]*[a-zà-ú]{3,}[^)]*)\)/i);
  if (par && !/^(b9|#9|maj7|b5|#5|b13|#11|add9)$/.test(par[1])) return par[1][0].toUpperCase() + par[1].slice(1);
  return pr.name.split(/[\s–]+/).filter(Boolean).every(t => ROMAN_TOKEN.test(t)) ? '' : pr.name;
}

export const PROG_STYLES = [['', 'Todas'], ['pop', 'Pop'], ['rock', 'Rock'], ['louvor', 'Louvor'], ['sert', 'Sertanejo'], ['forro', 'Forró e baião'],
  ['samba', 'Samba e choro'], ['bossa', 'Bossa nova'], ['rom', 'Romântica e seresta'], ['latina', 'Tango, bolero e flamenco'], ['jazz', 'Jazz'], ['blues', 'Blues']];

// monta os acordes de uma progressão num tom
export function progressionChords(key, mode, prog, useSharps) {
  const scale = mode === 'maior' ? 'Maior' : 'Menor';
  const notes = scaleNotes(key, scale), inKey = keyNotes(key, mode);
  return prog.chords.map(([deg, alt, type, roman]) => {
    const t = CHORD_TYPES[type], rootName = spellDegree(key, scale, deg, alt, useSharps);
    const rootPc = (notes[deg] + alt + 12) % 12;
    return { roman, type, rootPc, rootName, name: rootName + t.suffix, da: [deg, alt],
      names: spellChordFromRoot(rootName, t.iv, t.letters), pcs: t.iv.map(i => (rootPc + i) % 12), inField: t.iv.every(i => inKey.has((rootPc + i) % 12)) };
  });
}

// ---------- progressões criadas pelo usuário ----------
// cada acorde é guardado pela distância até o tom (o: 0-11 semitons) e o tipo; trocar o tom transpõe tudo
// grau e acidente de cada distância, em relação à escala do tom (tom menor = escala menor natural)
const DEG_OF = {
  maior: [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]],
  menor: [[0, 0], [1, -1], [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [5, 0], [5, 1], [6, 0], [6, 1]],
};
const LOWER = new Set(['menor', 'm7', 'dim', 'm7b5', 'm6', 'm9', 'dim7', 'mmaj7', 'madd9', 'm11']);
const ROMAN_SUF = { menor: '', m7: '7', m7b5: 'ø', dim: '°', dim7: '°7', m6: '6', m9: '9', mmaj7: '(maj7)', madd9: '(add9)', m11: '11', maior: '', '5': '5' };
// converte acordes de uma progressão pronta em itens editáveis (distância até o tom + tipo)
// se o grau escrito for diferente do comum (ex.: #I°7 em vez de bII), guarda o grau em "d"
export const itemsFromChords = (key, chords, mode = 'maior') => chords.map(c => {
  const o = (c.rootPc - key + 12) % 12, it = { o, t: c.type }, def = DEG_OF[mode][o];
  if (c.da && (c.da[0] !== def[0] || c.da[1] !== def[1])) it.d = c.da;
  return it;
});

// notas do tom: no menor vale também a sensível (7ª subida, da menor harmônica), que faz o V7 e o vii°7
export const keyNotes = (key, mode) => new Set([...scaleNotes(key, mode === 'maior' ? 'Maior' : 'Menor'), ...(mode === 'menor' ? [(key + 11) % 12] : [])]);
// diminutos de passagem sobem para o grau seguinte: C#°7 (#I°7) em C, e não Db°7
const DIM_UP = { 1: [0, 1], 3: [1, 1], 8: [4, 1] };
export function customChords(key, mode, items, useSharps) {
  const scale = mode === 'maior' ? 'Maior' : 'Menor', inKey = keyNotes(key, mode);
  const sn = scaleNotes(key, scale);
  return items.map(({ o, t: type, d }) => {
    const okD = d && (sn[d[0]] + d[1] - key + 24) % 12 === o; // o grau guardado só vale se cair na mesma nota
    const t = CHORD_TYPES[type], [deg, alt] = okD ? d : mode === 'maior' && (type === 'dim' || type === 'dim7') && DIM_UP[o] ? DIM_UP[o] : DEG_OF[mode][o];
    const rootName = spellDegree(key, scale, deg, alt, useSharps), rootPc = (key + o) % 12;
    const pcs = t.iv.map(i => (rootPc + i) % 12);
    const num = LOWER.has(type) ? ROMAN[deg].toLowerCase() : ROMAN[deg];
    const roman = (alt < 0 ? 'b' : alt > 0 ? '#' : '') + num + (type in ROMAN_SUF ? ROMAN_SUF[type] : t.suffix);
    return { roman, type, rootPc, rootName, name: rootName + t.suffix, o, da: [deg, alt],
      names: spellChordFromRoot(rootName, t.iv, t.letters), pcs, inField: pcs.every(p => inKey.has(p)) };
  });
}

// "com tensão": troca cada acorde por uma versão mais rica, como no jazz e na bossa
// o V (5º grau, 7 semitons acima do tom) é dominante: vira 9; os outros maiores viram maj7
const TENSION = { menor: 'm7', '7': '9', m7: 'm9', maj7: 'maj9', dim: 'm7b5', sus4: '7sus4', '6': '6/9' };
export function tensionType(type, o, mode = 'maior') {
  if (mode === 'menor') {
    // tom menor: o V pede a nona menor (b9, da menor harmônica); o VII (subtônica) tem sétima menor
    if (o === 7 && (type === 'maior' || type === '5' || type === '7')) return '7b9';
    if (o === 10 && (type === 'maior' || type === '5')) return '7';
  }
  if (type === 'maior' || type === '5') return o === 7 ? '9' : 'maj7';
  return TENSION[type] || type;
}
export function tensionChords(key, mode, chords, useSharps) {
  return chords.map(c => {
    const o = (c.rootPc - key + 12) % 12, t = tensionType(c.type, o, mode);
    if (t === c.type) return c;
    const n = customChords(key, mode, [{ o, t, d: c.da }], useSharps)[0];
    return { ...n, inField: c.inField !== false && n.inField }; // de fora se o original era de fora ou se a nota a mais sai do tom
  });
}
