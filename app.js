import { SHARP, FLAT, SCALES, CHORD_TYPES, SCALE_INFO, STEP_NAME, TUNING, noteName, noteAt, ptName, ptOf, spelledScale, spelledChord, nameMap, intervalNames, scaleDegreeLabels, spellChordFromRoot, PROGRESSIONS, progressionChords, customChords, itemsFromChords,
  scaleNotes, harmonicField, degreeLabels } from './music.js';
import { midiAt, playNote, strum, sequence, schedule, stopAll, soundOn, setSound } from './audio.js';
import { STRINGS as TSTR, nearestString, centsToString, tuneStatus, startMic, stopMic, micOn } from './tuner.js';
import { generateVoicings, filterVoicings, cagedShapes, hasCaged, neckPositions, findVoicing, powerChords, stringSetTriads } from './chords.js';

const $ = id => document.getElementById(id);
const state = {
  tab: 'escalas', fsel: null, hide: false, revealed: new Set(), revealKey: '', root: 5, scale: 'Maior', frets: 12, sharps: true, all: false, sel: null,
  frets2: 24, croot: 0, ctype: 'maior', cvoice: null,
  cf: { region: 'all', open: 'any', barre: 'any', bass: 'root', min: 4 },
  g: { root: 4, kind: 'pow', tri: 'maior', set: '5,4,3', ext: '7', pos: null, labels: 'notes' },
  p: { key: 0, mode: 'maior', idx: 0, step: 0, pos: null, labels: 'notes', playing: false, src: 'ready', mine: 0, ed: null },
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
    el('line', { x1: from === 1 ? LEFT - 30 : LEFT, x2: LEFT + n * FW, y1: y, y2: y, stroke: 'var(--string)', 'stroke-width': 1 + s * 0.4 }, svg);
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
  const perRow = perRowFor(host.clientWidth, frets);
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
  rootButtons($('gRoots'), g.root, p => { g.root = p; g.pos = null; renderGuitarra(); });
  $('gInfo').innerHTML = `<p><b>${cn[0]}${t.suffix}</b> — ${ptOf(cn[0])}, ${t.label.toLowerCase()}</p>` +
    `<p>Notas: <b>${cn.join(' - ')}</b> &nbsp;(${intervalNames(t).join(' - ')})</p><p>${G_INFO[g.kind] || t.desc}</p>` +
    `<p>${list.length} formas pelo braço, da casa mais baixa para a mais alta.</p><p>${playBtn('gPlay', 'Ouvir')}</p>`;
  positionCards($('gPositions'), list, g.root, shown, g.pos, i => { g.pos = i; renderGuitarra(); });
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
const saveMine = () => { try { localStorage.setItem(MY_KEY, JSON.stringify(myProgs)); return true; } catch { return false; } };
const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const setSeg = (id, v) => { $(id).value = v; document.querySelectorAll(`#${id} + .seg button`).forEach(b => b.classList.toggle('on', b.dataset.v === v)); };
const STOP_BTN = '<button type="button" class="play stop" id="pPlay"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg><span>Parar</span></button>';

// forma escolhida para cada acorde: nas minhas fica no próprio acorde; nas prontas, guardada à parte. Vale só para o tom em que foi escolhida.
const READY_V_KEY = 'progVoices';
let readyVoices = {};
try { const v = JSON.parse(localStorage.getItem(READY_V_KEY) || '{}'); if (v && typeof v === 'object') readyVoices = v; } catch {}
function voiceSlot(i) {
  const p = state.p, items = p.ed ? p.ed.items : p.src === 'mine' && myProgs[p.mine] ? myProgs[p.mine].items : null;
  if (items) return {
    get: () => items[i] && items[i].fk === p.key ? items[i].f : null,
    set: f => {
      if (f) { items[i].f = f; items[i].fk = p.key; } else { delete items[i].f; delete items[i].fk; }
      if (!p.ed) saveMine();
    },
  };
  const k = `${p.mode}|${PROGRESSIONS[p.mode][p.idx].name}|${p.key}|${i}`;
  return {
    get: () => readyVoices[k] || null,
    set: f => {
      if (f) readyVoices[k] = f; else delete readyVoices[k];
      try { localStorage.setItem(READY_V_KEY, JSON.stringify(readyVoices)); } catch {}
    },
  };
}
const chordPositions = c => neckPositions(c.rootPc, c.type, CHORD_TYPES[c.type].iv);

function stopProg() { if (state.p.playing) { stopAll(); state.p.playing = false; } }
function curProg() {
  const p = state.p;
  if (p.ed) return { name: p.ed.name.trim() || 'Nova progressão', desc: '', mine: true, chords: customChords(p.key, p.mode, p.ed.items, state.sharps) };
  const m = p.src === 'mine' && myProgs[p.mine];
  if (m) return { name: m.name, desc: 'Progressão criada por você.', mine: true, chords: customChords(p.key, p.mode, m.items, state.sharps) };
  p.src = 'ready';
  const list = PROGRESSIONS[p.mode];
  if (p.idx >= list.length) p.idx = 0;
  return { name: list[p.idx].name, desc: list[p.idx].desc, chords: progressionChords(p.key, p.mode, list[p.idx], state.sharps) };
}
// os acordes da sequência, um ao lado do outro, cada um com o desenho de como tocar
const seqCards = (chords, step) => '<div class="pseq">' + chords.map((x, i) => {
  const v = x.v;
  return `<button type="button" class="pc${i === step ? ' on' : ''}${x.inField === false ? ' out' : ''}" data-i="${i}" aria-label="${i + 1}º acorde: ${x.name}">` +
    `<span class="pn">${i + 1}º</span><b>${x.name}</b><small>${x.roman}</small>${v ? chordSvg(v, x.rootPc, nameMap(x.pcs, x.names)) : ''}</button>`;
}).join('') + '</div>';

// entrar ou sair da montagem muda muito a altura da página: vai direto ao ponto certo, sem o pulo
const jumpTo = id => { tabJump = true; $(id).scrollIntoView(); };

// o tom e o modo ficam dentro do quadro de criar enquanto se monta a progressão
const pTop = $('pTop'), pTopHome = $('pTopHome');
function renderProgressoes() {
  const p = state.p, ed = p.ed, list = PROGRESSIONS[p.mode];
  pTopHome.appendChild(pTop);
  $('pTomTitle').textContent = ed ? '2º Tom da música' : 'Tom da música';
  $('pTomHint').hidden = !ed;
  $('plabels').closest('label').hidden = !!ed;
  const scale = p.mode === 'maior' ? 'Maior' : 'Menor', keyName = spelledScale(p.key, scale, state.sharps)[0];
  rootButtons($('pKeys'), p.key, k => { stopProg(); p.key = k; p.pos = null; renderProgressoes(); });
  $('pPick').hidden = !!ed;
  $('pEditor').hidden = !ed;

  // listas: prontas e as minhas
  $('pList').innerHTML = list.map((pr, i) => {
    const ch = progressionChords(p.key, p.mode, pr, state.sharps);
    const seq = pr.chords.length > 6 ? ch.slice(0, 12).map(c => c.name).join(' · ') : ch.map(c => c.name).join(' – ');
    return `<button type="button" class="pcard ${p.src === 'ready' && i === p.idx ? 'active' : ''}" data-i="${i}"><b>${pr.name}</b><span>${seq}</span></button>`;
  }).join('');
  $('pList').querySelectorAll('.pcard').forEach(b => b.onclick = () => { stopProg(); p.src = 'ready'; p.idx = +b.dataset.i; p.step = 0; p.pos = null; renderProgressoes(); });
  $('pMine').innerHTML = myProgs.map((m, i) => {
    const ch = customChords(m.key, m.mode, m.items, state.sharps);
    return `<button type="button" class="pcard ${p.src === 'mine' && i === p.mine ? 'active' : ''}" data-i="${i}"><b>${esc(m.name)}</b>` +
      `<span>${ch.slice(0, 12).map(c => c.name).join(' – ')}${ch.length > 12 ? ' …' : ''} · ${ch.length} acorde${ch.length > 1 ? 's' : ''}</span></button>`;
  }).join('') + '<button type="button" class="pcard new" id="pNew"><b>+ Criar uma progressão</b><span>Monte a sua com qualquer acorde, quantos quiser</span></button>';
  $('pMine').querySelectorAll('.pcard[data-i]').forEach(b => b.onclick = () => {
    stopProg(); const m = myProgs[+b.dataset.i];
    p.src = 'mine'; p.mine = +b.dataset.i; p.key = m.key; p.mode = m.mode; setSeg('pmode', m.mode); p.step = 0; p.pos = null; renderProgressoes();
  });
  $('pNew').onclick = () => { stopProg(); p.ed = { id: null, name: '', items: [], root: p.key, msg: '', del: false }; p.step = 0; p.pos = null; renderProgressoes(); jumpTo('pDetail'); };

  const cur = curProg(), chords = cur.chords;
  chords.forEach((x, i) => { x.v = findVoicing(chordPositions(x), voiceSlot(i).get()) || bestVoicing(x.rootPc, x.type); });
  if (p.step >= chords.length) p.step = Math.max(0, chords.length - 1);
  const c = chords[p.step];
  const playRow = chords.length ? `<p>${p.playing ? STOP_BTN : playBtn('pPlay', 'Tocar a progressão')}</p>` : '';
  const outNote = chords.some(x => x.inField === false)
    ? '<p class="hint">Borda tracejada: acorde <b>de fora</b> do campo harmônico do tom. Pode usar à vontade, ele só dá uma cor diferente à música.</p>' : '';
  let html = `<h2>${ed ? 'Montando: ' : ''}${esc(cur.name)} em ${keyName} ${p.mode}</h2>${cur.desc ? `<p>${cur.desc}</p>` : ''}`;
  if (!chords.length) html += '<p><b>Ainda não há acordes.</b> Escolha os acordes logo abaixo: cada um entra no fim da sequência, um ao lado do outro.</p>';
  else {
    html += `<p class="hint">Os acordes em ordem, com o desenho de cada um. Toque num acorde para ouvir e ver onde ele fica no braço.</p>${seqCards(chords, p.step)}${outNote}`;
    if (ed) html += `<div class="eact"><span>Acorde escolhido: <b>${p.step + 1}º — ${c.name}</b></span>` +
      '<button type="button" id="eLeft">← Mover</button><button type="button" id="eRight">Mover →</button>' +
      '<button type="button" id="eDup">Repetir</button><button type="button" id="eRm" class="danger">Tirar</button></div>';
    html += playRow;
    const t = CHORD_TYPES[c.type];
    html += `<p><b>${c.name}</b> (${ptOf(c.rootName)}, ${t.label.toLowerCase()}): notas <b>${c.names.join(' - ')}</b>.</p>`;
  }
  if (cur.mine && !ed) {
    const armed = p.delArm === myProgs[p.mine].id;
    html += '<p><button type="button" class="link" id="pEdit">Mudar esta progressão (pôr, tirar ou trocar acordes)</button> ' +
      `<button type="button" class="link danger" id="pDelMine">${armed ? 'Toque de novo para excluir de vez' : 'Excluir esta progressão'}</button></p>`;
  }
  if (!cur.mine && !ed) html += '<p><button type="button" class="link" id="pCustom">Personalizar esta progressão (pôr, tirar ou trocar acordes)</button></p><p class="hint">A pronta continua igual. A sua versão fica guardada em <b>Minhas progressões</b>.</p>';
  $('pDetail').innerHTML = html;

  $('pDetail').querySelectorAll('.pc').forEach(b => b.onclick = () => {
    stopProg(); p.step = +b.dataset.i; p.pos = null; strumV(chords[p.step].v); renderProgressoes();
  });
  if (chords.length) $('pPlay').onclick = () => {
    if (p.playing) { stopProg(); renderProgressoes(); return; }
    p.playing = true;
    schedule(chords, chords.length > 6 ? 1300 : 1700, (x, i) => {
      p.step = i; p.pos = null; strumV(x.v); keepScroll(renderProgressoes);
    }, () => { p.playing = false; keepScroll(renderProgressoes); });
    renderProgressoes();
  };
  if ($('pDelMine')) $('pDelMine').onclick = () => {
    const id = myProgs[p.mine].id;
    if (p.delArm !== id) { p.delArm = id; renderProgressoes(); return; } // pede dois toques para evitar engano
    stopProg(); p.delArm = null; myProgs = myProgs.filter(m => m.id !== id); saveMine();
    p.src = 'ready'; p.step = 0; p.pos = null; renderProgressoes(); jumpTo('pDetail');
  };
  if ($('pCustom')) $('pCustom').onclick = () => {
    stopProg();
    const items = itemsFromChords(p.key, chords).map((x, i) => { const f = voiceSlot(i).get(); return f ? { ...x, f, fk: p.key } : x; });
    p.ed = { id: null, name: `${cur.name} (minha)`.slice(0, 40), items, root: p.key, msg: '', del: false }; p.step = 0; p.pos = null;
    renderProgressoes(); jumpTo('pDetail');
  };
  if ($('pEdit')) $('pEdit').onclick = () => {
    p.delArm = null;
    stopProg(); const m = myProgs[p.mine];
    p.ed = { id: m.id, name: m.name, items: m.items.map(x => ({ ...x })), root: p.key, msg: '', del: false }; renderProgressoes(); jumpTo('pDetail');
  };
  if (ed) renderEditor(chords, keyName, scale);
  else $('pEditor').innerHTML = '';

  const show = !!c;
  ['board3', 'pPositions', 'pPosHint'].forEach(id => $(id).hidden = !show);
  $('pPosTitle').hidden = !show;
  if (!show) return;
  const t = CHORD_TYPES[c.type], shown = labelMap(c.pcs, c.names, t, p.labels);
  const pos = chordPositions(c), slot = voiceSlot(p.step), v = findVoicing(pos, slot.get());
  const sel = v ? pos.indexOf(v) : null;
  $('pPosTitle').textContent = `Trocar a forma de ${c.name} (casas 0 a 24)`;
  $('pPosHint').innerHTML = v
    ? `<b>${c.name} agora usa a forma da ${v.minF > 0 ? 'casa ' + v.minF : 'posição aberta'}</b> nesta progressão, neste tom. Toque nela de novo para voltar à forma normal.`
    : `Toque numa forma: ela passa a ser a usada no ${p.step + 1}º acorde, lá em cima na sequência, e fica guardada.`;
  positionCards($('pPositions'), pos, c.rootPc, shown, sel, i => { slot.set(i === null ? null : pos[i].frets); renderProgressoes(); });
  drawBoard($('board3'), 24, { inScale: new Set(c.pcs), names: shown, rootPc: c.rootPc, all: false, exact: v ? v.frets : null });
}

// montar / mudar uma progressão própria
function renderEditor(chords, keyName, scale) {
  const p = state.p, ed = p.ed;
  const field = harmonicField(p.key, scale, state.sharps), notes = scaleNotes(p.key, scale);
  const ro = (ed.root - p.key + 12) % 12, types = ['maior', 'menor', ...Object.keys(CHORD_TYPES).filter(t => t !== 'maior' && t !== 'menor')];
  const byType = customChords(p.key, p.mode, types.map(t => ({ o: ro, t })), state.sharps);
  const cancelBtn = `<button type="button" class="link danger" data-cancel>${ed.cancel ? 'Toque de novo para cancelar' : ed.id ? 'Cancelar as mudanças' : 'Cancelar progressão'}</button>`;
  const seqNames = chords.map(x => x.name);
  const live = `<div class="elive" aria-live="polite"><b>Sua sequência${seqNames.length ? ` (${seqNames.length})` : ''}:</b> ${seqNames.length ? (seqNames.length > 8 ? '… ' : '') + seqNames.slice(-8).join(' – ') : 'ainda vazia'}<p class="emsg">${ed.msg}</p>${cancelBtn}</div>`;
  $('pEditor').innerHTML = live +
    `<label class="ename"><span>1º Nome da progressão</span><input id="eName" maxlength="40" placeholder="Ex.: Música da festa" value="${esc(ed.name)}"><small class="hint">Escreva um nome para achar depois. Se deixar vazio, o aplicativo dá um nome sozinho.</small></label>` +
    '<div id="eTom"></div>' +
    `<h3><b>3º</b> Pôr acorde — jeito rápido</h3><p class="hint">São os acordes do campo harmônico de ${keyName} ${p.mode}: todos combinam com o tom. Toque num e ele entra no fim da sequência.</p>` +
    `<div class="roots efield">${field.map((f, i) => `<button type="button" data-o="${(notes[i] - p.key + 12) % 12}" data-t="${f.type}"><b>${f.chord}</b><small>${f.roman}</small></button>`).join('')}</div>` +
    '<h3>Ou pôr qualquer acorde</h3><p class="hint">Primeiro toque na nota. Depois toque no tipo: o acorde entra no fim da sequência.</p>' +
    '<div class="roots" id="eRoots"></div>' +
    `<div class="etypes">${byType.map((x, i) => `<button type="button" data-t="${types[i]}"><b>${x.name}</b><small>${CHORD_TYPES[types[i]].label}</small></button>`).join('')}</div>` +
    '<h3><b>4º</b> Confira a sequência</h3><p class="hint">Ela aparece lá em cima, na ordem da música. Toque num acorde para ouvir e para mover, repetir ou tirar.</p>' +
    '<h3><b>5º</b> Guarde</h3><p class="hint">Depois de guardar, ela fica em <b>Minhas progressões</b>, para abrir quando quiser.</p>' +
    '<div class="dlg-actions"><button type="button" class="play" id="eSave">Guardar a progressão</button>' + cancelBtn +
    (ed.id ? `<button type="button" class="link danger" id="eDelAll">${ed.del ? 'Toque de novo para apagar de vez' : 'Apagar esta progressão'}</button>` : '') + '</div>';
  $('eTom').appendChild(pTop);
  $('eName').oninput = e => { ed.name = e.target.value; };
  rootButtons($('eRoots'), ed.root, r => { ed.root = r; ed.msg = `Agora toque no tipo de acorde de ${dual(r)}, nos botões logo abaixo das notas.`; renderProgressoes(); });
  const add = (o, t) => {
    stopProg();
    if (ed.items.length >= MAX_ITEMS) { ed.msg = `O limite é de ${MAX_ITEMS} acordes.`; renderProgressoes(); return; }
    ed.items.push({ o, t }); ed.msg = `✓ ${customChords(p.key, p.mode, [{ o, t }], state.sharps)[0].name} entrou como ${ed.items.length}º acorde.`; ed.del = false; ed.cancel = false; p.step = ed.items.length - 1; p.pos = null;
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
    p.ed = null; p.src = 'mine'; p.mine = i >= 0 ? i : myProgs.length - 1; p.pos = null;
    renderProgressoes(); jumpTo('pDetail');
  };
  $('pEditor').querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => {
    if (ed.items.length && !ed.cancel) { ed.cancel = true; renderProgressoes(); return; } // pede dois toques para não perder o que já montou
    stopProg(); p.ed = null; p.pos = null; renderProgressoes(); jumpTo('pDetail');
  });
  if ($('eDelAll')) $('eDelAll').onclick = () => {
    if (!ed.del) { ed.del = true; renderProgressoes(); return; }
    stopProg(); myProgs = myProgs.filter(m => m.id !== ed.id); saveMine();
    p.ed = null; p.src = 'ready'; p.step = 0; p.pos = null; renderProgressoes(); jumpTo('pDetail');
  };
}

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
  $('fieldCards').innerHTML = Object.keys(SCALES).map(name => {
    const f = harmonicField(state.root, name, state.sharps);
    if (!f) return '';
    const cells = f.map((c, i) => {
      const on = sel && sel.scale === name && sel.idx === i;
      return `<button type="button" class="cell ${on ? 'on' : ''} ${i === 0 ? 'root' : ''}" data-i="${i}" data-s="${name}"><b>${c.chord}</b><small>${c.roman}</small></button>`;
    }).join('');
    return `<div class="scard"><div class="name">${f[0].chord.replace(/m$/, '')} ${name}</div><div class="row">${cells}</div></div>`;
  }).join('');
  document.querySelectorAll('#fieldCards .cell').forEach(c => c.onclick = () => {
    const name = c.dataset.s, i = +c.dataset.i;
    const same = sel && sel.scale === name && sel.idx === i;
    state.fsel = same ? null : { scale: name, idx: i };
    if (!same) { const f = harmonicField(state.root, name, state.sharps)[i]; strumV(bestVoicing(f.notes[0], f.type)); }
    renderCampos();
  });
  const panel = $('fpanel');
  const f = sel && harmonicField(state.root, sel.scale, state.sharps);
  panel.classList.toggle('empty', !f);
  document.body.classList.toggle('sheet-open', !!f && state.tab === 'campos');
  if (!f) { panel.innerHTML = '<p class="hint">Toque num acorde para ouvir e ver como tocar.</p>'; return; }
  const c = f[sel.idx];
  panel.innerHTML = fieldDetail(c, f[0].chord.replace(/m$/, '') + ' ' + sel.scale);
  $('fPlay').onclick = () => strumV(bestVoicing(c.notes[0], c.type));
  $('fMore').onclick = () => goChord(c.notes[0], c.type);
  $('fClose').onclick = () => { state.fsel = null; renderCampos(); };
  panel.querySelectorAll('.vc').forEach(b => b.onclick = () => strum(fieldShapes(c)[+b.dataset.i].frets));
}
// as formas mais fáceis de um acorde do campo (até 4)
const fieldShapes = f => voicingsOf(f.notes[0], f.type).filter(v => v.bassIsRoot).slice(0, 4);
function fieldDetail(f, where) {
  const t = CHORD_TYPES[f.type], rootName = f.chord.replace(/[m°+]$/, '');
  const cn = spellChordFromRoot(rootName, t.iv, t.letters), names = nameMap(f.notes, cn); // mesma grafia do campo (Bb em F maior)
  const shapes = fieldShapes(f);
  return `<button type="button" class="close" id="fClose" aria-label="Fechar">✕</button>
    <p><b class="big">${f.chord}</b> — ${ptOf(rootName)}, ${t.label.toLowerCase()} · grau <b>${f.roman}</b> de ${where}</p>
    <p>Notas: <b>${cn.join(' - ')}</b></p>
    <p>${playBtn('fPlay', 'Ouvir')} <button type="button" class="link" id="fMore">Ver todas as formas e o braço inteiro →</button></p>
    <div class="shapes">${shapes.map((v, i) => `<button type="button" class="vc" data-i="${i}">${chordSvg(v, f.notes[0], names)}<small>${v.minF > 0 ? 'Casa ' + v.minF : 'Posição aberta'}</small></button>`).join('')}</div>`;
}
function goChord(pc, type) {
  state.croot = pc; state.ctype = type; state.cvoice = null;
  fillChordSelects(); setTab('acordes');
}

