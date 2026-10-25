// 셀 하나(수식/텍스트)의 화면과 동작. 이미지 만들기와 미리보기는 group.js 가 맡아요.
import { h, icon, styleFields } from './ui.js';
import { t } from './i18n.js';
import { createEditor } from './editor.js';
import { hasTopLevelAmp, isSingleEnvironment } from './render.js';
import { makeDraggable } from './dnd.js';

export function cellLabel(cell, number) {
  return cell.name || (t(cell.type === 'math' ? 'cell.math' : 'cell.text') + ' ' + number);
}

function buildHeader(cell, ctx, extraTools, toggle) {
  const a = ctx.actions;
  const defaultLabel = t(cell.type === 'math' ? 'cell.math' : 'cell.text') + ' ' + ctx.number;
  const tool = (name, key, fn, disabled) => h('button', {
    class: 'tool', type: 'button', title: t(key), 'aria-label': t(key), disabled, onClick: fn,
  }, icon(name));

  const chev = h('button', { class: 'tool chev', type: 'button', title: t('cell.collapse'), 'aria-label': t('cell.collapse'), 'aria-expanded': String(!cell.collapsed), onClick: toggle }, icon('chev'));
  const title = h('span', { class: 'title', title: t('cell.renameHint') }, cell.name || defaultLabel);
  const summary = h('span', { class: 'summary' });

  function startRename() {
    if (el.querySelector('.rename')) return;
    const input = h('input', { class: 'rename', value: cell.name || defaultLabel, maxlength: '40', 'aria-label': t('cell.rename') });
    title.replaceWith(input);
    input.focus(); input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      if (save) { const v = input.value.trim(); cell.name = (!v || v === defaultLabel) ? '' : v; a.onChange(); }
      title.textContent = cell.name || defaultLabel;
      input.replaceWith(title);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  }
  title.addEventListener('dblclick', (e) => { e.preventDefault(); startRename(); });

  const el = h('header', { class: 'cell-head' },
    chev, title, tool('edit', 'cell.rename', startRename), summary,
    h('div', { class: 'tools' },
      extraTools,
      tool('up', 'cell.moveUp', () => a.move(cell.id, -1), ctx.isFirst),
      tool('down', 'cell.moveDown', () => a.move(cell.id, 1), ctx.isLast),
      tool('dup', 'cell.duplicate', () => a.duplicate(cell.id)),
      tool('trash', 'cell.delete', () => a.remove(cell.id))));
  // 제목줄의 빈 곳을 눌러도 접고 펼 수 있어요 (제목 글자는 더블클릭 = 이름 바꾸기)
  el.addEventListener('click', (e) => { if (!e.target.closest('button, input, .title')) toggle(); });

  const updateSummary = () => {
    const first = (cell.code || '').split('\n').find((l) => l.trim());
    summary.textContent = cell.collapsed ? (first ? first.trim() : t('cell.emptyCode')) : '';
  };
  const updateChev = () => {
    chev.setAttribute('aria-expanded', String(!cell.collapsed));
    const key = cell.collapsed ? 'cell.expand' : 'cell.collapse';
    chev.title = t(key); chev.setAttribute('aria-label', t(key));
  };
  updateSummary();
  return { el, tool, updateSummary, updateChev };
}

function makeNote() {
  const el = h('div', { class: 'cell-note', role: 'status' });
  const state = { error: '', warn: '' };
  const paint = () => {
    el.textContent = state.error || state.warn;
    el.className = 'cell-note' + (state.error ? ' is-err' : state.warn ? ' warn' : '');
    el.style.display = (state.error || state.warn) ? 'block' : 'none';
  };
  paint();
  return { el, setError: (m) => { state.error = m || ''; paint(); }, setWarn: (m) => { state.warn = m || ''; paint(); } };
}

