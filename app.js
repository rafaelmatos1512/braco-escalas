import { CHORD_ORDER, SHARP, FLAT, SCALES, CHORD_TYPES, SCALE_INFO, STEP_NAME, noteName, noteAt, ptOf, spelledScale, spelledChord, nameMap, intervalNames, scaleDegreeLabels, spellChordFromRoot, harmonicField7, PROGRESSIONS, PROG_STYLES, progRoman, progNick, progressionChords, tensionChords, customChords, itemsFromChords,
  scaleNotes, harmonicField } from './music.js';
import { midiAt, playNote, strum, sequence, schedule, stopAll, soundOn, setSound } from './audio.js';
import { STRINGS as TSTR, nearestString, centsToString, tuneStatus, startMic, stopMic, micOn } from './tuner.js';
import { createPlayer, GROOVES, GROOVE_ORDER, GROOVE_OF } from './backing.js';
import * as api from './api.js';
import { shapeOf, generateVoicings, filterVoicings, cagedShapes, hasCaged, neckPositions, allPositions, findVoicing, powerChords, stringSetTriads } from './chords.js';

const $ = id => document.getElementById(id);
const state = {
  tab: 'escalas', fsel: null, hide: false, revealed: new Set(), revealKey: '', root: 5, scale: 'Maior', frets: 12, sharps: true, all: false, sel: null,
  frets2: 24, croot: 0, ctype: 'maior', cvoice: null,
  cf: { region: 'all', open: 'any', barre: 'any', bass: 'root', min: 4 },
  g: { root: 4, kind: 'pow', tri: 'maior', set: '5,4,3', ext: '7', pos: null, labels: 'notes' },
  p: { key: 0, mode: 'maior', idx: 0, step: 0, pos: null, labels: 'notes', playing: false, src: 'ready', mine: 0, ed: null, style: '' },
};
let tabJump = false; // trocar de tela sempre começa do topo (a proteção de rolagem não segura)
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) {
    const v = attrs[k];
    // cores do tema (var(--x)) precisam ir no style; atributo SVG não entende var()
    if ((k === 'fill' || k === 'stroke') && typeof v === 'string' && v.startsWith('var(')) e.style[k] = v;
    else e.setAttribute(k, v);
  }
  parent.appendChild(e); return e;
};
const nn = n => noteName(n, state.sharps);
const dual = (pc, suf = '') => SHARP[pc] === FLAT[pc] ? SHARP[pc] + suf : `${SHARP[pc]}${suf} / ${FLAT[pc]}${suf}`;
const STRING_NAMES = ['6ª corda (a mais grossa)', '5ª corda', '4ª corda', '3ª corda', '2ª corda', '1ª corda (a mais fina)'];
const ORD = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª'];

/* ---------- braço (linhas empilhadas) ---------- */
function drawRow(host, from, to, o) {
  const FW = 64, SG = 40, LEFT = 48, TOP = 24, n = to - from + 1;
  const W = LEFT + n * FW + 12, H = TOP + 5 * SG + 40;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Braço' }, host);
  svg.style.maxWidth = (W * 1.25) + 'px';
  el('rect', { x: LEFT, y: TOP, width: n * FW, height: 5 * SG, fill: 'var(--wood)' }, svg);
  for (let i = 0; i <= n; i++) {
    const nut = from === 1 && i === 0;
    el('line', { x1: LEFT + i * FW, x2: LEFT + i * FW, y1: TOP, y2: TOP + 5 * SG,
      stroke: nut ? 'var(--nut)' : 'var(--fret)', 'stroke-width': nut ? 5 : 2 }, svg);
  }
  const dots = [3, 5, 7, 9, 15, 17, 19, 21];
  for (let f = from; f <= to; f++) {
    const cx = LEFT + (f - from + 0.5) * FW, cy = TOP + 2.5 * SG;
    if (dots.includes(f)) el('circle', { cx, cy, r: 6, fill: 'var(--inlay)', opacity: .5 }, svg);
    if (f === 12 || f === 24) [-1, 1].forEach(d => el('circle', { cx, cy: cy + d * SG, r: 6, fill: 'var(--inlay)', opacity: .5 }, svg));
    el('text', { x: cx, y: H - 12, 'text-anchor': 'middle', fill: 'var(--mut)', 'font-size': 14 }, svg).textContent = f;
  }
  for (let row = 0; row < 6; row++) {
    const s = 5 - row, y = TOP + row * SG;
    el('line', { x1: from === 1 ? LEFT - 30 : LEFT, x2: LEFT + n * FW, y1: y, y2: y, stroke: 'var(--string)', 'stroke-width': 1 + (5 - s) * 0.4 }, svg);
    if (o.exact && from === 1 && o.exact[s] < 0)
      el('text', { x: LEFT - 28, y: y + 6, 'text-anchor': 'middle', fill: 'var(--mute-x)', 'font-size': 20, 'font-weight': 700 }, svg).textContent = '×';
    for (let f = from === 1 ? 0 : from; f <= to; f++) {
      const nt = noteAt(s, f);
      let on, hi = false, fill, op = 1;
      if (o.exact) {
        if (o.exact[s] !== f) continue;
        on = true; fill = nt === o.rootPc ? '#f59e0b' : '#4ade80';
      } else {
        on = o.inScale.has(nt);
        hi = o.hl ? o.hl.includes(nt) : false;
        if (!on && !hi && !o.all) continue;
        const isRoot = nt === o.rootPc && (!o.hl || hi);
        fill = isRoot ? '#f59e0b' : hi ? '#4ade80' : on ? '#38bdf8' : 'var(--off)';
        op = o.hl && !hi ? .25 : on ? 1 : .8;
      }
      const cx = f === 0 ? LEFT - 28 : LEFT + (f - from + 0.5) * FW;
      const m = midiAt(s, f), sf = s + ',' + f;
      el('circle', { cx, cy: y, r: 15, fill, opacity: op, class: 'nt', 'data-m': m, 'data-sf': sf }, svg);
      el('text', { x: cx, y: y + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'nt', 'data-m': m, 'data-sf': sf,
        fill: on ? '#0f172a' : 'var(--mut)' }, svg).textContent = o.hide && !o.revealed.has(sf) ? '' : (o.names && o.names.get(nt)) || nn(nt);
    }
  }
}
const perRowFor = (w, frets = 24) => (w >= 1400 && frets > 12 ? 24 : w >= 760 ? 12 : 6);
function drawBoard(host, frets, o) {
  host.innerHTML = '';
  host.onclick = e => {
    const m = e.target.getAttribute && e.target.getAttribute('data-m');
    if (!m) return;
    playNote(+m);
    if (o.onReveal) o.onReveal(e.target.getAttribute('data-sf'));
  };
  const perRow = o.oneRow ? frets : perRowFor(host.clientWidth, frets); // oneRow: braço inteiro numa linha só (menor)
  for (let from = 1; from <= frets; from += perRow)
    drawRow(host, from, Math.min(from + perRow - 1, frets), o);
}

/* ---------- diagrama de acorde ---------- */
function chordSvg(v, rootPc, names) {
  const X0 = 40, DX = 18, TOP = 34, DY = 24, W = 150, H = 176;
  const wrap = document.createElement('div');
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, wrap);
  const base = v.maxF <= 4 ? 1 : v.minF;
  for (let r = 0; r <= 5; r++)
    el('line', { x1: X0, x2: X0 + 5 * DX, y1: TOP + r * DY, y2: TOP + r * DY,
      stroke: r === 0 && base === 1 ? 'var(--nut)' : 'var(--grid)', 'stroke-width': r === 0 && base === 1 ? 5 : 1.5 }, svg);
  for (let s = 0; s < 6; s++)
    el('line', { x1: X0 + s * DX, x2: X0 + s * DX, y1: TOP, y2: TOP + 5 * DY, stroke: 'var(--string)', 'stroke-width': 1 + (5 - s) * 0.25 }, svg);
  if (base > 1) el('text', { x: 4, y: TOP + DY * 0.65, fill: 'var(--fg)', 'font-size': 14, 'font-weight': 700 }, svg).textContent = base + 'ª';
  v.frets.forEach((f, s) => {
    const x = X0 + s * DX;
    if (f < 0) el('text', { x, y: 24, 'text-anchor': 'middle', fill: 'var(--mute-x)', 'font-size': 16, 'font-weight': 700 }, svg).textContent = '×';
    else if (f === 0) el('circle', { cx: x, cy: 19, r: 5, fill: 'none', stroke: 'var(--fg)', 'stroke-width': 1.8 }, svg);
  });
  if (v.barre) {
    const row = v.minF - base;
    const y = TOP + row * DY + DY / 2;
    el('rect', { x: X0 + v.barreFrom * DX - 8, y: y - 8, width: (v.barreTo - v.barreFrom) * DX + 16, height: 16, rx: 8, fill: '#38bdf8' }, svg);
  }
  v.frets.forEach((f, s) => {
    if (f <= 0) return;
    const nt = noteAt(s, f), isRoot = nt === rootPc;
    const cx = X0 + s * DX, cy = TOP + (f - base) * DY + DY / 2;
    el('circle', { cx, cy, r: 8.5, fill: isRoot ? '#f59e0b' : '#38bdf8' }, svg);
    el('text', { x: cx, y: cy + 3.5, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 700, fill: '#0f172a' }, svg).textContent = (names && names.get(nt)) || nn(nt);
  });
  return wrap.innerHTML;
}

/* ---------- cartões de formas (Guitarra / Progressões) ---------- */
function positionCards(box, list, rootPc, names, sel, onPick) {
  box.innerHTML = list.map((v, i) =>
    `<button type="button" class="vc ${sel === i ? 'active' : ''}" data-i="${i}">${chordSvg(v, rootPc, names)}` +
    `<small>${v.minF > 0 ? 'Casa ' + v.minF : 'Posição aberta'}${v.shape ? ' · forma de ' + v.shape : ''}</small>` +
    (v.label ? `<span class="tag">${v.label}</span>` : '') + (v.barre ? '<span class="tag">pestana</span>' : '') + '</button>').join('');
  box.querySelectorAll('.vc').forEach(b => b.onclick = () => {
    const i = +b.dataset.i, next = sel === i ? null : i;
    if (next !== null) strum(list[next].frets);
    onPick(next);
  });
}
const howTo = (v, names) => '<ol class="str">' + v.frets.map((f, s) =>
  `<li>${STRING_NAMES[s]}: ${f < 0 ? 'não tocar' : f === 0 ? `solta (${names.get(noteAt(s, 0))})` : `casa ${f} (${names.get(noteAt(s, f))})`}</li>`).join('') + '</ol>';