/* ---------- ABA ACORDES ---------- */
const memo = {};
const voicingsOf = (rootPc, type) => memo[rootPc + ':' + type] || (memo[rootPc + ':' + type] = generateVoicings(rootPc, CHORD_TYPES[type].iv));
const bestVoicing = (rootPc, type) => type === '5' ? powerChords(rootPc)[0]
  : (voicingsOf(rootPc, type).find(v => v.bassIsRoot) || voicingsOf(rootPc, type)[0]);
const strumV = v => { if (v) strum(v.frets); };
const playBtn = (id, text) => `<button type="button" class="play" id="${id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg><span>${text}</span></button>`;
const MAX_SHOW = 40;
function renderAcordes() {
  const t = CHORD_TYPES[state.ctype], rootPc = state.croot;
  const all = voicingsOf(rootPc, state.ctype);
  const filtered = filterVoicings(all, state.cf), list = filtered.slice(0, MAX_SHOW);
  const pcs = t.iv.map(i => (rootPc + i) % 12);
  const cn = spelledChord(rootPc, t.iv, state.sharps, t.letters), names = nameMap(pcs, cn);
  const cg = hasCaged(state.ctype), caged = cg ? cagedShapes(rootPc, state.ctype) : [];

  $('chordRoots').innerHTML = Array.from({ length: 12 }, (_, i) =>
    `<button type="button" data-p="${i}" class="${i === rootPc ? 'on' : ''}">${dual(i)}</button>`).join('');
  document.querySelectorAll('#chordRoots button').forEach(b => b.onclick = () => { state.croot = +b.dataset.p; state.cvoice = null; renderAcordes(); });

  const count = !filtered.length
    ? 'Nenhuma forma com esses filtros. O acorde existe: os filtros é que estão apertados demais.'
    : filtered.length > MAX_SHOW
      ? `Mostrando as ${MAX_SHOW} formas mais fáceis (de ${filtered.length} encontradas). Toque numa para ver os detalhes.`
      : `${filtered.length} forma${filtered.length === 1 ? '' : 's'} de tocar, das mais fáceis para as mais difíceis. Toque numa para ver os detalhes.`;
  $('chordInfo').innerHTML =
    `<p><b>${cn[0]}${t.suffix}</b> — ${ptOf(cn[0])} ${t.label.toLowerCase()}</p>` +
    `<p>Notas do acorde: <b>${cn.join(' - ')}</b></p><p>${t.desc}</p><p>${count}</p>` +
    (filtered.length ? '' : '<p><button type="button" class="link" id="clearCf">Limpar os filtros e ver as formas</button></p>') +
    `<p>${playBtn('playChord', 'Ouvir o acorde')}</p>`;
  if ($('clearCf')) $('clearCf').onclick = () => {
    state.cf = { region: 'all', open: 'any', barre: 'any', bass: 'root', min: 4 };
    [['region', 'all'], ['copen', 'any'], ['cbarre', 'any'], ['cbass', 'root'], ['cmin', '4']].forEach(([id, v]) => setSeg(id, v));
    refreshDropdowns(); state.cvoice = null; renderAcordes();
  };

  const card = (v, id, head, foot) =>
    `<button type="button" class="vc ${state.cvoice === id ? 'active' : ''}" data-id="${id}">${head}${chordSvg(v, rootPc, names)}<small>${foot}</small>` +
    (v.barre ? '<span class="tag">pestana</span>' : '') + (v.hasOpen ? '<span class="tag">cordas soltas</span>' : '') + '</button>';
  const where = v => v.minF > 0 ? 'Casa ' + v.minF : 'Posição aberta';

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
  if (!$('ctype').options.length) Object.entries(CHORD_TYPES).filter(([k]) => k !== '5').forEach(([k, t]) => $('ctype').add(new Option(t.label, k)));
  $('ctype').value = state.ctype;
}

