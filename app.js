import { SHARP, FLAT, SCALES, CHORD_TYPES, SCALE_INFO, STEP_NAME, TUNING, noteName, noteAt, ptName, ptOf, spelledScale, spelledChord, nameMap, intervalNames, scaleDegreeLabels, PROGRESSIONS, progressionChords,
  scaleNotes, harmonicField, degreeLabels } from './music.js';
import { midiAt, playNote, strum, sequence, schedule, stopAll, soundOn, setSound } from './audio.js';
import { generateVoicings, filterVoicings, cagedShapes, hasCaged, neckPositions, powerChords, stringSetTriads } from './chords.js';

const $ = id => document.getElementById(id);
const state = {
  tab: 'escalas', root: 5, scale: 'Maior', frets: 12, sharps: true, all: false, sel: null,
  frets2: 24, croot: 0, ctype: 'maior', cvoice: null,
  cf: { region: 'all', open: 'any', barre: 'any', bass: 'root', min: 4 },
  g: { root: 4, kind: 'pow', tri: 'maior', set: '5,4,3', ext: '7', pos: null, labels: 'notes' },
  p: { key: 0, mode: 'maior', idx: 0, step: 0, pos: null, labels: 'notes', playing: false },
};
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
      const m = midiAt(s, f);
      el('circle', { cx, cy: y, r: 15, fill, opacity: op, class: 'nt', 'data-m': m }, svg);
      el('text', { x: cx, y: y + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'nt', 'data-m': m,
        fill: on ? '#0f172a' : 'var(--mut)' }, svg).textContent = (o.names && o.names.get(nt)) || nn(nt);
    }
  }
}
const perRowFor = (w, frets = 24) => (w >= 1400 && frets > 12 ? 24 : w >= 760 ? 12 : 6);
function drawBoard(host, frets, o) {
  host.innerHTML = '';
  host.onclick = e => { const m = e.target.getAttribute && e.target.getAttribute('data-m'); if (m) playNote(+m); };
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
  positionCards($('gPositions'), list, g.root, shown, g.pos, i => { g.pos = i; renderGuitarra(); if (i !== null) $('gSel').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  const v = g.pos !== null ? list[g.pos] : null;
  $('gPlay').onclick = () => strumV(v || list[0]);
  $('gSel').innerHTML = v ? `<p><b>Como tocar:</b></p>${howTo(v, names)}<p>Toque na forma de novo para ver todas as posições.</p>`
    : '<p>Abaixo: todas as notas deste acorde no braço inteiro. Toque numa forma acima para ver só ela.</p>';
  drawBoard($('board4'), 24, { inScale: new Set(pcs), names: shown, rootPc: g.root, all: false, exact: v ? v.frets : null });
}

/* ---------- ABA PROGRESSÕES ---------- */
function stopProg() { if (state.p.playing) { stopAll(); state.p.playing = false; } }
function renderProgressoes() {
  const p = state.p, list = PROGRESSIONS[p.mode];
  if (p.idx >= list.length) p.idx = 0;
  const scale = p.mode === 'maior' ? 'Maior' : 'Menor', keyName = spelledScale(p.key, scale, state.sharps)[0];
  rootButtons($('pKeys'), p.key, k => { stopProg(); p.key = k; p.step = 0; p.pos = null; renderProgressoes(); });
  $('pList').innerHTML = list.map((pr, i) => {
    const ch = progressionChords(p.key, p.mode, pr, state.sharps);
    const seq = pr.chords.length > 6 ? ch.slice(0, 12).map(c => c.name).join(' · ') : ch.map(c => c.name).join(' – ');
    return `<button type="button" class="pcard ${i === p.idx ? 'active' : ''}" data-i="${i}"><b>${pr.name}</b><span>${seq}</span></button>`;
  }).join('');
  $('pList').querySelectorAll('.pcard').forEach(b => b.onclick = () => { stopProg(); p.idx = +b.dataset.i; p.step = 0; p.pos = null; renderProgressoes(); });

  const pr = list[p.idx], chords = progressionChords(p.key, p.mode, pr, state.sharps);
  if (p.step >= chords.length) p.step = 0;
  const c = chords[p.step], t = CHORD_TYPES[c.type];
  const names = nameMap(c.pcs, c.names), shown = labelMap(c.pcs, c.names, t, p.labels);
  $('pDetail').innerHTML = `<h2>${pr.name} em ${keyName} ${p.mode}</h2><p>${pr.desc}</p>` +
    `<div class="steps">${chords.map((x, i) => `<button type="button" data-i="${i}" class="${i === p.step ? 'on' : ''}"><b>${x.name}</b><small>${x.roman}</small></button>`).join('')}</div>` +
    `<p>${p.playing ? `<button type="button" class="play stop" id="pPlay"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg><span>Parar</span></button>` : playBtn('pPlay', 'Tocar a progressão')}</p>` +
    `<p><b>${c.name}</b> (${ptOf(c.rootName)}, ${t.label.toLowerCase()}): notas <b>${c.names.join(' - ')}</b>. Toque em outro acorde da sequência para ouvir e ver onde ele fica no braço.</p>`;
  $('pDetail').querySelectorAll('.steps button').forEach(b => b.onclick = () => {
    stopProg(); p.step = +b.dataset.i; p.pos = null; strumV(bestVoicing(chords[p.step].rootPc, chords[p.step].type)); renderProgressoes();
  });
  $('pPlay').onclick = () => {
    if (p.playing) { stopProg(); renderProgressoes(); return; }
    p.playing = true;
    schedule(chords, chords.length > 6 ? 1300 : 1700, (x, i) => {
      p.step = i; p.pos = null; strumV(bestVoicing(x.rootPc, x.type)); renderProgressoes();
    }, () => { p.playing = false; renderProgressoes(); });
    renderProgressoes();
  };

  const pos = neckPositions(c.rootPc, c.type, t.iv);
  $('pPosTitle').textContent = `Onde tocar ${c.name} no braço (casas 0 a 24)`;
  positionCards($('pPositions'), pos, c.rootPc, shown, p.pos, i => { p.pos = i; renderProgressoes(); if (i !== null) $('board3').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  const v = p.pos !== null ? pos[p.pos] : null;
  drawBoard($('board3'), 24, { inScale: new Set(c.pcs), names: shown, rootPc: c.rootPc, all: false, exact: v ? v.frets : null });
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
  drawBoard($('board'), state.frets, {
    inScale: new Set(notes), names, hl: state.sel ? state.sel.notes : null, rootPc: state.root, all: state.all });

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
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ---------- ABA CAMPOS ---------- */
function renderCampos() {
  $('fieldCards').innerHTML = Object.keys(SCALES).map(name => {
    const f = harmonicField(state.root, name, state.sharps);
    if (!f) return '';
    const cells = f.map((c, i) =>
      `<button type="button" class="cell ${i === 0 ? 'root' : ''}" data-i="${i}" data-s="${name}"><b>${c.chord}</b><small>${c.roman}</small></button>`).join('');
    return `<div class="scard"><div class="name">${f[0].chord.replace(/m$/, '')} ${name}</div><div class="row">${cells}</div></div>`;
  }).join('');
  document.querySelectorAll('#fieldCards .cell').forEach(c => c.onclick = () => {
    const f = harmonicField(state.root, c.dataset.s, state.sharps)[+c.dataset.i];
    strumV(bestVoicing(f.notes[0], f.type));
    goChord(f.notes[0], f.type);
  });
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
    ? 'Nenhuma forma com esses filtros. Tente afrouxar um filtro (por exemplo "Nota mais grave: Qualquer").'
    : filtered.length > MAX_SHOW
      ? `Mostrando as ${MAX_SHOW} formas mais fáceis (de ${filtered.length} encontradas). Toque numa para ver os detalhes.`
      : `${filtered.length} forma${filtered.length === 1 ? '' : 's'} de tocar, das mais fáceis para as mais difíceis. Toque numa para ver os detalhes.`;
  $('chordInfo').innerHTML =
    `<p><b>${cn[0]}${t.suffix}</b> — ${ptOf(cn[0])} ${t.label.toLowerCase()}</p>` +
    `<p>Notas do acorde: <b>${cn.join(' - ')}</b></p><p>${t.desc}</p><p>${count}</p>` +
    `<p>${playBtn('playChord', 'Ouvir o acorde')}</p>`;

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
    if (state.cvoice !== null) $('voiceInfo').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  campos: ['Campo harmônico', 'Os acordes que combinam em cada escala'],
  acordes: ['Acordes', 'Como montar qualquer acorde, com filtros e o sistema CAGED'],
  guitarra: ['Guitarra', 'Power chords, tríades e acordes de guitarrista nas 24 casas'],
  progressoes: ['Progressões', 'As sequências de acordes mais usadas, em qualquer tom'],
  aprender: ['Aprender', 'Explicações simples, para quem está começando'],
};
function setTab(t) {
  stopProg();
  if (!TAB_INFO[t]) t = 'escalas';
  const [title, sub] = TAB_INFO[t];
  $('pageTitle').textContent = title; $('pageSub').textContent = sub;
  document.title = `${title} · Braço e Escalas`;
  try { history.replaceState(null, '', '#' + t); } catch {}
  state.tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  Object.keys(TAB_INFO).forEach(x => $('tab-' + x).hidden = x !== t);
  $('root').closest('.bar').hidden = t !== 'escalas' && t !== 'campos';
  render(); window.scrollTo(0, 0);
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
$('root').onchange = e => { state.root = +e.target.value; state.sel = null; render(); };
$('sharps').onchange = e => { state.sharps = e.target.checked; fillRoots(); render(); };
$('frets').onchange = e => { state.frets = +e.target.value; render(); };
$('all').onchange = e => { state.all = e.target.checked; render(); };
$('frets2').onchange = e => { state.frets2 = +e.target.value; render(); };
$('ctype').onchange = e => { state.ctype = e.target.value; state.cvoice = null; render(); };
[['gkind', 'kind'], ['gtri', 'tri'], ['gset', 'set'], ['gext', 'ext'], ['glabels', 'labels']].forEach(([id, k]) =>
  $(id).onchange = e => { state.g[k] = e.target.value; state.g.pos = null; render(); });
[['pmode', 'mode'], ['plabels', 'labels']].forEach(([id, k]) =>
  $(id).onchange = e => { state.p[k] = e.target.value; if (k === 'mode') { state.p.idx = 0; state.p.step = 0; } state.p.pos = null; render(); });
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
new ResizeObserver(() => {
  const id = { escalas: 'board', acordes: 'board2', progressoes: 'board3', guitarra: 'board4' }[state.tab];
  const host = id && $(id);
  if (!host || !host.clientWidth) return;
  const p = perRowFor(host.clientWidth);
  if (p !== lastPer) { lastPer = p; render(); }
}).observe(document.body);

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
['frets', 'frets2', 'region', 'copen', 'cbarre', 'cbass', 'cmin', 'gkind', 'gtri', 'gset', 'gext', 'glabels', 'pmode', 'plabels'].forEach(segmentize);

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

new ResizeObserver(() => document.documentElement.style.setProperty('--head-h', $('head').offsetHeight + 'px')).observe($('head'));
window.addEventListener('scroll', () => $('head').classList.toggle('stuck', scrollY > 4), { passive: true });

fillRoots();
setTab(location.hash.slice(1) || 'escalas');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