const labelMap = (pcs, names, t, mode) => nameMap(pcs, mode === 'iv' ? intervalNames(t) : names);
const rootButtons = (box, cur, onPick) => {
  box.innerHTML = Array.from({ length: 12 }, (_, i) => `<button type="button" data-p="${i}" class="${i === cur ? 'on' : ''}">${dual(i)}</button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => onPick(+b.dataset.p));
};

/* ---------- ABA GUITARRA ---------- */
const G_INFO = {
  pow: 'Power chord: só a nota base e a quinta (às vezes a oitava por cima). Não é maior nem menor, por isso soa forte e "neutro". É o acorde do rock e do metal, quase sempre com distorção. O mesmo desenho anda pelo braço inteiro.',
  tri: 'Tríade: o acorde em só 3 cordas. Guitarristas usam muito nas cordas agudas para fazer uma base mais leve ou dividir com outro violão. Cada desenho tem uma nota diferente embaixo (fundamental, 1ª ou 2ª inversão).',
};
function renderGuitarra() {
  const g = state.g;
  ['gtriL', 'gsetL'].forEach(id => $(id).hidden = g.kind !== 'tri');
  $('gextL').hidden = g.kind !== 'ext';
  const type = g.kind === 'pow' ? '5' : g.kind === 'tri' ? g.tri : g.ext, t = CHORD_TYPES[type];
  const cn = spelledChord(g.root, t.iv, state.sharps, t.letters), pcs = t.iv.map(i => (g.root + i) % 12);
  const names = nameMap(pcs, cn), shown = labelMap(pcs, cn, t, g.labels);
  const list = g.kind === 'pow' ? powerChords(g.root)
    : g.kind === 'tri' ? stringSetTriads(g.root, t.iv, g.set.split(',').map(Number))
    : neckPositions(g.root, type, t.iv);
  rootButtons($('gRoots'), g.root, p => { g.root = p; g.pos = null; g.limit = 0; renderGuitarra(); });
  $('gInfo').innerHTML = `<p><b>${cn[0]}${t.suffix}</b> — ${ptOf(cn[0])}, ${t.label.toLowerCase()}</p>` +
    `<p>Notas: <b>${cn.join(' - ')}</b> &nbsp;(${intervalNames(t).join(' - ')})</p><p>${G_INFO[g.kind] || t.desc}</p>` +
    `<p>${list.length} formas pelo braço, da casa mais baixa para a mais alta.</p><p>${playBtn('gPlay', 'Ouvir')}</p>`;
  const lim = g.limit || POS_PAGE, page = list.slice(0, Math.max(lim, g.pos !== null ? g.pos + 1 : 0));
  positionCards($('gPositions'), page, g.root, shown, g.pos, i => { g.pos = i; renderGuitarra(); });
  $('gMore').innerHTML = (list.length > page.length ? `<span class="hint">${page.length} de ${list.length}</span><button type="button" class="link" id="gMoreB">Ver mais</button>` : '') +
    (page.length > POS_PAGE ? '<button type="button" class="link" id="gLessB">Ver menos</button>' : '');
  if ($('gMoreB')) $('gMoreB').onclick = () => { g.limit = lim + POS_PAGE; renderGuitarra(); };
  if ($('gLessB')) $('gLessB').onclick = () => { g.limit = POS_PAGE; if (g.pos !== null && g.pos >= POS_PAGE) g.pos = null; renderGuitarra(); $('gPositions').scrollIntoView(); tabJump = true; };
  const v = g.pos !== null ? list[g.pos] : null;
  $('gPlay').onclick = () => strumV(v || list[0]);
  $('gSel').innerHTML = v ? `<p><b>Como tocar:</b></p>${howTo(v, names)}<p>Toque na forma de novo para ver todas as posições.</p>`
    : '<p>Abaixo: todas as notas deste acorde no braço inteiro. Toque numa forma acima para ver só ela.</p>';
  drawBoard($('board4'), 24, { inScale: new Set(pcs), names: shown, rootPc: g.root, all: false, exact: v ? v.frets : null });
}

/* ---------- ABA PROGRESSÕES ---------- */
// progressões criadas pelo usuário, guardadas neste aparelho
const MY_KEY = 'myProgs', MAX_ITEMS = 64;
const validProg = m => m && typeof m.name === 'string' && Number.isInteger(m.key) && m.key >= 0 && m.key < 12 && (m.mode === 'maior' || m.mode === 'menor') &&
  Array.isArray(m.items) && m.items.every(x => x && Number.isInteger(x.o) && x.o >= 0 && x.o < 12 && x.t in CHORD_TYPES);
let myProgs = [];
try { const v = JSON.parse(localStorage.getItem(MY_KEY) || '[]'); if (Array.isArray(v)) myProgs = v.filter(validProg); } catch {}
// com conta, a lista também vai para o servidor (syncMine); `local` = só este aparelho
const saveMine = local => { if (!local) syncMine(); try { localStorage.setItem(MY_KEY, JSON.stringify(myProgs)); return true; } catch { return false; } };
const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const setSeg = (id, v) => { $(id).value = v; document.querySelectorAll(`#${id} + .seg button`).forEach(b => b.classList.toggle('on', b.dataset.v === v)); };
const STOP_BTN = '<button type="button" class="play stop" id="pPlay"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg><span>Parar</span></button>';

// forma escolhida para cada acorde: nas minhas fica no próprio acorde; nas prontas, guardada à parte. Vale só para o tom em que foi escolhida.
const READY_V_KEY = 'progVoices';
let readyVoices = {};
try { const v = JSON.parse(localStorage.getItem(READY_V_KEY) || '{}'); if (v && typeof v === 'object') readyVoices = v; } catch {}
const posFilter = () => { const p = state.p; return { region: 'all', open: p.fOpen || 'any', barre: p.fBarre || 'any', bass: 'any', min: +p.fMin || 0 }; };
const progRegKey = () => { const p = state.p; return p.ed ? 'ed' : `${p.src}|${p.src === 'mine' ? p.mine : p.mode + p.idx}|${p.key}`; };
function voiceSlot(i) {
  const p = state.p, items = p.ed ? p.ed.items : p.src === 'mine' && myProgs[p.mine] ? myProgs[p.mine].items : null;
  if (items) return {
    // a forma escolhida vale para o tom e o tipo de desenho em que foi escolhida
    get: () => items[i] && items[i].fk === p.key && (items[i].fd || 'normal') === (p.kind || 'normal') ? items[i].f : null,
    set: f => {
      if (f) { items[i].f = f; items[i].fk = p.key; if (p.kind && p.kind !== 'normal') items[i].fd = p.kind; else delete items[i].fd; }
      else { delete items[i].f; delete items[i].fk; delete items[i].fd; }
      if (!p.ed) saveMine();
    },
  };
  const k = `${p.mode}|${PROGRESSIONS[p.mode][p.idx].name}|${p.key}|${i}` + (p.kind && p.kind !== 'normal' ? '|' + p.kind : '');
  return {
    get: () => readyVoices[k] || null,
    set: f => {
      if (f) readyVoices[k] = f; else delete readyVoices[k];
      try { localStorage.setItem(READY_V_KEY, JSON.stringify(readyVoices)); } catch {}
    },
  };
}
const posMemo = {};
const POS_PAGE = 12;
// tipo de desenho em Progressões: normal, power chord (rock) ou tríade (3 cordas), como na tela Guitarra
const TRI_SETS = [[5, 4, 3], [4, 3, 2], [3, 2, 1], [2, 1, 0]];
const triadsOf = (rootPc, iv) => {
  const core = iv.slice(0, 3); // nota base, terça (ou 2ª/4ª) e quinta
  if (new Set(core.map(i => i % 12)).size < 3) return powerChords(rootPc);
  return TRI_SETS.flatMap(st => stringSetTriads(rootPc, core, st)).sort((a, b) => a.minF - b.minF || a.maxF - b.maxF);
};
// power chord só serve em acorde com quinta justa; diminuto e aumentado ficam como tríade (B5 no lugar de B° tocaria F#, fora do tom)
const powOk = type => CHORD_TYPES[type].iv.includes(7);
const chordPositions = c => {
  const kind = state.p.kind || 'normal', k = kind + ':' + c.rootPc + ':' + c.type;
  return posMemo[k] || (posMemo[k] =
    (kind === 'pow' && powOk(c.type)) || c.type === '5' ? powerChords(c.rootPc)
    : kind === 'pow' ? triadsOf(c.rootPc, CHORD_TYPES[c.type].iv) // power chord usa só 2 ou 3 cordas: o gerador comum não acha
    : kind === 'tri' ? triadsOf(c.rootPc, CHORD_TYPES[c.type].iv)
    : allPositions(c.rootPc, c.type, CHORD_TYPES[c.type].iv));
};

function stopProg() { if (state.p.playing) { stopAll(); state.p.playing = false; } }
function curProg() {
  const p = state.p;
  if (p.ed) return { name: p.ed.name.trim() || 'Nova progressão', desc: '', mine: true, chords: customChords(p.key, p.mode, p.ed.items, state.sharps) };
  const m = p.src === 'mine' && myProgs[p.mine];
  if (m) return { name: m.name, desc: 'Progressão criada por você.', mine: true, chords: customChords(p.key, p.mode, m.items, state.sharps) };
  p.src = 'ready';
  const list = PROGRESSIONS[p.mode];
  if (p.idx >= list.length) p.idx = 0;
  const pr = list[p.idx], nick = progNick(pr);
  return { name: (nick ? nick + ': ' : '') + progRoman(pr), desc: pr.desc, chords: progressionChords(p.key, p.mode, pr, state.sharps) };
}
// os acordes da sequência, um ao lado do outro, cada um com o desenho de como tocar
const seqCards = (chords, step) => '<div class="pseq">' + chords.map((x, i) => {
  const v = x.v;
  return `<button type="button" class="pc${i === step ? ' on' : ''}${x.inField === false ? ' out' : ''}" data-i="${i}" aria-label="${i + 1}º acorde: ${x.name}">` +
    `<span class="pn">${i + 1}º</span><b>${x.name}</b><small>${x.roman}</small>${v ? chordSvg(v, x.rootPc, nameMap(x.pcs, x.names)) : ''}</button>`;
}).join('') + '</div>';

// entrar ou sair da montagem muda muito a altura da página: vai direto ao ponto certo, sem o pulo
// nas formas do acorde: se a lista encolher, a sobra fica no fim da página, nunca no meio
const posHold = () => {
  const more = $('pPosMore'), top = $('pPosTools').getBoundingClientRect().top;
  renderProgressoes();
  more.style.paddingBottom = '';
  const delta = $('pPosTools').getBoundingClientRect().top - top;
  const lack = scrollY + delta + innerHeight - document.documentElement.scrollHeight;
  if (lack > 0) more.style.paddingBottom = lack + 'px';
  tabJump = true; scrollBy(0, delta);
};
const jumpTo = id => { tabJump = true; $(id).scrollIntoView(); };

// o tom e o modo ficam dentro do quadro de criar enquanto se monta a progressão
const pTop = $('pTop'), pTopHome = $('pTopHome');
// lista das progressões prontas, com filtro de estilo e busca (nome, explicação ou acordes)
const fold = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[–-]/g, ' ').replace(/\s+/g, ' ').trim();
const squeeze = list => {
  const out = [];
  list.forEach(x => { const l = out[out.length - 1]; if (l && l.x === x) l.n++; else out.push({ x, n: 1 }); });
  return out.map(o => o.n > 1 ? `${o.x} ×${o.n}` : o.x).join(list.length > 6 ? ' · ' : ' – ');
};
function renderPList() {
  const p = state.p, q = fold($('pSearch').value || '');
  // só os estilos que têm progressão neste modo (maior ou menor)
  const styles = PROG_STYLES.filter(([k]) => !k || PROGRESSIONS[p.mode].some(pr => (pr.tags || []).includes(k)));
  if (!styles.some(([k]) => k === (p.style || ''))) p.style = '';
  $('pStyles').innerHTML = styles.map(([k, t]) => `<button type="button" class="${(p.style || '') === k ? 'on' : ''}" data-k="${k}">${t}</button>`).join('');
  $('pStyles').querySelectorAll('button').forEach(b => b.onclick = () => { p.style = b.dataset.k; renderPList(); });
  const cards = PROGRESSIONS[p.mode].map((pr, i) => {
    if (p.style && !(pr.tags || []).includes(p.style)) return '';
    const ch = progressionChords(p.key, p.mode, pr, state.sharps), names = ch.map(c => c.name);
    if (q && !fold([pr.name, pr.desc, ...names, ...ch.map(c => c.roman)].join(' ')).includes(q)) return '';
    // cartão sempre do mesmo tamanho: uma linha para os graus e uma para os acordes; repetições viram "×4"
    const roman = squeeze(pr.chords.map(c => c[3])), seq = squeeze(names), nick = progNick(pr);
    return `<button type="button" class="pcard ${p.src === 'ready' && i === p.idx ? 'active' : ''}" data-i="${i}" title="${nick ? nick + ': ' : ''}${progRoman(pr)}"><b>${roman}</b><span>${nick ? `<em>${nick}</em> · ` : ''}${seq}</span></button>`;
  }).join('');
  $('pList').innerHTML = cards || '<p class="hint">Nenhuma progressão com essa busca. Troque o estilo para <b>Todas</b> ou apague o que digitou.</p>';
  $('pList').querySelectorAll('.pcard').forEach(b => b.onclick = () => { stopProg(); p.src = 'ready'; p.idx = +b.dataset.i; p.step = 0; p.pos = null; renderProgressoes(); });
}
$('pSearch').addEventListener('input', () => renderPList());

function renderProgressoes() {
  const p = state.p, ed = p.ed, list = PROGRESSIONS[p.mode];
  pTopHome.appendChild(pTop);
  const delArmed = p.delArm; p.delArm = null; // o pedido de excluir só vale se o próximo toque for de novo em excluir
  $('pTomTitle').textContent = ed ? '2º Tom da música' : 'Tom da música';
  $('pTomHint').hidden = !ed;
  $('plabels').closest('label').hidden = !!ed;
  const scale = p.mode === 'maior' ? 'Maior' : 'Menor', keyName = spelledScale(p.key, scale, state.sharps)[0];
  rootButtons($('pKeys'), p.key, k => { stopProg(); p.key = k; p.pos = null; renderProgressoes(); });
  $('pPick').hidden = !!ed;
  $('pEditor').hidden = !ed;
  $('tab-progressoes').classList.toggle('editing', !!ed); // montando: quadro de cima e de baixo viram uma caixa só

  // listas: prontas e as minhas
  renderPList();
  // duas listas no mesmo lugar: as prontas ou as minhas (um botão troca)
  if (!p.which) p.which = p.src === 'mine' && myProgs.length ? 'mine' : 'ready';
  if (p.which === 'mine' && !myProgs.length) p.which = 'ready';
  $('pWhich').innerHTML = `<button type="button" data-w="ready" class="${p.which === 'ready' ? 'on' : ''}">Prontas</button>` +
    `<button type="button" data-w="mine" class="${p.which === 'mine' ? 'on' : ''}">As minhas (${myProgs.length})</button>`;
  $('pWhich').querySelectorAll('button').forEach(b => b.onclick = () => { p.which = b.dataset.w; renderProgressoes(); });
  $('pReady').hidden = p.which !== 'ready';
  $('pMine').hidden = p.which !== 'mine';
  $('pMine').innerHTML = (myProgs.length ? '' : '<p class="hint">Você ainda não criou nenhuma. Toque em <b>+ Criar progressão</b>.</p>') + myProgs.map((m, i) => {
    const ch = customChords(m.key, m.mode, m.items, state.sharps);
    return `<button type="button" class="pcard ${p.src === 'mine' && i === p.mine ? 'active' : ''}" data-i="${i}"><b>${esc(m.name)}</b>` +
      `<span>${ch.slice(0, 12).map(c => c.name).join(' – ')}${ch.length > 12 ? ' …' : ''} · ${ch.length} acorde${ch.length > 1 ? 's' : ''}</span></button>`;
  }).join('');
  $('pMine').querySelectorAll('.pcard[data-i]').forEach(b => b.onclick = () => {
    stopProg(); const m = myProgs[+b.dataset.i];
    p.src = 'mine'; p.mine = +b.dataset.i; p.key = m.key; p.mode = m.mode; setSeg('pmode', m.mode); p.step = 0; p.pos = null; renderProgressoes();
  });
  $('pNew').onclick = () => { stopProg(); p.ed = { id: null, name: '', items: [], root: p.key, msg: '', del: false }; p.step = 0; p.pos = null; renderProgressoes(); jumpTo('pDetail'); };

  const cur = curProg();
  if (ed && p.kind === 'ten') p.kind = 'normal'; // montando, os acordes ficam como ele pôs
  const chords = p.kind === 'ten' ? tensionChords(p.key, p.mode, cur.chords, state.sharps) : cur.chords;
  chords.forEach((x, i) => { const l = chordPositions(x); x.v = findVoicing(l, voiceSlot(i).get()) || (['normal', 'ten'].includes(p.kind || 'normal') ? bestVoicing(x.rootPc, x.type) : l[0]); });
  if (p.step >= chords.length) p.step = Math.max(0, chords.length - 1);
  const c = chords[p.step];
  const playRow = ''; // sem botão de tocar a sequência: tocar num acorde já toca o som
  const outNote = chords.some(x => x.inField === false)
    ? '<p class="hint">Borda tracejada: acorde <b>de fora</b> do campo harmônico do tom. Pode usar à vontade, ele só dá uma cor diferente à música.</p>' : '';
  let html = `<h2>${ed ? 'Montando: ' : ''}${esc(cur.name)} em ${keyName} ${p.mode}</h2>${cur.desc ? `<p>${cur.desc}</p>` : ''}`;
  if (!chords.length) html += '<p><b>Ainda não há acordes.</b> Escolha os acordes logo abaixo: cada um entra no fim da sequência, um ao lado do outro.</p>';
  else {
    html += `${seqCards(chords, p.step)}${outNote}`;
    if (ed) html += `<div class="eact"><span>Acorde escolhido: <b>${p.step + 1}º — ${c.name}</b></span>` +
      '<button type="button" id="eLeft">← Mover</button><button type="button" id="eRight">Mover →</button>' +
      '<button type="button" id="eDup">Repetir</button><button type="button" id="eRm" class="danger">Tirar</button></div>';
    html += playRow;
    if (chords.length) {
      const rk = progRegKey(), cur = p.allReg && p.allReg.k === rk ? p.allReg.r : '';
      const kind = p.kind || 'normal';
      html += '<div class="roots preg"><b>Desenho:</b> ' + [['normal', 'Normal'], ...(ed ? [] : [['ten', 'Com tensão (jazz)']]), ['pow', 'Power chord (rock)'], ['tri', 'Tríade (3 cordas)']]
        .map(([k, l]) => `<button type="button" data-kind="${k}" class="${k === kind ? 'on' : ''}">${l}</button>`).join('') + '</div>' +
        (kind === 'ten' ? '<p class="hint">Com tensão: cada acorde ganha notas a mais (7ª, 9ª), o som rico do jazz e da bossa. Em C maior, o C vira Cmaj7, o Am vira Am7 e o G (5º acorde do tom) vira G9. Os outros maiores viram maj7. No tom menor, o 5º acorde vira 7(b9) e o 7º vira 7, para não sair do tom.</p>'
          : kind === 'pow' ? '<p class="hint">Power chord: só a nota base e a quinta. Não é maior nem menor, por isso serve para os acordes maiores e menores. Som forte do rock. Diminutos e aumentados não têm essa quinta: ficam como tríade.</p>'
          : kind === 'tri' ? '<p class="hint">Tríade: o acorde em só 3 cordas, som leve. Acordes com sétima ou nona ficam só com as 3 notas principais.</p>' : '');
      html += '<div class="roots preg"><b>Tocar tudo em:</b> ' + [['', 'Normal'], ['1', 'Início (1–4)'], ['2', 'Meio (5–8)'], ['3', 'Agudo (9–12)'], ['4', 'Mais agudo (13+)']]
        .map(([k, l]) => `<button type="button" data-ar="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('') +
        '</div><p class="hint">Muda a forma de todos os acordes de uma vez para aquela parte do braço.</p>';
    }
    const t = CHORD_TYPES[c.type];
    html += `<p><b>${c.name}</b> (${ptOf(c.rootName)}, ${t.label.toLowerCase()}): notas <b>${c.names.join(' - ')}</b>.</p>`;
  }
  if (cur.mine && !ed) {
    const armed = delArmed === myProgs[p.mine].id;
    html += '<p><button type="button" class="link" id="pEdit">Mudar esta progressão (pôr, tirar ou trocar acordes)</button> ' +
      `<button type="button" class="link danger" id="pDelMine">${armed ? 'Toque de novo para excluir de vez' : 'Excluir esta progressão'}</button></p>`;
  }
  if (!cur.mine && !ed) html += '<p><button type="button" class="link" id="pCustom">Personalizar esta progressão (pôr, tirar ou trocar acordes)</button></p><p class="hint">A pronta continua igual. A sua versão fica guardada em <b>As minhas</b>, no alto da lista.</p>';
  if (!ed && chords.length) html += '<p>' + playBtn('pBase', 'Tocar como base') + ' <span class="hint">Abre a tela Base com esta progressão, no mesmo tom e com as formas que você escolheu.</span></p>';
  $('pDetail').innerHTML = html;
  if ($('pBase')) $('pBase').onclick = () => {
    stopProg(); const b = state.b, mine = cur.mine && p.src === 'mine';
    Object.assign(b, { key: p.key, mode: p.mode, src: mine ? 'mine' : 'ready', idx: p.idx, mine: p.mine, which: mine ? 'mine' : 'ready', msg: '',
      link: { key: p.key, mode: p.mode, src: mine ? 'mine' : 'ready', idx: mine ? p.mine : p.idx, ten: p.kind === 'ten', frets: chords.map(x => x.v.frets) } });
    setTab('base'); startBase();
  };

  $('pDetail').querySelectorAll('.pc').forEach(b => b.onclick = () => {
    stopProg(); p.step = +b.dataset.i; p.pos = null; strumV(chords[p.step].v); renderProgressoes();
  });
  $('pDetail').querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { stopProg(); p.kind = b.dataset.kind; p.pos = null; p.posLimit = POS_PAGE; renderProgressoes(); });
  $('pDetail').querySelectorAll('[data-ar]').forEach(b => b.onclick = () => {
    stopProg(); const r = b.dataset.ar; let miss = 0;
    chords.forEach((x, i) => {
      const f = r ? filterVoicings(chordPositions(x), { ...posFilter(), region: r })[0] : null;
      if (r && !f) miss++;
      voiceSlot(i).set(f ? f.frets : null);
    });
    p.allReg = { k: progRegKey(), r }; p.pos = null;
    if (ed) ed.msg = miss ? `${miss} acorde(s) não têm forma nessa parte e ficaram na forma normal.` : '';
    renderProgressoes();
  });
  if ($('pPlay')) $('pPlay').onclick = () => {
    if (p.playing) { stopProg(); renderProgressoes(); return; }
    p.playing = true;
    schedule(chords, chords.length > 6 ? 1300 : 1700, (x, i) => {
      p.step = i; p.pos = null; strumV(x.v); keepScroll(renderProgressoes);
    }, () => { p.playing = false; keepScroll(renderProgressoes); });
    renderProgressoes();
  };
  if ($('pDelMine')) $('pDelMine').onclick = () => {
    const id = myProgs[p.mine].id;
    if (delArmed !== id) { p.delArm = id; renderProgressoes(); return; } // pede dois toques para evitar engano
    stopProg(); myProgs = myProgs.filter(m => m.id !== id); saveMine();
    p.src = 'ready'; p.step = 0; p.pos = null; renderProgressoes(); jumpTo('pDetail');
  };
  if ($('pCustom')) $('pCustom').onclick = () => {
    stopProg();
    const items = itemsFromChords(p.key, chords, p.mode).map((x, i) => { const f = voiceSlot(i).get(); return f ? { ...x, f, fk: p.key, ...(p.kind && p.kind !== 'normal' ? { fd: p.kind } : {}) } : x; });
    p.ed = { id: null, name: `${p.src === 'ready' ? (progNick(PROGRESSIONS[p.mode][p.idx]) || progRoman(PROGRESSIONS[p.mode][p.idx])) : cur.name} (minha)`.slice(0, 40), items, root: p.key, msg: '', del: false }; p.step = 0; p.pos = null;
    renderProgressoes(); jumpTo('pDetail');
  };
  if ($('pEdit')) $('pEdit').onclick = () => {
    stopProg(); const m = myProgs[p.mine];
    p.ed = { id: m.id, name: m.name, items: m.items.map(x => ({ ...x })), root: p.key, msg: '', del: false }; renderProgressoes(); jumpTo('pDetail');
  };
  if (ed) renderEditor(chords, keyName, scale);
  else $('pEditor').innerHTML = '';

  const show = !!c;
  ['board3', 'pPositions', 'pPosHint', 'pPosTools', 'pPosMore'].forEach(id => $(id).hidden = !show);
  $('pPosTitle').hidden = !show;
  if (!show) return;
  const t = CHORD_TYPES[c.type], shown = labelMap(c.pcs, c.names, t, p.labels);
  const pos = chordPositions(c), slot = voiceSlot(p.step), v = findVoicing(pos, slot.get());
    $('pPosTitle').textContent = `Trocar a forma de ${c.name} (casas 0 a 24)`;
  $('pPosHint').innerHTML = v
    ? `<b>${c.name} agora usa a forma da ${v.minF > 0 ? 'casa ' + v.minF : 'posição aberta'}</b> nesta progressão, neste tom. Toque nela de novo para voltar à forma normal.`
    : `Toque numa forma: ela passa a ser a usada no ${p.step + 1}º acorde e a tela sobe até o braço para você ver onde fica. A escolha fica guardada.`;
  // região e "ver mais": a lista pode ter dezenas de formas
  const chordId = c.rootPc + ':' + c.type;
  if (p.posChord !== chordId) { p.posChord = chordId; p.posLimit = POS_PAGE; }
  const region = p.posRegion || 'all';
  const found = filterVoicings(pos, { ...posFilter(), region });
  // mais filtros (como na tela Acordes): cordas soltas, pestana e quantas cordas soam
  const fl = [['fOpen', 'Cordas soltas', [['any', 'Tanto faz'], ['without', 'Sem'], ['with', 'Com']]],
    ['fBarre', 'Pestana', [['any', 'Tanto faz'], ['without', 'Sem'], ['with', 'Com']]],
    ['fMin', 'Cordas que soam', [['0', 'Qualquer'], ['4', '4 ou mais'], ['5', '5 ou mais'], ['6', 'Todas as 6']]]];
  $('pFilt').innerHTML = fl.map(([k, t, opts]) => `<div class="roots preg"><b>${t}:</b> ` +
    opts.map(([v, l]) => `<button type="button" data-fk="${k}" data-fv="${v}" class="${(p[k] || opts[0][0]) === v ? 'on' : ''}">${l}</button>`).join('') + '</div>').join('') +
    '<p class="hint">Valem para esta lista e para <b>Tocar tudo em</b>.</p>';
  $('pFilt').querySelectorAll('button').forEach(b => b.onclick = () => { p[b.dataset.fk] = b.dataset.fv; p.posLimit = POS_PAGE; posHold(); });
  const nAct = ['fOpen', 'fBarre'].filter(k => p[k] && p[k] !== 'any').length + (+p.fMin ? 1 : 0);
  $('pFiltSum').textContent = nAct ? `Mais filtros (${nAct} ligado${nAct > 1 ? 's' : ''})` : 'Mais filtros';
  let page = found.slice(0, p.posLimit);
  if (v && !page.includes(v) && found.includes(v)) page = [v, ...page.slice(0, -1)]; // a forma escolhida sempre aparece
  $('pPosTools').innerHTML = '<b>Parte do braço:</b> ' + [['all', 'Todas'], ['1', 'Início (1–4)'], ['2', 'Meio (5–8)'], ['3', 'Agudo (9–12)'], ['4', 'Mais agudo (13+)']]
    .map(([k, l]) => `<button type="button" data-r="${k}" class="${k === region ? 'on' : ''}">${l}</button>`).join('');
  $('pPosTools').querySelectorAll('button').forEach(b => b.onclick = () => {
    p.posRegion = b.dataset.r; p.posLimit = POS_PAGE; posHold();
  });
  if (v && !found.includes(v)) $('pPosHint').innerHTML += ' A forma escolhida fica em outra parte do braço: toque em <b>Todas</b> para vê-la.';
  positionCards($('pPositions'), page, c.rootPc, shown, v ? page.indexOf(v) : null, i => { slot.set(i === null ? null : page[i].frets); posHold(); if (i !== null) { tabJump = true; $('board3').scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
  $('pPosMore').innerHTML = !found.length ? `<p>Nenhuma forma de ${c.name} com estes filtros. Escolha outra parte do braço ou mude os filtros.</p>` : '';
  $('pPosMoreTop').innerHTML = (found.length ? `<span class="hint">${page.length} de ${found.length}</span>` : '') +
    (found.length > p.posLimit ? '<button type="button" class="link" id="pMoreF">Ver mais</button>' : '') +
    (p.posLimit > POS_PAGE ? '<button type="button" class="link" id="pLessF">Ver menos</button>' : '');
  if ($('pMoreF')) $('pMoreF').onclick = () => { p.posLimit += POS_PAGE; posHold(); };
  if ($('pLessF')) $('pLessF').onclick = () => { p.posLimit = POS_PAGE; renderProgressoes(); $('pPosTitle').scrollIntoView(); tabJump = true; };
  drawBoard($('board3'), 24, { inScale: new Set(c.pcs), names: shown, rootPc: c.rootPc, all: false, exact: v ? v.frets : null });
}

// montar / mudar uma progressão própria
function renderEditor(chords, keyName, scale) {
  const p = state.p, ed = p.ed;
  const field = harmonicField(p.key, scale, state.sharps), notes = scaleNotes(p.key, scale);
  const ro = (ed.root - p.key + 12) % 12, types = CHORD_ORDER;
  const byType = customChords(p.key, p.mode, types.map(t => ({ o: ro, t })), state.sharps);
  const cancelArmed = ed.cancel, delAllArmed = ed.del; ed.cancel = ed.del = false; // dois toques só valem em seguida
  const cancelBtn = `<button type="button" class="link danger" data-cancel>${cancelArmed ? 'Toque de novo para cancelar' : ed.id ? 'Cancelar as mudanças' : 'Cancelar progressão'}</button>`;
  const live = `<div class="elive" aria-live="polite"><p class="emsg">${ed.msg}</p></div>`;
  $('pEditor').innerHTML = live +
    `<label class="ename"><span>1º Nome da progressão</span><input id="eName" maxlength="40" placeholder="Ex.: Música da festa" value="${esc(ed.name)}"><small class="hint">Escreva um nome para achar depois. Se deixar vazio, o aplicativo dá um nome sozinho.</small></label>` +
    '<div id="eTom"></div>' +
    `<h3><b>3º</b> Pôr acorde — jeito rápido</h3><p class="hint">São os acordes do campo harmônico de ${keyName} ${p.mode}: todos combinam com o tom. Toque num e ele entra no fim da sequência.</p>` +
    `<div class="roots efield">${field.map((f, i) => `<button type="button" data-o="${(notes[i] - p.key + 12) % 12}" data-t="${f.type}"><b>${f.chord}</b><small>${f.roman}</small></button>`).join('')}</div>` +
    '<h3>Ou pôr qualquer acorde</h3><p class="hint">Primeiro toque na nota. Depois toque no tipo: o acorde entra no fim da sequência.</p>' +
    '<div class="roots" id="eRoots"></div>' +
    `<div class="etypes">${byType.map((x, i) => `<button type="button" data-t="${types[i]}"><b>${x.name}</b><small>${CHORD_TYPES[types[i]].label}</small></button>`).join('')}</div>` +
    '<h3><b>4º</b> Confira a sequência</h3><p class="hint">Ela aparece lá em cima, na ordem da música. Toque num acorde para ouvir e para mover, repetir ou tirar.</p>' +
    '<h3><b>5º</b> Guarde</h3><p class="hint">Depois de guardar, ela fica em <b>As minhas</b>, no alto da lista, para abrir quando quiser.</p>' +
    '<div class="dlg-actions"><button type="button" class="play" id="eSave">Guardar a progressão</button>' + cancelBtn +
    (ed.id ? `<button type="button" class="link danger" id="eDelAll">${delAllArmed ? 'Toque de novo para apagar de vez' : 'Apagar esta progressão'}</button>` : '') + '</div>';
  $('eTom').appendChild(pTop);
  $('eName').oninput = e => { ed.name = e.target.value; };
  rootButtons($('eRoots'), ed.root, r => { ed.root = r; ed.msg = `Agora toque no tipo de acorde de ${dual(r)}, nos botões logo abaixo das notas.`; renderProgressoes(); });
  const add = (o, t) => {
    stopProg();
    if (ed.items.length >= MAX_ITEMS) { ed.msg = `O limite é de ${MAX_ITEMS} acordes.`; renderProgressoes(); return; }
    ed.items.push({ o, t }); ed.msg = `✓ ${customChords(p.key, p.mode, [{ o, t }], state.sharps)[0].name} entrou como ${ed.items.length}º acorde.`; p.step = ed.items.length - 1; p.pos = null;
    strumV(bestVoicing((p.key + o) % 12, t));
    // a sequência cresce: mantém o quadro dos acordes parado sob o dedo
    const top = $('pEditor').getBoundingClientRect().top;
    renderProgressoes();
    tabJump = true; scrollBy(0, $('pEditor').getBoundingClientRect().top - top);
  };
  $('pEditor').querySelectorAll('.efield button').forEach(b => b.onclick = () => add(+b.dataset.o, b.dataset.t));
  $('pEditor').querySelectorAll('.etypes button').forEach(b => b.onclick = () => add(ro, b.dataset.t));
  const move = d => { const i = p.step, j = i + d; if (j < 0 || j >= ed.items.length) return; [ed.items[i], ed.items[j]] = [ed.items[j], ed.items[i]]; p.step = j; };
  if (chords.length) {
    $('eLeft').onclick = () => { stopProg(); move(-1); renderProgressoes(); };
    $('eRight').onclick = () => { stopProg(); move(1); renderProgressoes(); };
    $('eDup').onclick = () => { if (ed.items.length >= MAX_ITEMS) return; stopProg(); ed.items.splice(p.step + 1, 0, { ...ed.items[p.step] }); p.step++; renderProgressoes(); };
    $('eRm').onclick = () => { stopProg(); ed.items.splice(p.step, 1); p.step = Math.max(0, p.step - 1); p.pos = null; renderProgressoes(); };
  }
  $('eSave').onclick = () => {
    stopProg();
    if (!ed.items.length) { ed.msg = 'Coloque pelo menos um acorde antes de guardar.'; renderProgressoes(); return; }
    const name = ed.name.trim() || `Minha progressão ${myProgs.length + 1}`;
    const rec = { id: ed.id || Date.now().toString(36), name, key: p.key, mode: p.mode, items: ed.items };
    const i = ed.id ? myProgs.findIndex(m => m.id === ed.id) : -1;
    if (i >= 0) myProgs[i] = rec; else myProgs.push(rec);
    if (!saveMine()) { ed.id = rec.id; ed.msg = 'Não consegui guardar neste aparelho. Tente de novo; se continuar, a memória do navegador pode estar cheia.'; renderProgressoes(); return; }
    p.ed = null; p.src = 'mine'; p.which = 'mine'; p.mine = i >= 0 ? i : myProgs.length - 1; p.pos = null;
    renderProgressoes(); jumpTo('pDetail');
  };
  document.querySelectorAll('#tab-progressoes [data-cancel]').forEach(b => b.onclick = () => {
    if (ed.items.length && !cancelArmed) { ed.cancel = true; renderProgressoes(); return; } // pede dois toques para não perder o que já montou
    stopProg(); p.ed = null; p.pos = null; renderProgressoes(); jumpTo('pDetail');
  });
  if ($('eDelAll')) $('eDelAll').onclick = () => {
    if (!delAllArmed) { ed.del = true; renderProgressoes(); return; }
    stopProg(); myProgs = myProgs.filter(m => m.id !== ed.id); saveMine();
    p.ed = null; p.src = 'ready'; p.step = 0; p.pos = null; renderProgressoes(); jumpTo('pDetail');
  };
}


/* ---------- ABA BASE (backing track) ---------- */
const BPMS = [[60, 'Lento'], [80, 'Médio'], [100, 'Animado'], [120, 'Rápido']];
state.b = { key: 0, mode: 'maior', src: 'ready', idx: 0, mine: 0, which: 'ready', style: '', bpm: 100, groove: 'pop', mix: { drums: true, bass: true, comp: true }, bars: 1, hide: false, playing: false, player: null, link: null, msg: '' };
function stopBase() {
  const b = state.b;
  if (b.player) { b.player.stop(); b.player = null; }
  const was = b.playing; b.playing = false;
  if (was && state.tab === 'base') renderBase();
}
function baseChords() {
  const b = state.b;
  let chords, name, items = null;
  const m = b.src === 'mine' && myProgs[b.mine];
  if (m) { items = m.items; name = m.name; chords = customChords(b.key, b.mode, items, state.sharps); }
  else {
    b.src = 'ready';
    const list = PROGRESSIONS[b.mode]; if (b.idx >= list.length) b.idx = 0;
    const pr = list[b.idx], nick = progNick(pr);
    name = (nick ? nick + ': ' : '') + progRoman(pr);
    chords = progressionChords(b.key, b.mode, pr, state.sharps);
  }
  const L = b.link, lk = L && L.key === b.key && L.mode === b.mode && L.src === b.src && L.idx === (b.src === 'mine' ? b.mine : b.idx);
  if (lk && L.ten) chords = tensionChords(b.key, b.mode, chords, state.sharps);
  chords.forEach((x, i) => {
    const saved = items && items[i].f && items[i].fk === b.key && !items[i].fd ? items[i].f : null; // forma que você escolheu em Progressões
    const f = lk && L.frets[i] ? L.frets[i] : saved;
    x.v = f ? (findVoicing(allPositions(x.rootPc, x.type, CHORD_TYPES[x.type].iv), f) || shapeOf(f)) : bestVoicing(x.rootPc, x.type);
  });
  b.shown = chords;
  return { name, chords };
}
function startBase() {
  const b = state.b;
  if (!soundOn()) { b.msg = 'O som está desligado. Toque no alto-falante no alto da tela para ligar.'; renderBase(); return; }
  if (b.player) b.player.stop();
  stopProg();
  const { chords } = baseChords();
  b.msg = ''; b.cur = 0;
  b.player = createPlayer({ chords: chords.map(c => ({ frets: c.v.frets, rootPc: c.rootPc, iv: CHORD_TYPES[c.type].iv })), bpm: b.bpm, bars: b.bars, groove: b.groove, mix: b.mix, onBeat: paintBeat });
  b.playing = true; b.player.start();
  renderBase();
}
// desenho do acorde da vez, prévia do próximo e braço (só quando os acordes estão à mostra)
function paintVis(i) {
  const b = state.b, ch = b.shown;
  if (b.hide || !ch || !$('bBoard')) return;
  const c = ch[i] || ch[0], n = ch[(i + 1) % ch.length], nm = x => nameMap(x.pcs, x.names);
  $('bNow').innerHTML = `<b>${c.name}</b>` + chordSvg(c.v, c.rootPc, nm(c));
  $('bNext').innerHTML = `<b>${n.name}</b>` + chordSvg(n.v, n.rootPc, nm(n));
  drawBoard($('bBoard'), 24, { inScale: new Set(c.pcs), names: nm(c), rootPc: c.rootPc, all: false, exact: c.v.frets, oneRow: true });
}
function paintBeat(info) {
  if (state.tab !== 'base') return;
  if (info.chord !== state.b.cur) { state.b.cur = info.chord; paintVis(info.chord); }
  document.querySelectorAll('#bPlayer .bchip').forEach((c, i) => c.classList.toggle('on', i === info.chord));
  document.querySelectorAll('#bPlayer .bbeats i').forEach((d, i) => d.classList.toggle('on', i === info.beat));
}
// mudou o tom, a progressão ou o andamento: se estava tocando, recomeça já com o novo
const baseChanged = () => { const was = state.b.playing; if (was) startBase(); else renderBase(); };
function renderBase() {
  const b = state.b;
  // duas fontes: a base do próprio app (sintetizada) ou as gravações que você guardou
  $('bSrc').innerHTML = [['app', 'Base do app'], ['rec', 'Minhas gravações']].map(([k, l]) => `<button type="button" data-src="${k}" class="${(b.fonte || 'app') === k ? 'on' : ''}">${l}</button>`).join('');
  $('bSrc').querySelectorAll('button').forEach(x => x.onclick = () => { b.fonte = x.dataset.src; if (b.fonte === 'rec') stopBase(); else pararGravacao(); renderBase(); });
  $('bSynth').hidden = b.fonte === 'rec'; $('bRec').hidden = b.fonte !== 'rec';
  if (b.fonte === 'rec') { renderRec(); return; }
  const { name, chords } = baseChords();
  const keyName = spelledScale(b.key, b.mode === 'maior' ? 'Maior' : 'Menor', state.sharps)[0];
  rootButtons($('bKeys'), b.key, k => { b.key = k; b.link = null; baseChanged(); });
  const seg = (arr, cur, attr) => arr.map(([v, l]) => `<button type="button" data-${attr}="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('');
  $('bMode').innerHTML = ' ' + seg([['maior', 'Maior (alegre)'], ['menor', 'Menor (triste)']], b.mode, 'm');
  $('bMode').querySelectorAll('button').forEach(x => x.onclick = () => { if (b.mode !== x.dataset.m) { b.mode = x.dataset.m; b.src = 'ready'; b.idx = 0; b.link = null; baseChanged(); } });
  if (b.which === 'mine' && !myProgs.length) b.which = 'ready';
  $('bWhich').innerHTML = seg([['ready', 'Prontas'], ['mine', `As minhas (${myProgs.length})`]], b.which, 'w');
  $('bWhich').querySelectorAll('button').forEach(x => x.onclick = () => { b.which = x.dataset.w; renderBase(); });
  // gêneros que existem neste modo; escolher um filtra a lista e já ajusta o andamento típico
  const sty = PROG_STYLES.filter(([k]) => !k || PROGRESSIONS[b.mode].some(pr => (pr.tags || []).includes(k)));
  if (!sty.some(([k]) => k === b.style)) b.style = '';
  $('bStyles').hidden = b.which === 'mine';
  $('bStyles').innerHTML = '<b>Gênero:</b> ' + seg(sty, b.style, 'sty');
  $('bStyles').querySelectorAll('button').forEach(x => x.onclick = () => { b.style = x.dataset.sty; if (GROOVE_OF[b.style]) { b.groove = GROOVE_OF[b.style]; b.bpm = GROOVES[b.groove].bpm; } baseChanged(); });
  if (b.which === 'mine') {
    $('bList').innerHTML = (myProgs.length ? '' : '<p class="hint">Você ainda não criou nenhuma. Crie na tela Progressões.</p>') + myProgs.map((m, i) => {
      const ch = customChords(b.key, m.mode, m.items, state.sharps);
      return `<button type="button" class="pcard ${b.src === 'mine' && i === b.mine ? 'active' : ''}" data-i="${i}"><b>${esc(m.name)}</b>${b.hide ? '' : `<span>${ch.slice(0, 12).map(c => c.name).join(' – ')}${ch.length > 12 ? ' …' : ''}</span>`}</button>`;
    }).join('');
    $('bList').querySelectorAll('.pcard').forEach(x => x.onclick = () => { b.src = 'mine'; b.mine = +x.dataset.i; b.mode = myProgs[b.mine].mode; b.link = null; baseChanged(); });
  } else {
    $('bList').innerHTML = PROGRESSIONS[b.mode].map((pr, i) => {
      if (b.style && !(pr.tags || []).includes(b.style)) return '';
      const nick = progNick(pr), seq = squeeze(progressionChords(b.key, b.mode, pr, state.sharps).map(c => c.name));
      return `<button type="button" class="pcard ${b.src === 'ready' && i === b.idx ? 'active' : ''}" data-i="${i}"><b>${squeeze(pr.chords.map(c => c[3]))}</b>` +
        `<span>${nick ? `<em>${nick}</em>${b.hide ? '' : ' · '}` : ''}${b.hide ? '' : seq}</span></button>`;
    }).join('');
    $('bList').querySelectorAll('.pcard').forEach(x => x.onclick = () => { b.src = 'ready'; b.idx = +x.dataset.i; b.link = null; baseChanged(); });
  }
  if (!b.playing) b.cur = 0;
  const chips = chords.map((c, i) => `<div class="bchip${c.inField === false ? ' out' : ''}${b.playing && i === b.cur ? ' on' : ''}">` +
    (b.hide ? '<b>?</b><small>' + (i + 1) + 'º acorde</small>' : `<b>${c.name}</b><small>${c.roman}</small>`) + '</div>').join('');
  $('bPlayer').innerHTML = `<div class="bcols"><div class="bleft"><div class="bnow"><span class="big">${b.hide ? `Em ${keyName} ${b.mode}` : esc(name) + ' em ' + keyName + ' ' + b.mode}</span>` +
    (b.playing ? STOP_BTN.replace('id="pPlay"', 'id="bPlay"') : playBtn('bPlay', 'Tocar')) + '</div>' +
    `<div class="bseq">${chips}</div><div class="bbeats" aria-hidden="true"><i></i><i></i><i></i><i></i></div>` +
    (b.msg ? `<p class="emsg">${b.msg}</p>` : '') +
    `<p class="hint">${b.playing ? 'Tocando em ciclo, sem parar. Toque em Parar quando quiser.' : 'Toque em Tocar. A base repete a sequência até você parar.'}</p></div>` +
    // desenhos do lado do texto (embaixo dele quando a tela é estreita); o braço fica embaixo, de ponta a ponta
    (b.hide ? '</div>' : '<div class="bvis"><div><small>Agora</small><div id="bNow"></div></div><div class="nx"><small>Em seguida</small><div id="bNext"></div></div></div></div><div class="board-wrap"><div id="bBoard"></div></div>');
  $('bPlay').onclick = () => b.playing ? stopBase() : startBase();
  paintVis(b.cur);
  $('bOpts').innerHTML =
    `<div class="roots preg"><b>Andamento:</b> ${seg(BPMS.map(([v, l]) => [v, `${l} (${v})`]), b.bpm, 'bpm')}</div>` +
    `<div class="roots preg bstep"><b>Ajuste fino:</b> <button type="button" data-bpmd="-5" aria-label="Mais devagar">−5</button><span><b>${b.bpm}</b> batidas por minuto</span><button type="button" data-bpmd="5" aria-label="Mais rápido">+5</button></div>` +
    `<div class="roots preg"><b>Ritmo:</b> ${seg(GROOVE_ORDER.map(k => [k, GROOVES[k].name]), b.groove, 'gr')}</div>` +
    `<div class="roots preg"><b>Instrumentos:</b> ${[['drums', 'Bateria'], ['bass', 'Baixo'], ['comp', 'Violão']].map(([k, l]) => `<button type="button" data-mx="${k}" class="${b.mix[k] ? 'on' : ''}" aria-pressed="${b.mix[k]}">${l}</button>`).join('')}</div>` +
    `<div class="roots preg"><b>Compassos por acorde:</b> ${seg([[1, '1'], [2, '2']], b.bars, 'bars')}</div>` +
    `<div class="roots preg"><b>Acordes na tela:</b> ${seg([['0', 'Mostrar (assistir)'], ['1', 'Esconder (só ouvir)']], b.hide ? '1' : '0', 'hide')}</div>` +
    '<p class="hint"><b>Esconder</b> tira os nomes dos acordes da tela: bom para treinar o ouvido ou tocar sem olhar. Os pontinhos mostram os 4 tempos do compasso.</p>' +
    `<p class="hint">Andamento é a velocidade, em batidas por minuto. <b>Ritmo</b> é a levada da banda (rock, samba, bossa nova, baião, blues…); ao escolher um ritmo ou um gênero, o andamento típico dele já vem ajustado. Em <b>Instrumentos</b> você desliga a bateria, o baixo ou o violão: desligue o violão para tocar você mesmo por cima.</p>`;
  const bind = (attr, fn) => $('bOpts').querySelectorAll(`[data-${attr}]`).forEach(x => x.onclick = () => { fn(x.dataset[attr]); baseChanged(); });
  bind('bpm', v => { b.bpm = +v; }); bind('bpmd', v => { b.bpm = Math.max(40, Math.min(200, b.bpm + +v)); }); bind('gr', v => { b.groove = v; b.bpm = GROOVES[v].bpm; }); bind('mx', v => { b.mix = { ...b.mix, [v]: !b.mix[v] }; }); bind('bars', v => { b.bars = +v; }); bind('hide', v => { b.hide = v === '1'; });
}


/* ---------- CONTA (login) e MINHAS GRAVAÇÕES (faixas guardadas no servidor do app) ---------- */
const conta = { usuario: null, cadastro: false, login: false, pronto: false, msg: '', err: false, senha: false };
state.rx = { pasta: '', q: '', sel: null, faixas: [], pastas: [], extras: [], carregou: false, carregando: false, msg: '', err: false, edit: false, del: false, speed: 1, loop: true, nova: false, pastaEd: false, pastaDel: false, enviando: '', parar: false, destino: '' };
const pararGravacao = () => { const a = $('rxAudio'); if (a && !a.paused) a.pause(); };

// progressões: com conta, ficam também no servidor (não somem se o navegador apagar os dados)
let syncTimer = null;
const syncMine = () => {
  if (!conta.usuario) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => api.gravarProgs(myProgs).catch(() => {}), 600);
};
async function puxarProgs() {
  try {
    const { progressoes } = await api.lerProgs(), srv = Array.isArray(progressoes) ? progressoes.filter(validProg) : [];
    const ids = new Set(srv.map(m => m.id)), extra = myProgs.filter(m => !ids.has(m.id)); // as deste aparelho que o servidor não tem
    const juntas = [...srv, ...extra];
    if (progressoes === null || extra.length) await api.gravarProgs(juntas);
    myProgs = juntas; saveMine(true);
    if (state.tab === 'progressoes' && !state.p.ed) renderProgressoes();
  } catch {}
}

async function carregarConta() {
  const e = await api.estado();
  conta.usuario = e.usuario; conta.cadastro = e.cadastro; conta.login = !!e.login; conta.comprime = !!e.comprime; conta.pronto = true;
  $('contaBtn').hidden = !conta.login; // modo simples (sem login): o botão de conta nem aparece
  $('contaBtn').classList.toggle('on', !!conta.usuario);
  $('contaBtn').title = conta.usuario ? `Conta: ${conta.usuario.nome}` : 'Entrar na sua conta';
  if (conta.usuario) puxarProgs();
  state.rx.carregou = false; state.rx.faixas = []; state.rx.sel = null;
  if (state.tab === 'base') renderBase();
}
const campo = (id, rotulo, tipo, auto, extra = '') => `<label>${rotulo}<input id="${id}" type="${tipo}" autocomplete="${auto}" ${extra} required></label>`;
function renderConta() {
  const u = conta.usuario, msg = conta.msg ? `<p class="${conta.err ? 'cerr' : 'cok'}" role="alert">${esc(conta.msg)}</p>` : '';
  let h;
  if (!api.temServidor) h = '<p>A conta funciona quando o aplicativo roda pelo servidor dele, neste computador (<b>npm start</b>).</p>';
  else if (u) h = `<p>Você entrou como <b>${esc(u.nome)}</b> (${esc(u.email)}).</p><p class="hint">Suas gravações e suas progressões ficam guardadas na sua conta.</p>${msg}` +
    (conta.senha ? `<form class="cform" id="cSenha">${campo('cAtual', 'Senha atual', 'password', 'current-password')}${campo('cNova', 'Senha nova (8 ou mais letras ou números)', 'password', 'new-password', 'minlength="8"')}` +
      '<div class="dlg-actions"><button type="submit" class="play">Trocar a senha</button><button type="button" class="link" id="cSenhaNao">Cancelar</button></div></form>'
      : '<div class="dlg-actions"><button type="button" class="play" id="cSair">Sair da conta</button><button type="button" class="link" id="cSenhaSim">Trocar a senha</button></div>');
  else if (conta.cadastro) h = '<p><b>Primeira vez:</b> crie a sua conta. Ela guarda suas gravações e suas progressões.</p>' + msg +
    `<form class="cform" id="cNovo">${campo('cNome', 'Seu nome', 'text', 'name', 'maxlength="80"')}${campo('cEmail', 'E-mail', 'email', 'username')}` +
    `${campo('cPass', 'Senha (8 ou mais letras ou números)', 'password', 'new-password', 'minlength="8"')}${campo('cPass2', 'Repita a senha', 'password', 'new-password', 'minlength="8"')}` +
    '<div class="dlg-actions"><button type="submit" class="play">Criar a conta</button></div></form>';
  else h = msg + `<form class="cform" id="cEntrar">${campo('cEmail', 'E-mail', 'email', 'username')}${campo('cPass', 'Senha', 'password', 'current-password')}` +
    '<div class="dlg-actions"><button type="submit" class="play">Entrar</button></div></form>';
  $('contaBody').innerHTML = h;
  const ir = async (fn, ok) => {
    try { await fn(); conta.msg = ok || ''; conta.err = false; conta.senha = false; await carregarConta(); }
    catch (e) { conta.msg = e.message; conta.err = true; }
    renderConta();
  };
  const val = id => $(id).value;
  if ($('cEntrar')) $('cEntrar').onsubmit = e => { e.preventDefault(); ir(() => api.entrar(val('cEmail'), val('cPass')), 'Pronto, você entrou.'); };
  if ($('cNovo')) $('cNovo').onsubmit = e => {
    e.preventDefault();
    if (val('cPass') !== val('cPass2')) { conta.msg = 'As duas senhas estão diferentes.'; conta.err = true; renderConta(); return; }
    ir(() => api.cadastrar(val('cNome'), val('cEmail'), val('cPass')), 'Conta criada. Você já entrou.');
  };
  if ($('cSair')) $('cSair').onclick = () => ir(() => api.sair(), 'Você saiu da conta.');
  if ($('cSenhaSim')) $('cSenhaSim').onclick = () => { conta.senha = true; conta.msg = ''; renderConta(); };
  if ($('cSenhaNao')) $('cSenhaNao').onclick = () => { conta.senha = false; renderConta(); };
  if ($('cSenha')) $('cSenha').onsubmit = e => { e.preventDefault(); ir(() => api.trocarSenha(val('cAtual'), val('cNova')), 'Senha trocada. Entre de novo com a senha nova.'); };
  const f = $('contaBody').querySelector('input'); if (f) setTimeout(() => f.focus(), 50);
}
const abrirConta = () => { conta.msg = ''; conta.senha = false; renderConta(); const d = $('contaDlg'); d.showModal ? d.showModal() : d.setAttribute('open', ''); };
$('contaBtn').onclick = abrirConta;
$('contaClose').onclick = () => { const d = $('contaDlg'); d.close ? d.close() : d.removeAttribute('open'); };
$('contaDlg').addEventListener('click', e => { if (e.target === $('contaDlg')) $('contaClose').onclick(); });

// Minhas gravações, organizadas em pastas (ex.: "A maior/Blues"), como no pen drive
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|flac|aif|aiff)$/i;
const paiDe = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
const nomeDe = p => p.slice(p.lastIndexOf('/') + 1);
const junta = (...ps) => ps.filter(Boolean).join('/');
const dentro = (f, p) => !p || f.pasta === p || f.pasta.startsWith(p + '/');
const nomeLimpo = t => t.replace(/[\\/]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60);
async function carregarFaixas() {
  const r = state.rx; r.carregando = true;
  try {
    const d = await api.faixas(); r.faixas = d.faixas; r.pastas = d.pastas; r.carregou = true;
    if (r.sel && !r.faixas.some(f => f.id === r.sel)) r.sel = null;
    r.extras = r.extras.filter(p => !r.pastas.includes(p)); // pasta criada vazia que já recebeu gravação
  }
  catch (e) { r.msg = e.message; r.err = true; if (e.status === 401) await carregarConta(); }
  r.carregando = false;
  if (state.tab === 'base' && state.b.fonte === 'rec') renderRec();
}
const todasPastas = () => { const r = state.rx; return [...new Set([...r.pastas, ...r.extras])].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true, sensitivity: 'base' })); };
const fxInfo = (f, comPasta) => [comPasta && f.pasta && '📁 ' + f.pasta.split('/').join(' › '), f.tom && 'tom ' + f.tom, f.bpm && f.bpm + ' bpm'].filter(Boolean).join(' · ') || 'sem tom e andamento';
const opcoesPastas = id => `<datalist id="${id}">${todasPastas().map(k => `<option value="${esc(k)}">`).join('')}</datalist>`;
function renderRec() {
  const r = state.rx, a = $('rxAudio');
  const msg = r.msg ? `<p class="${r.err ? 'cerr' : 'cok'}" role="status">${esc(r.msg)}</p>` : '';
  if (!api.temServidor || !conta.usuario) {
    $('rxHead').innerHTML = '<div class="box">' + (!conta.pronto ? '<p>Carregando…</p>' : !api.temServidor
      ? '<p>As gravações ficam guardadas pelo servidor do aplicativo, neste computador. Abra o app pelo atalho <b>Braço e Escalas</b> (ou <b>npm start</b>) para usar.</p>'
      : '<p><b>Minhas gravações:</b> guarde aqui as suas bases (backing tracks) em MP3, M4A ou WAV e toque quando quiser, separadas em pastas.</p><p><button type="button" class="play" id="rxLogin">Entrar na conta</button></p>') + '</div>';
    if ($('rxLogin')) $('rxLogin').onclick = abrirConta;
    $('rxList').innerHTML = ''; $('rxPlayer').hidden = true; return;
  }
  if (!r.carregou && !r.carregando) carregarFaixas();
  const cur = r.pasta, todas = todasPastas();
  if (cur && !todas.includes(cur) && r.carregou) r.pasta = '';
  const q = fold(r.q), busca = !!q;
  const lista = busca ? r.faixas.filter(f => fold(f.nome + ' ' + f.pasta + ' ' + f.tom).includes(q)) : r.faixas.filter(f => f.pasta === r.pasta);
  const subs = busca ? [] : todas.filter(p => paiDe(p) === r.pasta);
  const conta_ = p => r.faixas.filter(f => dentro(f, p)).length;
  const aqui = r.pasta ? r.pasta.split('/').join(' › ') : 'Início (fora das pastas)';
  const caminho = '<nav class="rxpath" aria-label="Pasta atual"><button type="button" data-ir="">Início</button>' +
    (r.pasta ? r.pasta.split('/').map((n, i, arr) => ` › <button type="button" data-ir="${esc(arr.slice(0, i + 1).join('/'))}" ${i === arr.length - 1 ? 'class="on" aria-current="true"' : ''}>${esc(n)}</button>`).join('') : '') + '</nav>';
  let painel = '';
  if (r.enviando) painel = `<div class="box"><p><b>${esc(r.enviando)}</b></p><p class="hint">Arquivos WAV são diminuídos ao guardar; cada um leva alguns segundos.</p><div class="dlg-actions"><button type="button" class="link danger" id="rxStop">Parar de acrescentar</button></div></div>`;
  else if (r.nova) painel = `<div class="box"><p><b>Nova pasta</b> dentro de <b>📁 ${esc(aqui)}</b></p><div class="rxform"><label>Nome da pasta<input id="rxNovaN" maxlength="60" placeholder="Ex.: Blues"></label></div>` +
    '<div class="dlg-actions"><button type="button" class="play" id="rxNovaOk">Criar</button><button type="button" class="link" id="rxNovaNo">Cancelar</button></div></div>';
  else if (r.pastaEd) painel = `<div class="box"><p><b>Mudar o nome da pasta</b></p><div class="rxform"><label>Nome<input id="rxPN" maxlength="60" value="${esc(nomeDe(r.pasta))}"></label>` +
    `<label>Fica dentro de<input id="rxPP" list="rxPastasP" maxlength="200" value="${esc(paiDe(r.pasta))}" placeholder="Início (fora das pastas)"></label></div>${opcoesPastas('rxPastasP')}` +
    '<p class="hint">Deixe "Fica dentro de" vazio para ela ficar no Início.</p><div class="dlg-actions"><button type="button" class="play" id="rxPOk">Guardar</button><button type="button" class="link" id="rxPNo">Cancelar</button></div></div>';
  const delP = r.pastaDel; r.pastaDel = false;
  const acoesPasta = r.pasta && !busca && !painel ? `<p class="rxacts"><button type="button" class="link" id="rxPEd">Mudar o nome ou o lugar desta pasta</button> <button type="button" class="link danger" id="rxPDel">${delP ? `Toque de novo para apagar a pasta e as ${conta_(r.pasta)} gravação(ões) dela` : 'Apagar esta pasta'}</button></p>` : '';
  const vazio = r.carregou && !r.faixas.length && !r.extras.length ? '<p class="hint">Você ainda não guardou nenhuma gravação. Toque em <b>+ Adicionar backing tracks</b> para trazer do pen drive ou do computador.</p>'
    : r.carregou && !busca && !subs.length && !lista.length ? '<p class="hint">Esta pasta está vazia. Toque em <b>+ Adicionar backing tracks</b> para pôr gravações nela.</p>'
    : busca && !lista.length ? '<p class="hint">Nenhuma gravação com essa busca.</p>' : '';
  $('rxHead').innerHTML = `<div class="rxbar"><input id="rxQ" type="search" placeholder="Buscar em todas as pastas: nome, pasta ou tom" value="${esc(r.q)}" autocomplete="off">` +
    `<button type="button" class="play" id="rxAdd" ${r.enviando ? 'disabled' : ''}>+ Adicionar backing tracks</button><button type="button" class="play" id="rxNova" ${r.enviando ? 'disabled' : ''}>+ Nova pasta</button></div>` +
    (busca || r.enviando ? '' : `<p class="hint">Toque em <b>+ Adicionar backing tracks</b> e escolha uma pasta do pen drive ou do computador: vem tudo o que tem dentro, com as pastas do mesmo jeito. Entra em <b>📁 ${esc(aqui)}</b>. ` +
      '<button type="button" class="link" id="rxPick">Prefiro escolher arquivos soltos</button></p>' +
      (!conta.comprime ? '<p class="hint">Aviso: falta o programa que diminui os WAV (ffmpeg); eles serão guardados do tamanho original.</p>' : '')) +
    (busca ? '' : caminho) + painel + msg + acoesPasta + vazio;
  $('rxQ').oninput = e => { r.q = e.target.value; const pos = e.target.selectionStart; renderRec(); $('rxQ').focus(); $('rxQ').setSelectionRange(pos, pos); };
  const fecha = () => { r.nova = r.pastaEd = false; };
  $('rxAdd').onclick = () => { fecha(); r.msg = ''; r.destino = r.pasta; $('rxDir').value = ''; $('rxDir').click(); };
  $('rxNova').onclick = () => { const v = !r.nova; fecha(); r.nova = v; r.msg = ''; renderRec(); if (v) $('rxNovaN').focus(); };
  $('rxHead').querySelectorAll('[data-ir]').forEach(x => x.onclick = () => { r.pasta = x.dataset.ir; fecha(); r.msg = ''; renderRec(); });
  if ($('rxStop')) $('rxStop').onclick = () => { r.parar = true; };
  if ($('rxPick')) $('rxPick').onclick = () => { fecha(); r.msg = ''; r.destino = r.pasta; $('rxFile').value = ''; $('rxFile').click(); };
  if ($('rxNovaNo')) $('rxNovaNo').onclick = () => { r.nova = false; renderRec(); };
  if ($('rxNovaOk')) {
    const criar = () => {
      const n = nomeLimpo($('rxNovaN').value); if (!n) { $('rxNovaN').focus(); return; }
      const p = junta(r.pasta, n);
      if (p.split('/').length > 6) { r.msg = 'Pastas demais, uma dentro da outra (no máximo 6).'; r.err = true; r.nova = false; renderRec(); return; }
      if (!todasPastas().includes(p)) r.extras.push(p);
      r.pasta = p; r.nova = false; r.msg = 'Pasta criada. Agora toque em + Adicionar backing tracks para pôr gravações nela.'; r.err = false; renderRec();
    };
    $('rxNovaOk').onclick = criar; $('rxNovaN').onkeydown = e => { if (e.key === 'Enter') criar(); };
  }
  if ($('rxPEd')) $('rxPEd').onclick = () => { fecha(); r.pastaEd = true; r.msg = ''; renderRec(); $('rxPN').focus(); };
  if ($('rxPNo')) $('rxPNo').onclick = () => { r.pastaEd = false; renderRec(); };
  if ($('rxPOk')) $('rxPOk').onclick = async () => {
    const n = nomeLimpo($('rxPN').value); if (!n) { $('rxPN').focus(); return; }
    const de = r.pasta, para = junta($('rxPP').value.split(/[\\/]+/).map(x => x.trim()).filter(Boolean).join('/'), n);
    try {
      if (r.pastas.some(p => p === de || p.startsWith(de + '/'))) await api.moverPasta(de, para);
      r.extras = r.extras.map(p => p === de || p.startsWith(de + '/') ? para + p.slice(de.length) : p);
      r.pasta = para; r.pastaEd = false; r.msg = 'Pasta guardada.'; r.err = false; await carregarFaixas();
    } catch (e) { r.msg = e.message; r.err = true; renderRec(); }
  };
  if ($('rxPDel')) $('rxPDel').onclick = async () => {
    if (!delP) { r.pastaDel = true; renderRec(); return; }
    const p = r.pasta;
    try {
      const temFaixa = r.faixas.some(f => dentro(f, p));
      if (temFaixa) await api.apagarPasta(p);
      r.extras = r.extras.filter(x => !(x === p || x.startsWith(p + '/')));
      if (r.sel && r.faixas.some(f => f.id === r.sel && dentro(f, p))) r.sel = null;
      r.pasta = paiDe(p); r.msg = 'Pasta apagada.'; r.err = false; await carregarFaixas();
    } catch (e) { r.msg = e.message; r.err = true; renderRec(); }
  };
  $('rxList').innerHTML = subs.map(p => `<button type="button" class="pcard rxfolder" data-p="${esc(p)}"><b>📁 ${esc(nomeDe(p))}</b><span>${conta_(p)} gravação(ões)</span></button>`).join('') +
    lista.map(f => `<button type="button" class="pcard ${f.id === r.sel ? 'active' : ''}" data-id="${f.id}"><b>${esc(f.nome)}</b><span>${esc(fxInfo(f, busca))}</span></button>`).join('');
  $('rxList').querySelectorAll('[data-p]').forEach(x => x.onclick = () => { r.pasta = x.dataset.p; fecha(); r.msg = ''; renderRec(); tabJump = true; $('rxHead').scrollIntoView({ block: 'nearest' }); });
  $('rxList').querySelectorAll('[data-id]').forEach(x => x.onclick = () => {
    const id = +x.dataset.id; if (r.sel !== id) { r.sel = id; r.edit = r.del = false; a.src = api.audioUrl(id); stopBase(); a.play().catch(() => {}); }
    renderRec(); $('rxPlayer').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); tabJump = true;
  });
  const f = r.faixas.find(x => x.id === r.sel);
  $('rxPlayer').hidden = !f;
  if (!f) { if (a.src) { a.pause(); a.removeAttribute('src'); a.load(); } return; }
  a.loop = r.loop; a.playbackRate = r.speed; a.preservesPitch = a.webkitPreservesPitch = true; // mais lento sem mudar o tom
  $('rxInfo').innerHTML = `<p><b class="big">${esc(f.nome)}</b></p><p>${esc(fxInfo(f, true))}</p>`;
  const delArm = r.del; r.del = false;
  $('rxCtl').innerHTML = `<div class="roots preg"><b>Velocidade:</b> ${[[0.5, 'Bem lenta'], [0.75, 'Lenta'], [1, 'Normal'], [1.25, 'Rápida']].map(([v, l]) => `<button type="button" data-sp="${v}" class="${r.speed === v ? 'on' : ''}">${l}</button>`).join('')}</div>` +
    `<div class="roots preg"><b>Repetir:</b> <button type="button" data-lp="1" class="${r.loop ? 'on' : ''}">Sem parar</button><button type="button" data-lp="0" class="${r.loop ? '' : 'on'}">Uma vez</button></div>` +
    '<p class="hint">Mais lenta não muda o tom: bom para estudar um trecho difícil.</p>' +
    (r.edit ? `<div class="rxform"><label>Nome<input id="rxN" maxlength="120" value="${esc(f.nome)}"></label><label>Pasta<input id="rxR" list="rxPastas2" maxlength="200" value="${esc(f.pasta)}" placeholder="Início (fora das pastas)"></label>` +
      `<label>Tom (ex.: A, F#, Em)<input id="rxT" maxlength="4" value="${esc(f.tom)}"></label><label>Andamento (bpm)<input id="rxB" type="number" min="30" max="300" inputmode="numeric" value="${f.bpm || ''}"></label></div>` +
      opcoesPastas('rxPastas2') + '<p class="hint">Para mudar de pasta, escolha uma da lista ou escreva o nome de uma nova (use / para pôr dentro de outra: <i>A maior/Blues</i>).</p>' +
      '<div class="dlg-actions"><button type="button" class="play" id="rxSave">Guardar</button><button type="button" class="link" id="rxEditNo">Cancelar</button></div>'
      : `<p><button type="button" class="link" id="rxEdit">Mudar nome, pasta, tom ou andamento</button> <button type="button" class="link danger" id="rxDel">${delArm ? 'Toque de novo para apagar de vez' : 'Apagar esta gravação'}</button></p>`);
  $('rxCtl').querySelectorAll('[data-sp]').forEach(x => x.onclick = () => { r.speed = +x.dataset.sp; renderRec(); });
  $('rxCtl').querySelectorAll('[data-lp]').forEach(x => x.onclick = () => { r.loop = x.dataset.lp === '1'; renderRec(); });
  if ($('rxEdit')) $('rxEdit').onclick = () => { r.edit = true; renderRec(); };
  if ($('rxEditNo')) $('rxEditNo').onclick = () => { r.edit = false; renderRec(); };
  if ($('rxSave')) $('rxSave').onclick = async () => {
    try { await api.mudarFaixa(f.id, { nome: $('rxN').value, pasta: $('rxR').value, tom: $('rxT').value.trim(), bpm: $('rxB').value }); r.edit = false; r.msg = 'Guardado.'; r.err = false; await carregarFaixas(); }
    catch (e) { r.msg = e.message; r.err = true; renderRec(); }
  };
  if ($('rxDel')) $('rxDel').onclick = async () => {
    if (!delArm) { r.del = true; renderRec(); return; }
    try { await api.apagarFaixa(f.id); r.sel = null; r.msg = 'Gravação apagada.'; r.err = false; await carregarFaixas(); }
    catch (e) { r.msg = e.message; r.err = true; renderRec(); }
  };
}
// arquivos soltos (rxFile) ou uma pasta inteira com as de dentro (rxDir: cada arquivo traz o caminho relativo)
async function acrescentar(lista) {
  const r = state.rx;
  const arqs = [...lista].filter(f => AUDIO_EXT.test(f.name) && !f.name.startsWith('.'));
  if (!arqs.length) { r.msg = 'Não achei nenhum arquivo de áudio (MP3, M4A, WAV…) no que você escolheu.'; r.err = true; renderRec(); return; }
  let ok = 0, rep = 0; const erros = []; r.parar = false;
  for (let i = 0; i < arqs.length && !r.parar; i++) {
    const f = arqs[i], rel = f.webkitRelativePath || '';
    const pasta = junta(r.destino, rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
    if (r.faixas.some(x => x.pasta === pasta && x.origem === f.name && x.original === f.size)) { rep++; continue; }
    r.enviando = `Guardando ${i + 1} de ${arqs.length}: ${f.name}`; r.msg = ''; renderRec();
    try { const x = await api.enviarFaixa(f, pasta); if (x.repetida) rep++; else { ok++; r.faixas.push(x); } }
    catch (err) { erros.push(`${f.name}: ${err.message}`); if (err.status === 0) break; }
  }
  r.enviando = '';
  r.msg = (r.parar ? 'Parado. ' : '') + `${ok} gravação(ões) guardada(s).` + (rep ? ` ${rep} já estava(m) guardada(s).` : '') + (erros.length ? ' Não deu certo: ' + erros.join(' · ') : '');
  r.err = !!erros.length; r.parar = false;
  await carregarFaixas();
}
$('rxFile').onchange = e => acrescentar(e.target.files);
$('rxDir').onchange = e => acrescentar(e.target.files);
$('rxAudio').addEventListener('play', () => stopBase());

/* ---------- ABA ESCALAS ---------- */
const formulaText = name => SCALES[name].map(i => STEP_NAME[i]).join(' · ');

function renderEscalas() {
  $('scale').value = state.scale;
  const notes = scaleNotes(state.root, state.scale);
  const sp = spelledScale(state.root, state.scale, state.sharps), names = nameMap(notes, sp);
  $('title').textContent = `${sp[0]} ${state.scale}  (${ptOf(sp[0])})`;
  $('scaleInfo').innerHTML =
    `<p>Notas: <b>${sp.join(' - ')}</b></p>` +
    `<p>${SCALE_INFO[state.scale]}</p>` +
    `<p>Receita (de uma nota para a próxima): ${formulaText(state.scale)}. Um tom são 2 casas, um semitom é 1 casa.</p>` +
    `<p>${playBtn('playScale', 'Ouvir a escala')}</p>`;
  $('playScale').onclick = () => { let m = 48 + state.root; sequence([m, ...SCALES[state.scale].map(i => (m += i))]); };
  const rk = [state.root, state.scale, state.frets, state.all, state.sharps].join('|');
  if (rk !== state.revealKey) { state.revealKey = rk; state.revealed.clear(); }
  drawBoard($('board'), state.frets, {
    inScale: new Set(notes), names, hl: state.sel ? state.sel.notes : null, rootPc: state.root, all: state.all,
    hide: state.hide, revealed: state.revealed,
    onReveal: state.hide ? k => { if (!state.revealed.has(k)) { state.revealed.add(k); keepScroll(renderEscalas); } } : null });
  $('trainBar').hidden = !state.hide;
  if (state.hide) {
    const total = $('board').querySelectorAll('circle.nt').length, seen = state.revealed.size;
    $('trainBar').innerHTML = `<p><b>Modo treino ligado.</b> Os nomes das notas estão escondidos.</p>` +
      `<ol class="steps-train"><li>Olhe uma bolinha e diga qual nota você acha que é.</li><li>Toque nela: o nome aparece e a nota toca.</li><li>Confira se acertou e passe para a próxima.</li></ol>` +
      `<p><b>${seen ? `Você já revelou ${seen} de ${total} notas.` : `São ${total} notas para descobrir.`}</b> ` +
      `${state.all ? '' : 'Para treinar o braço inteiro, marque "Mostrar todas as notas". '}Para sair, toque em "Mostrar" em Nomes das notas.</p>` +
      (seen ? '<p><button type="button" class="link" id="hideAgain">Esconder de novo (recomeçar)</button></p>' : '');
    if (seen) $('hideAgain').onclick = () => { state.revealed.clear(); keepScroll(renderEscalas); };
  }

  const labels = scaleDegreeLabels(state.root, state.scale, state.sharps);
  if (state.sel && state.sel.scale === state.scale) {
    const i = state.sel.idx;
    $('selInfo').hidden = false;
    $('selInfo').innerHTML = `<p><b>${sp[i]}</b> (${ptOf(sp[i])}) é a ${ORD[i]} nota da escala, o grau ${labels[i]}. ` +
      (i === 0 ? 'É a tônica, a "nota de casa" onde a escala começa e termina.' : 'Aparece em verde no braço, em todas as posições onde ela existe.') + '</p>';
  } else $('selInfo').hidden = true;

  $('scaleCards').innerHTML = Object.keys(SCALES).map(name => {
    const ns = spelledScale(state.root, name, state.sharps), lb = scaleDegreeLabels(state.root, name, state.sharps);
    const cells = ns.map((n, i) => {
      const on = state.sel && state.sel.scale === name && state.sel.idx === i;
      return `<button type="button" class="cell ${on ? 'on' : ''} ${i === 0 ? 'root' : ''}" data-s="${name}" data-i="${i}"><b>${n}</b><small>${lb[i]}</small></button>`;
    }).join('');
    return `<div class="scard ${name === state.scale ? 'active' : ''}"><div class="name">${name}</div><div class="row">${cells}</div></div>`;
  }).join('');
  document.querySelectorAll('#scaleCards .cell').forEach(c => c.onclick = () => {
    const name = c.dataset.s, i = +c.dataset.i;
    const same = state.sel && state.sel.scale === name && state.sel.idx === i;
    state.scale = name;
    state.sel = same ? null : { scale: name, idx: i, notes: [scaleNotes(state.root, name)[i]] };
    if (!same) playNote(48 + state.root + ((state.sel.notes[0] - state.root + 12) % 12));
    render();
  });
}

/* ---------- ABA CAMPOS ---------- */
function renderCampos() {
  const sel = state.fsel;
  // Desenho e Tocar tudo em, como em Progressões
  const fk = state.fkind || 'normal', fr = state.freg || '';
  $('fOpts').innerHTML = '<div class="roots preg"><b>Desenho:</b> ' + [['normal', 'Normal'], ['ten', 'Com tensão (jazz)'], ['pow', 'Power chord (rock)'], ['tri', 'Tríade (3 cordas)']]
      .map(([k, l]) => `<button type="button" data-fk="${k}" class="${k === fk ? 'on' : ''}">${l}</button>`).join('') + '</div>' +
    '<div class="roots preg"><b>Tocar tudo em:</b> ' + [['', 'Normal'], ['1', 'Início (1–4)'], ['2', 'Meio (5–8)'], ['3', 'Agudo (9–12)'], ['4', 'Mais agudo (13+)']]
      .map(([k, l]) => `<button type="button" data-fr="${k}" class="${k === fr ? 'on' : ''}">${l}</button>`).join('') + '</div>' +
    (fk === 'ten' ? '<p class="hint">Com tensão: cada acorde ganha a sétima (vira tétrade, acorde de 4 notas), como no jazz e na bossa (Cmaj7, Dm7, G7…).</p>'
      : fk === 'pow' ? '<p class="hint">Power chord: só a nota base e a quinta, o som forte do rock. Diminutos e aumentados não têm essa quinta, por isso ficam como tríade.</p>'
      : fk === 'tri' ? '<p class="hint">Tríade: o acorde em só 3 cordas, som leve.</p>' : '');
  $('fOpts').querySelectorAll('[data-fk]').forEach(b => b.onclick = () => { state.fkind = b.dataset.fk; renderCampos(); });
  $('fOpts').querySelectorAll('[data-fr]').forEach(b => b.onclick = () => { state.freg = b.dataset.fr; renderCampos(); });
  $('fieldCards').classList.toggle('ten', fk === 'ten'); // nomes longos (Bm7(b5)): 4 por linha para não encavalar
  // o campo escolhido abre embaixo de todos os cartões: os 7 acordes lado a lado, com o desenho de cada um
  const sname = sel && sel.scale;
  $('fieldCards').innerHTML = Object.keys(SCALES).map(name => {
    const f = fieldOf(name);
    if (!f) return '';
    const cells = f.map((c, i) => {
      const on = sel && sel.scale === name && sel.idx === i;
      return `<button type="button" class="cell ${on ? 'on' : ''} ${i === 0 ? 'root' : ''}" data-i="${i}" data-s="${name}" title="${c.chord} (${c.roman})"><b>${c.chord}</b><small>${c.roman}</small></button>`;
    }).join('');
    const card = `<div class="scard${name === sname ? ' active' : ''}"><div class="name">${f[0].rn || f[0].chord.replace(/[m°]$/, '')} ${name}</div><div class="row">${cells}</div></div>`;
    return card;
  }).join('') + (sel ? fieldRow(fieldOf(sname), sel.idx, sname) : ''); // os cartões todos em cima; o detalhe abre embaixo deles
  document.querySelectorAll('#fieldCards .cell').forEach(c => c.onclick = () => pickField(c.dataset.s, +c.dataset.i, true));
  $('fpanel').hidden = true;
  document.body.classList.remove('sheet-open');
  if (sel) bindFrow();
}
// tocar num acorde do campo: na mesma escala só troca o quadro de baixo (a tela não se mexe)
function pickField(name, i, fromCell) {
  const sel = state.fsel, same = sel && sel.scale === name && sel.idx === i && fromCell;
  state.fsel = same ? null : { scale: name, idx: i }; state.fshape = null;
  if (!same) { const f = fieldOf(name)[i]; strumV(fieldShapes(f)[0] || bestVoicing(f.notes[0], f.type)); }
  tabJump = true;
  if (!same && sel && sel.scale === name && $('frow')) {
    // o que foi tocado fica no mesmo lugar da tela (a fila de desenhos ou o cartão da escala)
    const anchor = () => fromCell ? document.querySelector(`#fieldCards .cell[data-s="${CSS.escape(name)}"]`) : $('frow').querySelector('.pseq');
    const before = anchor().getBoundingClientRect().top;
    $('frow').outerHTML = fieldRow(fieldOf(name), i, name);
    document.querySelectorAll(`#fieldCards .cell[data-s="${CSS.escape(name)}"]`).forEach(b => b.classList.toggle('on', +b.dataset.i === i));
    bindFrow();
    scrollBy(0, anchor().getBoundingClientRect().top - before);
    return;
  }
  campoHold(name);
}
function bindFrow() {
  const sel = state.fsel, f = fieldOf(sel.scale), c = f[sel.idx];
  $('frow').querySelectorAll('.pc').forEach(b => b.onclick = () => pickField(sel.scale, +b.dataset.i, false));
  $('fPlay').onclick = () => strumV(fieldShapes(c)[0] || bestVoicing(c.notes[0], c.type));
  $('fMore').onclick = () => goChord(c.notes[0], c.type);
  $('fClose').onclick = () => { const n = sel.scale; state.fsel = null; campoHold(n); };
  const sh = fieldShapes(c);
  if ($('fMoreShapes')) $('fMoreShapes').onclick = () => { state.fmore = !state.fmore; state.fshape = null; campoHold(sel.scale); };
  // braço inteiro do acorde escolhido; tocar numa forma acima mostra só ela (sem redesenhar a tela, para não pular)
  const t = CHORD_TYPES[c.type], rn = c.rn || c.chord.replace(/[m°+]$/, ''), names = nameMap(c.notes, spellChordFromRoot(rn, t.iv, t.letters));
  const vcs = [...$('frow').querySelectorAll('.vc')];
  const paint = () => {
    const v = state.fshape != null && sh[state.fshape];
    vcs.forEach((b, k) => b.classList.toggle('on', k === state.fshape));
    drawBoard($('fboard'), 24, { inScale: new Set(c.notes), names, rootPc: c.notes[0], all: false, exact: v ? v.frets : null, oneRow: true });
  };
  vcs.forEach(b => b.onclick = () => { state.fshape = state.fshape === +b.dataset.i ? null : +b.dataset.i; strum(sh[+b.dataset.i].frets); paint(); });
  paint();
}
// redesenha Campos sem a tela pular: o cartão da escala tocada fica no mesmo lugar da tela
const campoHold = name => {
  const q = () => document.querySelector(`#fieldCards .cell[data-s="${CSS.escape(name)}"]`);
  const before = q() ? q().getBoundingClientRect().top : null;
  renderCampos();
  const after = q() ? q().getBoundingClientRect().top : null;
  tabJump = true;
  if (before !== null && after !== null) scrollBy(0, after - before);
};
function fieldRow(f, idx, name) {
  const chords = f.map(c => {
    const t = CHORD_TYPES[c.type], rn = c.rn || c.chord.replace(/[m°+]$/, '');
    return { name: c.chord, roman: c.roman, rootPc: c.notes[0], pcs: c.notes, names: spellChordFromRoot(rn, t.iv, t.letters), v: fieldShapes(c)[0] || bestVoicing(c.notes[0], c.type) };
  });
  return `<div class="fpanel frow" id="frow">${fieldDetail(f[idx], (f[0].rn || f[0].chord.replace(/[m°]$/, '')) + ' ' + name)}` +
    `<h3>Os 7 acordes do campo</h3>${seqCards(chords, idx)}` +
    `<h3>${f[idx].chord} no braço inteiro (casas 1 a 24)</h3><div class="board-wrap fboard"><div id="fboard"></div></div></div>`;
}
// as formas mais fáceis de um acorde do campo (até 4)
// as formas de um acorde do campo, conforme o Desenho e a parte do braço escolhidos (até 4)
const fieldShapes = f => {
  const r = f.notes[0], k = state.fkind || 'normal';
  // braço inteiro (até a casa 24): a mais fácil primeiro, depois uma de cada região, subindo
  let list = k === 'pow' && powOk(f.type) ? powerChords(r) : k === 'pow' ? triadsOf(r, CHORD_TYPES[f.type].iv) : k === 'tri' ? triadsOf(r, CHORD_TYPES[f.type].iv) : allPositions(r, f.type, CHORD_TYPES[f.type].iv);
  if (state.freg) list = filterVoicings(list, { region: state.freg, open: 'any', barre: 'any', bass: 'any', min: 0 });
  else if (k === 'normal' || k === 'ten') { const easy = voicingsOf(r, f.type).find(v => v.bassIsRoot); list = [easy, ...list.filter(v => v !== easy && (!easy || v.frets.join() !== easy.frets.join())).sort((a, b) => a.minF - b.minF)].filter(Boolean); }
  const out = list.slice(0, state.fmore ? 24 : 8); out.total = list.length; return out;
};
const fieldOf = name => (state.fkind === 'ten' ? harmonicField7 : harmonicField)(state.root, name, state.sharps);
function fieldDetail(f, where) {
  const t = CHORD_TYPES[f.type], rootName = f.rn || f.chord.replace(/[m°+]$/, '');
  const cn = spellChordFromRoot(rootName, t.iv, t.letters), names = nameMap(f.notes, cn); // mesma grafia do campo (Bb em F maior)
  const shapes = fieldShapes(f);
  const more = shapes.total > 8 ? `<p class="morebtns"><span class="hint">${shapes.length} de ${shapes.total} formas</span><button type="button" class="link" id="fMoreShapes">${state.fmore ? 'Ver menos' : 'Ver mais formas'}</button></p>` : '';
  const none = !shapes.length ? '<p class="hint">Nenhuma forma deste acorde nessa parte do braço. Escolha outra em <b>Tocar tudo em</b>.</p>' : '';
  return `<button type="button" class="close" id="fClose" aria-label="Fechar">✕</button>
    <p><b class="big">${f.chord}</b> — ${ptOf(rootName)}, ${t.label.toLowerCase()} · grau <b>${f.roman}</b> de ${where}</p>
    <p>Notas: <b>${cn.join(' - ')}</b></p>
    <p>${playBtn('fPlay', 'Ouvir')} <button type="button" class="link" id="fMore">Ver todas as formas e o braço inteiro →</button></p>
    <div class="shapes">${shapes.map((v, i) => `<button type="button" class="vc" data-i="${i}">${chordSvg(v, f.notes[0], names)}<small>${v.minF > 0 ? 'Casa ' + v.minF : 'Posição aberta'}</small></button>`).join('')}</div>${more}${none}`;
}
function clearChordFilters() {
  state.cf = { region: 'all', open: 'any', barre: 'any', bass: 'root', min: 4 };
  [['region', 'all'], ['copen', 'any'], ['cbarre', 'any'], ['cbass', 'root'], ['cmin', '4']].forEach(([id, v]) => setSeg(id, v));
  refreshDropdowns();
}
function goChord(pc, type) {
  state.croot = pc; state.ctype = type; state.cvoice = null; clearChordFilters();
  fillChordSelects(); setTab('acordes');
}

/* ---------- ABA ACORDES ---------- */
const memo = {};
const voicingsOf = (rootPc, type) => memo[rootPc + ':' + type] || (memo[rootPc + ':' + type] = generateVoicings(rootPc, CHORD_TYPES[type].iv));
const bestVoicing = (rootPc, type) => type === '5' ? powerChords(rootPc)[0]
  : (voicingsOf(rootPc, type).find(v => v.bassIsRoot) || voicingsOf(rootPc, type)[0]);
const strumV = v => { if (v) strum(v.frets); };
const playBtn = (id, text) => `<button type="button" class="play" id="${id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg><span>${text}</span></button>`;
const SHOW_STEP = 40;
function renderAcordes() {
  const t = CHORD_TYPES[state.ctype], rootPc = state.croot;
  const all = voicingsOf(rootPc, state.ctype);
  const filtered = filterVoicings(all, state.cf), cKey = rootPc + ':' + state.ctype + ':' + JSON.stringify(state.cf);
  if (state.cKey !== cKey) { state.cKey = cKey; state.cLimit = SHOW_STEP; }
  const list = filtered.slice(0, state.cLimit);
  const pcs = t.iv.map(i => (rootPc + i) % 12);
  const cn = spelledChord(rootPc, t.iv, state.sharps, t.letters), names = nameMap(pcs, cn);
  const cg = hasCaged(state.ctype), caged = cg ? cagedShapes(rootPc, state.ctype) : [];

  $('chordRoots').innerHTML = Array.from({ length: 12 }, (_, i) =>
    `<button type="button" data-p="${i}" class="${i === rootPc ? 'on' : ''}">${dual(i)}</button>`).join('');
  document.querySelectorAll('#chordRoots button').forEach(b => b.onclick = () => { state.croot = +b.dataset.p; state.cvoice = null; renderAcordes(); });

  const count = !filtered.length
    ? 'Nenhuma forma com esses filtros. O acorde existe: os filtros é que estão apertados demais.'
    : filtered.length > list.length
      ? `Mostrando as ${list.length} formas mais fáceis (de ${filtered.length} encontradas). Toque numa para ver os detalhes.`
      : `${filtered.length} forma${filtered.length === 1 ? '' : 's'} de tocar, das mais fáceis para as mais difíceis. Toque numa para ver os detalhes.`;
  $('chordInfo').innerHTML =
    `<p><b>${cn[0]}${t.suffix}</b> — ${ptOf(cn[0])} ${t.label.toLowerCase()}</p>` +
    `<p>Notas do acorde: <b>${cn.join(' - ')}</b></p><p>${t.desc}</p><p>${count}</p>` +
    (filtered.length ? '' : '<p><button type="button" class="link" id="clearCf">Limpar os filtros e ver as formas</button></p>') +
    `<p>${playBtn('playChord', 'Ouvir o acorde')}</p>`;
  if ($('clearCf')) $('clearCf').onclick = () => { clearChordFilters(); state.cvoice = null; renderAcordes(); };

  const card = (v, id, head, foot) =>
    `<button type="button" class="vc ${state.cvoice === id ? 'active' : ''}" data-id="${id}">${head}${chordSvg(v, rootPc, names)}<small>${foot}</small>` +
    (v.barre ? '<span class="tag">pestana</span>' : '') + (v.hasOpen ? '<span class="tag">cordas soltas</span>' : '') + '</button>';
  const where = v => v.minF > 0 ? 'Casa ' + v.minF : 'Posição aberta';

  const moreHtml = (filtered.length > list.length ? '<button type="button" class="link cMoreB">Ver mais formas</button> ' : '') +
    (state.cLimit > SHOW_STEP ? '<button type="button" class="link cLessB">Ver menos</button>' : '');
  $('cMore').innerHTML = $('cMoreTop').innerHTML = moreHtml;
  document.querySelectorAll('.cMoreB').forEach(b => b.onclick = () => { state.cLimit += SHOW_STEP; renderAcordes(); });
  document.querySelectorAll('.cLessB').forEach(b => b.onclick = () => { state.cLimit = SHOW_STEP; if (state.cvoice && +state.cvoice.slice(1) >= SHOW_STEP && state.cvoice[0] === 'v') state.cvoice = null; renderAcordes(); $('voicings').scrollTop = 0; $('voicings').scrollIntoView(); tabJump = true; });
  $('cagedWrap').hidden = !cg;
  $('caged').innerHTML = caged.map((v, i) => card(v, 'c' + i, `<b class="shape">Forma de ${v.shape}</b>`, where(v))).join('');
  $('voicings').innerHTML = list.map((v, i) =>
    card(v, 'v' + i, '', `${where(v)} · ${v.fingers} dedo${v.fingers === 1 ? '' : 's'}`)).join('');
  document.querySelectorAll('#caged .vc, #voicings .vc').forEach(c => c.onclick = () => {
    const id = c.dataset.id; state.cvoice = state.cvoice === id ? null : id;
    if (state.cvoice) strum((id[0] === 'c' ? caged : list)[+id.slice(1)].frets);
    renderAcordes();
  });

  const id = state.cvoice;
  const v = !id ? null : id[0] === 'c' ? caged[+id.slice(1)] : list[+id.slice(1)];
  $('playChord').onclick = () => { strumV(v || caged[0] || list[0] || bestVoicing(rootPc, state.ctype)); };
  $('voiceInfo').hidden = $('board2wrap').hidden = false;
  if (v) {
    $('voiceInfo').innerHTML = `<p><b>Como tocar${v.shape ? ` (forma de ${v.shape})` : ''}:</b></p><ol class="str">` + v.frets.map((f, s) =>
      `<li>${STRING_NAMES[s]}: ${f < 0 ? 'não tocar' : f === 0 ? `solta (${names.get(noteAt(s, 0))})` : `casa ${f} (${names.get(noteAt(s, f))})`}</li>`).join('') + '</ol>' +
      (v.barre ? `<p>Use a pestana na casa ${v.minF} (um dedo apoiado sobre várias cordas).</p>` : '') +
      '<p>No braço abaixo aparece só esta forma. Toque nela de novo para ver todas as posições.</p>';
  } else $('voiceInfo').innerHTML = '<p>Abaixo: todas as posições das notas deste acorde no braço. Toque numa forma acima para ver só ela.</p>';
  drawBoard($('board2'), v ? (v.maxF > 12 ? 24 : 12) : state.frets2, { inScale: new Set(pcs), names, rootPc, all: false, exact: v ? v.frets : null });
}
function fillChordSelects() {
  // Guitarra, acordes com tensão: todos os tipos de 4 notas ou mais (e os suspensos/add9)
  if (!$('gext').options.length) CHORD_ORDER.filter(k => !['maior', 'menor', '5', 'dim', 'aug', 'sus2'].includes(k)).forEach(k => $('gext').add(new Option(CHORD_TYPES[k].suffix + ' — ' + CHORD_TYPES[k].label.replace(/ \(.*\)$/, ''), k)));
  $('gext').value = state.g.ext;
  if (!$('ctype').options.length) CHORD_ORDER.filter(k => k !== '5').forEach(k => $('ctype').add(new Option(CHORD_TYPES[k].label, k)));
  $('ctype').value = state.ctype;
}

/* ---------- geral ---------- */
function fillRoots() {
  const r = $('root'); r.innerHTML = '';
  for (let i = 0; i < 12; i++) r.add(new Option(dual(i), i));
  r.value = state.root; fillChordSelects(); refreshDropdowns();
}
function render() {
  try { renderTab(); $('tab-' + state.tab).querySelector('.err')?.remove(); } catch (err) {
    console.error(err);
    const sec = $('tab-' + state.tab);
    if (sec && !sec.querySelector('.err')) sec.insertAdjacentHTML('afterbegin', '<div class="box err">Algo deu errado. Recarregue a página.</div>');
  }
}
function renderTab() {
  queueMicrotask(refreshDropdowns);
  if (state.tab === 'escalas') renderEscalas();
  else if (state.tab === 'campos') renderCampos();
  else if (state.tab === 'acordes') renderAcordes();
  else if (state.tab === 'guitarra') renderGuitarra();
  else if (state.tab === 'progressoes') renderProgressoes();
  else if (state.tab === 'base') renderBase();
}
const TAB_INFO = {
  escalas: ['Escalas', 'As notas de cada escala desenhadas no braço'],
  campos: ['Campo harmônico', 'Os acordes que combinam em cada escala', 'Campos'],
  acordes: ['Acordes', 'Como montar qualquer acorde, com filtros e o sistema CAGED'],
  guitarra: ['Guitarra', 'Power chords, tríades e acordes de guitarrista nas 24 casas'],
  progressoes: ['Progressões', 'Sequências de acordes prontas ou montadas por você, em qualquer tom'],
  base: ['Base', 'Acompanhamento em ciclo para ouvir ou tocar junto, em qualquer tom'],
  aprender: ['Aprender', 'Guia do aplicativo e explicações simples de música'],
};
function setTab(t) {
  tabJump = true;
  stopProg(); stopBase(); pararGravacao();
  document.body.classList.remove('sheet-open');
  if (!TAB_INFO[t]) t = 'escalas';
  const [title, sub, short] = TAB_INFO[t];
  $('pageTitle').textContent = short && innerWidth <= 760 ? short : title; $('pageSub').textContent = sub;
  document.title = `${title} · Braço e Escalas`;
  try { history.replaceState(null, '', '#' + t); } catch {}
  state.tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  Object.keys(TAB_INFO).forEach(x => $('tab-' + x).hidden = x !== t);
  $('root').closest('.bar').hidden = t !== 'escalas' && t !== 'campos';
  render(); window.scrollTo(0, 0);
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
$('root').onchange = e => { state.root = +e.target.value; state.sel = null; state.fsel = null; render(); };
$('sharps').onchange = e => { state.sharps = e.target.checked; fillRoots(); render(); };
$('frets').onchange = e => { state.frets = +e.target.value; render(); };
$('all').onchange = e => { state.all = e.target.checked; render(); };
$('hide').onchange = e => { state.hide = e.target.value === '1'; state.revealed.clear(); render(); };
$('frets2').onchange = e => { state.frets2 = +e.target.value; render(); };
$('ctype').onchange = e => { state.ctype = e.target.value; state.cvoice = null; render(); };
[['gkind', 'kind'], ['gtri', 'tri'], ['gset', 'set'], ['gext', 'ext'], ['glabels', 'labels']].forEach(([id, k]) =>
  $(id).onchange = e => { state.g[k] = e.target.value; state.g.pos = null; state.g.limit = 0; render(); });
[['pmode', 'mode'], ['plabels', 'labels']].forEach(([id, k]) =>
  $(id).onchange = e => { state.p[k] = e.target.value; if (k === 'mode' && state.p.src === 'ready') { state.p.idx = 0; state.p.step = 0; } state.p.pos = null; render(); });
[['region', 'region'], ['copen', 'open'], ['cbarre', 'barre'], ['cbass', 'bass'], ['cmin', 'min']].forEach(([id, k]) =>
  $(id).onchange = e => { state.cf[k] = k === 'min' ? +e.target.value : e.target.value; state.cvoice = null; render(); });

// som ligado / desligado
const applySound = () => {
  const on = soundOn();
  $('soundBtn').classList.toggle('muted', !on);
  $('soundBtn').setAttribute('aria-label', on ? 'Desligar o som' : 'Ligar o som');
  $('soundBtn').title = on ? 'Som ligado (toque para desligar)' : 'Som desligado (toque para ligar)';
};
$('soundBtn').onclick = () => { setSound(!soundOn()); stopProg(); stopBase(); applySound(); if (soundOn()) playNote(57); };
applySound();

// tema claro / escuro
const applyTheme = th => {
  document.documentElement.dataset.theme = th;
  document.querySelector('meta[name=theme-color]').content = th === 'light' ? '#ffffff' : '#14213d';
  $('themeBtn').setAttribute('aria-label', th === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro');
  try { localStorage.setItem('theme', th); } catch {}
};
$('themeBtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

// tamanho da letra
let fs = 1;
try { fs = +localStorage.getItem('fs') || 1; } catch {}
const applyFs = () => { document.documentElement.style.setProperty('--fs', fs); try { localStorage.setItem('fs', fs); } catch {} };
$('fplus').onclick = () => { fs = Math.min(1.6, +(fs + 0.15).toFixed(2)); applyFs(); };
$('fminus').onclick = () => { fs = Math.max(0.85, +(fs - 0.15).toFixed(2)); applyFs(); };
applyFs();

let lastPer = 0;
const observe = (fn, target) => window.ResizeObserver ? new ResizeObserver(fn).observe(target) : (addEventListener('resize', fn), setTimeout(fn));
observe(() => {
  const id = { escalas: 'board', acordes: 'board2', progressoes: 'board3', guitarra: 'board4' }[state.tab];
  const host = id && $(id);
  if (!host || !host.clientWidth) return;
  const p = perRowFor(host.clientWidth);
  if (p !== lastPer) { lastPer = p; render(); }
}, document.body);

// filtros curtos viram botões (tudo do mesmo tamanho, sem lista abrindo no meio da tela)
function segmentize(id) {
  const sel = $(id); sel.classList.add('segd');
  const box = document.createElement('div'); box.className = 'seg'; sel.after(box);
  [...sel.options].forEach(o => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = o.text; b.dataset.v = o.value;
    b.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('change')); sync(); };
    box.appendChild(b);
  });
  const sync = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === sel.value));
  sync();
}
['hide', 'frets', 'frets2', 'region', 'copen', 'cbarre', 'cbass', 'cmin', 'gkind', 'gtri', 'gset', 'glabels', 'pmode', 'plabels'].forEach(segmentize);

