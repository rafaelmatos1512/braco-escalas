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

export function harmonicField(root, name, useSharps) {
  const n = scaleNotes(root, name);
  if (n.length !== 7) return null;
  return n.map((r, i) => {
    const third = (n[(i + 2) % 7] - r + 12) % 12;
    const fifth = (n[(i + 4) % 7] - r + 12) % 12;
    let suffix = '', roman = ROMAN[i];
    if (third === 3 && fifth === 7) { suffix = 'm'; roman = roman.toLowerCase(); }
    else if (third === 3 && fifth === 6) { suffix = '°'; roman = roman.toLowerCase(); }
    else if (third === 4 && fifth === 8) { suffix = '+'; }
    const type = suffix === 'm' ? 'menor' : suffix === '°' ? 'dim' : suffix === '+' ? 'aug' : 'maior';
    return { chord: noteName(r, useSharps) + suffix, type, roman, notes: [r, n[(i + 2) % 7], n[(i + 4) % 7]] };
  });
}

const PT = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };
export function ptName(pc, useSharps) {
  const n = noteName(pc, useSharps);
  return PT[n[0]] + (n[1] === '#' ? ' sustenido' : n[1] === 'b' ? ' bemol' : '');
}

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
  sus2: { label: 'Suspenso 2 (sus2)', suffix: 'sus2', iv: [0,2,7],
    desc: 'Não é nem alegre nem triste, soa aberto e indefinido, porque falta a nota que decide se é maior ou menor.' },
  sus4: { label: 'Suspenso 4 (sus4)', suffix: 'sus4', iv: [0,5,7],
    desc: 'Parecido com o sus2, também aberto e indefinido. Muitas vezes volta para o acorde maior logo depois.' },
  '6': { label: 'Com sexta (6)', suffix: '6', iv: [0,4,7,9],
    desc: 'Acorde maior com uma nota a mais. Soa doce e estável. Comum no samba e na bossa nova.' },
  '9': { label: 'Com nona (9)', suffix: '9', iv: [0,4,7,10,2],
    desc: 'Acorde com 7 e uma nota extra. Soa rico e cheio de personalidade, comum no blues e no funk.' },
};

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
