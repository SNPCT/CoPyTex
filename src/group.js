// 묶음(group): 위아래로 붙은 셀들 + 오른쪽의 묶음 이미지. 셀이 하나뿐이면 그 셀의 이미지가 그대로 나와요.
import { h, icon, groupFields, copyPng } from './ui.js';
import { t } from './i18n.js';
import { createMathCell, createTextCell, cellLabel } from './cell.js';
import { getLayer, invalidateLayer, composePng, RenderError } from './render.js';

function errText(e) {
  const msg = e && e.message ? e.message : String(e);
  if (e instanceof RenderError) return t('status.error', { msg });
  return /MathJax/i.test(msg) ? t('status.mathjaxFailed') : t('status.renderFailed', { msg });
}

// 오른쪽 중괄호 } : 위/아래 모서리와 가운데 뾰족한 부분은 고정, 사이는 늘어나는 선이에요.
function makeBrace() {
  const svg = (w, hgt, d) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${hgt}`); s.setAttribute('width', w); s.setAttribute('height', hgt);
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
    return s;
  };
  return h('div', { class: 'brace', 'aria-hidden': 'true' },
    svg(16, 16, 'M1 1.5Q8 1.5 8 9L8 16'),
    h('div', { class: 'brace-line' }),
    svg(16, 24, 'M8 0L8 8Q8 12 15 12Q8 12 8 16L8 24'),
    h('div', { class: 'brace-line' }),
    svg(16, 16, 'M8 0L8 7Q8 14.5 1 14.5'));
}

export function createGroup({ cells, opts, settings, numbers, startIndex, total, actions, insertBar }) {
  const multi = cells.length > 1;
  const ctrls = new Map();
  let seq = 0; let timer = null; let updating = Promise.resolve();
  let current = null; let lastKey = null;

  /* ----- 오른쪽 이미지 패널 ----- */
  const img = h('img', { class: 'out', alt: '', draggable: 'true', title: t('cell.dragHint') });
  const empty = h('span', { class: 'empty' }, t('cell.emptyPreview'));
  const err = h('div', { class: 'err', role: 'alert' });
  const meta = h('div', { class: 'meta' });
  const stage = h('div', { class: 'stage' }, empty, img);

  const refreshBtn = h('button', { class: 'tool', type: 'button', title: t('group.refresh'), 'aria-label': t('group.refresh'), onClick: () => update(true) }, icon('refresh'));
  const copyBtn = h('button', { class: 'tool', type: 'button', title: t('group.copy'), 'aria-label': t('group.copy'), onClick: () => copyGroup() }, icon('copy'));
  const sideHead = h('div', { class: 'side-head' },
    h('span', { class: 'side-title' }, multi ? t('group.title', { n: cells.length }) : ''),
    h('div', { class: 'tools' }, refreshBtn, copyBtn));
  const optsBox = h('details', { class: 'opts' },
    h('summary', null, t('group.options')),
    h('div', { class: 'opts-grid' }, groupFields(opts, () => { actions.onChange(); schedule(); }, multi)));
  const side = h('aside', { class: 'group-side' }, h('div', { class: 'side-panel' }, sideHead, stage, err, meta, optsBox));

  function show(res) {
    current = res;
    err.style.display = 'none'; img.style.opacity = '';
    if (!res) { img.style.display = 'none'; empty.style.display = ''; meta.textContent = ''; return; }
    const hex = (cells[0].opts.color || '#000000').replace('#', '');
    const lum = (0.299 * parseInt(hex.slice(0, 2), 16) + 0.587 * parseInt(hex.slice(2, 4), 16) + 0.114 * parseInt(hex.slice(4, 6), 16)) / 255;
    stage.dataset.checker = !opts.transparent ? 'light' : (!multi && lum > 0.6 ? 'dark' : 'light');
    img.src = res.url;
    img.style.width = res.cssW + 'px'; // 칸보다 크면 CSS(max-width:100%)가 비율을 유지하며 줄여요
    img.style.display = 'block';
    empty.style.display = 'none';
    const parts = [t('status.size', { w: res.pxW, h: res.pxH })];
    res.notices.forEach((n) => parts.push(t(n.key, n.vars)));
    meta.textContent = parts.join(' · ');
  }

  /* ----- 이미지 만들기 ----- */
  function update(force) {
    const my = ++seq;
    const run = (async () => {
      refreshBtn.classList.add('spin');
      const items = cells.filter((c) => c.code.trim() && (c.type === 'math' || c.include));
      const settled = await Promise.all(items.map((c) => getLayer(c, settings, force).then((l) => ({ c, l }), (e) => ({ c, e }))));
      if (my !== seq) return;

      const errs = [];
      cells.forEach((c) => {
        const s = settled.find((x) => x.c === c);
        const msg = s && s.e ? errText(s.e) : '';
        const ctrl = ctrls.get(c.id);
        if (ctrl) ctrl.setError(msg);
        if (msg) errs.push(cellLabel(c, numbers.get(c.id)) + ': ' + msg);
      });
      if (errs.length) {
        err.textContent = errs.join('\n'); err.style.display = 'block'; img.style.opacity = '0.35';
        return;
      }
      const layers = settled.map((s) => s.l).filter(Boolean);
      if (!layers.length) { show(null); lastKey = null; return; }

      const key = JSON.stringify([layers.map((l) => l.key), opts]);
      if (key === lastKey && current && !force) { show(current); return; }
      const res = await composePng(layers, opts);
      if (my !== seq) { URL.revokeObjectURL(res.url); return; }
      const old = current;
      lastKey = key;
      show(res);
      if (old && old.url) setTimeout(() => URL.revokeObjectURL(old.url), 1500);
    })().catch((e) => { if (my === seq) { err.textContent = errText(e); err.style.display = 'block'; img.style.opacity = '0.35'; } })
      .finally(() => { if (my === seq) refreshBtn.classList.remove('spin'); });
    updating = run;
    return run;
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => { timer = null; update(false); }, 250); }
  function flush() { if (timer) { clearTimeout(timer); timer = null; update(false); } }

  async function copyGroup() {
    flush();
    await Promise.resolve();
    copyPng((async () => {
      await updating;
      if (!current) throw new Error(err.textContent || t('status.copyEmpty'));
      return current.blob;
    })());
  }

  function copyCell(cell) {
    copyPng((async () => {
      const layer = await getLayer(cell, settings);
      if (!layer) throw new Error(t('status.copyEmpty'));
      const r = await composePng([layer], { dpr: opts.dpr, gap: 0, pad: 0, transparent: true, noUrl: true });
      return r.blob;
    })());
  }

  img.addEventListener('dragstart', (e) => {
    if (!current) return;
    try { e.dataTransfer.setData('DownloadURL', 'image/png:formula.png:' + img.src); } catch (err2) { /* ignore */ }
  });

  /* ----- 왼쪽: 셀들 ----- */
  const cellsCol = h('div', { class: 'group-cells' });
  cells.forEach((cell, i) => {
    const gi = startIndex + i;
    const ctx = {
      settings, number: numbers.get(cell.id), isFirst: gi === 0, isLast: gi === total - 1,
      actions: {
        onChange: actions.onChange,
        changed: schedule,
        refreshCell: () => { invalidateLayer(cell.id); update(false); },
        copyCell: () => copyCell(cell),
        move: actions.move, duplicate: actions.duplicate, remove: actions.remove, runNext: actions.runNext,
      },
    };
    const ctrl = cell.type === 'math' ? createMathCell(cell, ctx) : createTextCell(cell, ctx);
    ctrls.set(cell.id, ctrl);
    cellsCol.appendChild(ctrl.el);
    if (i < cells.length - 1) cellsCol.appendChild(insertBar(gi + 1));
  });

  const el = h('section', { class: 'group' + (multi ? ' multi' : ''), dataset: { gid: cells[0].group } },
    cellsCol, multi ? makeBrace() : null, side);

  return {
    el, ctrls, update, schedule,
    destroy() {
      clearTimeout(timer);
      ctrls.forEach((c) => c.destroy());
      if (current && current.url) URL.revokeObjectURL(current.url);
    },
  };
}