// listas longas: menu próprio no lugar da lista nativa do navegador
const dropdowns = [];
function dropdown(id, cols = 1) {
  const sel = $(id); sel.classList.add('segd');
  const box = document.createElement('div'); box.className = 'dd';
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dd-btn';
  btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('div'); menu.className = 'dd-menu'; menu.hidden = true; menu.setAttribute('role', 'listbox');
  menu.style.setProperty('--cols', cols);
  box.append(btn, menu); sel.after(box);
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const open = () => {
    dropdowns.forEach(d => d.close());
    refresh(); menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    menu.querySelector('.on')?.focus();
  };
  const refresh = () => {
    const cur = sel.options[sel.selectedIndex];
    btn.innerHTML = `<span>${cur ? cur.text : ''}</span>`;
    menu.innerHTML = '';
    [...sel.options].forEach(o => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o.text;
      b.setAttribute('role', 'option');
      if (o.value === sel.value) { b.className = 'on'; b.setAttribute('aria-selected', 'true'); }
      b.onclick = () => { sel.value = o.value; close(); sel.dispatchEvent(new Event('change')); refresh(); btn.focus(); };
      menu.appendChild(b);
    });
  };
  btn.onclick = e => { e.stopPropagation(); menu.hidden ? open() : close(); };
  menu.onclick = e => e.stopPropagation();
  menu.onkeydown = e => {
    const items = [...menu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { close(); btn.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); items[Math.max(i - 1, 0)]?.focus(); }
  };
  dropdowns.push({ close, refresh }); refresh();
}
function refreshDropdowns() { dropdowns.forEach(d => d.refresh()); }
document.addEventListener('click', () => dropdowns.forEach(d => d.close()));
document.addEventListener('keydown', e => { if (e.key === 'Escape') dropdowns.forEach(d => d.close()); });
// a lista de escalas é preenchida na primeira renderização
if (!$('scale').options.length) Object.keys(SCALES).forEach(n => $('scale').add(new Option(n, n)));
$('scale').onchange = e => { state.scale = e.target.value; state.sel = null; render(); };
fillChordSelects();
dropdown('root', 3); dropdown('scale'); dropdown('ctype'); dropdown('gext');

