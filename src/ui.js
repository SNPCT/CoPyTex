// 작은 UI 도우미: DOM 생성(h), 아이콘, 토스트, 이미지 옵션 입력칸.
import { t } from './i18n.js';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c === undefined || c === null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}

const ICONS = {
  chev: '<path d="m9 18 6-6-6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  unlink: '<path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><path d="M8 2v3M2 8h3M16 19v3M19 16h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  dup: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  fold: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
  unfold: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
};

export function icon(name) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  return span;
}

let toastTimer;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---- 옵션 입력칸 ----
const field = (label, ...ctrl) => h('label', { class: 'opt' }, h('span', null, label), h('span', { class: 'row' }, ...ctrl));

function numberInput(opts, key, min, max, step, onChange) {
  return h('input', {
    type: 'number', min, max, step, value: opts[key],
    onInput: (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) { opts[key] = v; onChange(); } },
  });
}
function bgControls(opts, onChange) {
  const tr = h('input', { type: 'checkbox', checked: !!opts.transparent, onChange: (e) => { opts.transparent = e.target.checked; onChange(); } });
  const bg = h('input', {
    type: 'color', value: opts.bg,
    onInput: (e) => { opts.bg = e.target.value; opts.transparent = false; tr.checked = false; onChange(); },
  });
  return [bg, h('label', { class: 'inline' }, tr, t('opt.transparent'))];
}

// 셀 하나의 글자 옵션 (수식/텍스트 공통, 텍스트는 줄바꿈 너비가 더 있어요)
export function styleFields(opts, onChange, withWidth) {
  const color = h('input', { type: 'color', value: opts.color, onInput: (e) => { opts.color = e.target.value; onChange(); } });
  const out = [
    field(t('opt.color'), color),
    field(t('opt.bg'), ...bgControls(opts, onChange)),
    field(t('opt.pad'), numberInput(opts, 'pad', 0, 200, 2, onChange)),
    field(t('opt.fs'), numberInput(opts, 'fs', 8, 200, 2, onChange)),
  ];
  if (withWidth) out.push(field(t('opt.width'), numberInput(opts, 'width', 0, 4000, 10, onChange)));
  return out;
}

// 묶음 이미지 옵션 (해상도, 항목 간격, 바깥 여백, 배경)
export function groupFields(opts, onChange, showGap) {
  const dpr = h('select', { onChange: (e) => { opts.dpr = +e.target.value; onChange(); } },
    [1, 2, 3, 4].map((n) => h('option', { value: String(n) }, n + 'x')));
  dpr.value = String(opts.dpr);
  const out = [field(t('opt.dpr'), dpr)];
  if (showGap) out.push(field(t('opt.gap'), numberInput(opts, 'gap', 0, 200, 2, onChange)));
  out.push(field(t('opt.groupPad'), numberInput(opts, 'pad', 0, 200, 2, onChange)));
  out.push(field(t('opt.bg'), ...bgControls(opts, onChange)));
  return out;
}

// 클릭 직후에 클립보드 요청을 시작하고 이미지는 약속(Promise)으로 넘겨요. (렌더링이 길어도 권한이 유지돼요)
export async function copyPng(blobPromise) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
    toast(t('status.copied'));
  } catch (e) {
    toast(e && e.name === 'NotAllowedError' ? t('status.copyDenied') : t('status.copyFailed', { msg: (e && e.message) || e }));
  }
}
