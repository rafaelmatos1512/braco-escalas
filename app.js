import { SHARP, FLAT, SCALES, CHORD_TYPES, SCALE_INFO, STEP_NAME, TUNING, noteName, noteAt, ptName,
  scaleNotes, harmonicField, degreeLabels } from './music.js';
import { generateVoicings, filterVoicings, cagedShapes, hasCaged } from './chords.js';

const $ = id => document.getElementById(id);
const state = {
  tab: 'escalas', root: 5, scale: 'Maior', frets: 12, sharps: true, all: false, sel: null,
  frets2: 24, croot: 0, ctype: 'maior', cvoice: null,
  cf: { region: 'all', open: 'any', barre: 'any', bass: 'root', min: 4 },
};
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e); return e;
};
const nn = n => noteName(n, state.sharps);
const dual = (pc, suf = '') => SHARP[pc] === FLAT[pc] ? SHARP[pc] + suf : `${SHARP[pc]}${suf} / ${FLAT[pc]}${suf}`;
const ORD = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª'];

/* ---------- braço (linhas empilhadas) ---------- */
function drawRow(host, from, to, o) {
  const FW = 64, SG = 40, LEFT = 48, TOP = 24, n = to - from + 1;
  const W = LEFT + n * FW + 12, H = TOP + 5 * SG + 40;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Braço' }, host);
  svg.style.maxWidth = (W * 1.25) + 'px';
  el('rect', { x: LEFT, y: TOP, width: n * FW, height: 5 * SG, fill: '#3b2a1a' }, svg);
  for (let i = 0; i <= n; i++) {
    const nut = from === 1 && i === 0;
    el('line', { x1: LEFT + i * FW, x2: LEFT + i * FW, y1: TOP, y2: TOP + 5 * SG,
      stroke: nut ? '#e2e8f0' : '#94a3b8', 'stroke-width': nut ? 5 : 2 }, svg);
  }
  const dots = [3, 5, 7, 9, 15, 17, 19, 21];
  for (let f = from; f <= to; f++) {
    const cx = LEFT + (f - from + 0.5) * FW, cy = TOP + 2.5 * SG;
    if (dots.includes(f)) el('circle', { cx, cy, r: 6, fill: '#64748b', opacity: .5 }, svg);
    if (f === 12 || f === 24) [-1, 1].forEach(d => el('circle', { cx, cy: cy + d * SG, r: 6, fill: '#64748b', opacity: .5 }, svg));
    el('text', { x: cx, y: H - 12, 'text-anchor': 'middle', fill: '#94a3b8', 'font-size': 14 }, svg).textContent = f;
  }
  for (let row = 0; row < 6; row++) {
    const s = 5 - row, y = TOP + row * SG;
    el('line', { x1: from === 1 ? LEFT - 30 : LEFT, x2: LEFT + n * FW, y1: y, y2: y, stroke: '#cbd5e1', 'stroke-width': 1 + s * 0.4 }, svg);
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
        const isRoot = o.hl ? (hi && nt === o.hl[0]) : nt === o.rootPc;
        fill = isRoot ? '#f59e0b' : hi ? '#4ade80' : on ? '#38bdf8' : '#334155';
        op = o.hl && !hi ? .25 : on ? 1 : .8;
      }
      const cx = f === 0 ? LEFT - 28 : LEFT + (f - from + 0.5) * FW;
      el('circle', { cx, cy: y, r: 15, fill, opacity: op }, svg);
      el('text', { x: cx, y: y + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700,
        fill: on ? '#0f172a' : '#94a3b8' }, svg).textContent = nn(nt);
    }
  }
}
function drawBoard(host, frets, o) {
  host.innerHTML = '';
  const perRow = host.clientWidth >= 760 ? 12 : 6;
  for (let from = 1; from <= frets; from += perRow)
    drawRow(host, from, Math.min(from + perRow - 1, frets), o);
}