observe(() => document.documentElement.style.setProperty('--head-h', $('head').offsetHeight + 'px'), $('head'));
window.addEventListener('scroll', () => $('head').classList.toggle('stuck', scrollY > 4), { passive: true });

// mantém a tela parada: redesenhar não pode fazer a página pular
const keepScroll = fn => { const y = scrollY; fn(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); };
document.addEventListener('click', e => {
  tabJump = false;
  if (e.target.closest && e.target.closest('#tabs')) return;
  const y = scrollY;
  requestAnimationFrame(() => { if (!tabJump && Math.abs(scrollY - y) > 1) scrollTo(0, y); });
}, true);
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t && t !== state.tab) setTab(t); });

// guia: ícones das telas e botões "Abrir a tela"
const TOP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>';
document.querySelectorAll('.gi').forEach(s => {
  const src = s.dataset.icon === 'tuner' ? $('tunerBtn').querySelector('svg') : document.querySelector(`#tabs [data-tab="${s.dataset.icon}"] svg`);
  s.innerHTML = src ? src.outerHTML : TOP_ICON;
});
document.querySelectorAll('.go-tab').forEach(b => b.onclick = () => setTab(b.dataset.go));

// pesquisa no Aprender (sem diferença de acento e maiúscula)
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function searchLearn(q) {
  const words = norm(q).split(/\s+/).filter(w => w.length > 1);
  const items = [...document.querySelectorAll('#tab-aprender details')];
  let n = 0;
  items.forEach(d => {
    if (!d.dataset.open0) d.dataset.open0 = d.open ? '1' : '0';
    const hit = !words.length || words.every(w => norm(d.textContent).includes(w));
    d.hidden = !hit;
    if (words.length) { d.open = hit; if (hit) n++; } else d.open = d.dataset.open0 === '1';
  });
  document.querySelectorAll('#tab-aprender h2.sec, #tab-aprender > .box:not(.search)').forEach(e => e.hidden = !!words.length);
  $('learnClear').hidden = !q;
  $('learnCount').hidden = !words.length;
  $('learnCount').textContent = n ? `${n} assunto${n > 1 ? 's' : ''} encontrado${n > 1 ? 's' : ''} sobre "${q.trim()}".`
    : `Nada encontrado sobre "${q.trim()}". Tente outra palavra, como "acorde", "escala" ou "som".`;
}
$('learnSearch').oninput = e => searchLearn(e.target.value);
$('learnClear').onclick = () => { $('learnSearch').value = ''; searchLearn(''); $('learnSearch').focus(); };