/* ---------- geral ---------- */
function fillRoots() {
  const r = $('root'); r.innerHTML = '';
  for (let i = 0; i < 12; i++) r.add(new Option(dual(i), i));
  r.value = state.root; fillChordSelects(); refreshDropdowns();
}
function render() {
  try { renderTab(); } catch (err) {
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
}
const TAB_INFO = {
  escalas: ['Escalas', 'As notas de cada escala desenhadas no braço'],
  campos: ['Campo harmônico', 'Os acordes que combinam em cada escala', 'Campos'],
  acordes: ['Acordes', 'Como montar qualquer acorde, com filtros e o sistema CAGED'],
  guitarra: ['Guitarra', 'Power chords, tríades e acordes de guitarrista nas 24 casas'],
  progressoes: ['Progressões', 'Sequências de acordes prontas ou montadas por você, em qualquer tom'],
  aprender: ['Aprender', 'Guia do aplicativo e explicações simples de música'],
};
function setTab(t) {
  tabJump = true;
  stopProg();
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
  $(id).onchange = e => { state.g[k] = e.target.value; state.g.pos = null; render(); });
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
$('soundBtn').onclick = () => { setSound(!soundOn()); stopProg(); applySound(); if (soundOn()) playNote(57); };
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
['hide', 'frets', 'frets2', 'region', 'copen', 'cbarre', 'cbass', 'cmin', 'gkind', 'gtri', 'gset', 'gext', 'glabels', 'pmode', 'plabels'].forEach(segmentize);

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
dropdown('root', 3); dropdown('scale'); dropdown('ctype');

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
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