/* ---------- diagrama de acorde ---------- */
function chordSvg(v, rootPc) {
  const X0 = 40, DX = 18, TOP = 34, DY = 24, W = 150, H = 176;
  const wrap = document.createElement('div');
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, wrap);
  const base = v.maxF <= 4 ? 1 : v.minF;
  for (let r = 0; r <= 5; r++)
    el('line', { x1: X0, x2: X0 + 5 * DX, y1: TOP + r * DY, y2: TOP + r * DY,
      stroke: r === 0 && base === 1 ? '#e2e8f0' : '#64748b', 'stroke-width': r === 0 && base === 1 ? 5 : 1.5 }, svg);
  for (let s = 0; s < 6; s++)
    el('line', { x1: X0 + s * DX, x2: X0 + s * DX, y1: TOP, y2: TOP + 5 * DY, stroke: '#cbd5e1', 'stroke-width': 1 + (5 - s) * 0.25 }, svg);
  if (base > 1) el('text', { x: 4, y: TOP + DY * 0.65, fill: '#f1f5f9', 'font-size': 14, 'font-weight': 700 }, svg).textContent = base + 'ª';
  v.frets.forEach((f, s) => {
    const x = X0 + s * DX;
    if (f < 0) el('text', { x, y: 24, 'text-anchor': 'middle', fill: '#f87171', 'font-size': 16, 'font-weight': 700 }, svg).textContent = '×';
    else if (f === 0) el('circle', { cx: x, cy: 19, r: 5, fill: 'none', stroke: '#f1f5f9', 'stroke-width': 1.8 }, svg);
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
    el('text', { x: cx, y: cy + 3.5, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 700, fill: '#0f172a' }, svg).textContent = nn(nt);
  });
  return wrap.innerHTML;
}

/* ---------- ABA ESCALAS ---------- */
const formulaText = name => SCALES[name].map(i => STEP_NAME[i]).join(' · ');

function renderEscalas() {
  $('scale').value = state.scale;
  const notes = scaleNotes(state.root, state.scale);
  $('title').textContent = `${dual(state.root)} ${state.scale}  (${ptName(state.root, state.sharps)})`;
  $('scaleInfo').innerHTML =
    `<p>Notas: <b>${notes.map(nn).join(' - ')}</b></p>` +
    `<p>${SCALE_INFO[state.scale]}</p>` +
    `<p>Receita (de uma nota para a próxima): ${formulaText(state.scale)}. Um tom são 2 casas, um semitom é 1 casa.</p>`;
  drawBoard($('board'), state.frets, {
    inScale: new Set(notes), hl: state.sel ? state.sel.notes : null, rootPc: state.root, all: state.all });

  const labels = degreeLabels(state.scale);
  if (state.sel && state.sel.scale === state.scale) {
    const i = state.sel.idx, n = notes[i];
    $('selInfo').hidden = false;
    $('selInfo').innerHTML = `<p><b>${nn(n)}</b> (${ptName(n, state.sharps)}) é a ${ORD[i]} nota da escala, o grau ${labels[i]}. ` +
      (i === 0 ? 'É a tônica, a "nota de casa" onde a escala começa e termina.' : 'Aparece em verde no braço, em todas as posições onde ela existe.') + '</p>';
  } else $('selInfo').hidden = true;

  $('scaleCards').innerHTML = Object.keys(SCALES).map(name => {
    const ns = scaleNotes(state.root, name), lb = degreeLabels(name);
    const cells = ns.map((n, i) => {
      const on = state.sel && state.sel.scale === name && state.sel.idx === i;
      return `<div class="cell ${on ? 'on' : ''} ${i === 0 ? 'root' : ''}" data-s="${name}" data-i="${i}"><b>${nn(n)}</b><small>${lb[i]}</small></div>`;
    }).join('');
    return `<div class="scard ${name === state.scale ? 'active' : ''}"><div class="name">${name}</div><div class="row">${cells}</div></div>`;
  }).join('');
  document.querySelectorAll('#scaleCards .cell').forEach(c => c.onclick = () => {
    const name = c.dataset.s, i = +c.dataset.i;
    const same = state.sel && state.sel.scale === name && state.sel.idx === i;
    state.scale = name;
    state.sel = same ? null : { scale: name, idx: i, notes: [scaleNotes(state.root, name)[i]] };
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
      `<div class="cell ${i === 0 ? 'root' : ''}" data-i="${i}" data-s="${name}"><b>${c.chord}</b><small>${c.roman}</small></div>`).join('');
    return `<div class="scard"><div class="name">${nn(state.root)} ${name}</div><div class="row">${cells}</div></div>`;
  }).join('');
  document.querySelectorAll('#fieldCards .cell').forEach(c => c.onclick = () => {
    const f = harmonicField(state.root, c.dataset.s, state.sharps)[+c.dataset.i];
    goChord(f.notes[0], f.type);
  });
}
function goChord(pc, type) {
  state.croot = pc; state.ctype = type; state.cvoice = null;
  fillChordSelects(); setTab('acordes');
}