// popup de ajuda
const dlg = $('helpDlg');
const openHelp = () => { $('helpInput').value = ''; dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); setTimeout(() => $('helpInput').focus(), 50); };
const closeHelp = () => (dlg.close ? dlg.close() : dlg.removeAttribute('open'));
$('helpBtn').onclick = openHelp;
$('helpClose').onclick = closeHelp;
dlg.addEventListener('click', e => { if (e.target === dlg) closeHelp(); }); // tocar fora fecha
$('helpForm').onsubmit = e => {
  e.preventDefault();
  const q = $('helpInput').value;
  closeHelp(); setTab('aprender');
  $('learnSearch').value = q; searchLearn(q);
};
$('helpGuide').onclick = () => { closeHelp(); setTab('aprender'); $('learnSearch').value = ''; searchLearn(''); };
// na primeira vez, o popup aparece sozinho para mostrar que a ajuda existe
try { if (!localStorage.getItem('helpSeen')) { localStorage.setItem('helpSeen', '1'); setTimeout(openHelp, 600); } } catch {}

// afinador
const tdlg = $('tunerDlg');
const tn = { target: -1, hist: [], last: 0, idle: null };
const MIC_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function tnShow(note, status, key, c) {
  $('tnNote').innerHTML = note;
  $('tnStatus').textContent = status;
  tdlg.dataset.state = key || '';
  const n = $('tnNeedle');
  n.hidden = c == null;
  if (c != null) n.style.left = 50 + Math.max(-50, Math.min(50, c)) + '%';
}
function tnIdle() {
  if (!micOn()) tnShow('—', 'Ligue o microfone e toque uma corda solta. Sem microfone, use os botões das cordas para afinar de ouvido.');
  else tnShow('—', tn.target < 0 ? 'Ouvindo… toque uma corda solta, sem apertar casa.' : `Ouvindo… toque a ${TSTR[tn.target].n}ª corda solta.`);
}
function tnMicBtn() {
  $('micBtn').innerHTML = MIC_ON + (micOn() ? ' Desligar o microfone' : ' Ligar o microfone');
  $('micBtn').classList.toggle('stop', micOn());
}
function tnFrame(r) {
  if (!r) {
    if (tn.last && Date.now() - tn.last > 1500) { tn.last = 0; tn.hist = []; tnIdle(); }
    return;
  }
  tn.last = Date.now();
  tn.hist.push(r.freq); if (tn.hist.length > 5) tn.hist.shift();
  const f = [...tn.hist].sort((a, b) => a - b)[tn.hist.length >> 1]; // mediana: ignora leituras soltas
  const i = tn.target < 0 ? nearestString(f).i : tn.target;
  const c = centsToString(f, i), st = tuneStatus(c), s = TSTR[i];
  tnShow(`<b>${s.n}ª corda</b> — ${s.name} (${s.letter})`, st.text, st.key, st.key === 'far' ? null : c);
}
async function tnToggleMic() {
  if (tn.asking) return; // já está pedindo o microfone
  if (micOn()) { stopMic(); tnMicBtn(); tnIdle(); return; }
  tn.asking = true;
  tnShow('—', 'Pedindo o microfone… se aparecer uma pergunta do navegador, toque em Permitir.');
  try {
    await startMic(tnFrame, () => { tnMicBtn(); tnShow('—', 'O microfone foi desligado pelo aparelho. Toque em Ligar o microfone de novo.', 'err'); });
    tn.asking = false;
    if (!tdlg.open) { stopMic(); return; } // fechou o afinador enquanto pedia permissão
    tnMicBtn(); tnIdle();
  }
  catch (e) {
    tn.asking = false;
    tnMicBtn();
    const msg = e && e.name === 'NotAllowedError'
      ? 'O navegador não deixou usar o microfone. Clique no cadeado ao lado do endereço do site e permita o microfone, ou afine de ouvido com os botões das cordas.'
      : e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError')
        ? 'Não encontrei microfone neste aparelho. Afine de ouvido: toque no botão da corda, ouça o som e iguale no violão.'
        : 'Não foi possível usar o microfone aqui. Afine de ouvido com os botões das cordas.';
    tnShow('—', msg, 'err');
  }
}
function tnStrings() {
  const box = $('tnStrings'); box.innerHTML = '';
  [{ i: -1, label: 'Automático' }, ...TSTR.map((s, i) => ({ i, label: `<b>${s.n}ª</b> ${s.name} (${s.letter})` }))].forEach(o => {
    const b = document.createElement('button');
    b.type = 'button'; b.innerHTML = o.label; b.className = o.i === tn.target ? 'on' : '';
    b.setAttribute('aria-pressed', o.i === tn.target);
    b.onclick = () => {
      tn.target = o.i; tn.hist = []; tnStrings();
      if (o.i >= 0) playNote(TSTR[o.i].midi, 0, 0.6, true); // som de referência toca mesmo com o som desligado
      if (!tn.last) tnIdle();
    };
    box.appendChild(b);
  });
}
const openTuner = () => { tnMicBtn(); tnStrings(); tnIdle(); tdlg.showModal ? tdlg.showModal() : tdlg.setAttribute('open', ''); };
const closeTuner = () => (tdlg.close ? tdlg.close() : tdlg.removeAttribute('open'));
tdlg.addEventListener('close', () => { stopMic(); tn.last = 0; tn.hist = []; }); // fechar desliga o microfone
tdlg.addEventListener('click', e => { if (e.target === tdlg) closeTuner(); });
$('tunerBtn').onclick = openTuner;
$('tunerClose').onclick = closeTuner;
$('micBtn').onclick = tnToggleMic;
document.querySelectorAll('[data-open-tuner]').forEach(b => b.onclick = openTuner);

const CHORD_LEGEND = '<b>Como ler os desenhos:</b> as linhas em pé são as cordas (a mais grossa à esquerda) e as deitadas são as casas. <span class="lg"><i class="lx">×</i> não tocar a corda</span> <span class="lg"><i class="lo"></i> tocar a corda solta</span> <span class="lg"><i class="ld or"></i> nota principal</span> <span class="lg"><i class="ld bl"></i> outras notas</span> <span class="lg"><i class="lb"></i> pestana</span> <span class="lg"><i class="ln">5ª</i> casa onde o desenho começa</span> <span class="lg">Toque num desenho para ouvir e ver no braço.</span>';
document.querySelectorAll('[data-chord-legend]').forEach(el => { el.innerHTML = CHORD_LEGEND; });

fillRoots();
setTab(location.hash.slice(1) || 'escalas');
carregarConta();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