export function createMathCell(cell, ctx) {
  const a = ctx.actions;
  let view = null;
  const note = makeNote();

  const toggle = () => {
    cell.collapsed = !cell.collapsed;
    root.classList.toggle('collapsed', cell.collapsed);
    head.updateSummary(); head.updateChev();
    a.onChange();
    if (!cell.collapsed && view) view.requestMeasure();
  };
  const refreshBtn = h('button', { class: 'tool', type: 'button', title: t('cell.refresh'), 'aria-label': t('cell.refresh'), onClick: () => a.refreshCell() }, icon('refresh'));
  const copyBtn = h('button', { class: 'tool', type: 'button', title: t('cell.copy'), 'aria-label': t('cell.copy'), onClick: () => a.copyCell() }, icon('copy'));
  const head = buildHeader(cell, ctx, [refreshBtn, copyBtn], toggle);

  // $$ \begin{aligned} ... \end{aligned} $$  — aligned 를 누르면 gathered 로 바뀌어요
  const mkChip = () => h('button', { class: 'chip', type: 'button', onClick: () => {
    if (isSingleEnvironment(cell.code)) return;
    cell.wrap = cell.wrap === 'aligned' ? 'gathered' : 'aligned';
    paintWrap(); a.onChange(); a.changed();
  } });
  const chipTop = mkChip(); const chipBottom = mkChip();
  function paintWrap() {
    const skip = isSingleEnvironment(cell.code);
    [chipTop, chipBottom].forEach((c) => {
      c.textContent = cell.wrap;
      c.classList.toggle('off', skip);
      c.setAttribute('aria-disabled', String(skip));
      c.title = skip ? t('cell.wrapSkipped') : t('cell.wrapToggle', { to: cell.wrap === 'aligned' ? 'gathered' : 'aligned' });
    });
    note.setWarn(!skip && cell.wrap === 'gathered' && hasTopLevelAmp(cell.code) ? t('cell.wrapGatheredAmp') : '');
  }

  const host = h('div', { class: 'cm-host' });
  const root = h('article', { class: 'cell math' + (cell.collapsed ? ' collapsed' : ''), dataset: { id: cell.id } },
    head.el,
    h('div', { class: 'cell-body' },
      h('div', { class: 'code' },
        h('div', { class: 'fence' }, h('span', { class: 'dl' }, '$$'), h('span', { class: 'kw' }, '\\begin{'), chipTop, h('span', { class: 'kw' }, '}')),
        host,
        h('div', { class: 'fence' }, h('span', { class: 'kw' }, '\\end{'), chipBottom, h('span', { class: 'kw' }, '}'), h('span', { class: 'dl' }, '$$'))),
      note.el,
      h('details', { class: 'opts' },
        h('summary', null, t('cell.styleOptions')),
        h('div', { class: 'opts-grid' }, styleFields(cell.opts, () => { a.onChange(); a.changed(); }, false)))));

  paintWrap();
  view = createEditor(host, {
    doc: cell.code,
    onChange: (code) => { cell.code = code; head.updateSummary(); paintWrap(); a.onChange(); a.changed(); },
    onRun: () => a.refreshCell(),
    onRunNext: () => { a.refreshCell(); a.runNext(cell.id); },
  });
  makeDraggable(head.el, root, cell.id);

  return {
    el: root,
    focus: () => view.focus(),
    setCollapsed(v) { if (cell.collapsed !== v) toggle(); },
    setError: note.setError,
    destroy: () => view.destroy(),
  };
}

export function createTextCell(cell, ctx) {
  const a = ctx.actions;
  const note = makeNote();
  const toggle = () => {
    cell.collapsed = !cell.collapsed;
    root.classList.toggle('collapsed', cell.collapsed);
    head.updateSummary(); head.updateChev();
    a.onChange();
    if (!cell.collapsed) fit();
  };
  const refreshBtn = h('button', { class: 'tool', type: 'button', title: t('cell.refresh'), 'aria-label': t('cell.refresh'), onClick: () => a.refreshCell() }, icon('refresh'));
  const copyBtn = h('button', { class: 'tool', type: 'button', title: t('cell.copy'), 'aria-label': t('cell.copy'), onClick: () => a.copyCell() }, icon('copy'));
  const head = buildHeader(cell, ctx, [refreshBtn, copyBtn], toggle);

  const area = h('textarea', {
    class: 'note', rows: '2', spellcheck: 'false',
    placeholder: t('cell.textPlaceholder'), value: cell.code, 'aria-label': t('cell.text'),
  });
  const fit = () => { area.style.height = 'auto'; area.style.height = area.scrollHeight + 2 + 'px'; };
  area.addEventListener('input', () => { cell.code = area.value; head.updateSummary(); a.onChange(); a.changed(); fit(); });
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); a.runNext(cell.id); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); a.refreshCell(); }
  });

  const include = h('input', { type: 'checkbox', checked: cell.include, onChange: (e) => { cell.include = e.target.checked; a.onChange(); a.changed(); } });
  const root = h('article', { class: 'cell text' + (cell.collapsed ? ' collapsed' : ''), dataset: { id: cell.id } },
    head.el,
    h('div', { class: 'cell-body' },
      area, note.el,
      h('details', { class: 'opts' },
        h('summary', null, t('cell.styleOptions')),
        h('div', { class: 'opts-grid' },
          styleFields(cell.opts, () => { a.onChange(); a.changed(); }, true),
          h('label', { class: 'opt' }, h('span', null, t('cell.include')), h('span', { class: 'row' }, include))))));
  makeDraggable(head.el, root, cell.id);
  requestAnimationFrame(fit);

  return {
    el: root,
    focus: () => { area.focus(); fit(); },
    setCollapsed(v) { if (cell.collapsed !== v) toggle(); },
    setError: note.setError,
    destroy: () => {},
  };
}