/* ---------- ABA ACORDES ---------- */
const memo = {};
function renderAcordes() {
  const t = CHORD_TYPES[state.ctype], rootPc = state.croot;
  const key = rootPc + ':' + state.ctype;
  const all = memo[key] || (memo[key] = generateVoicings(rootPc, t.iv));
  const list = filterVoicings(all, state.cf).slice(0, 40);
  const pcs = t.iv.map(i => (rootPc + i) % 12);
  $('chordRoots').innerHTML = Array.from({ length: 12 }, (_, i) =>
    `<button data-p="${i}" class="${i === rootPc ? 'on' : ''}">${dual(i)}</button>`).join('');
  document.querySelectorAll('#chordRoots button').forEach(b => b.onclick = () => { state.croot = +b.dataset.p; state.cvoice = null; renderAcordes(); });
  $('chordInfo').innerHTML =
    `<p><b>${dual(rootPc, t.suffix)}</b> — ${ptName(rootPc, state.sharps)} ${t.label.toLowerCase()}</p>` +
    `<p>Notas do acorde: <b>${pcs.map(nn).join(' - ')}</b></p><p>${t.desc}</p>` +
    `<p>${list.length ? `${list.length} formas de tocar, das mais fáceis para as mais difíceis. Toque numa para ver os detalhes.` : 'Nenhuma forma com esses filtros. Tente afrouxar um filtro (por exemplo "Nota mais grave: Qualquer").'}</p>`;
  const cg = hasCaged(state.ctype);
  $('cagedWrap').hidden = !cg;
  if (cg) $('caged').innerHTML = cagedShapes(rootPc, state.ctype).map(v =>
    `<div class="vc"><b class="shape">Forma de ${v.shape}</b>${chordSvg(v, rootPc)}<small>${v.minF > 0 ? 'Casa ' + v.minF : 'Posição aberta'}${v.barre ? ' · pestana' : ''}</small></div>`).join('');
  $('voicings').innerHTML = list.map((v, i) => {
    const tags = (v.barre ? '<span class="tag">pestana</span>' : '') + (v.hasOpen ? '<span class="tag">cordas soltas</span>' : '');
    return `<div class="vc ${state.cvoice === i ? 'active' : ''}" data-i="${i}">${chordSvg(v, rootPc)}` +
      `<small>${v.minF > 0 ? 'Casa ' + v.minF : 'Posição aberta'} · ${v.fingers} dedo${v.fingers === 1 ? '' : 's'}</small>${tags}</div>`;
  }).join('');
  document.querySelectorAll('#voicings .vc').forEach(c => c.onclick = () => {
    const i = +c.dataset.i; state.cvoice = state.cvoice === i ? null : i; renderAcordes();
    if (state.cvoice !== null) $('voiceInfo').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  const v = state.cvoice !== null ? list[state.cvoice] : null;
  $('voiceInfo').hidden = $('board2wrap').hidden = false;
  const names = ['6ª corda (a mais grossa)', '5ª corda', '4ª corda', '3ª corda', '2ª corda', '1ª corda (a mais fina)'];
  if (v) {
    $('voiceInfo').innerHTML = `<p><b>Como tocar:</b></p><ol class="str">` + v.frets.map((f, s) =>
      `<li>${names[s]}: ${f < 0 ? 'não tocar' : f === 0 ? `solta (${nn(noteAt(s, 0))})` : `casa ${f} (${nn(noteAt(s, f))})`}</li>`).join('') + '</ol>' +
      (v.barre ? `<p>Use a pestana na casa ${v.minF} (um dedo apoiado sobre várias cordas).</p>` : '');
  } else $('voiceInfo').innerHTML = '<p>Abaixo: todas as posições das notas deste acorde no braço. Toque numa forma acima para ver só ela.</p>';
  drawBoard($('board2'), v ? (v.maxF > 12 ? 24 : 12) : state.frets2, { inScale: new Set(pcs), rootPc, all: false, exact: v ? v.frets : null });
}
function fillChordSelects() {
  if (!$('ctype').options.length) Object.entries(CHORD_TYPES).forEach(([k, t]) => $('ctype').add(new Option(t.label, k)));
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
}
function setTab(t) {
  state.tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  ['escalas', 'campos', 'acordes', 'aprender'].forEach(x => $('tab-' + x).hidden = x !== t);
  render(); window.scrollTo(0, 0);
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
$('root').onchange = e => { state.root = +e.target.value; state.sel = null; render(); };
$('sharps').onchange = e => { state.sharps = e.target.checked; fillRoots(); render(); };
$('frets').onchange = e => { state.frets = +e.target.value; render(); };
$('all').onchange = e => { state.all = e.target.checked; render(); };
$('frets2').onchange = e => { state.frets2 = +e.target.value; render(); };
$('ctype').onchange = e => { state.ctype = e.target.value; state.cvoice = null; render(); };
[['region', 'region'], ['copen', 'open'], ['cbarre', 'barre'], ['cbass', 'bass'], ['cmin', 'min']].forEach(([id, k]) =>
  $(id).onchange = e => { state.cf[k] = k === 'min' ? +e.target.value : e.target.value; state.cvoice = null; render(); });

// tamanho da letra
let fs = 1;
try { fs = +localStorage.getItem('fs') || 1; } catch {}
const applyFs = () => { document.documentElement.style.setProperty('--fs', fs); try { localStorage.setItem('fs', fs); } catch {} };
$('fplus').onclick = () => { fs = Math.min(1.6, +(fs + 0.15).toFixed(2)); applyFs(); };
$('fminus').onclick = () => { fs = Math.max(0.85, +(fs - 0.15).toFixed(2)); applyFs(); };
applyFs();

let lastPer = 0;
new ResizeObserver(() => {
  const host = state.tab === 'escalas' ? $('board') : state.tab === 'acordes' ? $('board2') : null;
  if (!host || !host.clientWidth) return;
  const p = host.clientWidth >= 760 ? 12 : 6;
  if (p !== lastPer) { lastPer = p; render(); }
}).observe(document.body);

// filtros curtos viram botões (tudo do mesmo tamanho, sem lista abrindo no meio da tela)
function segmentize(id) {
  const sel = $(id); sel.classList.add('segd');
  const box = document.createElement('div'); box.className = 'seg'; sel.after(box);
  [...sel.options].forEach(o => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = o.text.replace(/ \(.*\)/, ''); b.dataset.v = o.value;
    b.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('change')); sync(); };
    box.appendChild(b);
  });
  const sync = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === sel.value));
  sync();
}
['frets', 'frets2', 'region', 'copen', 'cbarre', 'cbass', 'cmin'].forEach(segmentize);

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

fillRoots(); render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
